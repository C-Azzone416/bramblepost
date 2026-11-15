/** Tile and Pip artwork for the board. Each function draws one tile into a group centred on (0,0). */
import type { Board, Edges } from "../engine";
import { el } from "./svg";

/** Tile size and board margins in SVG units (room for the slide arrows). */
export const T = 100;
export const MX = 62;
export const MY = 84;
export const MB = 66;

/**
 * The tilted tabletop: the tile layer is foreshortened vertically by TILT about the grid's top edge (y = MY), and the
 * board gets a visible front edge EDGE units deep. Things that stand up are not squashed; they are placed at the
 * projected position of their cell instead. Grid space is the flat layout the engine and input work in.
 */
export const TILT = 0.8;
export const EDGE = 22;

/** A flat grid-space y (a y in the old, untilted layout) as it lands on the tilted board. */
export function projY(y: number): number {
  return MY + (y - MY) * TILT;
}

/** The SVG transform that foreshortens the tile layer; its CTM is what maps pointers back to grid space. */
export const TILT_TRANSFORM = `translate(0 ${MY * (1 - TILT)}) scale(1 ${TILT})`;

/** Total viewBox height for a board h tiles tall: top margin, the tilted grid, the front edge, the bottom margin. */
export function boardHeight(h: number): number {
  return MY + h * T * TILT + EDGE + MB;
}

/** Top-left of a cell in grid space (flat layout). */
export function cellXY(P: Board, i: number): [number, number] {
  return [MX + (i % P.w) * T, MY + Math.floor(i / P.w) * T];
}

/** Top-left of a cell as drawn on the tilted board; the cell is T wide and T * TILT tall there. */
export function screenXY(P: Board, i: number): [number, number] {
  const [x, y] = cellXY(P, i);
  return [x, projY(y)];
}

export function drawPath(g: Element, e: Edges, lit: boolean): void {
  const outer = lit ? "#d99a2b" : "#b78a53";
  const inner = lit ? "#ffe6a0" : "#efd29c";
  for (const [w, col] of [
    [40, outer],
    [30, inner],
  ] as const) {
    if (e & 1) el("rect", { x: -w / 2, y: -50, width: w, height: 50, fill: col }, g);
    if (e & 4) el("rect", { x: -w / 2, y: 0, width: w, height: 50, fill: col }, g);
    if (e & 2) el("rect", { x: 0, y: -w / 2, width: 50, height: w, fill: col }, g);
    if (e & 8) el("rect", { x: -50, y: -w / 2, width: 50, height: w, fill: col }, g);
    el("circle", { r: w / 2, fill: col }, g);
  }
  if (!lit) {
    el("circle", { cx: -6, cy: 5, r: 2.6, fill: "#c99a5c" }, g);
    el("circle", { cx: 7, cy: -6, r: 2.1, fill: "#c99a5c" }, g);
  } else {
    el("circle", { r: 4, fill: "#fffbe6" }, g);
  }
}

export function drawGrass(g: Element, rooted: boolean, alt: boolean): void {
  el("rect", { x: -46, y: -42, width: 92, height: 92, rx: 14, fill: rooted ? "#3f5f2a" : "#56772f" }, g);
  el(
    "rect",
    { x: -46, y: -46, width: 92, height: 88, rx: 14, fill: rooted ? "url(#grassRoot)" : alt ? "url(#grassA)" : "url(#grassB)" },
    g,
  );
  el("path", { d: "M-32 -44.5 H32", stroke: "#d4ef9a", "stroke-width": 2.4, opacity: 0.6, "stroke-linecap": "round" }, g);
}

/** Little flowers in the grass, kept off the lane. */
export function drawFlecks(g: Element, rnd: () => number, e: Edges): void {
  const cols = ["#fffaf0", "#f6b9c4", "#ffd27a"];
  for (let i = 0; i < 4; i++) {
    const u = -36 + rnd() * 72;
    const v = -36 + rnd() * 70;
    const onLane =
      e &&
      ((Math.abs(u) < 24 && ((e & 1 && v < 0) || (e & 4 && v > 0) || Math.abs(v) < 24)) ||
        (Math.abs(v) < 24 && ((e & 2 && u > 0) || (e & 8 && u < 0))));
    if (onLane) continue;
    el("circle", { cx: u, cy: v, r: 2.4 + rnd() * 1.8, fill: cols[i % 3] }, g);
  }
}

export function drawBed(g: Element, rnd: () => number): void {
  el("ellipse", { cx: 0, cy: 4, rx: 34, ry: 28, fill: "#6b4a2b" }, g);
  el("ellipse", { cx: 0, cy: 1, rx: 31, ry: 25, fill: "#8a5f38" }, g);
  const cols = ["#e1595a", "#f6b9c4", "#ffd27a", "#fffaf0", "#c4a6e8"];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd();
    const r = i === 0 ? 0 : 15 + rnd() * 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.8 - 2;
    el("circle", { cx: x + 3, cy: y + 4, r: 7, fill: "#4f7a35" }, g);
    const c = cols[Math.floor(rnd() * cols.length)];
    for (let k = 0; k < 5; k++) {
      const b = (k / 5) * Math.PI * 2;
      el("circle", { cx: x + Math.cos(b) * 4.6, cy: y + Math.sin(b) * 4.6, r: 3.6, fill: c }, g);
    }
    el("circle", { cx: x, cy: y, r: 2.6, fill: "#e3a43a" }, g);
  }
}

export function drawWater(g: Element, P: Board, i: number): void {
  el("rect", { x: -50, y: -50, width: 100, height: 100, fill: "url(#waterG)" }, g);
  const x = i % P.w;
  // banks where the neighbour isn't water
  const wet = (k: string) => k === "water" || k === "bridge";
  const left = x > 0 && wet(P.kind[i - 1]);
  const right = x < P.w - 1 && wet(P.kind[i + 1]);
  if (!left) el("rect", { x: -50, y: -50, width: 7, height: 100, fill: "#c9b07a" }, g);
  if (!right) el("rect", { x: 43, y: -50, width: 7, height: 100, fill: "#c9b07a" }, g);
  el(
    "path",
    { d: "M-26 -24 q8 -6 16 0 t16 0 M-10 18 q8 -6 16 0 t16 0", stroke: "#e6f6fa", "stroke-width": 3, fill: "none", "stroke-linecap": "round", opacity: 0.75 },
    g,
  );
  if ((i * 7) % 3 === 0) {
    el("ellipse", { cx: 18, cy: -6, rx: 11, ry: 8, fill: "#5f8d3e" }, g);
    el("path", { d: "M18 -6 L28 -10", stroke: "#4c9fb8", "stroke-width": 2 }, g);
  }
}

export function drawBridge(g: Element, e: Edges, lit: boolean): void {
  const vert = e & 1 || e & 4;
  const inner = el("g", { transform: vert ? "" : "rotate(90)" }, g);
  el("rect", { x: -22, y: -50, width: 44, height: 100, fill: lit ? "#d99a2b" : "#7a4d2a" }, inner);
  for (let k = 0; k < 7; k++) {
    el("rect", { x: -20, y: -48 + k * 14, width: 40, height: 11, rx: 2, fill: lit ? "#ffe6a0" : k % 2 ? "#b88454" : "#c79563" }, inner);
  }
  el("rect", { x: -27, y: -46, width: 6, height: 92, rx: 3, fill: "#5c3a1f" }, inner);
  el("rect", { x: 21, y: -46, width: 6, height: 92, rx: 3, fill: "#5c3a1f" }, inner);
}

/** Pip's spines: same seeded recipe as the proposal art, drawn once into #pipSpines. */
export function drawPipSpines(): void {
  const g = document.getElementById("pipSpines");
  if (!g) return;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const cx = 170;
  const cy = 208;
  const rx = 112;
  const ry = 104;
  function layer(a0d: number, a1d: number, n: number, lmin: number, lmax: number, inset: number, fill: string, stroke: string, edge: string) {
    const a0 = (a0d * Math.PI) / 180;
    const a1 = (a1d * Math.PI) / 180;
    const pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      pts.push([cx + Math.cos(a) * (rx - inset), cy + Math.sin(a) * (ry - inset)]);
      if (k < n) {
        const am = a + ((a1 - a0) / n) * (0.5 + (rnd() - 0.5) * 0.3);
        const t = k / n;
        const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t * 1.1)));
        const L = lmin + (lmax - lmin) * taper * (0.8 + rnd() * 0.3);
        pts.push([cx + Math.cos(am) * (rx - inset + L), cy + Math.sin(am) * (ry - inset + L)]);
      }
    }
    el(
      "path",
      { d: "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L") + edge, fill, stroke, "stroke-width": 7, "stroke-linejoin": "round" },
      g!,
    );
  }
  layer(146, 340, 24, 16, 44, 0, "#4a2c19", "#4a2c19", " C 240 170, 196 186, 178 226 C 160 262, 118 280, 64 262 Z");
  layer(156, 330, 20, 12, 34, 10, "url(#spineGrad)", "#6e4628", " C 230 176, 194 192, 176 228 C 160 260, 122 274, 80 262 Z");
  layer(176, 318, 14, 8, 22, 30, "#9a6a41", "#9a6a41", " C 220 186, 190 200, 176 232 C 164 256, 132 266, 104 258 Z");
  el("path", { d: "M104 150 C 130 116, 170 104, 204 108", stroke: "#d6a06a", "stroke-width": 8, fill: "none", "stroke-linecap": "round", opacity: 0.45 }, g);
}
