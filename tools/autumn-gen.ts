/**
 * Seeded search for Conker Corner's autumn boards (#131). For each route it fills the layout's "?" cells and keeps boards
 * whose par is the target AND where the gusts matter: with the wind removed no satchel order solves within par; on routes that
 * mix sunflowers, sunflowers frozen as ordinary tiles do not either.
 *   node --import tsx tools/autumn-gen.ts <route 1-10> <fromSeed> <toSeed> [maxHits] [stride]
 */
import { parse, solveOrder, validOrders, type Parcel, type Puzzle } from "../src/engine";
import { fill, type Mix } from "./lib/generate";

type Wind = NonNullable<Puzzle["wind"]>;
interface Spec { layout: string[]; parcels: Parcel[]; par: number; mix: Mix; sun?: boolean; winds: Wind[]; cap?: number }

const w = (line: "row" | "col", index: number, every: number, d: 1 | -1 = 1): Wind => ({ line, index, d, every });
const rows = (ix: number[], every: number[]) => ix.flatMap((i) => every.flatMap((e) => [w("row", i, e, 1), w("row", i, e, -1)]));
const cols = (ix: number[], every: number[]) => ix.flatMap((i) => every.flatMap((e) => [w("col", i, e, 1), w("col", i, e, -1)]));

export const SPECS: Record<number, Spec> = {
  1: {
    layout: ["T T A T T", "T ? ? ? B", "P ? ? ? T", "T ? ? ? T", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }],
    par: 4, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2, 3], [2]), ...cols([1, 2, 3], [2])],
  },
  2: {
    layout: ["T A T B T", "T ? ? ? T", "P ? ? ? T", "T ? ? ? T", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }],
    par: 4, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2, 3], [2, 3]), ...cols([1, 2, 3], [2, 3])],
  },
  3: {
    layout: ["T A T B T", "T ? ? ? T", "P ? ? ? C", "T ? ? ? T", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "parcel" }],
    par: 5, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: cols([1, 2, 3], [2, 3]),
  },
  4: {
    layout: ["T A T T T", "T ? ? ? B", "P ? ? ? T", "T ? ? ? C", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "pie", limit: 5 }, { to: "C", kind: "parcel" }],
    par: 5, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2, 3], [2, 3]), ...cols([1, 2, 3], [2, 3])],
  },
  5: {
    layout: ["T B ~ T T T", "T ? ~ ? A T", "P ? =NS ? ? T", "T ? ~ ? C T", "T T ~ T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "cat" }],
    par: 5, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2, 3], [2, 3]), ...cols([0, 1, 3], [2, 3])],
  },
  6: {
    layout: ["T A T B T T", "T ? @NE ? ? T", "P ? ? T C T", "T T ? T T T", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "parcel" }],
    par: 6, sun: true, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2], [2, 3]), ...cols([1, 2, 3], [2, 3])],
  },
  7: {
    layout: ["T A T B T T", "T ? ? ? T T", "P ? ? ? C T", "T T T ? D T", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "C", kind: "signed", key: "A" }, { to: "B", kind: "parcel" }, { to: "D", kind: "cat" }],
    par: 6, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2], [2, 3]), ...cols([1, 2, 3], [2, 3])],
  },
  8: {
    layout: ["T A T B T T", "T ? ? ? T T", "P ? ? ? C T", "T T T ? D T", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "C", kind: "pie", limit: 5 }, { to: "B", kind: "parcel" }, { to: "D", kind: "parcel" }],
    par: 6, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2], [2, 3]), ...cols([1, 2, 3], [2, 3])],
  },
  9: {
    layout: ["T B ~ T T T", "T ? ~ @EW A T", "P ? =NS ? ? T", "T T ~ ? C T", "T T ~ T T T"],
    parcels: [{ to: "C", kind: "letter" }, { to: "A", kind: "parcel" }, { to: "B", kind: "pie", limit: 6 }, { to: "C", kind: "cat" }],
    par: 7, sun: true, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2], [2, 3]), ...cols([3], [2, 3])],
  },
  10: {
    layout: ["T B ~ T T T", "T ? ~ @EW A T", "P ? =NS ? ? T", "T ? ~ ? C T", "T T ~ T T T"],
    parcels: [{ to: "A", kind: "parcel" }, { to: "B", kind: "parcel" }, { to: "C", kind: "signed", key: "B" }, { to: "A", kind: "cat" }],
    par: 7, sun: true, mix: { bed: 0.06, tee: 0.10, str: 0.35 }, winds: [...rows([1, 2], [2, 3]), ...cols([3], [2, 3])],
  },
};

/** Fewest moves over every valid order, up to maxDepth (null: none within it); `capped` if the search gave up. */
export function bestPar(p: Puzzle, maxDepth: number, cap: number): { par: number | null; capped: boolean; orders: number[] } {
  const P = parse(p);
  let par: number | null = null, capped = false, orders: number[] = [];
  for (const o of validOrders(p)) {
    const r = solveOrder(P, o, maxDepth, cap);
    if (r.capped) capped = true;
    if (r.par === -1) return { par: -1, capped, orders };
    if (r.par != null && (par == null || r.par < par)) par = r.par;
    if (r.par != null) orders.push(o.length);
  }
  return { par, capped, orders };
}

if (process.argv[1]?.endsWith("autumn-gen.ts")) {
  const [n, from, to, maxHits = "3", stride = "1"] = process.argv.slice(2);
  const S = SPECS[+n];
  if (!S) throw new Error("route 1-10");
  let hits = 0;
  for (let seed = +from; seed < +to && hits < +maxHits; seed += +stride) {
    const grid = fill(S.layout, seed, S.mix);
    for (const wind of S.winds) {
      const cap = S.cap ?? 6e6;
      const a = bestPar({ grid, parcels: S.parcels, wind }, S.par, cap);
      if (a.par !== S.par || a.capped) continue;
      const free = bestPar({ grid, parcels: S.parcels }, S.par, cap);
      if (free.par != null || free.capped) continue;
      if (S.sun) {
        const frozen = bestPar({ grid: grid.map((r) => r.replace(/@/g, "")), parcels: S.parcels, wind }, S.par, cap);
        if (frozen.par != null || frozen.capped) continue;
      }
      hits++;
      console.log(`ROUTE ${n} SEED ${seed} wind ${JSON.stringify(wind)}\n  ${JSON.stringify(grid)}`);
    }
  }
}
