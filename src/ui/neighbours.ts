/**
 * A neighbour stepping out of their house when Pip's leg to it connects (#53). Mechanics only: the figures are
 * the nb* symbols in sprites.svg, decorative, and `neighbourFigure` is the one seam where #11 / #56 swap in real figures
 * (add a symbol per neighbour id in sprites.svg and map it in FIGURE_SYMBOL; nothing else changes).
 */
import type { NeighbourId } from "../letters/cast";
import { el } from "./svg";

/** How long a neighbour waits at the door at most, if Pip hasn't arrived. */
export const STEPOUT_MS = 1200;

/** Figure size on the board, in SVG units; the feet sit at the door. */
export const FIGURE_W = 30;
export const FIGURE_H = 46;

/** Symbol per neighbour (sprites.svg); anything unknown falls back to the generic silhouette. */
export const FIGURE_SYMBOL: Record<NeighbourId, string> = { clementine: "nbClementine", barnaby: "nbBarnaby", bea: "nbBea", moles: "nbMoles" };
export const PLACEHOLDER = "nbFigure";

/** An upright figure for `id`, feet at (x, y), as an SVG <use>. */
export function neighbourFigure(id: NeighbourId, x: number, y: number, parent?: Element): SVGElement {
  return el("use", { href: "#" + ((FIGURE_SYMBOL as Record<string, string>)[id] ?? PLACEHOLDER), x: x - FIGURE_W / 2, y: y - FIGURE_H, width: FIGURE_W, height: FIGURE_H, "data-neighbour": id, "aria-hidden": "true", "pointer-events": "none" }, parent);
}

export interface Stepout {
  /** Neighbour `id` appears at the door of house `cell` (feet at x, y), directly after the house `after` in the draw order. */
  show(cell: number, id: NeighbourId, x: number, y: number, after: Element | null): void;
  /** The board was redrawn: put the figure back beside its house. */
  redraw(cell: number, after: Element): void;
  /** Go back in now. */
  hide(): void;
  /** Same as hide: for restart, undo and leaving the route. */
  stop(): void;
  readonly active: boolean;
}

export function createStepout(reduce: () => boolean): Stepout {
  let cur: { cell: number; id: NeighbourId; x: number; y: number; g: SVGElement | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function put(after: Element | null) {
    if (!cur || !after) return;
    cur.g?.remove();
    const g = el("g", { class: "nb-out" + (reduce() ? "" : " nb-wave"), "data-door": cur.cell });
    neighbourFigure(cur.id, 0, 0, g);
    g.setAttribute("transform", `translate(${cur.x} ${cur.y})`);
    after.after(g);
    cur.g = g;
  }
  function hide() {
    clearTimeout(timer);
    timer = undefined;
    cur?.g?.remove();
    cur = null;
  }
  return {
    show(cell, id, x, y, after) {
      hide();
      cur = { cell, id, x, y, g: null };
      put(after);
      timer = setTimeout(hide, STEPOUT_MS);
    },
    redraw(cell, after) {
      if (cur && cur.cell === cell) put(after);
    },
    hide,
    stop: hide,
    get active() {
      return cur != null;
    },
  };
}
