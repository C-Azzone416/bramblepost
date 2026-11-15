/**
 * Ambient life on the board: chimney smoke, a laundry flap and a few fireflies, in one requestAnimationFrame loop.
 * Placeholder shapes in the current palette (#10 swaps in the final art). A house comes alive once its parcel is delivered.
 *
 * Every node is created once in build() and only its transform / opacity changes per frame. The loop runs only while
 * something is alive, motion is allowed, the tab and the board are visible; anything else stops it (and nothing is drawn
 * under reduced motion). board.ts calls stop() with the rest of a game's cleanup.
 */
import { reducedMotion } from "./motion";
import { el } from "./svg";

/** Where a live house's effects sit, in board SVG units. */
export interface Spot {
  /** Chimney top. */
  x: number;
  y: number;
  /** Laundry line. */
  lx: number;
  ly: number;
}
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PUFFS = 3;
const FLIES = 4;

export function createAmbient(boardVisible: () => boolean = () => true) {
  let layer: SVGGElement | null = null;
  let bounds: Bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let spots: Spot[] = [];
  let smoke: SVGGElement[] = [];
  let puffs: SVGCircleElement[][] = [];
  let laundry: SVGRectElement | null = null;
  let flies: SVGCircleElement[] = [];
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
    spots.forEach((p, i) => {
      if (!puffs[i]) return;
      puffs[i].forEach((c, k) => {
        const ph = (s * 0.45 + k / PUFFS + i * 0.17) % 1;
        c.setAttribute("transform", `translate(${(p.x + Math.sin(ph * 6 + i) * 4).toFixed(1)} ${(p.y - ph * 26).toFixed(1)}) scale(${(0.6 + ph).toFixed(2)})`);
        c.setAttribute("opacity", (0.6 * (1 - ph)).toFixed(2));
      });
    });
    if (laundry && spots[0]) laundry.setAttribute("transform", `translate(${spots[0].lx} ${spots[0].ly}) skewX(${(Math.sin(s * 2.2) * 10).toFixed(1)})`);
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    flies.forEach((f, i) => {
      const x = bounds.x0 + w / 2 + (w / 2.3) * Math.sin(s * (0.21 + i * 0.05) + i * 2);
      const y = bounds.y0 + h / 2 + (h / 2.3) * Math.cos(s * (0.17 + i * 0.04) + i * 1.3);
      f.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      f.setAttribute("opacity", (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s * 2.4 + i * 1.7))).toFixed(2));
    });
    raf = requestAnimationFrame((n) => frame(n, mine));
  }

  /** Make the (empty) layer's nodes: `houses` smoke stacks, one laundry flap, a few fireflies. Replaces any earlier layer. */
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
    for (let i = 0; i < houses; i++) {
      const g = el("g", { display: "none" }, layer);
      smoke.push(g);
      puffs.push(Array.from({ length: PUFFS }, () => el("circle", { r: 4, fill: "#fffaf0", opacity: 0 }, g)));
    }
    laundry = el("rect", { x: -6, y: 0, width: 12, height: 9, rx: 1.5, fill: "#c4452e", stroke: "#fffaf0", "stroke-width": 1.2, display: "none" }, layer);
    flies = Array.from({ length: FLIES }, () => el("circle", { r: 2.6, fill: "#ffd66e", opacity: 0 }, layer!));
  }

  /** The houses that are alive right now (delivered). Empty means nothing is drawn and the loop stops. */
  function set(live: Spot[]) {
    spots = live.slice(0, smoke.length);
    smoke.forEach((g, i) => g.setAttribute("display", i < spots.length ? "inline" : "none"));
    laundry?.setAttribute("display", spots.length ? "inline" : "none");
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

  // Pause and resume with the tab; follow the reduced-motion setting (the class on <html>) and the system query live.
  document.addEventListener("visibilitychange", refresh);
  try {
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", refresh);
  } catch {
    /* no matchMedia */
  }
  if (typeof MutationObserver !== "undefined") new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return { build, set, stop, refresh };
}
