/**
 * Breadth-first solver: the fewest moves that deliver everything on time for one satchel order.
 * Boards are stored as compact strings with parent links, so depth 6-7 on a 6x5 board fits in memory.
 */
import { allMoves, applyUnchecked, step } from "./board";
import { deliverChain, validOrders } from "./satchel";
import type { Board, Move, SolveResult } from "./types";

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

  const enc = (v: number[], nx: number, depth: number) => String.fromCharCode(...v) + String.fromCharCode(nx) + (lv.wind ? String.fromCharCode(depth % lv.wind.every) : "");
  const dec = (k: string) => {
    const v = new Array<number>(P.init.length);
    for (let i = 0; i < v.length; i++) v[i] = k.charCodeAt(i);
    return v;
  };
  const k0 = enc(v0, 0, 0);
  const parent = new Map<string, [string, Move] | null>();
  parent.set(k0, null);
  let frontier = [k0];
  let count = 1;
  let found = null as SolveResult | null;
  let nsol = 0;

  const lineTo = (k: string, lastMove: Move) => {
    const ms = [lastMove];
    let p = parent.get(k);
    while (p) {
      ms.unshift(p[1]);
      p = parent.get(p[0]);
    }
    return ms;
  };

  for (let depth = 1; depth <= maxDepth; depth++) {
    const nf: string[] = [];
    for (const sk of frontier) {
      const sv = dec(sk);
      const snext = sk.charCodeAt(P.init.length);
      for (const m of allMoves(P, sv)) {
        const v = lv.wind ? step(P, sv, m, depth, true) : applyUnchecked(P, sv, m);
        const got = deliverChain(P, v, order, snext);
        const nx = snext + got.length;
        let late = false;
        for (let g = snext; g < nx; g++) if (depth > limits[g]) late = true;
        for (let g = nx; g < n; g++) if (depth >= limits[g]) late = true;
        if (late) continue;
        if (nx === n) {
          if (!found) found = { par: depth, line: lineTo(sk, m) };
          nsol++;
          if (!countAll) return { ...found, states: count, solutions: 1 };
          continue;
        }
        if (depth === maxDepth) continue;
        const k = enc(v, nx, depth);
        if (parent.has(k)) continue;
        parent.set(k, [sk, m]);
        count++;
        if (count > cap) return { par: null, states: count, capped: true };
        nf.push(k);
      }
    }
    if (found) return { ...found, states: count, solutions: nsol };
    frontier = nf;
    if (!frontier.length) break;
  }
  return { par: null, states: count };
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
