// @vitest-environment jsdom
/** The board's one input path: Pointer Events for taps and swipes (what a finger sends), and the Turn back button. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { MB, MX, MY, T, TILT, projY } from "../src/ui/draw";
import { MIN_TARGET_PX, OVERFLOW_PX, hitExtent } from "../src/ui/board";
import type { GameApi } from "../src/ui/game";
import { mountApp } from "../src/ui/mount";

// jsdom has no PointerEvent: build one from MouseEvent so clientX/Y, button and pointerId survive.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === "undefined") {
  class PointerEventPoly extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "touch";
    }
  }
  (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPoly;
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPoly;
}

let bp: GameApi;
let board: SVGSVGElement;
type Mat = { a: number; d: number; e: number; f: number };
const withInverse = (m: Mat) => ({
  ...m,
  inverse: () => ({ a: 1 / m.a, d: 1 / m.d, e: -m.e / m.a, f: -m.f / m.d }),
});
/** The ROOT svg's screen matrix, which jsdom lacks: board unit -> client px is (a*x + e, d*y + f). Plain scale and offset, no tilt. */
const ctm: Mat = { a: 1, d: 1, e: 0, f: 0 };
/** Whether the #boardTilt group's matrix carries the tilt (as in a browser). Off = identical to the root, for the flat-input tests. */
let tiltOn = false;
/** The #boardTilt group's screen matrix: the root's, composed with the tilt (scaleY TILT about the grid top, y = MY). */
const tiltCtm = (): Mat =>
  tiltOn ? { a: ctm.a, d: ctm.d * TILT, e: ctm.e, f: ctm.f + ctm.d * MY * (1 - TILT) } : { ...ctm };
let nullCtm = false;

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES);
  board = document.getElementById("board") as unknown as SVGSVGElement;
  // jsdom has no SVG geometry: the root svg and the #boardTilt group get distinct matrices, as in a browser.
  (SVGElement.prototype as unknown as { getScreenCTM: (this: Element) => unknown }).getScreenCTM = function (this: Element) {
    if (nullCtm) return null;
    return withInverse(this.id === "boardTilt" ? tiltCtm() : { ...ctm });
  };
  (board as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => ({
    x: 0,
    y: 0,
    matrixTransform(this: { x: number; y: number }, m: Mat) {
      return { x: m.a * this.x + m.e, y: m.d * this.y + m.f };
    },
  });
  board.setPointerCapture = () => {};
  board.releasePointerCapture = () => {};
});
beforeEach(async () => {
  Object.assign(ctm, { a: 1, d: 1, e: 0, f: 0 });
  tiltOn = false;
  nullCtm = false;
  await new Promise((r) => setTimeout(r, 500)); // let the previous move's walk and animation settle
  bp.openLevel(0);
});

const centre = (c: number) => {
  const w = bp.G!.P.w;
  return { x: MX + (c % w) * T + T / 2, y: MY + Math.floor(c / w) * T + T / 2 };
};
function fire(type: string, x: number, y: number, init: PointerEventInit = {}) {
  board.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0, ...init }));
}
/** Garden tile whose row and column can both slide. */
function gardenCell() {
  const s = bp.G!;
  for (let c = 0; c < s.P.w * s.P.h; c++) {
    if (s.P.kind[c] === "m" && s.P.rowsM[Math.floor(c / s.P.w)].length >= 2 && s.P.colsM[c % s.P.w].length >= 2) return c;
  }
  throw new Error("no slidable garden tile");
}

describe("board pointer input", () => {
  it("a tap turns the tile one quarter turn and selects it", () => {
    const c = gardenCell();
    const before = bp.G!.v[c];
    const { x, y } = centre(c);
    fire("pointerdown", x, y);
    fire("pointerup", x + 2, y + 1);
    expect(bp.G!.moves).toBe(1);
    expect(bp.G!.sel).toBe(c);
    expect(bp.G!.v[c]).not.toBe(before);
  });

  it("a horizontal swipe slides the row, with no tap turn", () => {
    const c = gardenCell();
    const s = bp.G!;
    const row = Math.floor(c / s.P.w);
    const cells = s.P.rowsM[row];
    const before = cells.map((i) => s.v[i]);
    const { x, y } = centre(c);
    fire("pointerdown", x, y);
    fire("pointermove", x + 20, y);
    expect(bp.G!.moves).toBe(0); // under the threshold
    fire("pointermove", x + 80, y + 4);
    fire("pointerup", x + 80, y + 4);
    expect(bp.G!.moves).toBe(1);
    const after = cells.map((i) => bp.G!.v[i]);
    expect(after).not.toEqual(before);
    expect(after).toEqual([before[before.length - 1], ...before.slice(0, -1)]); // one step right, wrapping
  });

  it("a vertical swipe slides the column", () => {
    const c = gardenCell();
    const s = bp.G!;
    const cells = s.P.colsM[c % s.P.w];
    const before = cells.map((i) => s.v[i]);
    const { x, y } = centre(c);
    fire("pointerdown", x, y);
    fire("pointerup", x + 3, y + 90);
    expect(bp.G!.moves).toBe(1);
    const after = cells.map((i) => bp.G!.v[i]);
    expect(after).toEqual([before[before.length - 1], ...before.slice(0, -1)]);
  });

  it("a cancelled touch does nothing", () => {
    const { x, y } = centre(gardenCell());
    fire("pointerdown", x, y);
    fire("pointercancel", x, y);
    fire("pointerup", x, y);
    expect(bp.G!.moves).toBe(0);
  });

  it("right-click on a mouse still turns back, and touch long-press (contextmenu) does not", () => {
    const c = gardenCell();
    const { x, y } = centre(c);
    fire("pointerdown", x, y, { pointerType: "mouse", button: 2 });
    expect(bp.G!.moves).toBe(1);
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y });
    board.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(bp.G!.moves).toBe(1);
  });

  it("the Turn back button works without a pointer", () => {
    const c = gardenCell();
    const { x, y } = centre(c);
    fire("pointerdown", x, y);
    fire("pointerup", x, y); // a tap selects the tile and turns it
    expect(bp.G!.moves).toBe(1);
    const btn = document.getElementById("ccwBtn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(bp.G!.moves).toBe(2);
  });

  it("ignores a second pointer while one is active", () => {
    const s = bp.G!;
    const cells: number[] = [];
    for (let c = 0; c < s.P.w * s.P.h; c++) if (s.P.kind[c] === "m") cells.push(c);
    const [a, b] = cells;
    const A = centre(a);
    const B = centre(b);
    const beforeB = s.v[b];
    fire("pointerdown", A.x, A.y, { pointerId: 1 });
    fire("pointerdown", B.x, B.y, { pointerId: 2 });
    fire("pointerup", B.x, B.y, { pointerId: 2 }); // not the active pointer
    expect(bp.G!.moves).toBe(0);
    fire("pointermove", B.x, B.y, { pointerId: 2 });
    expect(bp.G!.moves).toBe(0);
    fire("pointerup", A.x, A.y, { pointerId: 1 });
    expect(bp.G!.moves).toBe(1);
    expect(bp.G!.sel).toBe(a);
    expect(bp.G!.v[b]).toBe(beforeB);
  });

  it("losing pointer capture abandons the gesture", () => {
    const { x, y } = centre(gardenCell());
    fire("pointerdown", x, y);
    fire("lostpointercapture", x, y);
    fire("pointerup", x, y);
    expect(bp.G!.moves).toBe(0);
    // and the board takes a fresh gesture afterwards
    fire("pointerdown", x, y);
    fire("pointerup", x, y);
    expect(bp.G!.moves).toBe(1);
  });

  it("a gesture that starts while Pip is busy never produces a move", () => {
    const { x, y } = centre(gardenCell());
    bp.G!.busy = true;
    fire("pointerdown", x, y);
    bp.G!.busy = false; // Pip stops walking mid-gesture
    fire("pointermove", x + 90, y);
    fire("pointerup", x + 90, y);
    expect(bp.G!.moves).toBe(0);
    fire("pointerdown", x, y); // the next gesture, with Pip idle, works
    fire("pointerup", x, y);
    expect(bp.G!.moves).toBe(1);
  });

  it("the board opts out of browser gestures", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/#board\{[^}]*touch-action:none/);
  });
});

describe("slide arrow hit targets", () => {
  // [inner room to the grid, outer room to the viewBox edge], in SVG units, as built in board.ts.
  const rooms: [number, number][] = [[34, MX - 34], [44, MY - 44], [36, MB - 36]];

  it("reaches 44 CSS px at every board scale a phone layout produces, and stays off the grid", () => {
    for (const scale of [0.45, 0.5, 0.53, 0.7, 1]) {
      for (const [inner, outer] of rooms) {
        const e = hitExtent(scale, inner, outer + OVERFLOW_PX / scale);
        expect((e.inner + e.outer) * scale).toBeGreaterThanOrEqual(MIN_TARGET_PX - 1e-9);
        expect(e.inner).toBeLessThanOrEqual(inner);
      }
    }
  });

  it("is sized from the rendered scale, and resized when it changes", () => {
    const rect = () => document.querySelector(".hdl rect") as SVGRectElement; // row 1, left arrow
    const sizes = (scale: number) => {
      ctm.a = scale;
      window.dispatchEvent(new Event("resize"));
      const r = rect();
      return { w: Number(r.getAttribute("width")), h: Number(r.getAttribute("height")), x: Number(r.getAttribute("x")) };
    };
    const half = sizes(0.5);
    expect(half.w * 0.5).toBeGreaterThanOrEqual(MIN_TARGET_PX - 1e-9);
    // across the row it is MIN_TARGET_PX where the row pitch allows, else exactly the pitch (80 units * 0.5 = 40px here)
    expect(half.h * 0.5).toBeCloseTo(Math.min(MIN_TARGET_PX, T * TILT * 0.5));
    // left arrow: the rect ends at the grid edge (arrow centre + 34 units) and no further
    expect(half.x + half.w).toBeLessThanOrEqual(34 + 1e-9);
    const full = sizes(1);
    expect(full.w).toBeCloseTo(MIN_TARGET_PX);
    expect(full.h).toBeCloseTo(MIN_TARGET_PX); // pitch (80px) is roomy at full scale
    ctm.a = 1;
    window.dispatchEvent(new Event("resize"));
  });

  it("a tap on the outer tile edge turns the tile, not an arrow", () => {
    const s = bp.G!;
    // jsdom has no hit testing: assert no arrow rect, at any scale, reaches into the grid box.
    for (const scale of [0.45, 1]) {
      ctm.a = scale;
      window.dispatchEvent(new Event("resize"));
      for (const g of document.querySelectorAll(".hdl")) {
        const [, tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform")!)!.map(Number) as number[];
        const r = g.querySelector("rect")!;
        const l = tx + Number(r.getAttribute("x"));
        const t = ty + Number(r.getAttribute("y"));
        const right = l + Number(r.getAttribute("width"));
        const bottom = t + Number(r.getAttribute("height"));
        const gx0 = MX;
        const gy0 = MY;
        const gx1 = MX + s.P.w * T;
        const gy1 = MY + s.P.h * T * TILT; // the grid as drawn on the tilted board
        const overlaps = l < gx1 - 1e-9 && right > gx0 + 1e-9 && t < gy1 - 1e-9 && bottom > gy0 + 1e-9;
        expect(overlaps).toBe(false);
      }
    }
    ctm.a = 1;
    window.dispatchEvent(new Event("resize"));
    // and a tap on the first tile's outer edge, the spot an arrow used to cover, turns the tile
    const col0 = Array.from({ length: s.P.h }, (_, y) => y * s.P.w).find((i) => s.P.kind[i] === "m");
    if (col0 !== undefined) {
      const y = projY(MY + Math.floor(col0 / s.P.w) * T + T / 2); // client y is the projected y (root scale 1, no offset)
      tiltOn = true;
      fire("pointerdown", MX + 2, y);
      fire("pointerup", MX + 2, y);
      expect(bp.G!.moves).toBe(1);
    }
  });
});

describe("trailing click after a touch move", () => {
  // Safari's ghost click follows a move; keyboard activation of an arrow is a click with detail 0.
  const arrowClick = (detail: number) => {
    const arrows = document.querySelectorAll<SVGGElement>(".hdl");
    arrows[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail }));
  };
  const tapTile = () => {
    const { x, y } = centre(gardenCell());
    fire("pointerdown", x, y);
    fire("pointerup", x + 2, y + 1);
  };

  it("a trailing synthetic click (detail 1) within 600ms does not make a second move", () => {
    tapTile();
    expect(bp.G!.moves).toBe(1);
    bp.G!.busy = false; // Pip has stopped walking; only the click remains
    arrowClick(1);
    expect(bp.G!.moves).toBe(1);
  });

  it("a keyboard-style click (detail 0) on an arrow within the window still makes a move", () => {
    tapTile();
    expect(bp.G!.moves).toBe(1);
    bp.G!.busy = false;
    arrowClick(0);
    expect(bp.G!.moves).toBe(2);
  });

  it("a fresh pointerdown/up tap within the window still works", () => {
    tapTile();
    expect(bp.G!.moves).toBe(1);
    bp.G!.busy = false;
    tapTile();
    expect(bp.G!.moves).toBe(2);
  });
});

describe("tilted board", () => {
  /** A phone's matrices: the root is `scale` px per unit offset by (ox, oy); #boardTilt is that composed with the tilt. */
  const tilt = (scale: number, ox = 7, oy = 31) => {
    Object.assign(ctm, { a: scale, d: scale, e: ox, f: oy });
    tiltOn = true;
  };
  /** Where a flat (untilted) board point lands on screen through the ROOT matrix. Pass an already-projected y for a point on the tilted art. */
  const onScreen = (gx: number, gy: number) => ({ x: ctm.a * gx + ctm.e, y: ctm.d * gy + ctm.f });
  /** Where the centre of a cell is drawn: projected once through the tilt, then the root matrix. */
  const cellCentre = (c: number) => {
    const w = bp.G!.P.w;
    return onScreen(MX + (c % w) * T + T / 2, projY(MY + Math.floor(c / w) * T + T / 2));
  };
  /** The garden tiles whose row and column both slide, nearest the far (top) and near (bottom) edge of the board. */
  function farAndNear() {
    const s = bp.G!;
    const ok = (c: number) => s.P.kind[c] === "m" && s.P.rowsM[Math.floor(c / s.P.w)].length >= 2 && s.P.colsM[c % s.P.w].length >= 2;
    const all = Array.from({ length: s.P.w * s.P.h }, (_, c) => c).filter(ok);
    return { far: all[0], near: all[all.length - 1] };
  }

  it("the tile layer is foreshortened by the tilt, and the board keeps a front edge", () => {
    const g = document.getElementById("boardTilt")!;
    expect(g.getAttribute("transform")).toContain(`scale(1 ${TILT})`);
    expect(TILT).toBeGreaterThan(0.7);
    expect(TILT).toBeLessThan(0.9);
    const vb = (board.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(vb[3]).toBeLessThan(MY + bp.G!.P.h * T + MB); // shorter than the flat board
  });

  it("a tap turns the tile under the finger on the far row and on the near row", () => {
    for (const scale of [0.5, 0.9]) {
      const { far, near } = farAndNear();
      expect(Math.floor(far / bp.G!.P.w)).toBeLessThan(Math.floor(near / bp.G!.P.w));
      for (const c of [far, near]) {
        bp.openLevel(0);
        tilt(scale);
        const before = bp.G!.v.slice();
        const { x, y } = cellCentre(c);
        fire("pointerdown", x, y);
        fire("pointerup", x + 1, y + 1);
        expect(bp.G!.moves).toBe(1);
        expect(bp.G!.sel).toBe(c);
        const changed = bp.G!.v.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
        expect(changed).toEqual([c]);
      }
    }
  });

  it("a tap in the front-edge band, below the grid, turns nothing", () => {
    tilt(0.5);
    const s = bp.G!;
    // A movable cell as low on the board as possible; its column's x is used for both probes.
    const movable = Array.from({ length: s.P.w * s.P.h }, (_, c) => c).filter((c) => s.P.kind[c] === "m");
    const low = movable[movable.length - 1];
    const x = MX + (low % s.P.w) * T + T / 2;
    const gridBottom = MY + s.P.h * T * TILT; // the grid's lower edge as drawn (projected once)
    // Just inside the grid, over the lowest row of that column: a tap here turns a tile.
    const inside = onScreen(x, Math.min(gridBottom - 4, projY(MY + Math.floor(low / s.P.w) * T + T / 2)));
    fire("pointerdown", inside.x, inside.y);
    fire("pointerup", inside.x, inside.y);
    expect(bp.G!.moves).toBe(1);
    bp.openLevel(0);
    tilt(0.5);
    // Same x, in the front-edge band below the grid: already-projected y, through the root matrix only.
    const edge = onScreen(x, gridBottom + 8);
    fire("pointerdown", edge.x, edge.y);
    fire("pointerup", edge.x, edge.y);
    expect(bp.G!.moves).toBe(0);
  });

  for (const which of ["far", "near"] as const) {
    it(`a horizontal swipe on the ${which} row slides that row`, () => {
      tilt(0.5);
      const c = farAndNear()[which];
      const s = bp.G!;
      const cells = s.P.rowsM[Math.floor(c / s.P.w)];
      const before = cells.map((i) => s.v[i]);
      const { x, y } = cellCentre(c);
      fire("pointerdown", x, y);
      fire("pointermove", x + 40, y);
      fire("pointerup", x + 40, y);
      expect(bp.G!.moves).toBe(1);
      expect(cells.map((i) => bp.G!.v[i])).toEqual([before[before.length - 1], ...before.slice(0, -1)]);
    });

    it(`a vertical swipe on the ${which} row slides that column`, () => {
      tilt(0.5);
      const c = farAndNear()[which];
      const s = bp.G!;
      const cells = s.P.colsM[c % s.P.w];
      const before = cells.map((i) => s.v[i]);
      const { x, y } = cellCentre(c);
      fire("pointerdown", x, y);
      fire("pointerup", x, y - 40); // up on screen = slide the column up
      expect(bp.G!.moves).toBe(1);
      expect(cells.map((i) => bp.G!.v[i])).toEqual([...before.slice(1), before[0]]);
    });
  }

  it("a CTM that goes null mid-gesture abandons it: no move on release or on move", () => {
    tilt(0.5);
    const { x, y } = cellCentre(farAndNear().near);
    for (const end of ["pointerup", "pointermove"]) {
      fire("pointerdown", x, y);
      nullCtm = true;
      fire(end, x + 60, y);
      fire("pointerup", x + 60, y);
      nullCtm = false;
      expect(bp.G!.moves).toBe(0);
    }
    fire("pointerdown", x, y); // the board takes a fresh gesture afterwards
    fire("pointerup", x, y);
    expect(bp.G!.moves).toBe(1);
  });

  it("swipe direction is decided in board space: a diagonal that is shorter on screen vertically still counts as vertical", () => {
    tilt(1);
    const c = farAndNear().near;
    const s = bp.G!;
    const col = s.P.colsM[c % s.P.w];
    const beforeCol = col.map((i) => s.v[i]);
    const { x, y } = cellCentre(c);
    // screen: dx 40 > dy 36, so a flat reading says "row". Board space: dy 36 / TILT = 43.9 > 40, so "column".
    fire("pointerdown", x, y);
    fire("pointerup", x + 40, y + 36);
    expect(bp.G!.moves).toBe(1);
    expect(col.map((i) => bp.G!.v[i])).toEqual([beforeCol[beforeCol.length - 1], ...beforeCol.slice(0, -1)]);
  });

  it("slide arrows are at least 44 CSS px at 375x667 and 390x844 widths, and sit outside the tilted grid", () => {
    for (const vw of [375, 390]) {
      const s = bp.G!;
      const W = s.P.w * T + MX * 2;
      const scale = (vw - 60) / W; // the stage and page padding leave the board ~60px less than the viewport (330px at 390)
      Object.assign(ctm, { a: scale, d: scale, e: 0, f: 0 });
      window.dispatchEvent(new Event("resize"));
      const arrows = document.querySelectorAll(".hdl");
      expect(arrows.length).toBeGreaterThan(0);
      for (const g of arrows) {
        const [, tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform")!)!.map(Number) as number[];
        const r = g.querySelector("rect")!;
        const w = Number(r.getAttribute("width"));
        const h = Number(r.getAttribute("height"));
        // outward axis: always MIN_TARGET_PX. Across the row / column: MIN_TARGET_PX, or the pitch where that is less.
        const isRow = /row/.test(g.getAttribute("aria-label")!);
        expect((isRow ? w : h) * scale).toBeGreaterThanOrEqual(MIN_TARGET_PX - 1e-9);
        expect((isRow ? h : w) * scale).toBeGreaterThanOrEqual(Math.min(MIN_TARGET_PX, (isRow ? T * TILT : T) * scale) - 1e-9);
        const l = tx + Number(r.getAttribute("x"));
        const t = ty + Number(r.getAttribute("y"));
        const inGrid = l < MX + s.P.w * T - 1e-9 && l + w > MX + 1e-9 && t < MY + s.P.h * T * TILT - 1e-9 && t + h > MY + 1e-9;
        expect(inGrid).toBe(false);
      }
    }
  });

  it("adjacent arrow hit rects never overlap, at 375 and 390 widths", () => {
    for (const vw of [375, 390]) {
      const s = bp.G!;
      const scale = (vw - 60) / (s.P.w * T + MX * 2);
      Object.assign(ctm, { a: scale, d: scale, e: 0, f: 0 });
      window.dispatchEvent(new Event("resize"));
      const box = (g: Element) => {
        const [, tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform")!)!.map(Number) as number[];
        const r = g.querySelector("rect")!;
        const l = (tx + Number(r.getAttribute("x"))) * scale;
        const top = (ty + Number(r.getAttribute("y"))) * scale;
        return { l, top, r: l + Number(r.getAttribute("width")) * scale, bottom: top + Number(r.getAttribute("height")) * scale };
      };
      const boxes = Array.from(document.querySelectorAll(".hdl")).map(box);
      expect(boxes.length).toBeGreaterThan(1);
      const eps = 1e-6;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlap = a.l < b.r - eps && b.l < a.r - eps && a.top < b.bottom - eps && b.top < a.bottom - eps;
          expect(overlap, `arrows ${i} and ${j} at ${vw}px`).toBe(false);
        }
      }
    }
  });
});
