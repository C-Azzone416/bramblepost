// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALL_KEYS,
  CURRENT_VERSION,
  PREFS_KEY,
  MIGRATIONS,
  DOOR_KEY,
  ENDING_KEY,
  SOUND_KEY,
  STARS_KEY,
  VERSION_KEY,
  VILLAGE_KEY,
  loadAll,
  localStorageAdapter,
  keysFor,
  memoryAdapter,
  migrate,
  resetProgress,
  saveVersion,
  setAdapter,
  type KeySet,
  type StorageAdapter,
} from "../src/save";
import { NEIGHBOURHOODS } from "../src/village/data";
import { RETIRED_SPRING_ROUTES } from "../src/village/progress";
import { villageProgress } from "../src/village/progress";
import { loadMuted, saveMuted } from "../src/ui/soundPref";
import { loadSave, persist, recordBest } from "../src/ui/save";
import { loadVillage, markStamped } from "../src/village/save";
import { loadDoorSave, setFlag } from "../src/door/save";

// Saves as written before versions existed. These must keep loading unchanged.
const STARS_FIXTURE = '{"best":{"primrose":{"stars":3,"moves":12},"millpond":{"stars":1,"moves":30}}}';
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
      expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE); // runs before the write lands
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

  it("an unreadable version blocks writes", () => {
    for (const bad of ["throw", "garbage"]) {
      const a = memoryAdapter({ [STARS_KEY]: STARS_FIXTURE, [VERSION_KEY]: "garbage" });
      const wrapped: StorageAdapter =
        bad === "throw"
          ? {
              getItem: (k) => {
                if (k === VERSION_KEY) throw new Error("transient");
                return a.getItem(k);
              },
              setItem: (k, v) => a.setItem(k, v),
              removeItem: (k) => a.removeItem(k),
            }
          : a;
      expect(saveVersion(wrapped)).toBeNull();
      setAdapter(wrapped);
      persist({ best: {} });
      markStamped(["primrose"]);
      expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE);
      expect(a.getItem(VILLAGE_KEY)).toBeNull();
      expect(a.getItem(VERSION_KEY)).toBe("garbage");
      expect(loadSave()).toEqual(JSON.parse(STARS_FIXTURE)); // reads still work
    }
  });

  it("a migration that throws blocks the following write", () => {
    const a = memoryAdapter({ [STARS_KEY]: STARS_FIXTURE });
    setAdapter(a);
    const original = MIGRATIONS[0];
    MIGRATIONS[0] = () => {
      throw new Error("half way");
    };
    try {
      expect(migrate(a).ok).toBe(false);
      persist({ best: {} });
    } finally {
      MIGRATIONS[0] = original;
    }
    expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE);
    expect(a.getItem(VERSION_KEY)).toBeNull();
    persist({ best: {} }); // migration works again: writes resume
    expect(a.getItem(STARS_KEY)).toBe('{"best":{}}');
    expect(saveVersion(a)).toBe(CURRENT_VERSION);
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

describe("localStorage adapter errors", () => {
  function withStorage(fake: object, fn: () => void) {
    const real = Object.getOwnPropertyDescriptor(globalThis, "localStorage")!;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: fake });
    try {
      fn();
    } finally {
      Object.defineProperty(globalThis, "localStorage", real);
    }
  }

  it("a failing version read on real-path storage blocks writes", () => {
    const data = new Map<string, string>([[STARS_KEY, STARS_FIXTURE]]);
    const fake = {
      getItem: (k: string) => {
        if (k === VERSION_KEY) throw new Error("transient");
        return data.get(k) ?? null;
      },
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    withStorage(fake, () => {
      setAdapter(localStorageAdapter());
      expect(saveVersion()).toBeNull();
      expect(() => {
        persist({ best: {} });
        markStamped(["primrose"]);
      }).not.toThrow();
      expect(data.get(STARS_KEY)).toBe(STARS_FIXTURE);
      expect(data.has(VILLAGE_KEY)).toBe(false);
      expect(data.has(VERSION_KEY)).toBe(false);
      expect(loadSave()).toEqual(JSON.parse(STARS_FIXTURE));
    });
  });

  it("the adapter propagates storage errors", () => {
    const boom = () => {
      throw new Error("x");
    };
    withStorage({ getItem: boom, setItem: boom, removeItem: boom }, () => {
      const a = localStorageAdapter();
      expect(() => a.getItem("k")).toThrow();
      expect(() => a.setItem("k", "v")).toThrow();
      expect(() => a.removeItem("k")).toThrow();
      expect(resetProgress(a)).toBe(false);
    });
  });
});

describe("resetProgress", () => {
  it("clears every bramblepost key", () => {
    const a = oldSaves();
    setAdapter(a);
    loadSave(); // stamps the version
    expect(resetProgress()).toBe(true);
    for (const k of ALL_KEYS) expect(a.getItem(k)).toBeNull();
    expect(a.data.size).toBe(0);
    expect(loadAll().stars).toEqual({ best: {} });
  });

  it("clears the sound mute", () => {
    const a = oldSaves();
    setAdapter(a);
    saveMuted(true);
    expect(loadMuted()).toBe(true);
    expect(ALL_KEYS).toContain(SOUND_KEY);
    resetProgress();
    expect(a.getItem(SOUND_KEY)).toBeNull();
    expect(loadMuted()).toBe(false);
  });

  it("clears real localStorage by default and leaves other keys", () => {
    localStorage.setItem(STARS_KEY, STARS_FIXTURE);
    localStorage.setItem("something-else", "keep");
    resetProgress();
    expect(localStorage.getItem(STARS_KEY)).toBeNull();
    expect(localStorage.getItem("something-else")).toBe("keep");
  });

  it("a failed data removal keeps the version key and returns false", () => {
    const newer = String(CURRENT_VERSION + 1);
    const a = memoryAdapter({ [STARS_KEY]: STARS_FIXTURE, [VILLAGE_KEY]: VILLAGE_FIXTURE, [VERSION_KEY]: newer });
    const flaky: StorageAdapter = {
      getItem: (k) => a.getItem(k),
      setItem: (k, v) => a.setItem(k, v),
      removeItem: (k) => {
        if (k === STARS_KEY) throw new Error("stuck");
        a.removeItem(k);
      },
    };
    expect(resetProgress(flaky)).toBe(false);
    expect(a.getItem(STARS_KEY)).toBe(STARS_FIXTURE);
    expect(a.getItem(VERSION_KEY)).toBe(newer);
    expect(a.getItem(VILLAGE_KEY)).toBeNull(); // other data keys are still cleared
  });
});

describe("per-pack save keys", () => {
  const std = keysFor("standard");
  const progress = (k: KeySet) => k.ALL_KEYS.filter((x) => x !== SOUND_KEY && x !== PREFS_KEY);

  it("standard keys are the original strings", () => {
    expect([std.STARS_KEY, std.VILLAGE_KEY, std.DOOR_KEY, std.SOUND_KEY, std.PREFS_KEY, std.LETTERS_KEY, std.CURRENT_VILLAGE_KEY, std.ENDING_KEY, std.VERSION_KEY]).toEqual([
      "bramblepost-playtest-v1", "bramblepost-village-v1", "bramblepost-door-v1", "bramblepost-sound-v1", "bramblepost-prefs-v1",
      "bramblepost-letters-v1", "bramblepost-current-village-v1", "bramblepost-ending-v1", "bramblepost-save-version",
    ]);
  });

  it("progress keys are disjoint across packs", () => {
    const sets = [std, keysFor("stand-in"), keysFor("story")].map((k) => new Set(progress(k)));
    expect(sets.map((s) => s.size)).toEqual([8, 8, 8]);
    const all = sets.flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("sound and prefs are shared", () => {
    for (const m of ["stand-in", "story"] as const) {
      expect(keysFor(m).SOUND_KEY).toBe(std.SOUND_KEY);
      expect(keysFor(m).PREFS_KEY).toBe(std.PREFS_KEY);
    }
  });

  it("a reset in one pack leaves other packs' progress intact", () => {
    const a = memoryAdapter();
    const other = [std, keysFor("story")];
    for (const k of [...other.flatMap(progress), ...keysFor("stand-in").ALL_KEYS]) a.setItem(k, "x");
    expect(resetProgress(a, keysFor("stand-in"))).toBe(true);
    for (const k of other.flatMap(progress)) expect(a.getItem(k)).toBe("x");
    for (const k of progress(keysFor("stand-in"))) expect(a.getItem(k)).toBeNull();
  });
});


describe("spring trim migration (save version 1 -> 2)", () => {
  const spring = NEIGHBOURHOODS[0].routes;
  const kept = Object.fromEntries(spring.map((id, i) => [id, { stars: i % 3 + 1, moves: i + 5 }]));
  const retired = Object.fromEntries(RETIRED_SPRING_ROUTES.map((id) => [id, { stars: 3, moves: 8 }]));
  const prior = (best: object, seen = true) => memoryAdapter({
    [VERSION_KEY]: "1", [STARS_KEY]: JSON.stringify({ best }), [ENDING_KEY]: JSON.stringify({ seen }),
  });

  it("keeps exact bests on retained routes and other villages, dropping every cut route", () => {
    const best = { primrose: kept.primrose, future: { stars: 2, moves: 12 } };
    const a = prior({ ...best, ...retired }, false);
    setAdapter(a);
    expect(loadSave()).toEqual({ best });
    expect(villageProgress(loadSave().best).hoods[0].stamps).toBe(1);
    expect(a.getItem(ENDING_KEY)).toBe('{"seen":false}');
    expect(saveVersion(a)).toBe(CURRENT_VERSION);
  });

  it("a save finished on all 15 old routes keeps every surviving lane stamped and its ending seen", () => {
    const a = prior({ ...kept, ...retired });
    a.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ["clover"], replies: { primrose: "read" } }));
    setAdapter(a);
    const p = villageProgress(loadSave().best);
    expect(loadSave().best).toEqual(kept);
    expect(p.hoods[0].lanes.every((l) => l.state === "done")).toBe(true);
    expect(p.hoods[0].stamps).toBe(spring.length);
    expect(p.hoods[1].state).toBe("soon");
    expect(p.today).toBeNull();
    expect(loadVillage()).toEqual({ stamped: spring, replies: { primrose: "read" } });
    expect(a.getItem(ENDING_KEY)).toBe('{"seen":true}');
  });

  it("does not mark an unseen ending seen for a completed old spring", () => {
    const a = prior({ ...kept, ...retired }, false);
    migrate(a);
    expect(a.getItem(ENDING_KEY)).toBe('{"seen":false}');
  });

  it("leaves new saves empty and current saves unchanged", () => {
    const fresh = memoryAdapter();
    setAdapter(fresh);
    expect(loadSave()).toEqual({ best: {} });
    expect(loadVillage()).toEqual({ stamped: [] });
    expect(fresh.getItem(ENDING_KEY)).toBeNull();
    expect(fresh.data.size).toBe(1); // version only
    const a = prior(kept);
    a.setItem(VERSION_KEY, String(CURRENT_VERSION));
    const before = new Map(a.data);
    expect(migrate(a).ok).toBe(true);
    expect(a.data).toEqual(before);
  });

  it("retries safely if writing stamps, stars or the version fails", () => {
    for (const failKey of [VILLAGE_KEY, STARS_KEY, VERSION_KEY]) {
      const a = prior({ ...kept, ...retired });
      let fail = true;
      const flaky: StorageAdapter = { ...a, setItem: (key, value) => {
        if (fail && key === failKey) throw new Error("blocked");
        a.setItem(key, value);
      } };
      expect(migrate(flaky).ok).toBe(false);
      expect(saveVersion(a)).toBe(1);
      fail = false;
      expect(migrate(flaky).ok).toBe(true);
      setAdapter(a);
      expect(loadSave().best).toEqual(kept);
      expect(loadVillage().stamped).toEqual(spring);
      expect(a.getItem(ENDING_KEY)).toBe('{"seen":true}');
    }
  });
});
