/**
 * Random level search: fill a layout's "?" cells for a range of seeds and print boards whose best par
 * equals the target.
 *   npm run gen -- <layout> <targetPar> <fromSeed> <toSeed>
 *   npm run gen -- millpond 4 0 200
 * Layouts live in tools/layouts.ts.
 */
import { evalLevel, fill } from "./lib/generate";
import { LAYOUTS } from "./layouts";

const [name, target, from, to] = process.argv.slice(2);
const L = LAYOUTS[name];
if (!L || !target || !from || !to) {
  console.error(`Usage: npm run gen -- <${Object.keys(LAYOUTS).join("|")}> <targetPar> <fromSeed> <toSeed>`);
  process.exit(1);
}
const tgt = +target;
for (let s = +from; s < +to; s++) {
  const grid = fill(L.layout, s, L.mix);
  const t = Date.now();
  const res = evalLevel({ grid, parcels: L.parcels, wind: L.wind }, tgt, L.cap ?? 4e6);
  if (!res) continue;
  const pars = res.map((x) => x.par).filter((x): x is number => x != null);
  const best = pars.length ? Math.min(...pars) : null;
  if (best !== tgt) continue;
  const bo = res.filter((x) => x.par === best);
  const line = bo[0].line as { t: string }[];
  if (L.needSlide && !line.some((m) => m.t !== "r")) continue;
  const sols = bo.reduce((a, x) => a + (x.sol ?? 0), 0);
  console.log(`SEED ${s} best ${best} sols ${sols} orders ${res.map((x) => x.o + ":" + x.par + (x.par === best ? `(${x.sol})` : "")).join(" ")} ${Date.now() - t}ms`);
  console.log("  " + JSON.stringify(grid));
  console.log("  " + JSON.stringify(line));
}
