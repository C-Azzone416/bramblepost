import { describe, expect, it } from "vitest";
import { parse, route, reachable, canRotate, slide, solveOrder, allMoves } from "../src/engine";

const board = (...grid: string[]) => parse({ grid, parcels: [{ to: "A", kind: "letter" }] });
describe("ice", () => {
  it("crosses one or two rooted ice cells", () => {
    for (const middle of ["#", "# #"]) {
      const p = board(`P EW ${middle} EW A`);
      expect(p.kind[2]).toBe("ice");
      expect(canRotate(p, p.init, 2)).toBe(false);
      expect(route(p, p.init, "P", "A")).toEqual(p.kind.map((_, i) => i));
    }
  });
  it("does not enter an incomplete crossing or turn on ice", () => {
    const p = board("P EW # NS A", "T T EW T T");
    expect(route(p, p.init, "P", "A")).toBeNull();
    expect(reachable(p, p.init, "P").has(2)).toBe(false);
  });
  it("skips ice in row and column slides", () => {
    const p = board("P EW # NS A", "T NS # EW T", "T EW T NS T");
    expect(slide(p, p.init, {t:"row", y:0, d:1})[2]).toBe(0);
    expect(slide(p, p.init, {t:"col", x:2, d:1})[7]).toBe(0);
    expect(p.rowsM[0]).toEqual([1, 3]);
  });
  it("rejects buildings beside ice", () => {
    expect(() => board("P # EW A")).toThrow(/adjacent to ice/);
  });
  it("solves a crossing after one rotation", () => {
    const p = board("P NS # EW A");
    expect(allMoves(p, p.init).some(m => m.t === "r" && m.i === 1)).toBe(true);
    expect(solveOrder(p, [0], 1).par).toBe(1);
  });
});
