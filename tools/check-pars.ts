/**
 * Exhaustive spring par proof, deliberately outside the fast unit suite.
 *   npm run check-pars
 *   npm run check-pars -- --reference  also compare complete SolveResults with
 *                                    the frozen pre-#123 solver
 * Run in a separate CI job; --reference is useful when changing the solver.
 */
import assert from "node:assert/strict";
import { parse, solveOrder, validOrders } from "../src/engine";
import { SPRING } from "../src/levels";
import { solveOrder as reference } from "../tests/fixtures/reference-solver";
import { HEADROOM } from "../tests/fixtures/headroom";

const compare = process.argv.includes("--reference");
for (const L of SPRING) {
  const start = performance.now();
  const P = parse(L);
  for (const order of validOrders(L)) {
    const result = solveOrder(P, order, L.par - 1, 6e6);
    assert.ok(!result.capped, `${L.id} order ${order} hit the search cap`);
    assert.equal(result.par, null, `${L.id} order ${order} solves below stored par`);
    if (compare) assert.deepEqual(result, reference(P, order, L.par - 1, 6e6), `${L.id} order ${order}`);
  }
  const order = L.solution.order;
  // CI needs one witness at par; the solver audit also checks the full winning
  // depth and its solution count against the reference implementation.
  const result = solveOrder(P, order, L.par, 6e6, compare);
  assert.equal(result.par, L.par, `${L.id} known order must solve at stored par`);
  assert.ok(!result.capped, `${L.id} known order hit the search cap`);
  if (compare) assert.deepEqual(result, reference(P, order, L.par, 6e6, true), `${L.id} winning depth`);
  console.log(`${L.id}: par ${result.par}, all orders checked${compare ? ", reference identical" : ""} (${Math.round(performance.now() - start)}ms)`);
}

for (const fixture of HEADROOM) {
  const start = performance.now();
  const P = parse(fixture.puzzle);
  const order = [0, 1, 2];
  const below = solveOrder(P, order, fixture.par - 1);
  assert.equal(below.par, null);
  assert.ok(!below.capped);
  const result = solveOrder(P, order, fixture.par, 4e6, compare);
  assert.equal(result.par, fixture.par);
  assert.ok(!result.capped);
  if (compare) {
    assert.deepEqual(below, reference(P, order, fixture.par - 1));
    assert.deepEqual(result, reference(P, order, fixture.par, 4e6, true));
  }
  console.log(`headroom seed ${fixture.seed}: par ${result.par}${compare ? ", reference identical" : ""} (${Math.round(performance.now() - start)}ms)`);
}
