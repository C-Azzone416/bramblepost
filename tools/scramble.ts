/**
 * Scramble search: start from a solved board, make k random moves, and keep scrambles whose best par
 * equals the target. Good for hand-designed routes.
 *   npx tsx tools/scramble.ts <name> <k> <targetPar> <fromSeed> <toSeed>
 *   npx tsx tools/scramble.ts footbridge 6 5 0 100
 */
import { allMoves, apply, edgesToString, parse, type Board, type Move, type Parcel } from "../src/engine";
import { evalLevel, fill, rng } from "./lib/generate";

/** Solved boards ("?" cells are filled at random first). */
const SOLVED: Record<string, { solved: string[]; parcels: Parcel[] }> = {
  footbridge: {
    solved: ["B SW ~ ? ?", "? NS ~ ES A", "P NEW =EW NW NS", "? T ~ ? NS", "? ? ~ C NW"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "seeds" }, { to: "C", kind: "cat" }],
  },
  sunday: {
    solved: ["B ? ? ~ T ?", "NS ? ? ~ ? D", "NES P ES =EW SW NS", "NS ? NS ~ NS NS", "A EW NW ~ NE C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "pie", limit: 5 },
      { to: "D", kind: "cat" },
    ],
  },
};
const MIX = { bed: 0.14, tee: 0.03, str: 0.42 };

function toTokens(P: Board, v: number[]): string[] {
  const rows: string[] = [];
  for (let y = 0; y < P.h; y++) {
    const r: string[] = [];
    for (let x = 0; x < P.w; x++) {
      const i = y * P.w + x;
      const k = P.kind[i];
      if (k === "m") r.push(v[i] === 16 ? "*" : edgesToString(v[i]) || "*");
      else if (k === "bridge") r.push("=" + edgesToString(v[i]));
      else if (k === "water") r.push("~");
      else if (k === "tree") r.push("T");
      else r.push(P.name[i]);
    }
    rows.push(r.join(" "));
  }
  return rows;
}

const [name, k, target, from, to] = process.argv.slice(2);
const L = SOLVED[name];
if (!L || !to) {
  console.error(`Usage: npx tsx tools/scramble.ts <${Object.keys(SOLVED).join("|")}> <k> <targetPar> <fromSeed> <toSeed>`);
  process.exit(1);
}
for (let s = +from; s < +to; s++) {
  const P = parse({ grid: fill(L.solved, s, MIX), parcels: L.parcels });
  const r = rng(s * 31 + 7, 5);
  let v = P.init.slice();
  let last: Move | null = null;
  for (let i = 0; i < +k; i++) {
    // don't immediately undo the previous slide
    const ms = allMoves(P, v).filter(
      (m) => !(last && m.t !== "r" && m.t === last.t && (m as { y?: number }).y === (last as { y?: number }).y && (m as { x?: number }).x === (last as { x?: number }).x && m.d === -last.d),
    );
    const m = ms[(r() * ms.length) | 0];
    v = apply(P, v, m);
    last = m;
  }
  const grid = toTokens(P, v);
  const t = Date.now();
  const res = evalLevel({ grid, parcels: L.parcels }, +target, 4e6);
  if (!res) continue;
  const pars = res.map((x) => x.par).filter((x): x is number => x != null);
  const best = pars.length ? Math.min(...pars) : null;
  console.log(`SEED ${s} best ${best} ${res.map((x) => x.o + ":" + x.par + (x.par === best ? `(${x.sol})` : "") + (x.capped ? "C" : "")).join(" ")} ${Date.now() - t}ms`);
  if (best === +target) {
    console.log("  " + JSON.stringify(grid));
    console.log("  " + JSON.stringify(res.find((x) => x.par === best)!.line));
  }
}
