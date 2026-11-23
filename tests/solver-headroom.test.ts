import { describe, expect, it } from "vitest";
import { deliverChain, legal, parse, solveOrder, step, validOrders } from "../src/engine";
import { HEADROOM } from "./fixtures/headroom";
import { solveOrder as reference } from "./fixtures/reference-solver";

describe("later-season solver headroom", () => {
  for (const fixture of HEADROOM) {
    it(`solves the generated 6x5 par-${fixture.par} board without a cap`, () => {
      const P = parse(fixture.puzzle);
      expect([P.w, P.h]).toEqual([6, 5]);
      expect(validOrders(P.level)).toEqual([[0, 1, 2]]);
      const order = [0, 1, 2];
      const shallower = solveOrder(P, order, fixture.par - 1);
      expect(shallower.par).toBeNull();
      expect(shallower.capped).toBeUndefined();
      for (const countAll of [false, true]) {
        const result = solveOrder(P, order, fixture.par, 4e6, countAll);
        expect(result).toEqual(reference(P, order, fixture.par, 4e6, countAll));
        expect(result.par).toBe(fixture.par);
        expect(result.capped).toBeUndefined();
        expect(result.line).toEqual(fixture.moves);
      }

      let v = P.init.slice();
      let next = 0;
      let crossedIce = false;
      for (const [i, m] of fixture.moves.entries()) {
        expect(legal(P, v, m)).toBe(true);
        v = step(P, v, m, i + 1);
        for (const delivery of deliverChain(P, v, order, next)) {
          expect(i + 1).toBeLessThanOrEqual(P.level.parcels[delivery.k].limit ?? Infinity);
          crossedIce ||= delivery.path.some((cell) => P.kind[cell] === "ice");
          next++;
        }
      }
      expect(next).toBe(order.length);
      expect(crossedIce).toBe(true);
      expect(P.kind).toContain("bridge");
    });
  }
});
