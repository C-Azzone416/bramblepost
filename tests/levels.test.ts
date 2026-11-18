/**
 * Replay every stored solution and check the satchel rules. The exhaustive proof
 * that every par is minimal lives in `npm run check-pars`.
 */
import { describe, expect, it } from "vitest";
import { step, defaultOrder, deliverChain, orderProblem, parse, teapot, validOrders } from "../src/engine";
import { NEIGHBOURS } from "../src/ui/cast";
import { ROUTES } from "../src/levels";

describe("routes", () => {
  it("have unique ids", () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
  });

  it("the first thirteen spring pars are 2, 2, 4, 5, 6, 6, 7, 6, 6, 6, 6, 5, 6", () => {
    expect(ROUTES.slice(0, 13).map((r) => r.par)).toEqual([2, 2, 4, 5, 6, 6, 7, 6, 6, 6, 6, 5, 6]);
  });

  for (const L of ROUTES) {
    describe(L.name, () => {
      const P = parse(L);

      it("has a post office, every house it delivers to, and a neighbour for each", () => {
        expect(P.bld.P).toBeDefined();
        for (const p of L.parcels) {
          expect(P.bld[p.to], p.to).toBeDefined();
          expect(NEIGHBOURS[L.houses[p.to]], p.to).toBeDefined();
        }
      });

      it("starts with a legal satchel order", () => {
        expect(orderProblem(L, defaultOrder(L))).toBeNull();
      });

      it("isn't already solved before the first move", () => {
        for (const o of validOrders(L)) expect(deliverChain(P, P.init, o, 0)).toEqual([]);
      });

      it("stored solution delivers everything on time in par moves", () => {
        const { order, moves } = L.solution;
        expect(orderProblem(L, order)).toBeNull();
        expect(moves).toHaveLength(L.par);
        let v = P.init.slice();
        let next = 0;
        const got: number[] = [];
        moves.forEach((m, j) => {
          v = step(P, v, m, j + 1);
          for (const d of deliverChain(P, v, order, next)) {
            got[d.k] = j + 1;
            next++;
          }
        });
        expect(next).toBe(L.parcels.length);
        L.parcels.forEach((p, k) => {
          if (p.limit) expect(got[k]).toBeLessThanOrEqual(p.limit);
        });
        expect(L.par).toBeLessThanOrEqual(teapot(L.par));
      });

    });
  }
});
