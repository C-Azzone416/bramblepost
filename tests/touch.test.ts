// @vitest-environment jsdom
/** The board's one input path: Pointer Events for taps and swipes (what a finger sends), and the Turn back button. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { MX, MY, T } from "../src/ui/draw";
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

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES);
  board = document.getElementById("board") as unknown as SVGSVGElement;
  // jsdom has no SVG geometry: treat client pixels as board units 1:1.
  const m = { a: 1, inverse: () => m };
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

  it("the board opts out of browser gestures", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/#board\{[^}]*touch-action:none/);
  });
});
