/** Helpers for the level generators: seeded random fill and per-order solving. */
import { parse, solveOrder, validOrders, type Puzzle } from "../../src/engine";

export function rng(seed: number, warmup = 3): () => number {
  let s = seed >>> 0 || 1;
  for (let i = 0; i < warmup; i++) s = (s * 16807) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Share of each tile type when filling a "?" cell; the rest are corners. */
export interface Mix {
  bed: number;
  tee: number;
  str: number;
}

const STR = ["NS", "EW"];
const COR = ["NE", "ES", "SW", "NW"];
const TEE = ["NES", "ESW", "NSW", "NEW"];

/** Replace every "?" in a layout with a random movable tile. */
export function fill(layout: string[], seed: number, mix: Mix): string[] {
  const r = rng(seed);
  return layout.map((row) =>
    row
      .split(/\s+/)
      .map((t) => {
        if (t !== "?") return t;
        const x = r();
        if (x < mix.bed) return "*";
        if (x < mix.bed + mix.tee) return TEE[(r() * 4) | 0];
        if (x < mix.bed + mix.tee + mix.str) return STR[(r() * 2) | 0];
        return COR[(r() * 4) | 0];
      })
      .join(" "),
  );
}

export interface OrderResult {
  o: string;
  par: number | null;
  line?: unknown;
  sol?: number;
  capped?: boolean;
}

/** Solve every valid order up to maxDepth. Returns null if the board is already solved at move 0. */
export function evalLevel(lv: Puzzle, maxDepth: number, cap: number): OrderResult[] | null {
  const P = parse(lv);
  const res: OrderResult[] = [];
  for (const o of validOrders(lv)) {
    const r = solveOrder(P, o, maxDepth, cap, true);
    if (r.par === -1) return null;
    res.push({ o: o.join(""), par: r.par, line: r.line, sol: r.solutions, capped: r.capped });
  }
  return res;
}
