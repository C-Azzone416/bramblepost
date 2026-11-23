/**
 * Rule ablations for the winter routes (#132). Every rule a board mixes in is derived from its data and switched off in turn:
 *
 *  - "help" rules open ways that would otherwise not exist, so with the rule switched off NO valid satchel order may solve within par:
 *      ice      every `#` becomes stream `~`: the same rooted, slide-skipping cell, but it can no longer be crossed (impassable)
 *      gust     the wind is removed
 *      sunflower every `@` becomes an ordinary tile with the same lanes, which can be rotated and slid like any other (so this also
 *                covers a fixed sunflower: an ordinary tile can do everything a fixed one can)
 *      bridge   every `=` becomes stream `~`: the crossing is gone
 *  - "limit" rules only restrict, so removing one can only help; they matter if removing it lets SOME valid order of the
 *    relaxed puzzle solve strictly below par:
 *      pie      the pie becomes a plain parcel (no timer)
 *      signed   the signed parcel becomes a plain parcel (no key holder to visit first)
 *      cat      the cat becomes a plain parcel (it need not ride last)
 */
import { parse, solveOrder, validOrders, type Puzzle } from "../../src/engine";

export type Rule = "ice" | "gust" | "sunflower" | "bridge" | "pie" | "signed" | "cat";
export interface Ablation {
  rule: Rule;
  /** "help": no order may solve within par without it. "limit": some order must solve below par without it. */
  mode: "help" | "limit";
  puzzle: Puzzle;
}

const plain = (p: Puzzle, kind: string): Puzzle["parcels"] => p.parcels.map((q) => (q.kind === kind ? { to: q.to, kind: "parcel" as const } : q));
const cells = (p: Puzzle) => p.grid.flatMap((r) => r.trim().split(/\s+/));

/** The rules a puzzle uses, with the puzzle that has each one switched off. */
export function ablations(p: Puzzle): Ablation[] {
  const out: Ablation[] = [];
  const t = cells(p);
  const swap = (re: RegExp, to: string) => p.grid.map((r) => r.trim().split(/\s+/).map((c) => (re.test(c) ? to : c)).join(" "));
  if (t.includes("#")) out.push({ rule: "ice", mode: "help", puzzle: { ...p, grid: swap(/^#$/, "~") } });
  if (p.wind) out.push({ rule: "gust", mode: "help", puzzle: { ...p, wind: undefined } });
  if (t.some((c) => c[0] === "@")) out.push({ rule: "sunflower", mode: "help", puzzle: { ...p, grid: p.grid.map((r) => r.trim().split(/\s+/).map((c) => (c[0] === "@" ? c.slice(1) : c)).join(" ")) } });
  if (t.some((c) => c[0] === "=")) out.push({ rule: "bridge", mode: "help", puzzle: { ...p, grid: swap(/^=/, "~") } });
  for (const rule of ["pie", "signed", "cat"] as const)
    if (p.parcels.some((q) => q.kind === rule)) out.push({ rule, mode: "limit", puzzle: { ...p, parcels: plain(p, rule) } });
  return out;
}

/** A search that stored more boards than the cap it was given (only the generator passes one). */
export class CappedError extends Error {}

/**
 * Fewest moves over every valid order within maxDepth (null: none). The proof (tests, `check-pars`) passes no cap: the search is
 * exhaustive. The generator passes one only to drop boards too big to prove cheaply; it never accepts a capped answer.
 */
export function bestPar(p: Puzzle, maxDepth: number, cap = Infinity): number | null {
  const P = parse(p);
  let best: number | null = null;
  for (const o of validOrders(p)) {
    const r = solveOrder(P, o, best == null ? maxDepth : best - 1, cap);
    if (r.capped) throw new CappedError();
    if (r.par === -1) return -1;
    if (r.par != null && (best == null || r.par < best)) best = r.par;
  }
  return best;
}

/** Does the rule matter at this par? (See the header for the two meanings.) */
export function matters(a: Ablation, par: number, cap = Infinity): boolean {
  if (a.mode === "help") return bestPar(a.puzzle, par, cap) == null;
  return bestPar(a.puzzle, par - 1, cap) != null;
}

/** Best par of the ablated puzzle up to maxDepth, for the report table (null: unsolvable within maxDepth). */
export const ablatedPar = (a: Ablation, maxDepth: number) => bestPar(a.puzzle, maxDepth);
