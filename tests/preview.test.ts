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
  bootPreview,
  needsOpenAll,
  prefixedAdapter,
  readSession,
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

/** The real save's keys only (no scratch prefix), as stored. */
const realKeys = (data: Map<string, string>) => Object.fromEntries([...data].filter(([k]) => !k.startsWith(SCRATCH_PREFIX)));

describe("scratch save helpers", () => {
  it("prefixes every key and never touches the real one", () => {
    const base = memoryAdapter({ [K.STARS_KEY]: "real" });
    const s = prefixedAdapter(base);
    expect(s.getItem(K.STARS_KEY)).toBeNull();
    s.setItem(K.STARS_KEY, "scratch");
    expect(base.data.get(K.STARS_KEY)).toBe("real");
    expect(base.data.get(SCRATCH_PREFIX + K.STARS_KEY)).toBe("scratch");
    s.removeItem(K.STARS_KEY);
    expect(base.data.has(SCRATCH_PREFIX + K.STARS_KEY)).toBe(false);
    expect(base.data.get(K.STARS_KEY)).toBe("real");
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
    expect(base.data.get(SCRATCH_PREFIX + K.STARS_KEY)).toBe(REAL[K.STARS_KEY]);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("goes back to the real save, keeping the scratch save for next time", () => {
    pv.goToVillage("snowberry");
    $("pvReal").click();
    expect(pv.state).toEqual({ scratch: false, openAll: false });
    expect(session.m.has(SESSION_KEY)).toBe(false);
    expect($("titleView").hidden).toBe(false);
    expect(pv.app.map.village).toBe("thistledown");
    expect(base.data.get(SCRATCH_PREFIX + K.CURRENT_VILLAGE_KEY)).toContain("snowberry");
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("clears the scratch save back to the start of spring", () => {
    pv.goToVillage("hollowmere");
    $("pvClear").click();
    expect([...base.data.keys()].filter((k) => k.startsWith(SCRATCH_PREFIX) && k !== SCRATCH_PREFIX + K.VERSION_KEY)).toEqual([]);
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

describe("preview panel when storage fails part way", () => {
  /** Real storage whose scratch writes and removals can be made to fail, from a given point or just once. */
  function faultyBase(initial: Record<string, string>) {
    const data = new Map(Object.entries(initial));
    const f = { writes: 0, failWriteAt: 0, failWritesFrom: 0, failRemoveOnce: false };
    const quota = () => new DOMException("full", "QuotaExceededError");
    const adapter = {
      data,
      f,
      getItem: (k: string) => data.get(k) ?? null,
      setItem(k: string, v: string) {
        if (k.startsWith(SCRATCH_PREFIX)) {
          f.writes++;
          if (f.writes === f.failWriteAt || (f.failWritesFrom && f.writes >= f.failWritesFrom)) throw quota();
        }
        data.set(k, v);
      },
      removeItem(k: string) {
        if (k.startsWith(SCRATCH_PREFIX) && f.failRemoveOnce) {
          f.failRemoveOnce = false;
          throw quota();
        }
        data.delete(k);
      },
    };
    return adapter;
  }
  function faultySession() {
    const s = sessionStore();
    const f = { failSet: false, failRemove: false };
    return Object.assign(s, {
      f,
      setItem(k: string, v: string) {
        if (f.failSet) throw new DOMException("full", "QuotaExceededError");
        s.m.set(k, v);
      },
      removeItem(k: string) {
        if (f.failRemove) throw new DOMException("blocked", "SecurityError");
        s.m.delete(k);
      },
    });
  }
  const scratchKeys = (data: Map<string, string>) => Object.fromEntries([...data].filter(([k]) => k.startsWith(SCRATCH_PREFIX)));

  let root: HTMLElement;
  let base: ReturnType<typeof faultyBase>;
  let session: ReturnType<typeof faultySession>;
  let pv: Preview;
  const boot = (s: typeof session | null = session) => (pv = bootPreview(root, ROUTES, {}, { base, session: s }));
  /** Arm a failure counted from the next scratch write. */
  const failWrite = (n: number) => (base.f.failWriteAt = base.f.writes + n);

  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    base = faultyBase(REAL);
    session = faultySession();
    boot();
  });
  afterEach(() => {
    pv.dispose();
    root.remove();
    setAdapter(localStorageAdapter());
  });

  /** Everything is exactly as it was before a refused change. */
  function expectUnchanged(was: { state: object; app: unknown; scratch: object; session: string | null; title: string }) {
    expect(pv.state).toEqual(was.state);
    expect(pv.app).toBe(was.app); // the running game was not remounted
    expect(scratchKeys(base.data)).toEqual(was.scratch);
    expect(session.m.get(SESSION_KEY) ?? null).toBe(was.session);
    expect($("mapTitle").textContent).toBe(was.title);
    expect($("pvStatus").textContent).toContain("nothing changed");
    expect(realKeys(base.data)).toEqual(REAL);
  }
  const current = () => ({ state: { ...pv.state }, app: pv.app, scratch: scratchKeys(base.data), session: session.m.get(SESSION_KEY) ?? null, title: $("mapTitle").textContent! });

  it("a write failing after others succeeded puts the scratch save back and leaves the game as it was", () => {
    pv.goToVillage("hollowmere");
    const was = current();
    failWrite(3);
    pv.goToVillage("snowberry");
    expectUnchanged(was);
    expect(getAdapter()).not.toBe(base);
    // and the next try, with room again, works
    pv.goToVillage("snowberry");
    expect($("mapTitle").textContent).toBe("Snowberry End");
    expect($("pvStatus").textContent).not.toContain("nothing changed");
  });

  it("a removal failing during the wipe is caught and rolled back too", () => {
    pv.goToVillage("hollowmere");
    const was = current();
    base.f.failRemoveOnce = true;
    pv.goToVillage("conker");
    expectUnchanged(was);
  });

  it("from the real save, a failed write keeps the real save running, and a reload agrees", () => {
    const was = current();
    failWrite(2);
    pv.goToVillage("hollowmere");
    expectUnchanged(was);
    expect(getAdapter()).toBe(base);
    failWrite(1);
    pv.openRoute("hollow");
    expect(pv.state.scratch).toBe(false);
    expect($("gameView").hidden).toBe(true);
    expect(getAdapter()).toBe(base);
    pv.dispose();
    boot();
    expect(pv.state.scratch).toBe(false);
    expect(getAdapter()).toBe(base);
    expect($("titleView").hidden).toBe(false);
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("if the session can't be stored, the jump doesn't happen and a reload agrees", () => {
    const was = current();
    session.f.failSet = true;
    pv.goToVillage("hollowmere");
    expectUnchanged(was);
    expect(getAdapter()).toBe(base);
    pv.dispose();
    boot();
    expect(pv.state.scratch).toBe(false);
    expect(getAdapter()).toBe(base);
  });

  it("if leaving the scratch save can't be stored, it stays on the scratch save and a reload agrees", () => {
    pv.goToVillage("hollowmere");
    const was = current();
    session.f.failRemove = true;
    pv.backToReal();
    expectUnchanged(was);
    expect(getAdapter()).not.toBe(base);
    pv.dispose();
    boot();
    expect(pv.state.scratch).toBe(true);
    expect(getAdapter()).not.toBe(base);
    $("titleContinue").click();
    expect($("mapTitle").textContent).toBe("Hollowmere");
    expect(realKeys(base.data)).toEqual(REAL);
  });

  it("with no session storage at all, jumps are refused", () => {
    pv.dispose();
    boot(null);
    const was = { ...current(), session: null };
    pv.goToVillage("hollowmere");
    expect(pv.state).toEqual(was.state);
    expect(pv.app).toBe(was.app);
    expect(getAdapter()).toBe(base);
    expect(scratchKeys(base.data)).toEqual(was.scratch);
    expect($("pvStatus").textContent).toContain("nothing changed");
  });

  it("says so when the scratch save can't be put back, and still never touches the real save", () => {
    pv.goToVillage("hollowmere");
    base.f.failWritesFrom = base.f.writes + 2;
    pv.goToVillage("snowberry");
    expect(pv.state).toEqual({ scratch: true, openAll: false });
    expect(getAdapter()).not.toBe(base);
    expect($("pvStatus").textContent).toContain("couldn't put the scratch save back");
    expect(realKeys(base.data)).toEqual(REAL);
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
