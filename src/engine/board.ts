/** Board parsing, tile rules, moves and Pip's pathfinding. Pure functions over plain arrays. */
import type { Board, CellKind, Edges, Move, Puzzle } from "./types";

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
/** Flowerbed: a movable tile with no lane. */
export const BED = 16;
/** Sunflower sprite support is a later UI issue. */
export const SUN = 32;

/** [edge bit, dx, dy, opposite edge bit] for N, E, S, W. */
export const DIRS: ReadonlyArray<readonly [number, number, number, number]> = [
  [N, 0, -1, S],
  [E, 1, 0, W],
  [S, 0, 1, N],
  [W, -1, 0, E],
];

export function rotCW(e: Edges): Edges {
  return ((e << 1) | (e >> 3)) & 15;
}
export function rotCCW(e: Edges): Edges {
  return ((e >> 1) | (e << 3)) & 15;
}

const EDGE_BY_LETTER: Record<string, number> = { N, E, S, W };
export function edgesFrom(str: string): Edges {
  let e = 0;
  for (const ch of str) e |= EDGE_BY_LETTER[ch] ?? 0;
  return e;
}
export function edgesToString(e: Edges): string {
  return (e & N ? "N" : "") + (e & E ? "E" : "") + (e & S ? "S" : "") + (e & W ? "W" : "");
}

/**
 * Level grid tokens (space separated, one string per row):
 *   NS EW NE ES SW NW, NES ...   movable path tile with those lane ends
 *   *                            flowerbed (movable, no lane)
 *   ~                            stream (rooted)
 *   T                            old tree (rooted)
 *   P                            post office (rooted)
 *   A..F                         neighbours' houses, named in level.houses (rooted)
 *   =NS / =EW                    footbridge: turns, never slides
 */
export function parse(level: Puzzle): Board {
  const rows = level.grid.map((r) => r.trim().split(/\s+/));
  const h = rows.length;
  const w = rows[0].length;
  const kind: CellKind[] = [];
  const init: number[] = [];
  const bld: Record<string, number> = {};
  const name: Record<number, string> = {};
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`Row ${y} has ${rows[y].length} cells, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const t = rows[y][x];
      const i = y * w + x;
      if (t === "*") {
        kind[i] = "m";
        init[i] = BED;
      } else if (t === "~") {
        kind[i] = "water";
        init[i] = 0;
      } else if (t === "T") {
        kind[i] = "tree";
        init[i] = 0;
      } else if (t === "P" || /^[A-F]$/.test(t)) {
        kind[i] = "b";
        init[i] = 0;
        name[i] = t;
        bld[t] = i;
      } else if (t[0] === "@") {
        kind[i] = "m";
        init[i] = SUN | edgesFrom(t.slice(1));
      } else if (t[0] === "=") {
        kind[i] = "bridge";
        init[i] = edgesFrom(t.slice(1));
      } else {
        kind[i] = "m";
        init[i] = edgesFrom(t);
      }
    }
  }
  const rowsM: number[][] = [];
  const colsM: number[][] = [];
  for (let y = 0; y < h; y++) {
    const a: number[] = [];
    for (let x = 0; x < w; x++) if (kind[y * w + x] === "m") a.push(y * w + x);
    rowsM.push(a);
  }
  for (let x = 0; x < w; x++) {
    const b: number[] = [];
    for (let y = 0; y < h; y++) if (kind[y * w + x] === "m") b.push(y * w + x);
    colsM.push(b);
  }
  return { w, h, kind, init, bld, name, rowsM, colsM, level };
}

/** Lane edges a cell offers right now. Buildings open on every side. */
export function edgesAt(P: Board, v: readonly number[], i: number): Edges {
  const k = P.kind[i];
  if (k === "m") return v[i] & 15;
  if (k === "bridge") return v[i];
  if (k === "b") return 15;
  return 0;
}

/** Can cell c step to neighbour n through direction D? Shared by route() and the UI's reach map. */
function canStep(P: Board, v: readonly number[], c: number, n: number, D: readonly [number, number, number, number]): boolean {
  if (!(edgesAt(P, v, n) & D[3])) return false;
  // two buildings side by side are not a lane
  if (P.kind[c] === "b" && P.kind[n] === "b") return false;
  return true;
}

/** Shortest walk from building `from` to building `to` over lanes. Returns the cell list, or null. */
export function route(P: Board, v: readonly number[], from: string, to: string): number[] | null {
  const s = P.bld[from];
  const t = P.bld[to];
  const { w, h } = P;
  const prev = new Int16Array(w * h).fill(-1);
  prev[s] = s;
  const q = [s];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (c === t) break;
    if (P.kind[c] === "b" && c !== s) continue; // never walk through another building
    const ce = edgesAt(P, v, c);
    const cx = c % w;
    const cy = (c / w) | 0;
    for (const D of DIRS) {
      if (!(ce & D[0])) continue;
      const nx = cx + D[1];
      const ny = cy + D[2];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (prev[n] !== -1) continue;
      if (P.kind[n] === "b" && n !== t) continue;
      if (!canStep(P, v, c, n, D)) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (prev[t] === -1) return null;
  const path = [t];
  while (path[0] !== s) path.unshift(prev[path[0]]);
  return path;
}

/** Every cell Pip could walk to from building `from` right now (used to light the lanes). */
export function reachable(P: Board, v: readonly number[], from: string): Set<number> {
  const start = P.bld[from];
  const seen = new Set<number>([start]);
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (P.kind[c] === "b" && c !== start) continue;
    const ce = edgesAt(P, v, c);
    const cx = c % P.w;
    const cy = Math.floor(c / P.w);
    for (const D of DIRS) {
      if (!(ce & D[0])) continue;
      const nx = cx + D[1];
      const ny = cy + D[2];
      if (nx < 0 || ny < 0 || nx >= P.w || ny >= P.h) continue;
      const n = ny * P.w + nx;
      if (seen.has(n)) continue;
      if (!canStep(P, v, c, n, D)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen;
}

export function canRotate(P: Board, v: readonly number[], i: number): boolean {
  const k = P.kind[i];
  if (k === "bridge") return true;
  return k === "m" && v[i] !== BED && !(v[i] & SUN) && v[i] !== 15;
}

function lineOf(P: Board, m: Move): number[] | undefined {
  if (m.t === "row") return P.rowsM[m.y];
  if (m.t === "col") return P.colsM[m.x];
  return undefined;
}

/** Move an array without applying tile effects; slides preserve arbitrary tile IDs. */
export function slide<T>(P: Board, v: readonly T[], m: Move): T[] {
  const o = v.slice();
  if (m.t === "r") {
    o[m.i] = (m.d > 0 ? rotCW(v[m.i] as number) : rotCCW(v[m.i] as number)) as T;
  } else {
    const line = lineOf(P, m);
    if (!line || line.length < 2) return o;
    const n = line.length;
    for (let j = 0; j < n; j++) o[line[(j + m.d + n) % n]] = v[line[j]];
  }
  return o;
}

/** Apply the player move, then turn all sunflowers before delivery is checked. */
export function apply(P: Board, v: readonly number[], m: Move): number[] {
  if (!legal(P, v, m)) return v.slice();
  const o = slide(P, v, m);
  for (let i = 0; i < o.length; i++) {
    if (P.kind[i] === "m" && (o[i] & SUN)) o[i] = SUN | rotCW(o[i] & 15);
  }
  return o;
}

export function legal(P: Board, v: readonly number[], m: Move): boolean {
  if (m.t === "r") return canRotate(P, v, m.i);
  const line = lineOf(P, m);
  return !!line && line.length >= 2;
}

/** All distinct moves from this board (skips duplicate rotations and 2-tile reverse slides). */
export function allMoves(P: Board, v: readonly number[]): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < P.w * P.h; i++) {
    if (!canRotate(P, v, i)) continue;
    out.push({ t: "r", i, d: 1 });
    const e = edgesAt(P, v, i);
    if (rotCW(e) !== rotCCW(e)) out.push({ t: "r", i, d: -1 });
  }
  for (let y = 0; y < P.h; y++) {
    if (P.rowsM[y].length >= 2) {
      out.push({ t: "row", y, d: 1 });
      if (P.rowsM[y].length > 2) out.push({ t: "row", y, d: -1 });
    }
  }
  for (let x = 0; x < P.w; x++) {
    if (P.colsM[x].length >= 2) {
      out.push({ t: "col", x, d: 1 });
      if (P.colsM[x].length > 2) out.push({ t: "col", x, d: -1 });
    }
  }
  return out;
}
