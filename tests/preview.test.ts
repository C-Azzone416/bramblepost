// @vitest-environment jsdom
/**
 * Preview tools (#120): jumps play on a scratch save and never write the real one, every season's village map
 * can be opened (even ones with no routes yet), any route opens directly, and a production build has none of it.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { ACTIVE_KEYS, getAdapter, localStorageAdapter, memoryAdapter, setAdapter } from "../src/save";
import { NEIGHBOURHOODS } from "../src/village/data";
import { villageProgress } from "../src/village/progress";
import {
  SCRATCH_PREFIX,
  SESSION_KEY,
  SNAPSHOT_KEY,
  bootPreview,
  needsOpenAll,
  readSession,
  readSnapshot,
  scratchAdapter,
  seedVillage,
  snapshot,
  writeSession,
  type Preview,
} from "../src/preview";

const $ = (id: string) => document.getElementById(id)!;
const K = ACTIVE_KEYS;
const spring = NEIGHBOURHOODS[0];

/** A real save part way through spring: first two routes done. */
const REAL: Record<string, string> = {
  [K.VERSION_KEY]: "1",
  [K.STARS_KEY]: JSON.stringify({ best: { primrose: { stars: 2, moves: 9 }, clover: { stars: 3, moves: 7 } } }),
  [K.VILLAGE_KEY]: JSON.stringify({ stamped: ["primrose", "clover"] }),
};

function sessionStore() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

/** The real save's keys only (nothing the preview tools own), as stored. */
const realKeys = (data: Map<string, string>) => Object.fromEntries([...data].filter(([k]) => !k.startsWith(SCRATCH_PREFIX)));

describe("scratch save helpers", () => {
  it("keeps the whole scratch save in one value and never touches another key", () => {
    const base = memoryAdapter({ [K.STARS_KEY]: "real" });
    const s = scratchAdapter(base);
    expect(s.getItem(K.STARS_KEY)).toBeNull();
    s.setItem(K.STARS_KEY, "scratch");
    s.setItem(K.VERSION_KEY, "1");
    expect(base.data.get(K.STARS_KEY)).toBe("real");
    expect([...base.data.keys()].sort()).toEqual([K.STARS_KEY, SNAPSHOT_KEY].sort());
    expect(readSnapshot(base)).toEqual({ [K.STARS_KEY]: "scratch", [K.VERSION_KEY]: "1" });
    s.removeItem(K.STARS_KEY);
    expect(s.getItem(K.STARS_KEY)).toBeNull();
    expect(s.getItem(K.VERSION_KEY)).toBe("1");
    expect(base.data.get(K.STARS_KEY)).toBe("real");
  });

  it("reads a missing or damaged snapshot as empty", () => {
    const base = memoryAdapter();
    expect(readSnapshot(base)).toEqual({});
    for (const bad of ["{nope", "[1]", "null", '{"a":1}']) {
      base.data.set(SNAPSHOT_KEY, bad);
      expect(readSnapshot(base)).toEqual({});
    }
  });

  it("reads and writes the session, and garbage reads as off", () => {
    const s = sessionStore();
    expect(readSession(s)).toEqual({ scratch: false, openAll: false });
    writeSession(s, { scratch: true, openAll: true });
    expect(readSession(s)).toEqual({ scratch: true, openAll: true });
    writeSession(s, { scratch: false, openAll: false });
    expect(s.m.has(SESSION_KEY)).toBe(false);
    s.m.set(SESSION_KEY, "{nope");
    expect(readSession(s)).toEqual({ scratch: false, openAll: false });
    expect(readSession(null)).toEqual({ scratch: false, openAll: false });
  });

  it("seeds Thistledown as a fresh start", () => {
    expect(seedVillage("thistledown", K, ROUTES)).toEqual({});
  });

  it("seeds Hollowmere with all of spring stamped and the closing scene seen", () => {
    const seed = seedVillage("hollowmere", K, ROUTES);
    const best = JSON.parse(seed[K.STARS_KEY]).best;
    expect(Object.keys(best)).toEqual(spring.routes);
    for (const id of spring.routes) expect(best[id]).toEqual({ stars: 3, moves: ROUTES.find((r) => r.id === id)!.par });
    expect(JSON.parse(seed[K.VILLAGE_KEY]).stamped).toEqual(spring.routes);
    expect(JSON.parse(seed[K.ENDING_KEY])).toEqual({ seen: true });
    expect(JSON.parse(seed[K.CURRENT_VILLAGE_KEY])).toEqual({ id: "hollowmere", visited: ["thistledown", "hollowmere"] });
    const p = villageProgress(best);
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "soon", "locked", "locked"]);
  });

  it("knows which jumps need every village open (a season before has no routes yet)", () => {
    expect(needsOpenAll("thistledown")).toBe(false);
    expect(needsOpenAll("hollowmere")).toBe(false);
    expect(needsOpenAll("conker")).toBe(NEIGHBOURHOODS[1].routes.length === 0);
    expect(needsOpenAll("snowberry")).toBe(true);
  });

  it("rejects an unknown village", () => {
    expect(() => seedVillage("nowhere", K, ROUTES)).toThrow();
  });

  it("snapshots every key of a save", () => {
    expect(snapshot(memoryAdapter(REAL), K)).toEqual(REAL);
  });
});

describe("preview panel", () => {
  let root: HTMLElement;
  let base: ReturnType<typeof memoryAdapter>;
  let session: ReturnType<typeof sessionStore>;
  let pv: Preview;

  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    base = memoryAdapter(REAL);
    session = sessionStore();
    pv = bootPreview(root, ROUTES, {}, { base, session });
  });
  afterEach(() => {
    pv.dispose();
    root.remove();
    setAdapter(localStorageAdapter());
  });

  it("starts on the real save with the title, and the panel closed", () => {
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect($("titleView").hidden).toBe(false);
    expect($("pvPanel").hidden).toBe(true);
    expect($("pvBadge").hidden).toBe(true);
    $("pvToggle").click();
    expect($("pvPanel").hidden).toBe(false);
    expect($("pvToggle").getAttribute("aria-expanded")).toBe("true");
    expect($("pvStatus").textContent).toContain("real save");
    expect((document.getElementById("pvOpenAll") as HTMLInputElement).disabled).toBe(true);
    expect(document.querySelectorAll("#pvVillages button")).toHaveLength(NEIGHBOURHOODS.length);
    expect(document.querySelectorAll("#pvRoute option")).toHaveLength(ROUTES.length);
  });

  it("jumps to summer: Hollowmere's map on a scratch save, real save untouched", () => {
    document.querySelector<HTMLButtonElement>('#pvVillages [data-hood="hollowmere"]')!.click();
    expect(pv.state).toEqual({ scratch: true, openAll: false });
    expect(readSession(session)).toEqual({ scratch: true, openAll: false });
    expect($("mapView").hidden).toBe(false);
    expect($("mapTitle").textContent).toBe("Hollowmere");
    expect($("mapSeason").textContent).toBe("Summer");
    expect(root.dataset.season).toBe("summer");
    expect($("pvBadge").hidden).toBe(false);
    expect(realKeys(base.data)).toEqual(REAL);
    // Back to Thistledown shows every spring lane stamped
    $("mapBack").click();
    expect($("mapTitle").textContent).toBe("Thistledown");
    expect(document.querySelectorAll("#mapLanes .vchip.done")).toHaveLength(spring.routes.length);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it.each([
    ["conker", "Conker Corner", "autumn", "Autumn"],
    ["snowberry", "Snowberry End", "winter", "Winter"],
  ])("opens %s's map even though the season before has no routes", (id, name, season, label) => {
    pv.goToVillage(id);
    expect(pv.state.scratch).toBe(true);
    expect(pv.state.openAll).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect($("mapTitle").textContent).toBe(name);
    expect($("mapSeason").textContent).toBe(label);
    expect(root.dataset.season).toBe(season);
    expect(document.querySelectorAll("#mapLanes .vchip")).toHaveLength(0);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("walks forward through every village when every village is open", () => {
    pv.goToVillage("hollowmere");
    pv.setOpenAll(true);
    expect($("mapEnter").hidden).toBe(false);
    expect($("mapEnter").textContent).toBe("Go to Conker Corner");
  });

  it("opens a route directly on a scratch copy of the real save", () => {
    pv.openRoute("hollow");
    const i = ROUTES.findIndex((r) => r.id === "hollow");
    expect($("gameView").hidden).toBe(false);
    expect($("mapView").hidden).toBe(true);
    expect($("titleView").hidden).toBe(true);
    expect(pv.app.G!.li).toBe(i);
    expect($("routeName").textContent).toBe(ROUTES[i].name);
    expect(pv.state.scratch).toBe(true);
    // the scratch save started as a copy of the real one
    expect(readSnapshot(base)[K.STARS_KEY]).toBe(REAL[K.STARS_KEY]);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("goes back to the real save, keeping the scratch save for next time", () => {
    pv.goToVillage("snowberry");
    $("pvReal").click();
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect(session.m.has(SESSION_KEY)).toBe(false);
    expect($("titleView").hidden).toBe(false);
    expect(pv.app.map.village).toBe("thistledown");
    expect(readSnapshot(base)[K.CURRENT_VILLAGE_KEY]).toContain("snowberry");
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("clears the scratch save back to the start of spring", () => {
    pv.goToVillage("hollowmere");
    $("pvClear").click();
    expect(Object.keys(readSnapshot(base)).filter((k) => k !== K.VERSION_KEY)).toEqual([]);
    expect($("mapTitle").textContent).toBe("Thistledown");
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("stays on the scratch save after a reload", () => {
    pv.goToVillage("hollowmere");
    pv.dispose();
    pv = bootPreview(root, ROUTES, {}, { base, session });
    expect(pv.state.scratch).toBe(true);
    $("titleContinue").click();
    expect($("mapTitle").textContent).toBe("Hollowmere");
  });
});

describe("preview panel when storage fails at any step", () => {
  /** Every write or removal on the real storage, in order, tagged with where it went. */
  type Op = { op: "set" | "remove"; store: "base" | "session"; key: string };

  let root: HTMLElement;
  let base: ReturnType<typeof memoryAdapter>;
  let session: ReturnType<typeof build>["s"];
  let log: Op[];
  let f: { failSnapshot: boolean; failFlagSet: boolean; dropFlagSet: boolean; failFlagRemove: boolean; failReload: boolean };
  let reloads: number;
  let pv: Preview;

  function build() {
    const inner = memoryAdapter(REAL);
    const b = Object.assign(inner, {
      setItem(k: string, v: string) {
        log.push({ op: "set", store: "base", key: k });
        if (f.failSnapshot && k === SNAPSHOT_KEY) throw new DOMException("full", "QuotaExceededError");
        inner.data.set(k, v);
      },
      removeItem(k: string) {
        log.push({ op: "remove", store: "base", key: k });
        inner.data.delete(k);
      },
    });
    const m = new Map<string, string>();
    const s = {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem(k: string, v: string): void {
        log.push({ op: "set", store: "session", key: k });
        if (f.failFlagSet) throw new DOMException("full", "QuotaExceededError");
        if (!f.dropFlagSet) m.set(k, v); // dropFlagSet: accepted but not kept, so the read-back doesn't match
      },
      removeItem(k: string): void {
        log.push({ op: "remove", store: "session", key: k });
        if (f.failFlagRemove) throw new DOMException("blocked", "SecurityError");
        m.delete(k);
      },
    };
    return { b, s };
  }
  const reload = () => {
    reloads++;
    if (f.failReload) throw new Error("reload blocked");
  };
  const boot = () => (pv = bootPreview(root, ROUTES, {}, { base, session, reload }));
  const flag = () => session.m.get(SESSION_KEY) ?? null;
  /** Writes the preview tools made to the real storage: only ever the one snapshot key. */
  const baseWrites = () => log.filter((o) => o.store === "base").map((o) => `${o.op}:${o.key}`);

  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    f = { failSnapshot: false, failFlagSet: false, dropFlagSet: false, failFlagRemove: false, failReload: false };
    log = [];
    reloads = 0;
    const made = build();
    base = made.b;
    session = made.s;
    boot();
    log.length = 0; // only what a change does
  });
  afterEach(() => {
    pv.dispose();
    root.remove();
    setAdapter(localStorageAdapter());
  });

  /** After an abort: flag off, real adapter active, state off, real keys untouched, only the snapshot key ever written. */
  function expectAbortedToReal() {
    expect(flag()).toBeNull();
    expect(getAdapter()).toBe(base);
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect(realKeys(base.data)).toEqual(REAL);
    expect(baseWrites().every((w) => w === `set:${SNAPSHOT_KEY}`)).toBe(true);
    expect($("pvStatus").textContent).toContain("went back to your real save");
  }
  /** A reload now would start on the real save. */
  function expectReloadIsReal() {
    pv.dispose();
    boot();
    expect(pv.state.scratch).toBe(false);
    expect(getAdapter()).toBe(base);
    expect(realKeys(base.data)).toEqual(REAL);
  }

  it("switches in order: snapshot in one write, flag last, then the game is on the scratch save", () => {
    pv.goToVillage("hollowmere");
    expect(log.map((o) => `${o.store}:${o.op}:${o.key}`)).toEqual([`base:set:${SNAPSHOT_KEY}`, `session:set:${SESSION_KEY}`]);
    expect(flag()).not.toBeNull();
    expect(getAdapter()).not.toBe(base);
    expect(reloads).toBe(0);
  });

  it("a snapshot write failing aborts to the real save and reloads (from the real save)", () => {
    f.failSnapshot = true;
    pv.goToVillage("hollowmere");
    expectAbortedToReal();
    expect(reloads).toBe(1);
    expect(log.some((o) => o.store === "session" && o.op === "set")).toBe(false); // the flag was never set
    expectReloadIsReal();
  });

  it("a snapshot write failing from the scratch save also aborts to the real save", () => {
    pv.goToVillage("hollowmere");
    log.length = 0;
    const was = base.data.get(SNAPSHOT_KEY);
    f.failSnapshot = true;
    pv.goToVillage("snowberry");
    expectAbortedToReal();
    expect(reloads).toBe(1);
    expect(base.data.get(SNAPSHOT_KEY)).toBe(was); // the old scratch save is whole, not partly overwritten
    expectReloadIsReal();
  });

  it("opening a route fails the same way when the snapshot can't be written", () => {
    f.failSnapshot = true;
    pv.openRoute("hollow");
    expectAbortedToReal();
    expect($("gameView").hidden).toBe(true);
    expect(reloads).toBe(1);
  });

  it("a flag write failing aborts to the real save and reloads", () => {
    f.failFlagSet = true;
    pv.goToVillage("hollowmere");
    expectAbortedToReal();
    expect(reloads).toBe(1);
    expectReloadIsReal();
  });

  it("a flag that doesn't read back aborts to the real save and reloads", () => {
    f.dropFlagSet = true;
    pv.goToVillage("hollowmere");
    expectAbortedToReal();
    expect(reloads).toBe(1);
    expectReloadIsReal();
  });

  it("with no session storage at all, a jump aborts to the real save", () => {
    pv.dispose();
    pv = bootPreview(root, ROUTES, {}, { base, session: null, reload });
    pv.goToVillage("hollowmere");
    expect(getAdapter()).toBe(base);
    expect(pv.state.scratch).toBe(false);
    expect(reloads).toBe(1);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("a failed clear of the scratch save (the reset step) aborts to the real save", () => {
    pv.goToVillage("hollowmere");
    log.length = 0;
    f.failSnapshot = true;
    pv.clearScratch();
    expectAbortedToReal();
    expect(reloads).toBe(1);
    expectReloadIsReal();
  });

  it("clearing from the real save empties the scratch save in one write and keeps the real save running", () => {
    pv.goToVillage("hollowmere");
    pv.backToReal();
    log.length = 0;
    const app = pv.app;
    pv.clearScratch();
    expect(baseWrites()).toEqual([`set:${SNAPSHOT_KEY}`]);
    expect(readSnapshot(base)).toEqual({});
    expect(pv.app).toBe(app);
    expect(getAdapter()).toBe(base);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("Back to my real save failing to remove the flag aborts to the real save and reloads", () => {
    pv.goToVillage("hollowmere");
    log.length = 0;
    f.failFlagRemove = true;
    pv.backToReal();
    // the removal failed, so the flag is cleared by overwriting it with "off" (which reads as the real save)
    expect(readSession(session)).toEqual({ scratch: false, openAll: false });
    expect(getAdapter()).toBe(base);
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect(reloads).toBe(1);
    expect(realKeys(base.data)).toEqual(REAL);
    expect(baseWrites()).toEqual([]); // not even the snapshot was written
    expectReloadIsReal();
  });

  it("even when the flag can neither be removed nor overwritten, the adapter is the real one and the real save is untouched", () => {
    pv.goToVillage("hollowmere");
    log.length = 0;
    f.failFlagRemove = true;
    f.failFlagSet = true;
    pv.backToReal();
    expect(getAdapter()).toBe(base);
    expect(reloads).toBe(1);
    expect(realKeys(base.data)).toEqual(REAL);
    expect(baseWrites()).toEqual([]);
  });

  it("a failing reload doesn't throw: the game is remounted on the real save with the flag cleared", () => {
    f.failSnapshot = true;
    f.failReload = true;
    expect(() => pv.goToVillage("hollowmere")).not.toThrow();
    expect(reloads).toBe(1);
    expect(flag()).toBeNull();
    expect(getAdapter()).toBe(base);
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect($("titleView").hidden).toBe(false);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("a failing reload after a failed back-to-real also ends on the real save", () => {
    pv.goToVillage("hollowmere");
    f.failFlagRemove = true;
    f.failReload = true;
    expect(() => pv.backToReal()).not.toThrow();
    expect(getAdapter()).toBe(base);
    expect(readSession(session).scratch).toBe(false);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("can't leave a partial scratch save: a jump is one write, so a failure keeps the old scratch save byte for byte", () => {
    pv.goToVillage("hollowmere");
    const old = base.data.get(SNAPSHOT_KEY);
    log.length = 0;
    // a successful jump is exactly one write to the real storage and no removals (the old clear-then-write-keys-one-by-one is gone)
    pv.goToVillage("conker");
    expect(baseWrites()).toEqual([`set:${SNAPSHOT_KEY}`]);
    expect(base.data.get(SNAPSHOT_KEY)).not.toBe(old);
    // and a failing one leaves what was there
    const mid = base.data.get(SNAPSHOT_KEY);
    f.failSnapshot = true;
    pv.goToVillage("snowberry");
    expect(base.data.get(SNAPSHOT_KEY)).toBe(mid);
    expect(() => JSON.parse(base.data.get(SNAPSHOT_KEY)!)).not.toThrow();
    expect([...base.data.keys()].filter((k) => k.startsWith(SCRATCH_PREFIX))).toEqual([SNAPSHOT_KEY]);
  });
});

describe("production build", () => {
  let out: string;
  beforeAll(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-prod-"));
    execFileSync(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "build", "--outDir", out, "--logLevel", "silent"], {
      env: { ...process.env, NODE_ENV: "production", VITE_STORY_PACK: "standard", VITEST: "" },
      stdio: "ignore",
    });
  });
  afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

  it("has no trace of the preview tools", () => {
    const files = fs.readdirSync(path.join(out, "assets")).map((f) => fs.readFileSync(path.join(out, "assets", f), "utf8"));
    expect(files.length).toBeGreaterThan(0);
    for (const marker of ["pvToggle", "Preview tools", SCRATCH_PREFIX, SESSION_KEY]) expect(files.some((t) => t.includes(marker))).toBe(false);
  });
});
