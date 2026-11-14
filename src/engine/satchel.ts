/** Satchel rules: which delivery orders are allowed, and delivering as far as the board allows. */
import { route } from "./board";
import type { Board, Delivery, Puzzle } from "./types";

/** Why an order breaks a satchel rule, or null if it's fine. */
export function orderProblem(level: Puzzle, order: readonly number[]): string | null {
  const ps = order.map((k) => level.parcels[k]);
  for (let j = 0; j < ps.length; j++) {
    const p = ps[j];
    if (p.kind === "cat" && j !== ps.length - 1) return "The cat always rides last.";
    if (p.kind === "signed") {
      let kj = -1;
      ps.forEach((q, qi) => {
        if (q.to === p.key) kj = qi;
      });
      if (kj === -1 || kj > j) return "This gate opens only after you visit the key holder.";
    }
  }
  return null;
}

export function permutations(n: number): number[][] {
  const res: number[][] = [];
  const a: number[] = [];
  const used: boolean[] = [];
  (function rec() {
    if (a.length === n) {
      res.push(a.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      a.push(i);
      rec();
      a.pop();
      used[i] = false;
    }
  })();
  return res;
}

export function validOrders(level: Puzzle): number[][] {
  return permutations(level.parcels.length).filter((o) => !orderProblem(level, o));
}

/** The order a route starts with: level.def if given, else the satchel as listed. */
export function defaultOrder(level: Puzzle & { def?: number[] }): number[] {
  return (level.def ?? level.parcels.map((_, j) => j)).slice();
}

/**
 * Deliver as far as the board allows, starting with order[next].
 * Pip walks from the post office (or his last stop) to each next stop in turn.
 */
export function deliverChain(P: Board, v: readonly number[], order: readonly number[], next: number): Delivery[] {
  const out: Delivery[] = [];
  const parcels = P.level.parcels;
  while (next < order.length) {
    const from = next === 0 ? "P" : parcels[order[next - 1]].to;
    const to = parcels[order[next]].to;
    const path = route(P, v, from, to);
    if (!path) break;
    out.push({ k: order[next], path });
    next++;
  }
  return out;
}
