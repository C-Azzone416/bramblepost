/**
 * Solve routes: par for every satchel order, plus a par solution line to paste into the level data.
 *   npm run solve              all routes (Hollow Lane takes about a minute)
 *   npm run solve -- hollow    one route by id
 *   npm run solve -- hollow 8  search deeper than the default 7 moves
 */
import { apply, defaultOrder, deliverChain, parse, solveLevel } from "../src/engine";
import { ROUTES } from "../src/levels";

const [id, depthArg] = process.argv.slice(2);
const maxDepth = depthArg ? +depthArg : 7;
const routes = id ? ROUTES.filter((r) => r.id === id) : ROUTES;
if (!routes.length) {
  console.error(`No route "${id}". Ids: ${ROUTES.map((r) => r.id).join(", ")}`);
  process.exit(1);
}

let drift = false;
for (const L of routes) {
  const t = Date.now();
  const P = parse(L);
  const { best, orders } = solveLevel(P, maxDepth);
  const def = defaultOrder(L).join("");
  console.log(`\n${L.name} (${L.id})  ${P.w}x${P.h}  ${Date.now() - t}ms`);
  for (const o of orders) {
    const par = o.par === -1 ? "already solved at move 0!" : o.par ?? (o.capped ? "search capped" : `none within ${maxDepth}`);
    console.log(`  order ${o.order.join("")}${o.order.join("") === def ? " (default)" : ""}: ${par}${o.solutions ? `  (${o.solutions} solutions)` : ""}`);
  }
  if (!best?.line) {
    console.log("  No solution found.");
    drift = true;
    continue;
  }
  // replay through the same engine the page uses
  let v = P.init.slice();
  let next = 0;
  for (const m of best.line) {
    v = apply(P, v, m);
    next += deliverChain(P, v, best.order, next).length;
  }
  if (next !== L.parcels.length) throw new Error(`Replay failed for ${L.id}`);
  console.log(`  par ${best.par}${best.par === L.par ? "" : `  (level data says ${L.par}: update it)`}`);
  console.log(`  solution: ${JSON.stringify({ order: best.order, moves: best.line })}`);
  if (best.par !== L.par) drift = true;
}
process.exitCode = drift ? 1 : 0;
