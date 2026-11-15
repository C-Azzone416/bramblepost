// @vitest-environment jsdom
/** Ambient life (#52): effects appear as parcels are delivered, reuse their nodes, and stop with the game, the tab or reduced motion. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";
import { CHIMNEY, chimneyAt } from "../src/ui/ambient";
import { NEIGHBOURS } from "../src/ui/cast";

let bp: GameApi;
let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;
let reduceQuery = false;
let now = 0;

beforeAll(() => {
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  beforeEachSetup();
  bp = mountApp(root, ROUTES);
});
function beforeEachSetup() {
  window.matchMedia = ((q: string) => ({ matches: reduceQuery, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  reduceQuery = false;
  queue = new Map();
  now = 0;
  const raf = (cb: FrameRequestCallback) => {
    queue.set(nextId, cb);
    return nextId++;
  };
  const caf = (id: number) => void queue.delete(id);
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  window.requestAnimationFrame = raf;
  window.cancelAnimationFrame = caf;
  beforeEachSetup();
  document.documentElement.classList.remove("reduce-motion");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Run every queued frame once (frames queued while running wait for the next call). */
function frames(n = 1) {
  for (let i = 0; i < n; i++) {
    const batch = [...queue.entries()];
    queue.clear();
    now += 16;
    for (const [, cb] of batch) cb(now);
  }
}
/** Play solution moves until the first parcel lands, then settle the walk. */
function deliverOne(li = 0) {
  bp.openLevel(li);
  for (const m of ROUTES[li].solution.moves) {
    bp.tryMove(m);
    if (bp.G!.busy) break;
  }
  vi.advanceTimersByTime(250);
  vi.advanceTimersByTime(2000);
  expect(Object.keys(bp.G!.got).length).toBeGreaterThan(0);
  frames(2); // the board's own slide-animation frames, so only the ambient loop is left queued
}
const layer = () => document.querySelector<SVGGElement>("#board [data-ambient]")!;
const nodes = () => document.querySelectorAll("#board *").length;
const shown = () => [...layer().querySelectorAll<SVGElement>(":scope > g")].filter((g) => g.getAttribute("display") === "inline").length;
const click = (id: string) => (document.getElementById(id) as HTMLButtonElement).click();

describe("ambient life", () => {
  it("is a hidden, inert layer before anything is delivered, and runs no loop", () => {
    bp.openLevel(0);
    expect(layer().getAttribute("aria-hidden")).toBe("true");
    expect(layer().getAttribute("pointer-events")).toBe("none");
    expect(layer().getAttribute("display")).toBe("none");
    expect(shown()).toBe(0);
    expect(queue.size).toBe(0);
  });

  it("sits above the houses and below Pip", () => {
    bp.openLevel(0);
    const kids = [...document.getElementById("board")!.children];
    expect(kids.indexOf(layer())).toBeLessThan(kids.indexOf(document.getElementById("pipMover")!.parentElement!));
    expect(kids.indexOf(layer())).toBeGreaterThan(kids.findIndex((k) => k.querySelector("[data-house]")));
  });

  it("effects appear for a house after its parcel is delivered", () => {
    deliverOne();
    expect(layer().getAttribute("display")).toBe("inline");
    expect(shown()).toBeGreaterThan(0);
    expect(queue.size).toBe(1);
    frames();
    expect(layer().querySelector("use[transform]")).not.toBeNull();
  });

  it("creates no nodes per frame", () => {
    deliverOne();
    frames();
    const n = nodes();
    frames(60);
    expect(nodes()).toBe(n);
    expect(queue.size).toBe(1);
  });

  it("smoke is anchored at each house style's chimney, and the data matches the sprites", () => {
    // every style's sprite has an entry, and the offset is inside the sprite
    for (const nb of Object.values(NEIGHBOURS)) {
      const c = CHIMNEY[nb.sym];
      expect(c, nb.sym).toBeDefined();
      expect(c.fx).toBeGreaterThan(0);
      expect(c.fx).toBeLessThan(1);
      expect(c.fy).toBeGreaterThan(0);
      expect(c.fy).toBeLessThan(0.5);
      const [, , vw, vh] = nb.vb.split(" ").map(Number);
      const at = chimneyAt(nb.sym, 10, 20, nb.w, nb.h);
      expect(at.x).toBeCloseTo(10 + (c.fx * vw * nb.w) / vw, 5);
      expect(at.y).toBeCloseTo(20 + (c.fy * vh * nb.h) / vh, 5);
    }
    // pinned values read off sprites.svg: burrow cap (124,28)/170, mushroom pipe (109,15)/(160,190)
    expect(CHIMNEY.burrowHouse).toEqual({ fx: 124 / 170, fy: 28 / 170 });
    expect(CHIMNEY.mushHouse).toEqual({ fx: 109 / 160, fy: 15 / 190 });
    // and the live smoke group sits exactly there on the board
    deliverOne();
    const g = [...layer().querySelectorAll<SVGElement>(":scope > g")].find((x) => x.getAttribute("display") === "inline" && x.querySelector("use[href^='#ambPuff']"))!;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform")!)!;
    const house = document.querySelector<SVGUseElement>("#board [data-house]")!;
    const sym = house.getAttribute("href")!.slice(1);
    const w = +house.getAttribute("width")!;
    const h = +house.getAttribute("height")!;
    const want = chimneyAt(sym, +house.getAttribute("x")!, +house.getAttribute("y")!, w, h);
    expect(+m[1]).toBeCloseTo(want.x, 0);
    expect(+m[2]).toBeCloseTo(want.y, 0);
  });

  it("the washing line is tied at both ends and hangs two or three pieces", () => {
    deliverOne();
    const path = layer().querySelector("path")!;
    expect(path.getAttribute("d")).toMatch(/^M[-\d.]+ [-\d.]+ Q/);
    const hung = [...layer().querySelectorAll<SVGElement>(":scope > g > g")].filter((x) => x.getAttribute("display") === "inline" && x.querySelector("use[href^='#amb']"));
    expect(hung.length).toBeGreaterThanOrEqual(2);
    expect(hung.length).toBeLessThanOrEqual(3);
  });

  it("art is defined once: no gradients or symbols in the layer, one glow gradient in the defs", () => {
    deliverOne();
    expect(layer().querySelector("radialGradient, linearGradient, symbol, defs, filter")).toBeNull();
    expect(document.querySelectorAll("#flyGlow").length).toBe(1);
    for (const id of ["ambPuffA", "ambPuffB", "ambShirt", "ambSock", "ambCloth", "ambPost", "ambFly"]) expect(document.querySelectorAll("#" + id).length, id).toBe(1);
    // fireflies are symbols reused, not new gradients per frame
    const before = document.querySelectorAll("radialGradient").length;
    frames(30);
    expect(document.querySelectorAll("radialGradient").length).toBe(before);
  });

  it("the node count and structure are stable over frames, and only transform / opacity change", () => {
    deliverOne();
    frames();
    const snap = () => [...layer().querySelectorAll("*")].map((n) => n.tagName + [...n.attributes].map((a) => a.name).filter((a) => !["transform", "opacity"].includes(a)).sort().join(",") + [...n.attributes].filter((a) => !["transform", "opacity"].includes(a.name)).map((a) => a.value).join("|")).join(";");
    const n = layer().querySelectorAll("*").length;
    const s0 = snap();
    frames(120);
    expect(layer().querySelectorAll("*").length).toBe(n);
    expect(snap()).toBe(s0);
  });

  it("undo switches the effects off again", () => {
    deliverOne();
    vi.runOnlyPendingTimers();
    for (let i = 0; i < 20 && bp.G!.hist.length; i++) click("undoBtn");
    expect(bp.G!.hist.length).toBe(0);
    expect(shown()).toBe(0);
    expect(queue.size).toBe(0);
  });

  it("pauses when the board is hidden and resumes by itself when the SAME board is shown again", async () => {
    deliverOne();
    frames();
    const view = document.getElementById("gameView")!;
    const before = layer().querySelector("use[transform]")!.getAttribute("transform");
    view.hidden = true;
    await Promise.resolve(); // the observer sees it
    expect(queue.size).toBe(0);
    frames(); // a frame already in flight does nothing
    expect(queue.size).toBe(0);
    view.hidden = false; // no rebuild, no delivery, no render
    await Promise.resolve();
    expect(queue.size).toBe(1);
    frames(5);
    expect(queue.size).toBe(1);
    expect(layer().querySelector("use[transform]")!.getAttribute("transform")).not.toBe(before);
  });

  it("pauses while the tab is hidden and resumes when it is back", () => {
    deliverOne();
    let state = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(queue.size).toBe(0);
    state = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(queue.size).toBe(1);
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  it("stops on leaving, and a frame already in flight does not throw", () => {
    deliverOne();
    frames();
    const stale = [...queue.values()];
    click("toRoutes");
    expect(queue.size).toBe(0);
    expect(() => stale.forEach((cb) => cb(now + 16))).not.toThrow();
    expect(queue.size).toBe(0);
  });

  it("stops on restart and on opening another route", () => {
    deliverOne();
    bp.openLevel(1);
    expect(queue.size).toBe(0);
    expect(shown()).toBe(0);
  });

  it("draws nothing and runs no loop under reduced motion (the system query)", () => {
    reduceQuery = true;
    deliverOne();
    expect(layer().getAttribute("display")).toBe("none");
    expect(queue.size).toBe(0);
  });

  it("reacts live when the setting changes", async () => {
    deliverOne();
    expect(queue.size).toBe(1);
    localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true }));
    document.documentElement.classList.add("reduce-motion"); // what applyMotion does
    await Promise.resolve();
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(layer().getAttribute("display")).toBe("none");
    expect(queue.size).toBe(0);
    localStorage.clear();
    document.documentElement.classList.remove("reduce-motion");
    await Promise.resolve();
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(layer().getAttribute("display")).toBe("inline");
    expect(queue.size).toBe(1);
  });
});

describe("dispose", () => {
  it("mounting the app twice on a root does not double the listeners", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const root = document.createElement("div");
    document.body.appendChild(root);
    const count = (spy: typeof add) => spy.mock.calls.filter((c) => c[0] === "visibilitychange").length;
    const net = () => count(add) - count(remove);
    const a = mountApp(root, ROUTES, { skipTitle: true });
    const first = net();
    const b = mountApp(root, ROUTES, { skipTitle: true });
    expect(net()).toBe(first); // the old board's listener was removed when the new one was added
    b.dispose();
    expect(net()).toBe(first - 1);
    expect(a).not.toBe(b);
    add.mockRestore();
    remove.mockRestore();
  });

  it("after dispose nothing fires and no frame is scheduled", async () => {
    deliverOne();
    expect(queue.size).toBe(1);
    bp.dispose();
    expect(queue.size).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    document.documentElement.classList.add("reduce-motion");
    document.documentElement.classList.remove("reduce-motion");
    const view = document.getElementById("gameView")!;
    view.hidden = true;
    view.hidden = false;
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.size).toBe(0);
  });
});
