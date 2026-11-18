/** Breadth-first solver with packed state records and numeric parent links. */
import { allMoves, applyUnchecked, step } from "./board";
import { deliverChain, validOrders } from "./satchel";
import { SolverStates } from "./solver-states";
import type { Board, Move, SolveResult } from "./types";

function encodeMove(m: Move): number {
  return (m.t === "r" ? m.i * 6 : m.t === "row" ? m.y * 6 + 2 : m.x * 6 + 4) + (m.d === -1 ? 1 : 0);
}

function decodeMove(code: number): Move {
  const index = Math.floor(code / 6);
  const kind = code % 6;
  const d = kind % 2 === 0 ? 1 : -1;
  return kind < 2 ? { t: "r", i: index, d } : kind < 4 ? { t: "row", y: index, d } : { t: "col", x: index, d };
}

/**
 * @param maxDepth  give up after this many moves
 * @param cap       give up after storing this many boards (result has capped: true)
 * @param countAll  keep counting every solution at the winning depth (slower)
 */
export function solveOrder(P: Board, order: readonly number[], maxDepth: number, cap = 4e6, countAll = false): SolveResult {
  const lv = P.level;
  const n = order.length;
  const limits = order.map((k) => lv.parcels[k].limit ?? 99);
  const v0 = P.init.slice();
  if (deliverChain(P, v0, order, 0).length) return { par: -1 };

  const cells = P.kind.flatMap((kind, i) => kind === "m" || kind === "bridge" ? [i] : []);
  const tileWords = Math.ceil(cells.length / 5);
  // Five six-bit tiles per word, then progress and wind phase (16 bits each,
  // matching the previous string key). All parsed tile values fit in six bits.
  const key = new Uint32Array(tileWords + 1);
  const enc = (v: number[], next: number, depth: number) => {
    for (let word = 0, cell = 0; word < tileWords; word++) {
      let packed = 0;
      for (let shift = 0; shift < 30 && cell < cells.length; shift += 6) packed |= v[cells[cell++]] << shift;
      key[word] = packed;
    }
    key[tileWords] = (next & 65535) | ((lv.wind ? depth % lv.wind.every : 0) << 16);
    return key;
  };
  const states = new SolverStates(key.length);
  states.add(enc(v0, 0, 0), 0xffffffff, 0);
  // Insertion order is BFS order, so each frontier is a contiguous index range.
  let first = 0;
  let end = 1;
  let found = null as SolveResult | null;
  let nsol = 0;

  const lineTo = (id: number, lastMove: Move) => {
    const ms = [lastMove];
    while (id !== 0) {
      const record = states.read(id);
      ms.push(decodeMove(record[key.length + 1]));
      id = record[key.length];
    }
    return ms.reverse();
  };

  const sv = v0.slice();
  for (let depth = 1; depth <= maxDepth; depth++) {
    for (let id = first; id < end; id++) {
      const record = states.read(id);
      for (let word = 0, cell = 0; word < tileWords; word++) {
        const packed = record[word];
        for (let shift = 0; shift < 30 && cell < cells.length; shift += 6) sv[cells[cell++]] = (packed >>> shift) & 63;
      }
      const snext = record[tileWords] & 65535;
      for (const m of allMoves(P, sv)) {
        const v = lv.wind ? step(P, sv, m, depth, true) : applyUnchecked(P, sv, m);
        const got = deliverChain(P, v, order, snext);
        const nx = snext + got.length;
        let late = false;
        for (let g = snext; g < nx; g++) if (depth > limits[g]) late = true;
        for (let g = nx; g < n; g++) if (depth >= limits[g]) late = true;
        if (late) continue;
        if (nx === n) {
          if (!found) found = { par: depth, line: lineTo(id, m) };
          nsol++;
          if (!countAll) return { ...found, states: states.size, solutions: 1 };
          continue;
        }
        if (depth === maxDepth) continue;
        if (states.add(enc(v, nx, depth), id, encodeMove(m)) === -1) continue;
        if (states.size > cap) return { par: null, states: states.size, capped: true };
      }
    }
    if (found) return { ...found, states: states.size, solutions: nsol };
    first = end;
    end = states.size;
    if (first === end) break;
  }
  return { par: null, states: states.size };
}

/** Par for a level: the best result over every valid satchel order, searching up to maxDepth. */
export function solveLevel(P: Board, maxDepth: number, cap = 6e6) {
  const orders: (SolveResult & { order: number[] })[] = validOrders(P.level).map((order) => {
    let r: SolveResult = { par: null };
    for (let d = 1; d <= maxDepth; d++) {
      r = solveOrder(P, order, d, cap, true);
      if (r.par != null || r.capped) break;
    }
    return Object.assign({ order }, r);
  });
  let best: (typeof orders)[number] | null = null;
  for (const o of orders) if (o.par != null && o.par >= 0 && (!best || o.par < best.par!)) best = o;
  return { best, orders };
}
