// @vitest-environment jsdom
/**
 * Sunflowers on the board (#124): the page plays the preview route in jsdom. Ids slide with the tile (slide()), values turn
 * (apply()), the flower is drawn and swings a quarter after a move, and it can't be turned by hand.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PREFS_KEY } from "../src/save/keys";
import { SUN, E, S, W, N, apply, deliverChain, solveOrder, parse } from "../src/engine";
import { SUNFLOWER_PREVIEW, TWIST_PREVIEW } from "../src/preview/twists";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
let bp: GameApi;
const G = () => bp.G!;
const SUNNY = 1; // the sunflower's cell in the preview route's first row
const cell = (i: number) => document.querySelector(`#board [data-cell="${i}"]`)!;
const tile = (i: number) => cell(i).querySelector<SVGGElement>(".tl")!;

beforeAll(async () => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, TWIST_PREVIEW);
  await sleep(50);
});

afterEach(() => {
  localStorage.removeItem(PREFS_KEY);
});

describe("sunflower preview route", () => {
  it("has the stated par and replays its solution", () => {
    const P = parse(SUNFLOWER_PREVIEW);
    expect(solveOrder(P, [0], 6).par).toBe(SUNFLOWER_PREVIEW.par);
    let v = P.init;
    SUNFLOWER_PREVIEW.solution.moves.forEach((m, k) => {
      v = apply(P, v, m);
      expect(deliverChain(P, v, [0], 0).length > 0).toBe(k === SUNFLOWER_PREVIEW.solution.moves.length - 1);
    });
  });
});

describe("sunflower on the board", () => {
  it("is drawn on its garden path tile, lanes still visible", () => {
    bp.openLevel(0);
    expect(G().v[SUNNY] & SUN).toBe(SUN);
    const flowers = document.querySelectorAll("#board use.sun");
    expect(flowers).toHaveLength(1);
    expect(tile(SUNNY).contains(flowers[0])).toBe(true);
    expect(flowers[0].getAttribute("href")).toBe("#sunflower");
    expect(document.getElementById("sunflower")).not.toBeNull();
    // the lane is drawn under it: the path rectangles of the tile are still there
    expect(tile(SUNNY).querySelectorAll("rect").length).toBeGreaterThan(3);
    expect($("bannerText").textContent).toContain("Sunflowers turn a quarter after every move.");
  });

  it("turns a quarter after a move, and swings round on the board", () => {
    bp.openLevel(0);
    expect(G().v[SUNNY] & 15).toBe(N | E);
    bp.tryMove({ t: "row", y: 1, d: 1 });
    expect(G().v[SUNNY] & 15).toBe(E | S);
    expect(G().v[SUNNY] & SUN).toBe(SUN);
    // the tile starts a quarter back and the board turns it clockwise to its new place
    expect(tile(SUNNY).style.transform).toBe("rotate(-90deg)");
    expect(cell(SUNNY).querySelectorAll("use.sun")).toHaveLength(1);
  });

  it("uses slide() for ids and apply() for values: a slid sunflower keeps its id and its flag, and still turns", async () => {
    bp.openLevel(0);
    const idBefore = G().ids[SUNNY];
    bp.tryMove({ t: "row", y: 0, d: 1 });
    expect(G().ids[SUNNY + 1]).toBe(idBefore);
    expect(G().v[SUNNY + 1]).toBe(SUN | (E | S));
    expect(G().v[SUNNY]).toBe(16); // the flowerbed that was beside it slid in
    expect(G().ids[SUNNY]).not.toBe(idBefore);
    // slid and turned in one move: both are animated on the same tile
    expect(tile(SUNNY + 1).style.transform).toBe("translate(-100px) rotate(-90deg)");
    await sleep(20);
  });

  it("does not animate under reduced motion", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    bp.openLevel(0);
    bp.tryMove({ t: "row", y: 1, d: 1 });
    expect(G().v[SUNNY] & 15).toBe(E | S);
    expect(tile(SUNNY).style.transform).toBe("");
  });

  it("can't be turned by hand: the tap is refused with a cue and costs nothing", () => {
    bp.openLevel(0);
    const before = G().v.slice();
    bp.tryMove({ t: "r", i: SUNNY, d: 1 });
    bp.tryMove({ t: "r", i: SUNNY, d: -1 });
    expect(G().v).toEqual(before);
    expect(G().moves).toBe(0);
    expect(G().hist).toHaveLength(0);
    expect($("toast").textContent).toBe("Sunflowers turn by themselves, after every move.");
    expect(tile(SUNNY).classList.contains("nope")).toBe(true);
    G().sel = SUNNY;
    bp.tryMove({ t: "row", y: 1, d: 1 }); // re-render with the cursor on the sunflower
    expect(($("ccwBtn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("no shake under reduced motion, but the message still shows", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    bp.openLevel(0);
    bp.tryMove({ t: "r", i: SUNNY, d: 1 });
    expect(tile(SUNNY).classList.contains("nope")).toBe(false);
    expect($("toast").textContent).toContain("Sunflowers turn by themselves");
  });

  it("delivers on the move the sunflower lines up, and undo puts it back", async () => {
    bp.openLevel(0);
    bp.tryMove({ t: "row", y: 1, d: 1 });
    expect(G().next).toBe(0);
    bp.tryMove({ t: "row", y: 1, d: 1 });
    for (let i = 0; i < 100 && G().busy; i++) await sleep(50);
    expect(G().v[SUNNY] & 15).toBe(S | W);
    expect(G().next).toBe(1);
    expect(G().phase).toBe("done");
    bp.openLevel(0);
    bp.tryMove({ t: "row", y: 1, d: 1 });
    bp.undo();
    expect(G().v[SUNNY] & 15).toBe(N | E);
    expect(G().moves).toBe(0);
  });
});

describe("sunflower art contrast", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  it("its outline reads at 3:1 or better on every ground it sits on (unlit and lit lane, rim and middle)", () => {
    // the symbol stays inside a 20-unit radius, so the ground beside its outline is always the path (draw.ts drawPath colours)
    const sym = readFileSync(resolve(process.cwd(), "src/ui/sprites.svg"), "utf8").match(/<symbol id="sunflower"[\s\S]*?<\/symbol>/)![0];
    const outline = sym.match(/stroke="(#[0-9a-f]{6})"/i)![1];
    for (const ground of ["#b78a53", "#efd29c", "#d99a2b", "#ffe6a0"]) expect(ratio(outline, ground), ground).toBeGreaterThanOrEqual(3);
  });
});
