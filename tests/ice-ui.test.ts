// @vitest-environment jsdom
/**
 * Ice on the board (#126): frozen cells are drawn (pale, streaks, nothing regular), a completed crossing lights up, and Pip's
 * walk slides straight over the ice in one glide without ever standing on it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parse, reachable, route, solveOrder } from "../src/engine";
import { PREFS_KEY } from "../src/save/keys";
import { ICE_PREVIEW, TWIST_PREVIEW } from "../src/preview/twists";
import type { Route } from "../src/levels";
import { MX, T, TILT, projY, MY } from "../src/ui/draw";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let bp: GameApi;
let root: HTMLElement;
const G = () => bp.G!;
const LI = TWIST_PREVIEW.indexOf(ICE_PREVIEW);
const iceIn = (c: number) => document.querySelector(`#board [data-cell="${c}"] .ice`);
/** Where Pip stands while crossing a cell (board.ts cellSpot, worked out here from the layout constants). */
const spot = (P: { w: number }, c: number) => `translate(${MX + (c % P.w) * T + T / 2}px, ${projY(MY + Math.floor(c / P.w) * T) + (T / 2 + 20) * TILT}px)`;
const norm = (t: string) => t.replace(/\s+/g, "").replace(/\.0+px/g, "px");

/** A crossing that is already complete but leads nowhere: the near tile and the far tile face the ice, and the lane beyond is closed. */
const CROSSING: Route = {
  ...ICE_PREVIEW,
  id: "ice-crossing-test",
  grid: ["P EW # EW NS A", "* * # * * *"],
  par: 9,
  solution: { order: [0], moves: [] },
};

beforeAll(async () => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, [...TWIST_PREVIEW, CROSSING]);
  await sleep(50);
});

beforeEach(() => {
  bp = mountApp(root, [...TWIST_PREVIEW, CROSSING]);
});

describe("ice preview route", () => {
  it("has the stated par and replays its solution", () => {
    const P = parse(ICE_PREVIEW);
    expect(solveOrder(P, [0], 5).par).toBe(ICE_PREVIEW.par);
    expect(route(P, P.init, "P", "A")).toBeNull();
  });
});

describe("ice cells", () => {
  it("are drawn as pale ice: one group per ice cell, with streaks and nothing dashed", () => {
    bp.openLevel(LI);
    const P = G().P;
    const iceCells = P.kind.flatMap((k, i) => (k === "ice" ? [i] : []));
    expect(iceCells).toEqual([2, 7, 12]);
    expect(document.querySelectorAll("#board .ice")).toHaveLength(3);
    for (const c of iceCells) {
      const ice = iceIn(c)!;
      expect(ice.querySelector('rect[fill="url(#iceG)"]')).not.toBeNull();
      expect(ice.querySelectorAll("path").length).toBeGreaterThanOrEqual(4); // frosty rim, 3 or 4 streaks, a shine
      expect(ice.querySelectorAll("[stroke-dasharray]")).toHaveLength(0);
      expect(ice.querySelector("use")).toBeNull(); // no lane sprite: it is not a road
      expect(ice.querySelector(".icelit")).toBeNull(); // nothing to cross yet
    }
    expect(document.getElementById("iceG")).not.toBeNull();
  });

  it("differ from cell to cell, so the streaks make no pattern", () => {
    bp.openLevel(LI);
    const d = (c: number) => [...iceIn(c)!.querySelectorAll("path")].map((p) => p.getAttribute("d")).join("|");
    expect(new Set([d(2), d(7), d(12)]).size).toBe(3);
  });

  it("are not drawn as water; a one-cell-wide stream has a bank on each side, and ice beside ice has none between", () => {
    bp.openLevel(LI);
    expect(document.querySelectorAll('#board rect[fill="url(#waterG)"]')).toHaveLength(0);
    const banks = (c: number) => iceIn(c)!.querySelectorAll('rect[fill="#c9b07a"]').length;
    expect(banks(2)).toBe(2);
    expect(parse({ ...ICE_PREVIEW, grid: ["P NS # # NS A", "* * # # * *"] }).kind[3]).toBe("ice"); // the wide stretch tested below
  });
});

describe("lit crossings", () => {
  it("light the ice along a completed crossing, left to right", () => {
    bp.openLevel(TWIST_PREVIEW.length);
    const P = G().P;
    expect(reachable(P, G().v, "P").has(2)).toBe(true);
    const lit = iceIn(2)!.querySelector(".icelit")!;
    expect(lit).not.toBeNull();
    expect(lit.querySelectorAll("rect")).toHaveLength(1); // across only, not up and down
    expect(lit.querySelector("rect")!.getAttribute("width")).toBe("100");
    // the row below has no crossing, so its ice is there but not lit
    expect(iceIn(8)).not.toBeNull();
    expect(iceIn(8)!.querySelector(".icelit")).toBeNull();
  });

  it("do not light an incomplete crossing", () => {
    bp.openLevel(LI); // the near tiles face away from the ice
    for (const c of [2, 7, 12]) expect(iceIn(c)!.querySelector(".icelit")).toBeNull();
  });
});

describe("which crossing is lit", () => {
  const mk = (id: string, grid: string[]): Route => ({ ...ICE_PREVIEW, id, grid, par: 9, solution: { order: [0], moves: [] } });
  const sheens = (c: number) => [...(iceIn(c)?.querySelectorAll(".icelit rect") ?? [])].map((r) => `${r.getAttribute("width")}x${r.getAttribute("height")}`);
  const open = (r: Route) => {
    bp = mountApp(root, [r]);
    bp.openLevel(0);
  };

  it("lights only the horizontal crossing when the tiles above and below are reachable some other way", () => {
    open(mk("ice-intersect", ["T ES SW T T", "P NESW # EW A", "T NE EW T T"]));
    expect(sheens(7)).toEqual(["100x42"]); // left to right only: no tall sheen
    expect(iceIn(7)!.querySelectorAll(".icelit rect")).toHaveLength(1);
  });

  it("lights two adjacent ice strips from different crossings each along its own crossing", () => {
    open(mk("ice-adjacent", ["T ES SW T T", "P NESW # EW A", "T NE # EW T"]));
    expect(sheens(7)).toEqual(["100x42"]);
    expect(sheens(12)).toEqual(["100x42"]);
  });

  it("lights a vertical crossing up and down", () => {
    open(mk("ice-vertical", ["T P T", "T NS T", "T # T", "T NS T", "T A T"]));
    expect(sheens(7)).toEqual(["42x100"]);
  });

  it("lights both ways where a horizontal and a vertical crossing really do meet", () => {
    open(mk("ice-both", ["T T P T T", "T ES NESW T T", "T NE # EW T", "T T NS T A"]));
    expect(sheens(12).sort()).toEqual(["100x42", "42x100"]);
  });
});

describe("Pip's walk over the ice", () => {
  const sampleWalk = async () => {
    const seen: string[] = [];
    const transitions = new Set<string>();
    const mover = document.getElementById("pipMover") as unknown as SVGGElement;
    for (let i = 0; i < 160 && G().phase !== "done"; i++) {
      seen.push(norm(mover.style.transform));
      transitions.add(mover.style.transition);
      await sleep(8);
    }
    return { seen, transitions };
  };

  it("glides from the near bank straight to the far bank and never stands on the ice", async () => {
    bp.openLevel(LI);
    const P = G().P;
    bp.tryMove({ t: "r", i: 1, d: 1 });
    bp.tryMove({ t: "r", i: 3, d: 1 });
    expect(route(P, G().v, "P", "A")).toEqual([0, 1, 2, 3, 4]);
    const { seen, transitions } = await sampleWalk();
    expect(seen).toContain(norm(spot(P, 1)));
    expect(seen).toContain(norm(spot(P, 3)));
    expect(seen).not.toContain(norm(spot(P, 2))); // never at the ice cell
    // the leg over the ice is one glide with its own easing, longer than an ordinary step; ordinary steps are linear
    const glide = [...transitions].find((t) => t.includes("cubic-bezier"));
    expect(glide).toBeTruthy();
    expect(glide).toContain("0.28s"); // one ice cell: .14s for the ice and .14s for the bank beyond
    expect([...transitions].some((t) => t.includes(".17s linear"))).toBe(true);
    for (let i = 0; i < 100 && G().busy; i++) await sleep(20);
    expect(G().phase).toBe("done");
  });

  it("glides longer over a stretch of two ice cells", async () => {
    const wide: Route = { ...ICE_PREVIEW, id: "ice-wide", grid: ["P NS # # NS A", "* * # # * *"], par: 2, solution: { order: [0], moves: [] } };
    bp = mountApp(root, [wide]);
    bp.openLevel(0);
    const P = G().P;
    bp.tryMove({ t: "r", i: 1, d: 1 });
    bp.tryMove({ t: "r", i: 4, d: 1 });
    expect(route(P, G().v, "P", "A")).toEqual([0, 1, 2, 3, 4, 5]);
    const { seen, transitions } = await sampleWalk();
    expect(seen).not.toContain(norm(spot(P, 2)));
    expect(seen).not.toContain(norm(spot(P, 3)));
    expect(seen).toContain(norm(spot(P, 4)));
    expect([...transitions].some((t) => t.includes("0.42s"))).toBe(true); // two ice cells and the bank: .14s each
  });

  it("just moves under reduced motion", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    bp = mountApp(root, TWIST_PREVIEW);
    bp.openLevel(LI);
    const P = G().P;
    bp.tryMove({ t: "r", i: 1, d: 1 });
    bp.tryMove({ t: "r", i: 3, d: 1 });
    const { seen, transitions } = await sampleWalk();
    expect(seen).not.toContain(norm(spot(P, 2)));
    expect([...transitions].some((t) => t.includes("cubic-bezier"))).toBe(false);
    localStorage.removeItem(PREFS_KEY);
  });
});
