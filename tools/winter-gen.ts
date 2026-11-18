/**
 * Seeded search for Snowberry End's winter boards (#132). For each route it fills the layout's "?" cells and keeps boards whose
 * par is the target AND where every rule the route mixes in matters (see tools/lib/ablate.ts): with ice impassable, or the wind
 * removed, or sunflowers frozen, or the bridge gone, no satchel order solves within par; with the pie timer, the signed-parcel
 * key or the cat's "rides last" lifted, some order solves below par. No solver caps.
 *   node --import tsx tools/winter-gen.ts <route 1-10> <fromSeed> <toSeed> [maxHits] [stride]
 */
import { parse, solveOrder, validOrders, type Parcel, type Puzzle } from "../src/engine";
import { ablations, bestPar, CappedError, matters } from "./lib/ablate";
import { fill, type Mix } from "./lib/generate";

type Wind = NonNullable<Puzzle["wind"]>;
interface Spec { houses: Record<string, string>; layout: string[]; parcels: Parcel[]; par: number; mix: Mix; winds?: Wind[]; /** pie timers to try */ limits?: number[] }

const w = (line: "row" | "col", index: number, every: number, d: 1 | -1 = 1): Wind => ({ line, index, d, every });
const rows = (ix: number[], every: number[]) => ix.flatMap((i) => every.flatMap((e) => [w("row", i, e, 1), w("row", i, e, -1)]));
const cols = (ix: number[], every: number[]) => ix.flatMap((i) => every.flatMap((e) => [w("col", i, e, 1), w("col", i, e, -1)]));
/** The generator drops boards whose proof would store more boards than this (check-pars uses the same 6e6). The tests use no cap. */
const CAP = 6e6;
const MIX: Mix = { bed: 0.06, tee: 0.10, str: 0.35 };
/** A tile-rich fill (more tees): plenty of ways through, so the boards are not forced above their par. */
const RICH: Mix = { bed: 0.04, tee: 0.35, str: 0.25 };

export const SPECS: Record<number, Spec> = {
  1: {
    houses: { A: "wh1", B: "wh2" },
    layout: ["T A T T T", "T ? ~ ? T", "P ? # ? B", "T ? ~ ? T", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }],
    par: 4, mix: MIX,
  },
  2: {
    houses: { A: "wh2", B: "wh3" },
    layout: ["T A T T T", "T ? # ? T", "P ? ~ ? T", "T ? ~ ? B", "T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }],
    par: 5, mix: MIX,
  },
  3: {
    houses: { A: "wh3", B: "wh4", C: "wh1" },
    layout: ["T A T T C T", "T ? ~ ~ ? T", "P ? # # ? B", "T ? ~ ~ ? T", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "parcel" }],
    par: 5, mix: MIX,
  },
  4: {
    houses: { A: "wh4", B: "wh1", C: "wh2" },
    layout: ["T A T T T T", "T ? ? ~ ? T", "P ? ? # ? B", "T ? ? ~ ? C", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "pie", limit: 3 }],
    par: 5, mix: MIX, limits: [3, 4],
  },
  5: {
    houses: { A: "wh1", B: "wh2", C: "wh3", D: "wh4" },
    layout: ["T A ~ T C T", "T ? # ? ? B", "P ? ~ =NS ~ T", "T ? ~ ? ? D", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "parcel" }, { to: "D", kind: "cat" }],
    par: 6, mix: MIX,
  },
  6: {
    houses: { A: "wh2", B: "wh4", C: "wh1" },
    layout: ["T A T T C T", "T ? ? ~ ? T", "P ? ? # ? B", "T ? ? ~ ? T", "T T T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "parcel" }],
    par: 6, mix: MIX, winds: [...rows([1, 2, 3], [2, 3]), ...cols([1, 2, 4], [2, 3])],
  },
  7: {
    houses: { A: "wh3", B: "wh2", C: "wh4", D: "wh1" },
    layout: ["T A T T D T", "T ? T ~ ? T", "P ? ? # ? B", "T ? @NE ~ ? T", "T C T T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "signed", key: "B" }, { to: "D", kind: "parcel" }],
    par: 6, mix: RICH,
  },
  8: {
    houses: { A: "wh4", B: "wh3", C: "wh1", D: "wh2" },
    layout: ["T A T T T T", "P ? ? ? ? T", "T ~ ~ # ~ T", "T ? ? ? ? B", "T T C T D T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "pie", limit: 4 }, { to: "D", kind: "parcel" }],
    par: 7, mix: RICH, limits: [4, 5, 6], winds: [...rows([1, 3], [2, 3]), ...cols([1, 2, 3, 4], [2, 3])],
  },
  9: {
    houses: { A: "wh2", B: "wh1", C: "wh3", D: "wh4" },
    layout: ["T A ~ T C T", "T ? ~ @NE ? B", "P ? ~ =NS ~ T", "T ? # ? ? D", "T T ~ T T T"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "parcel" }, { to: "C", kind: "pie", limit: 4 }, { to: "D", kind: "parcel" }],
    par: 7, mix: RICH, limits: [4, 5, 6],
  },
  10: {
    houses: { A: "wh1", B: "wh2", C: "wh3", D: "wh4" },
    layout: ["T B ~ T D T", "T ? # @NE ? C", "P ? ~ =NS ~ T", "T ? ~ ? ? A", "T T T T T T"],
    parcels: [{ to: "A", kind: "parcel" }, { to: "B", kind: "parcel" }, { to: "C", kind: "signed", key: "A" }, { to: "D", kind: "parcel" }],
    par: 7, mix: RICH, winds: [...rows([1, 2, 3], [2, 3]), ...cols([1, 3, 4], [2, 3])],
  },
};

/** Does this board play at exactly the target par with every rule it uses mattering? Cheap checks first. */
export function accept(p: Puzzle, par: number): boolean {
  try {
    if (bestPar(p, par - 1, CAP) != null) return false; // nothing below par
    if (bestPar(p, par, CAP) !== par) return false; // some order at par
    return ablations(p).every((a) => matters(a, par, CAP));
  } catch (e) {
    if (e instanceof CappedError) return false; // too big to prove cheaply: not a board we want
    throw e;
  }
}

if (process.argv[1]?.endsWith("winter-gen.ts") && process.argv[2] !== "emit") {
  const [n, from, to, maxHits = "3", stride = "1"] = process.argv.slice(2);
  const S = { ...SPECS[+n] };
  if (!SPECS[+n]) throw new Error("route 1-10");
  if (process.env.NOWIND) S.winds = undefined; // fallback: the same layout without a gust
  if (process.env.PAR) S.par = +process.env.PAR; // try another par for the same layout
  let hits = 0;
  for (let seed = +from; seed < +to && hits < +maxHits; seed += +stride) {
    const grid = fill(S.layout, seed, S.mix);
    for (const limit of S.limits ?? [undefined]) {
      const parcels = S.parcels.map((q) => (q.kind === "pie" && limit ? { ...q, limit } : q));
      // the gust must matter, so the calm board (same for every wind) cannot solve within par: skip the whole seed if it can
      try { if (S.winds && bestPar({ grid, parcels }, S.par, CAP) != null) continue; } catch { continue; }
      for (const wind of S.winds ?? [undefined]) {
        if (!accept({ grid, parcels, wind }, S.par)) continue;
        hits++;
        console.log(`ROUTE ${n} SEED ${seed} limit ${limit} wind ${JSON.stringify(wind)}\n  ${JSON.stringify(grid)}`);
      }
    }
  }
}

/** The boards chosen from the search (seed, pie timer, wind), so `emit` rebuilds src/levels/winter.ts exactly. */
export const PICKS: Record<number, { seed: number; limit?: number; wind?: Wind }> = {
  1: { seed: 1 },
  2: { seed: 2 },
  3: { seed: 1 },
  4: { seed: 13, limit: 3 },
  5: { seed: 19 },
  6: { seed: 3, wind: w("row", 1, 3, -1) },
  9: { seed: 11, limit: 4 },
  10: { seed: 61, wind: w("row", 1, 3, 1) },
  7: { seed: 142 },
  8: { seed: 1, limit: 4, wind: w("row", 1, 3, 1) },
};

const COPY: Record<number, { blurb: string; tag: string; teach: string }> = {
  1: { blurb: "Winter route 1.", tag: "New: ice", teach: "Ice cannot be turned or slid. Line up a lane on each bank and Pip slides straight across." },
  2: { blurb: "Winter route 2.", tag: "Both banks", teach: "A crossing needs a lane facing the ice on both banks, in the same row. Slide a bank to line them up." },
  3: { blurb: "Winter route 3.", tag: "Long ice", teach: "Two ice cells make one longer crossing. Line up the banks across both." },
  4: { blurb: "Winter route 4.", tag: "Ice + pie", teach: "Cross the ice and still deliver the pie before it cools." },
  5: { blurb: "Winter route 5.", tag: "Sunday puzzle", teach: "Plan the ice, the footbridge and the cat together. The cat rides last." },
  6: { blurb: "Winter route 6.", tag: "Ice + gust", teach: "WIND Time your crossing around the gust." },
  7: { blurb: "Winter route 7.", tag: "Ice + signed", teach: "Deliver the signed parcel after its key holder. The sunflower keeps turning, so catch it on the ice's bank." },
  8: { blurb: "Winter route 8.", tag: "Ice + gust + pie", teach: "WIND Three rules against the clock: cross the ice and keep the pie warm while the gust blows." },
  9: { blurb: "Winter route 9.", tag: "Sunday puzzle", teach: "Plan the ice, the footbridge, the sunflower and the pie together." },
  10: { blurb: "Winter route 10.", tag: "Last lane", teach: "WIND Almost everything so far: ice, footbridge, sunflower, signed parcel and gust." },
};
const ORD = ["", "", "second", "third"];
const windText = (x: Wind) => `A gust slides ${x.line} ${x.index + 1} ${x.line === "row" ? (x.d === 1 ? "right" : "left") : x.d === 1 ? "down" : "up"} after every ${ORD[x.every]} move.`;

/** Rebuild the file: node --import tsx tools/winter-gen.ts emit > src/levels/winter.ts */
export function emit(): string {
  const out: string[] = ['/** Snowberry End’s winter routes. House codes and copy are neutral placeholders. */', 'import type { Route } from "./types";', "", "export const WINTER: Route[] = ["];
  for (const n of Object.keys(PICKS).map(Number)) {
    const S = SPECS[n], K = PICKS[n], C = COPY[n];
    const grid = fill(S.layout, K.seed, S.mix);
    const parcels = S.parcels.map((q) => (q.kind === "pie" && K.limit ? { ...q, limit: K.limit } : q));
    const puzzle: Puzzle = { grid, parcels, wind: K.wind };
    const P = parse(puzzle);
    let sol: { order: number[]; moves: unknown[] } | null = null;
    for (const o of validOrders(puzzle)) {
      const r = solveOrder(P, o, S.par, Infinity);
      if (r.par === S.par) { sol = { order: o, moves: r.line! }; break; }
    }
    if (!sol) throw new Error(`route ${n}: no solution at par ${S.par}`);
    const listed = parcels.map((_, j) => j);
    const fits = solveOrder(P, listed, S.par + 4, 6e6);
    const def = fits.par != null ? null : sol.order;
    const first = parcels.find((q) => q.kind === "letter") ?? parcels[0];
    const win = K.wind ? windText(K.wind) : "";
    const teach = C.teach.replace(/^WIND /, win ? win + " " : "");
    out.push("  {", `    id: "winter-${n}",`, `    name: "Winter route ${n}",`, `    blurb: ${JSON.stringify(C.blurb)},`, `    teach: ${JSON.stringify(teach)},`, `    tag: ${JSON.stringify(C.tag)},`);
    if (n === 5 || n === 9) out.push("    sunday: true,");
    if (def) out.push(`    def: ${JSON.stringify(def)}, // ${"the listed order cannot finish inside the teapot"}`);
    out.push(`    grid: ${JSON.stringify(grid)},`);
    if (K.wind) out.push(`    wind: ${JSON.stringify(K.wind).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ").replace("{", "{ ").replace("}", " }")},`);
    out.push(`    houses: { ${Object.entries(S.houses).filter(([k]) => grid.join(" ").split(/\s+/).includes(k)).map(([k, v]) => `${k}: "${v}"`).join(", ")} },`);
    out.push("    parcels: [", ...parcels.map((q) => `      ${JSON.stringify(q).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ").replace("{", "{ ").replace("}", " }")},${q.kind === "parcel" ? " // plain" : ""}`), "    ],");
    out.push(`    par: ${S.par},`, `    solution: ${JSON.stringify(sol)},`, "  },");
    void first;
  }
  out.push("];", "");
  return out.join("\n");
}
if (process.argv[2] === "emit") process.stdout.write(emit());
