import { describe, expect, it } from "vitest";
import { parse, solveOrder, validOrders } from "../src/engine";
import { SPRING } from "../src/levels";
import { solveOrder as reference } from "./fixtures/reference-solver";

describe("solver compatibility", () => {
  for (const L of SPRING) {
    it(`preserves complete results for every ${L.id} order, including caps`, () => {
      const P = parse(L);
      for (const order of validOrders(L)) {
        for (const countAll of [false, true]) {
          for (const [depth, cap] of [[0, 128], [2, 128], [3, 128], [3, 1]]) {
            expect(solveOrder(P, order, depth, cap, countAll)).toEqual(reference(P, order, depth, cap, countAll));
          }
        }
      }
    });
  }

  it("preserves wind-phase results, paths and winning-depth counts", () => {
    const P = parse({
      grid: ["P EW * A", "NW ES * NE"],
      parcels: [{ to: "A", kind: "letter" }],
      wind: { line: "row", index: 0, d: 1, every: 3 },
    });
    for (const depth of [2, 3, 4]) {
      for (const countAll of [false, true]) {
        expect(solveOrder(P, [0], depth, 4e6, countAll)).toEqual(reference(P, [0], depth, 4e6, countAll));
      }
    }
    expect(solveOrder(P, [0], 3).par).toBe(3);
  });

  it("preserves the move-zero result when a delivery is already possible", () => {
    const P = parse({ grid: ["P EW A"], parcels: [{ to: "A", kind: "letter" }] });
    expect(solveOrder(P, [0], 8)).toEqual({ par: -1 });
  });
});

it("solves and delivers a plain parcel like an ordinary delivery", () => {
  const level = { ...SPRING[0], parcels: SPRING[0].parcels.map((p) => ({ ...p, kind: "parcel" as const })) };
  const result = solveOrder(parse(level), level.solution.order, 20);
  expect(result.par).toBe(level.par);
  expect(result.line).toBeDefined();
});
