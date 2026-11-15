// @vitest-environment jsdom
/** The board's one input path: Pointer Events for taps and swipes (what a finger sends), and the Turn back button. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { MB, MX, MY, T } from "../src/ui/draw";
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
let scaleCTM: { a: number };

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES);
  board = document.getElementById("board") as unknown as SVGSVGElement;
  // jsdom has no SVG geometry: treat client pixels as board units 1:1.
  const m = { a: 1, inverse: () => m };
  scaleCTM = m;
  (board as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => m;
  (board as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(this: { x: number; y: number }) { return { x: this.x, y: this.y }; } });
  board.setPointerCapture = () => {};
  board.releasePointerCapture = () => {};
});
beforeEach(async () => {
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
      scaleCTM.a = scale;
      window.dispatchEvent(new Event("resize"));
      const r = rect();
      return { w: Number(r.getAttribute("width")), h: Number(r.getAttribute("height")), x: Number(r.getAttribute("x")) };
    };
    const half = sizes(0.5);
    expect(half.w * 0.5).toBeGreaterThanOrEqual(MIN_TARGET_PX - 1e-9);
    expect(half.h * 0.5).toBeGreaterThanOrEqual(MIN_TARGET_PX - 1e-9);
    // left arrow: the rect ends at the grid edge (arrow centre + 34 units) and no further
    expect(half.x + half.w).toBeLessThanOrEqual(34 + 1e-9);
    const full = sizes(1);
    expect(full.w).toBeCloseTo(MIN_TARGET_PX);
    scaleCTM.a = 1;
    window.dispatchEvent(new Event("resize"));
  });

  it("a tap on the outer tile edge turns the tile, not an arrow", () => {
    const s = bp.G!;
    // jsdom has no hit testing: assert no arrow rect, at any scale, reaches into the grid box.
    for (const scale of [0.45, 1]) {
      scaleCTM.a = scale;
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
        const gy1 = MY + s.P.h * T;
        const overlaps = l < gx1 - 1e-9 && right > gx0 + 1e-9 && t < gy1 - 1e-9 && bottom > gy0 + 1e-9;
        expect(overlaps).toBe(false);
      }
    }
    scaleCTM.a = 1;
    window.dispatchEvent(new Event("resize"));
    // and a tap on the first tile's outer edge, the spot an arrow used to cover, turns the tile
    const col0 = Array.from({ length: s.P.h }, (_, y) => y * s.P.w).find((i) => s.P.kind[i] === "m");
    if (col0 !== undefined) {
      const y = MY + Math.floor(col0 / s.P.w) * T + T / 2;
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
