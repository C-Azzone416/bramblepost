// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALL_KEYS,
  CURRENT_VERSION,
  MIGRATIONS,
  DOOR_KEY,
  STARS_KEY,
  VERSION_KEY,
  VILLAGE_KEY,
  loadAll,
  localStorageAdapter,
  memoryAdapter,
  migrate,
  resetProgress,
  saveVersion,
  setAdapter,
  type StorageAdapter,
} from "../src/save";
import { loadSave, persist, recordBest } from "../src/ui/save";
import { loadVillage, markStamped } from "../src/village/save";
import { loadDoorSave, setFlag } from "../src/door/save";

// Saves as written before versions existed. These must keep loading unchanged.
const STARS_FIXTURE = '{"best":{"primrose":{"stars":3,"moves":12},"clover":{"stars":1,"moves":30}}}';
const VILLAGE_FIXTURE = '{"stamped":["primrose"],"replies":{"primrose":"kind"}}';
const DOOR_FIXTURE = '{"flags":{"clementine.sisterNote":"read"},"voices":false}';

function oldSaves() {
  return memoryAdapter({ [STARS_KEY]: STARS_FIXTURE, [VILLAGE_KEY]: VILLAGE_FIXTURE, [DOOR_KEY]: DOOR_FIXTURE });
}

const blocked: StorageAdapter = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

beforeEach(() => {
  localStorage.clear();
  setAdapter(localStorageAdapter());
});

describe("existing saves load unchanged", () => {
  it("loads all three keys from fixtures", () => {
    setAdapter(oldSaves());
    expect(loadSave()).toEqual(JSON.parse(STARS_FIXTURE));
    expect(loadVillage()).toEqual(JSON.parse(VILLAGE_FIXTURE));
    expect(loadDoorSave()).toEqual(JSON.parse(DOOR_FIXTURE));
    expect(loadAll()).toEqual({
      version: CURRENT_VERSION,
      stars: JSON.parse(STARS_FIXTURE),
      village: JSON.parse(VILLAGE_FIXTURE),
      door: JSON.parse(DOOR_FIXTURE),
    });
  });

  it("migrating leaves the stored data byte for byte alone", () => {
    const a = oldSaves();
    setAdapter(a);
    loadSave();
    expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE);
    expect(a.getItem(VILLAGE_KEY)).toBe(VILLAGE_FIXTURE);
    expect(a.getItem(DOOR_KEY)).toBe(DOOR_FIXTURE);
  });

  it("loads fixtures through real localStorage too", () => {
    localStorage.setItem(STARS_KEY, STARS_FIXTURE);
    localStorage.setItem(VILLAGE_KEY, VILLAGE_FIXTURE);
    localStorage.setItem(DOOR_KEY, DOOR_FIXTURE);
    expect(loadSave().best.primrose).toEqual({ stars: 3, moves: 12 });
    expect(loadVillage().stamped).toEqual(["primrose"]);
    expect(loadDoorSave().voices).toBe(false);
  });

  it("keeps the key names", () => {
    expect([STARS_KEY, VILLAGE_KEY, DOOR_KEY]).toEqual([
      "bramblepost-playtest-v1",
      "bramblepost-village-v1",
      "bramblepost-door-v1",
    ]);
  });
});

describe("versions and migrate", () => {
  it("treats a save with no version key as version 0, then stamps it", () => {
    const a = oldSaves();
    expect(saveVersion(a)).toBe(0);
    migrate(a);
    expect(saveVersion(a)).toBe(CURRENT_VERSION);
    expect(a.getItem(VERSION_KEY)).toBe(String(CURRENT_VERSION));
  });

  it("runs on first read and on first write", () => {
    const a = oldSaves();
    setAdapter(a);
    loadSave();
    expect(saveVersion(a)).toBe(CURRENT_VERSION);

    const b = memoryAdapter();
    setAdapter(b);
    recordBest({ best: {} }, "primrose", 2, 9);
    expect(saveVersion(b)).toBe(CURRENT_VERSION);
  });

  it("leaves a newer save's version alone", () => {
    const a = memoryAdapter({ [VERSION_KEY]: String(CURRENT_VERSION + 1) });
    migrate(a);
    expect(a.getItem(VERSION_KEY)).toBe(String(CURRENT_VERSION + 1));
  });

  it("a first write runs pending migrations before writing", () => {
    const a = memoryAdapter({ [STARS_KEY]: STARS_FIXTURE });
    setAdapter(a);
    const original = MIGRATIONS[0];
    const step = vi.fn(() => {
      expect(a.getItem("bramblepost-new")).toBeNull();
    });
    MIGRATIONS[0] = step;
    try {
      persist({ best: {} });
    } finally {
      MIGRATIONS[0] = original;
    }
    expect(step).toHaveBeenCalledTimes(1);
    expect(saveVersion(a)).toBe(CURRENT_VERSION);
    expect(a.getItem(STARS_KEY)).toBe('{"best":{}}');
  });

  it("a newer stored version blocks writes but not reads", () => {
    const newer = String(CURRENT_VERSION + 1);
    const a = memoryAdapter({ [STARS_KEY]: STARS_FIXTURE, [VERSION_KEY]: newer });
    setAdapter(a);
    persist({ best: {} });
    markStamped(["primrose"]);
    setFlag(loadDoorSave(), "a", "b");
    expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE);
    expect(a.getItem(VILLAGE_KEY)).toBeNull();
    expect(a.getItem(DOOR_KEY)).toBeNull();
    expect(a.getItem(VERSION_KEY)).toBe(newer);
    expect(loadSave()).toEqual(JSON.parse(STARS_FIXTURE));
  });

  it("writes round-trip through the adapter", () => {
    const a = memoryAdapter();
    setAdapter(a);
    const s = loadSave();
    recordBest(s, "primrose", 3, 10);
    markStamped(["primrose"]);
    setFlag(loadDoorSave(), "a.b", "c");
    expect(JSON.parse(a.getItem(STARS_KEY)!)).toEqual({ best: { primrose: { stars: 3, moves: 10 } } });
    expect(loadVillage().stamped).toEqual(["primrose"]);
    expect(loadDoorSave().flags).toEqual({ "a.b": "c" });
  });
});

describe("blocked storage", () => {
  it("never throws and falls back to empty saves", () => {
    setAdapter(blocked);
    expect(() => {
      loadSave();
      persist({ best: {} });
      loadVillage();
      markStamped(["primrose"]);
      loadDoorSave();
      setFlag(loadDoorSave(), "a", "b");
      loadAll();
      migrate();
      resetProgress();
    }).not.toThrow();
    expect(loadSave()).toEqual({ best: {} });
    expect(loadVillage()).toEqual({ stamped: [] });
    expect(loadDoorSave()).toEqual({ flags: {}, voices: true });
  });

  it("the localStorage adapter survives a localStorage that throws", () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, "localStorage")!;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      const a = localStorageAdapter();
      expect(a.getItem("x")).toBeNull();
      expect(() => {
        a.setItem("x", "1");
        a.removeItem("x");
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", real);
    }
  });
});

describe("resetProgress", () => {
  it("clears every bramblepost key", () => {
    const a = oldSaves();
    setAdapter(a);
    loadSave(); // stamps the version
    resetProgress();
    for (const k of ALL_KEYS) expect(a.getItem(k)).toBeNull();
    expect(a.data.size).toBe(0);
    expect(loadAll().stars).toEqual({ best: {} });
  });

  it("clears real localStorage by default and leaves other keys", () => {
    localStorage.setItem(STARS_KEY, STARS_FIXTURE);
    localStorage.setItem("something-else", "keep");
    resetProgress();
    expect(localStorage.getItem(STARS_KEY)).toBeNull();
    expect(localStorage.getItem("something-else")).toBe("keep");
  });
});
