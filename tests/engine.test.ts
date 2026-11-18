import { describe, expect, it } from "vitest";
import {
  BED,
  SUN,
  edgesAt,
  E,
  N,
  S,
  W,
  allMoves,
  apply,
  canRotate,
  deliverChain,
  edgesFrom,
  legal,
  orderProblem,
  outOfTea,
  parse,
  rotCCW,
  rotCW,
  route,
  solveOrder,
  slide,
  starsFor,
  teapot,
  validOrders,
  type Puzzle,
} from "../src/engine";

describe("tiles", () => {
  it("rotates edges a quarter turn each way", () => {
    expect(rotCW(N)).toBe(E);
    expect(rotCW(W)).toBe(N);
    expect(rotCCW(N)).toBe(W);
    expect(rotCW(edgesFrom("NE"))).toBe(edgesFrom("ES"));
    for (let e = 0; e < 16; e++) expect(rotCCW(rotCW(e))).toBe(e);
  });

  it("parses every token kind", () => {
    const P = parse({ grid: ["P * ~", "T =NS A", "NS EW NES"], parcels: [] });
    expect(P.w).toBe(3);
    expect(P.h).toBe(3);
    expect(P.kind).toEqual(["b", "m", "water", "tree", "bridge", "b", "m", "m", "m"]);
    expect(P.init[1]).toBe(BED);
    expect(P.init[4]).toBe(N | S);
    expect(P.bld).toEqual({ P: 0, A: 5 });
    // only movable tiles are in the slide lines
    expect(P.rowsM).toEqual([[1], [], [6, 7, 8]]);
    expect(P.colsM).toEqual([[6], [1, 7], [8]]);
  });

  it("rejects ragged grids", () => {
    expect(() => parse({ grid: ["P NS", "NS"], parcels: [] })).toThrow();
  });
});

describe("moves", () => {
  const P = parse({ grid: ["NS EW ~ NE", "P * T A"], parcels: [] });

  it("slides wrap the end tile around and skip rooted tiles", () => {
    // row 0 movable cells: 0, 1, 3 (water at 2 is skipped)
    const right = apply(P, P.init, { t: "row", y: 0, d: 1 });
    expect([right[0], right[1], right[3]]).toEqual([P.init[3], P.init[0], P.init[1]]);
    expect(right[2]).toBe(P.init[2]);
    const left = apply(P, right, { t: "row", y: 0, d: -1 });
    expect(left).toEqual(P.init);
  });

  it("rooted tiles, flowerbeds and crossroads never rotate", () => {
    expect(canRotate(P, P.init, 0)).toBe(true);
    expect(canRotate(P, P.init, 2)).toBe(false); // water
    expect(canRotate(P, P.init, 4)).toBe(false); // post office
    expect(canRotate(P, P.init, 5)).toBe(false); // flowerbed
    expect(canRotate(P, P.init, 6)).toBe(false); // tree
    const cross = parse({ grid: ["NESW"], parcels: [] });
    expect(canRotate(cross, cross.init, 0)).toBe(false);
  });

  it("a single movable tile in a line can't slide", () => {
    expect(legal(P, P.init, { t: "col", x: 0, d: 1 })).toBe(false);
    expect(legal(P, P.init, { t: "row", y: 0, d: 1 })).toBe(true);
  });

  it("footbridges turn but never slide", () => {
    const B = parse({ grid: ["NS =NS EW"], parcels: [] });
    expect(canRotate(B, B.init, 1)).toBe(true);
    const slid = apply(B, B.init, { t: "row", y: 0, d: 1 });
    expect(slid[1]).toBe(B.init[1]);
    expect([slid[0], slid[2]]).toEqual([B.init[2], B.init[0]]);
  });

  it("skips duplicate moves (straight tiles turn the same both ways)", () => {
    const B = parse({ grid: ["NS NE"], parcels: [] });
    const ms = allMoves(B, B.init);
    expect(ms.filter((m) => m.t === "r" && m.i === 0)).toHaveLength(1);
    expect(ms.filter((m) => m.t === "r" && m.i === 1)).toHaveLength(2);
    // a two-tile row slides one way only (both ways are the same swap)
    expect(ms.filter((m) => m.t === "row")).toHaveLength(1);
  });
});

describe("routing", () => {
  it("walks lanes between buildings", () => {
    const P = parse({ grid: ["P EW EW A"], parcels: [] });
    expect(route(P, P.init, "P", "A")).toEqual([0, 1, 2, 3]);
    const broken = parse({ grid: ["P NS EW A"], parcels: [] });
    expect(route(broken, broken.init, "P", "A")).toBeNull();
  });

  it("two buildings side by side are not a lane", () => {
    const P = parse({ grid: ["P A"], parcels: [] });
    expect(route(P, P.init, "P", "A")).toBeNull();
  });

  it("never walks through another building", () => {
    const P = parse({ grid: ["P EW B EW A"], parcels: [] });
    expect(route(P, P.init, "P", "A")).toBeNull();
    expect(route(P, P.init, "P", "B")).toEqual([0, 1, 2]);
  });
});

describe("satchel", () => {
  const lv: Puzzle = {
    grid: ["P EW A EW B EW C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "cat" },
    ],
  };

  it("the cat always rides last", () => {
    expect(orderProblem(lv, [0, 2, 1])).toMatch(/cat/);
    expect(orderProblem(lv, [0, 1, 2])).toBeNull();
  });

  it("a signed letter needs its key holder visited first", () => {
    expect(orderProblem(lv, [1, 0, 2])).toMatch(/gate/);
  });

  it("lists only valid orders", () => {
    expect(validOrders(lv)).toEqual([[0, 1, 2]]);
  });

  it("delivers as far as the board allows", () => {
    const P = parse(lv);
    const chain = deliverChain(P, P.init, [0, 1, 2], 0);
    // P -> A works; A -> C passes through B, which is not allowed
    expect(chain.map((d) => d.k)).toEqual([0]);
  });
});

describe("solver", () => {
  it("finds the fewest moves for an order", () => {
    const lv: Puzzle = { grid: ["P NS NS A"], parcels: [{ to: "A", kind: "letter" }] };
    const r = solveOrder(parse(lv), [0], 4);
    expect(r.par).toBe(2);
    expect(r.line).toHaveLength(2);
  });

  it("respects pie timers", () => {
    const lv: Puzzle = { grid: ["P NS NS A"], parcels: [{ to: "A", kind: "pie", limit: 1 }] };
    expect(solveOrder(parse(lv), [0], 4).par).toBeNull();
  });

  it("flags boards that are already solved", () => {
    const lv: Puzzle = { grid: ["P EW A"], parcels: [{ to: "A", kind: "letter" }] };
    expect(solveOrder(parse(lv), [0], 4).par).toBe(-1);
  });
});

describe("tea and stars", () => {
  it("teapot holds par + 4", () => {
    expect(teapot(2)).toBe(6);
    expect(teapot(6)).toBe(10);
  });

  it("3 stars at par, 2 within par + 2, 1 otherwise", () => {
    expect(starsFor(4, 4, false)).toBe(3);
    expect(starsFor(3, 4, false)).toBe(3);
    expect(starsFor(5, 4, false)).toBe(2);
    expect(starsFor(6, 4, false)).toBe(2);
    expect(starsFor(7, 4, false)).toBe(1);
    expect(starsFor(8, 4, false)).toBe(1);
  });

  it("a cold pie caps the route at 2 stars", () => {
    expect(starsFor(4, 4, true)).toBe(2);
    expect(starsFor(7, 4, true)).toBe(1);
  });

  it("an empty pot ends the round only while post is left", () => {
    expect(outOfTea(5, 2, 1, 2)).toBe(false);
    expect(outOfTea(6, 2, 1, 2)).toBe(true);
    expect(outOfTea(6, 2, 2, 2)).toBe(false); // finishing on the last cup still counts
  });
});


describe("sunflowers", () => {
  it("parses, slides and turns on every move", () => {
    const P = parse({ grid: ["@NE EW", "NS NW"], parcels: [] });
    expect(P.init[0]).toBe(SUN | N | E);
    expect(P.kind[0]).toBe("m");
    expect(edgesAt(P, P.init, 0)).toBe(N | E);
    expect(legal(P, P.init, { t: "r", i: 0, d: 1 })).toBe(false);
    expect(apply(P, P.init, { t: "r", i: 0, d: 1 })).toEqual(P.init);
    expect(allMoves(P, P.init).some(m => m.t === "r" && m.i === 0)).toBe(false);
    let v = apply(P, P.init, { t: "row", y: 0, d: -1 });
    expect(v[1]).toBe(SUN | E | S);
    v = apply(P, v, { t: "col", x: 1, d: -1 });
    expect(v[3]).toBe(SUN | S | W);
    v = apply(P, v, { t: "row", y: 1, d: 1 });
    v = apply(P, v, { t: "col", x: 0, d: 1 });
    expect(v[0]).toBe(SUN | N | E);
  });

  it("delivers after the turn and solves with that timing", () => {
    const P = parse({ grid: ["P @NS A", "EW NE ~"], parcels: [{ to: "A", kind: "letter" }] });
    expect(deliverChain(P, P.init, [0], 0)).toHaveLength(0);
    const v = apply(P, P.init, { t: "row", y: 1, d: 1 });
    expect(deliverChain(P, v, [0], 0)).toHaveLength(1);
    expect(solveOrder(P, [0], 1).par).toBe(1);
  });
});


it("slides tile IDs without interpreting sunflower bits", () => {
  const P = parse({ grid: ["@NE EW"], parcels: [] });
  expect(slide(P, [32, 35], { t: "row", y: 0, d: 1 })).toEqual([35, 32]);
});
