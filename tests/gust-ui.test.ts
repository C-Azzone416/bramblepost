// @vitest-environment jsdom
/**
 * Gusts on the board (#125): the page calls step() (player move, sunflowers, gust), ids slide with the gust, undo restores the board
 * from before the move and its gust, and the windy line and the leaf counter are drawn.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { applyUnchecked, gustMove, parse, slide, solveOrder, step, type Move } from "../src/engine";
import { PREFS_KEY } from "../src/save/keys";
import { GUST_PREVIEW, TWIST_PREVIEW } from "../src/preview/twists";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
let bp: GameApi;
let root: HTMLElement;
const G = () => bp.G!;
const LI = TWIST_PREVIEW.indexOf(GUST_PREVIEW);
const idle = async () => {
  for (let i = 0; i < 100 && G().busy; i++) await sleep(20);
};
const play = async (m: Move) => {
  bp.tryMove(m);
  await idle();
};
/** Moves that change the board without delivering (rotations of far tiles, slides of the bottom row). */
const filler: Move[] = [
  { t: "row", y: 2, d: 1 },
  { t: "row", y: 2, d: -1 },
  { t: "row", y: 2, d: 1 },
  { t: "row", y: 2, d: -1 },
  { t: "row", y: 2, d: 1 },
  { t: "row", y: 2, d: -1 },
];
const leavesLeft = () => $("gustLeaves").querySelectorAll('use[href="#icoLeaf"]').length;

beforeAll(async () => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, TWIST_PREVIEW);
  await sleep(50);
});

describe("gust preview route", () => {
  it("has the stated par, which needs the wind, and replays its solution through step()", () => {
    const P = parse(GUST_PREVIEW);
    expect(solveOrder(P, [0], 4).par).toBe(GUST_PREVIEW.par);
    expect(solveOrder(parse({ ...GUST_PREVIEW, wind: undefined }), [0], 3).par).toBeNull();
  });
});

describe("gusts in play", () => {
  it("fire on moves 3 and 6 only (the pot holds six cups), and the values are exactly what step() gives", async () => {
    bp.openLevel(LI);
    const P = G().P;
    let v = P.init;
    for (let n = 1; n <= 6; n++) {
      const m = filler[(n - 1) % filler.length];
      const before = G().v.slice();
      await play(m);
      v = step(P, v, m, n);
      expect(G().moves, `move ${n}`).toBe(n);
      expect(G().v, `move ${n}`).toEqual(v);
      const gusted = gustMove(P, n) !== null;
      expect(gusted).toBe(n % 3 === 0);
      // on a gust move the row differs from what the player's move alone leaves
      expect(G().v.join()).toEqual(gusted ? slide(P, applyUnchecked(P, before, m), gustMove(P, n)!).join() : applyUnchecked(P, before, m).join());
    }
  });

  it("keeps the tile ids in sync: the same tile id sits under the same values after every gust", async () => {
    bp.openLevel(LI);
    const P = G().P;
    // tag every garden cell by its starting values; a tile's values never change while it slides, only when it turns
    for (let n = 1; n <= 6; n++) await play(filler[(n - 1) % filler.length]);
    const byId = new Map<number, number>();
    for (let c = 0; c < P.w * P.h; c++) if (P.kind[c] === "m") byId.set(G().ids[c], G().v[c]);
    expect(byId.size).toBe(P.kind.filter((k) => k === "m").length); // ids stay a permutation
    for (const [id, val] of byId) expect(val).toBe(P.init[id]); // filler moves only slide, so each id still has its own tile's values
  });

  it("undo restores the board from before the move and its gust", async () => {
    bp.openLevel(LI);
    for (let n = 1; n <= 2; n++) await play(filler[n - 1]);
    const v2 = G().v.slice();
    const ids2 = G().ids.slice();
    await play(filler[2]); // move 3: the gust fires
    expect(G().v).not.toEqual(v2);
    bp.undo();
    expect(G().v).toEqual(v2);
    expect(G().ids).toEqual(ids2);
    expect(G().moves).toBe(2);
    expect(leavesLeft()).toBe(1);
  });

  it("animates the gust slide after the player's move, and the board is busy meanwhile", async () => {
    bp.openLevel(LI);
    await play(filler[0]);
    await play(filler[1]);
    bp.tryMove(filler[2]);
    expect(G().busy).toBe(true); // between the player's move and the wind
    const mid = G().v.slice();
    bp.undo(); // refused while the wind is blowing
    expect(G().moves).toBe(3);
    for (let i = 0; i < 100 && G().v.join() === mid.join(); i++) await sleep(5);
    expect(G().v).not.toEqual(mid);
    const row1 = [...document.querySelectorAll<SVGGElement>("#board [data-cell] > .tl")].filter((t) => t.style.transform.includes("translate"));
    expect(row1.length).toBeGreaterThan(0);
    await idle();
    expect(G().busy).toBe(false);
  });

  it("with reduced motion the tiles just move", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    bp.openLevel(LI);
    for (let n = 1; n <= 3; n++) bp.tryMove(filler[n - 1]);
    expect(G().busy).toBe(false);
    const P = G().P;
    let v = P.init;
    for (let n = 1; n <= 3; n++) v = step(P, v, filler[n - 1], n);
    expect(G().v).toEqual(v);
    expect(document.querySelectorAll("#board .tl").length).toBeGreaterThan(0);
    for (const t of document.querySelectorAll<SVGGElement>("#board .tl")) expect(t.style.transform).toBe("");
    localStorage.removeItem(PREFS_KEY);
  });

  it("plays the solution to the end: the third move's gust finishes the lane", async () => {
    bp.openLevel(LI);
    for (const m of GUST_PREVIEW.solution.moves) await play(m);
    for (let i = 0; i < 100 && G().phase !== "done"; i++) await sleep(50);
    expect(G().phase).toBe("done");
    expect(G().moves).toBe(3);
  });
});

describe("the wind's marks", () => {
  it("shows the leaves and the arrow on the windy row, and a three-leaf counter that loses a leaf each move", async () => {
    bp.openLevel(LI);
    expect(document.querySelectorAll("#board .windmark path").length).toBeGreaterThan(4);
    expect($("gust").hidden).toBe(false);
    expect($("gustLeaves").querySelectorAll("svg")).toHaveLength(3);
    expect(leavesLeft()).toBe(3);
    await play(filler[0]);
    expect(leavesLeft()).toBe(2);
    expect($("gustLeaves").getAttribute("aria-label")).toBe("2 moves until the next gust");
    await play(filler[1]);
    expect(leavesLeft()).toBe(1);
    expect($("gustLeaves").getAttribute("aria-label")).toBe("The next move brings a gust");
    await play(filler[2]);
    expect(leavesLeft()).toBe(3);
  });

  it("is absent on a route with no wind", () => {
    bp.openLevel(0);
    expect($("gust").hidden).toBe(true);
    expect(document.querySelectorAll("#board .windmark *")).toHaveLength(0);
  });

  it("marks a column with the wind blowing up", () => {
    const col = { ...GUST_PREVIEW, wind: { line: "col" as const, index: 2, d: -1 as const, every: 3 } };
    const app = mountApp(root, [col]); // replaces the app on the same root
    app.openLevel(0);
    expect(root.querySelectorAll(".windmark path").length).toBeGreaterThan(4);
    const arrow = [...root.querySelectorAll(".windmark path")].find((p) => p.getAttribute("fill") === "#fffaf0" && p.getAttribute("transform")?.includes("rotate(-90)"));
    expect(arrow).toBeTruthy();
    bp = mountApp(root, TWIST_PREVIEW);
  });
});
