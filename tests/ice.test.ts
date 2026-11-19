import { describe, expect, it } from "vitest";
import { parse, route, reachable, reachableCrossings, canRotate, slide, solveOrder, allMoves } from "../src/engine";

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
  describe("reachableCrossings", () => {
    const sort = (x: { cells: number[]; axis: string }[]) => x.map((c) => `${c.axis}:${c.cells}`).sort();
    it("lists a one- and a two-cell crossing with their axis", () => {
      expect(sort(reachableCrossings(board("P EW # EW A"), board("P EW # EW A").init, "P"))).toEqual(["h:2"]);
      const p = board("P EW # # EW A");
      expect(sort(reachableCrossings(p, p.init, "P"))).toEqual(["h:2,3"]);
      const q = board("P NS # NS A", "T T EW T T");
      expect(reachableCrossings(q, q.init, "P")).toEqual([]);
    });
    it("is empty without ice, and leaves reachable() as it was", () => {
      const p = board("P EW EW A");
      expect(reachableCrossings(p, p.init, "P")).toEqual([]);
      const q = board("P EW # EW A");
      expect([...reachable(q, q.init, "P")].sort()).toEqual([0, 1, 2, 3, 4]);
    });
    it("reports a vertical crossing as vertical", () => {
      const p = board("T P T", "T NS T", "T # T", "T NS T", "T A T");
      expect(sort(reachableCrossings(p, p.init, "P"))).toEqual(["v:7"]);
    });
    it("a horizontal crossing is not joined by a vertical one just because the tiles above and below are reachable", () => {
      // (2,0) faces the ice and is reachable; (2,2) is reachable too, but has no lane facing back up: no vertical crossing
      const p = board("T ES SW T T", "P NESW # EW A", "T NE EW T T");
      expect(reachable(p, p.init, "P").has(2)).toBe(true);
      expect(reachable(p, p.init, "P").has(12)).toBe(true);
      expect(sort(reachableCrossings(p, p.init, "P"))).toEqual(["h:7"]);
    });
    it("finds both crossings where a horizontal and a vertical one meet on the same ice", () => {
      const p = board("T T P T T", "T ES NESW T T", "T NE # EW T", "T T NS T A");
      expect(sort(reachableCrossings(p, p.init, "P"))).toEqual(["h:12", "v:12"]);
    });
    it("keeps two adjacent ice strips from different crossings apart", () => {
      const p = board("T ES SW T T", "P NESW # EW A", "T NE # EW T");
      expect(sort(reachableCrossings(p, p.init, "P"))).toEqual(["h:12", "h:7"]);
    });
  });
});
