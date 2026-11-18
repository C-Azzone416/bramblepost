import { describe, expect, it } from "vitest";
import { parse, step, apply, SUN, E, deliverChain, solveOrder } from "../src/engine";

describe("wind", () => {
  it("gusts every third move, wrapping garden tiles past rooted cells and carrying turned sunflowers", () => {
    const P = parse({ grid: ["@N T EW *", "P N A *"], parcels: [], wind: { line: "row", index: 0, d: 1, every: 3 } });
    const m = { t: "r", i: 5, d: 1 } as const;
    for (const n of [1, 2, 4, 5]) expect(step(P, P.init, m, n)).toEqual(apply(P, P.init, m));
    for (const n of [3, 6, 9]) {
      const v = step(P, P.init, m, n);
      expect(v.slice(0, 4)).toEqual([16, 0, SUN | E, 10]);
    }
    expect(step(P, P.init, m, 3)[2] & 15).toBe(E);
  });
  it("checks delivery on the gusted board", () => {
    const P = parse({ grid: ["P NS A EW", "* N * *"], parcels: [{ to: "A", kind: "letter" }], wind: { line: "row", index: 0, d: 1, every: 3 } });
    const m = { t: "r", i: 5, d: 1 } as const;
    expect(deliverChain(P, apply(P, P.init, m), [0], 0)).toHaveLength(0);
    expect(deliverChain(P, step(P, P.init, m, 3), [0], 0)).toHaveLength(1);
  });
  it("retains boards reached at different wind phases in the solver", () => {
    const P = parse({ grid: ["P EW * A", "NW ES * NE"], parcels: [{ to: "A", kind: "letter" }], wind: { line: "row", index: 0, d: 1, every: 3 } });
    expect(solveOrder(P, [0], 3).par).toBe(3);
  });

});
