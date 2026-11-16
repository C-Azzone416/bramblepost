/**
 * Ambient life on the board: chimney smoke, a washing line and a few fireflies, in one requestAnimationFrame loop.
 * The art lives in sprites.svg (ambPuffA/B, ambShirt/Sock/Cloth, ambPost, ambFly + the flyGlow gradient, defined once).
 * A house comes alive once its parcel is delivered.
 *
 * Every node is created once in build() and only its transform / opacity changes per frame. The loop runs only while
 * something is alive, motion is allowed, the tab and the board are visible; anything else stops it (and nothing is drawn
 * under reduced motion). board.ts calls stop() with the rest of a game's cleanup.
 */
import type { Board } from "../engine";
import { reducedMotion } from "./motion";
import { el } from "./svg";

/** Where a live house's effects sit, in board SVG units. */
export interface Spot {
  /** Chimney top: smoke starts here. */
  x: number;
  y: number;
  /** The washing line: tied to the house wall (a) and to a tree trunk or a post (b). */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** True when the far end is a post we draw; false when it is a tree already on the board. */
  post: boolean;
  /** True when no washing line can be hung without a post landing on a path: the house gets smoke only (#111). */
  noWash?: boolean;
}

/**
 * Which way house `i`'s washing line runs (#111): towards a tree in the next tile along the row (`tree`), else towards a
 * tile where the post can stand without covering a path: the board's edge or a building, never a path, bridge or water tile.
 * The side towards the board's middle is tried first (`towardsRight`). Null when neither side is free: skip the line.
 */
export function washSide(P: Board, i: number, towardsRight: boolean): { dir: 1 | -1; tree: boolean } | null {
  const col = i % P.w;
  const next = (d: 1 | -1) => (col + d >= 0 && col + d < P.w ? P.kind[i + d] : undefined);
  for (const d of [1, -1] as const) if (next(d) === "tree") return { dir: d, tree: true };
  for (const d of towardsRight ? ([1, -1] as const) : ([-1, 1] as const)) {
    const k = next(d);
    if (k === undefined || k === "b") return { dir: d, tree: false };
  }
  return null;
}

/**
 * Where each house sprite's chimney (or spout, or stalk) mouth is, as a fraction of the sprite's viewBox.
 * Read off the paths in sprites.svg: burrow chimney cap (124,28) of 170x170; mushroom stovepipe (109,15) of 160x190;
 * teapot spout tip (10,76) of 190x200; acorn stalk top (96,8) of 160x200.
 */
export const CHIMNEY: Record<string, { fx: number; fy: number }> = {
  burrowHouse: { fx: 124 / 170, fy: 28 / 170 },
  mushHouse: { fx: 109 / 160, fy: 15 / 190 },
  teaHouse: { fx: 10 / 190, fy: 76 / 200 },
  acornHouse: { fx: 96 / 160, fy: 8 / 200 },
};

/** Chimney mouth for a house sprite drawn at (left, top) with size w x h. */
export function chimneyAt(sym: string, left: number, top: number, w: number, h: number): { x: number; y: number } {
  const c = CHIMNEY[sym] ?? { fx: 0.5, fy: 0.1 };
  return { x: left + c.fx * w, y: top + c.fy * h };
}

/**
 * The spot for a delivered house: `cx` is the tile centre, `top` the sprite's top, `dir` the side (1 right, -1 left) the line
 * runs to. With a `trunk` (a tree beside the house) the line ties to it; otherwise a post stands a short way off.
 */
export function spotFor(sym: string, cx: number, top: number, w: number, h: number, dir: 1 | -1, trunk?: { x: number; y: number }): Spot {
  const c = chimneyAt(sym, cx - w / 2, top, w, h);
  const ax = cx + dir * w * 0.4;
  if (trunk) return { x: c.x, y: c.y, ax, ay: trunk.y, bx: trunk.x, by: trunk.y, post: false };
  const ay = top + h * 0.62;
  return { x: c.x, y: c.y, ax, ay, bx: ax + dir * 28, by: ay, post: true };
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PUFFS = 3;
const FLIES = 4;

/**
 * `view` is the element whose visibility gates the loop (the game view): it is watched for `hidden` / class / style changes,
 * so showing the same board again restarts the loop with no render needed. Call dispose() when the app goes away.
 */
export function createAmbient(boardVisible: () => boolean = () => true, view?: Element | null) {
  let layer: SVGGElement | null = null;
  let bounds: Bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let spots: Spot[] = [];
  let smoke: SVGGElement[] = [];
  let puffs: SVGUseElement[][] = [];
  let wash: SVGGElement | null = null;
  let line: SVGPathElement | null = null;
  let post: SVGUseElement | null = null;
  /** Each piece: a static outer group (placed on the line) around the swinging use. */
  let pieces: { outer: SVGGElement; swing: SVGUseElement }[] = [];
  let flies: SVGGElement[] = [];
  let raf = 0;
  /** Bumped by build() and stop(); a frame that was already queued for an older layer does nothing. */
  let gen = 0;

  const running = () =>
    !!layer && layer.isConnected && spots.length > 0 && !reducedMotion() && document.visibilityState !== "hidden" && boardVisible();

  function cancel() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Bring the loop and the layer in line with the current state. Cheap; safe to call any time. */
  function refresh() {
    if (!layer) return;
    const show = spots.length > 0 && !reducedMotion();
    layer.setAttribute("display", show ? "inline" : "none");
    if (running()) {
      if (!raf) {
        const mine = gen;
        raf = requestAnimationFrame((t) => frame(t, mine));
      }
    } else cancel();
  }

  function frame(t: number, mine: number) {
    raf = 0;
    if (mine !== gen || !running()) return;
    const s = t / 1000;
    spots.forEach((_p, i) => {
      if (!puffs[i]) return;
      puffs[i].forEach((c, k) => {
        const ph = (s * 0.4 + k / PUFFS + i * 0.17) % 1;
        // relative to the chimney (the group is placed there); grows and drifts as it rises, fading at both ends
        c.setAttribute("transform", `translate(${(Math.sin(ph * 5 + i + k) * 4 + ph * 5).toFixed(1)} ${(-ph * 30).toFixed(1)}) scale(${(0.75 + ph * 1.1).toFixed(2)})`);
        c.setAttribute("opacity", (Math.min(1, ph * 6) * 1 * (1 - ph)).toFixed(2));
      });
    });
    pieces.forEach((q, k) => q.swing.setAttribute("transform", `rotate(${(Math.sin(s * 2.2 + k * 1.3) * 9 + Math.sin(s * 0.7) * 3).toFixed(1)})`));
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    flies.forEach((f, i) => {
      const x = bounds.x0 + w / 2 + (w / 2.3) * Math.sin(s * (0.21 + i * 0.05) + i * 2);
      const y = bounds.y0 + h / 2 + (h / 2.3) * Math.cos(s * (0.17 + i * 0.04) + i * 1.3);
      f.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.9 + 0.3 * Math.sin(s * 1.3 + i)).toFixed(2)})`);
      f.setAttribute("opacity", (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s * 2.4 + i * 1.7))).toFixed(2));
    });
    raf = requestAnimationFrame((n) => frame(n, mine));
  }

  /** Make the (empty) layer's nodes: `houses` smoke stacks, one washing line, a few fireflies. Replaces any earlier layer. */
  function build(into: SVGGElement, area: Bounds, houses: number) {
    cancel();
    gen++;
    layer = into;
    bounds = area;
    spots = [];
    layer.setAttribute("data-ambient", "");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("pointer-events", "none");
    layer.setAttribute("display", "none");
    smoke = [];
    puffs = [];
    const puffSyms = ["#ambPuffA", "#ambPuffB", "#ambPuffA"];
    for (let i = 0; i < houses; i++) {
      const g = el("g", { display: "none" }, layer);
      smoke.push(g);
      puffs.push(puffSyms.map((h) => el("use", { href: h, x: -12, y: -9, width: 24, height: 18, opacity: 0 }, g)));
    }
    wash = el("g", { display: "none" }, layer);
    line = el("path", { d: "M0 0", fill: "none", stroke: "#8a6a45", "stroke-width": 1.3, "stroke-linecap": "round" }, wash);
    post = el("use", { href: "#ambPost", x: -3, y: 0, width: 6, height: 26, display: "none" }, wash);
    pieces = [
      { s: "#ambShirt", w: 16, h: 15 },
      { s: "#ambSock", w: 10, h: 14 },
      { s: "#ambCloth", w: 14, h: 14 },
    ].map(({ s, w, h }) => {
      const outer = el("g", {}, wash!);
      return { outer, swing: el("use", { href: s, x: -w / 2, y: -1, width: w, height: h }, outer) };
    });
    flies = Array.from({ length: FLIES }, () => {
      const f = el("g", { opacity: 0 }, layer!);
      el("use", { href: "#ambFly", x: -8, y: -8, width: 16, height: 16 }, f);
      return f;
    });
  }

  /** Where along the sagging line (0..1) each piece hangs, for two or three pieces. */
  const HANG = [0.26, 0.52, 0.78];

  function placeWash(p: Spot) {
    if (!wash || !line || !post) return;
    const mx = (p.ax + p.bx) / 2;
    const my = (p.ay + p.by) / 2 + 5;
    line.setAttribute("d", `M${p.ax.toFixed(1)} ${p.ay.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.bx.toFixed(1)} ${p.by.toFixed(1)}`);
    post.setAttribute("display", p.post ? "inline" : "none");
    post.setAttribute("x", String(p.bx - 3));
    post.setAttribute("y", String(p.by - 2));
    const room = Math.abs(p.bx - p.ax);
    const n = room < 40 ? 2 : 3;
    const t = n === 2 ? [0.3, 0.72] : HANG;
    pieces.forEach((q, k) => {
      q.outer.setAttribute("display", k < n ? "inline" : "none");
      const u = t[k] ?? 0.5;
      const x = (1 - u) * (1 - u) * p.ax + 2 * u * (1 - u) * mx + u * u * p.bx;
      const y = (1 - u) * (1 - u) * p.ay + 2 * u * (1 - u) * my + u * u * p.by;
      q.outer.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });
  }

  /** The houses that are alive right now (delivered). Empty means nothing is drawn and the loop stops. */
  function set(live: Spot[]) {
    spots = live.slice(0, smoke.length);
    smoke.forEach((g, i) => {
      g.setAttribute("display", i < spots.length ? "inline" : "none");
      if (spots[i]) g.setAttribute("transform", `translate(${spots[i].x.toFixed(1)} ${spots[i].y.toFixed(1)})`);
    });
    const washer = spots.find((p) => !p.noWash); // the first live house that can hang a line
    wash?.setAttribute("display", washer ? "inline" : "none");
    if (washer) placeWash(washer);
    refresh();
  }

  /** The game is going away: stop the loop and drop every effect. */
  function stop() {
    gen++;
    cancel();
    spots = [];
    smoke.forEach((g) => g.setAttribute("display", "none"));
    layer?.setAttribute("display", "none");
  }

  // Pause and resume with the tab; follow the reduced-motion setting (the class on <html>) and the system query live;
  // follow the game view being hidden and shown (any code path, no hook needed).
  document.addEventListener("visibilitychange", refresh);
  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", refresh);
  } catch {
    /* no matchMedia */
  }
  const observers: MutationObserver[] = [];
  if (typeof MutationObserver !== "undefined") {
    const watch = (node: Element, filter: string[]) => {
      const o = new MutationObserver(refresh);
      o.observe(node, { attributes: true, attributeFilter: filter });
      observers.push(o);
    };
    watch(document.documentElement, ["class"]);
    if (view) watch(view, ["hidden", "class", "style"]);
  }

  /** Remove every listener and observer and stop the loop for good. */
  function dispose() {
    stop();
    document.removeEventListener("visibilitychange", refresh);
    try {
      mq?.removeEventListener("change", refresh);
    } catch {
      /* ignore */
    }
    observers.forEach((o) => o.disconnect());
    observers.length = 0;
    layer = null;
  }

  return { build, set, stop, refresh, dispose };
}
