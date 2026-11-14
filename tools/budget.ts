/**
 * Teapot check: for every satchel order, the fewest moves that finish within the pot (par + 4),
 * with pie timers enforced. Shows whether the starting order can still finish, and which orders can't.
 *   npm run budget            all routes (slow for Hollow Lane)
 *   npm run budget -- clover  one route
 */
import { defaultOrder, parse, solveOrder, teapot, validOrders, type SolveResult } from "../src/engine";
import { ROUTES } from "../src/levels";

const id = process.argv[2];
for (const L of ROUTES.filter((r) => !id || r.id === id)) {
  const P = parse(L);
  const pot = teapot(L.par);
  const def = defaultOrder(L).join("");
  const out: string[] = [];
  for (const o of validOrders(L)) {
    let r: SolveResult = { par: null };
    for (let d = 1; d <= pot; d++) {
      r = solveOrder(P, o, d, 4e6);
      if (r.par != null || r.capped) break;
    }
    const key = o.join("");
    out.push(`${key}:${r.par ?? (r.capped ? "?" : "none")}${key === def ? "(default)" : ""}`);
  }
  console.log(`${L.id} teapot ${pot}  ${out.join("  ")}`);
}
