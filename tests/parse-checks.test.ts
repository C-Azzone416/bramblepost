import { describe, expect, it } from "vitest";
import { parse } from "../src/engine";

const parcels = [{ to: "A", kind: "letter" as const }];
const wind = (w: object) => () => parse({ grid: ["P EW EW A", "* * * *"], parcels, wind: w as never });

describe("parse(): wind", () => {
  it("accepts a good row and column wind", () => {
    expect(() => wind({ line: "row", index: 1, d: -1, every: 1 })()).not.toThrow();
    expect(() => wind({ line: "col", index: 3, d: 1, every: 3 })()).not.toThrow();
  });
  it("rejects every below 1 or not whole", () => {
    for (const every of [0, -3, 1.5, NaN]) expect(wind({ line: "row", index: 0, d: 1, every }), String(every)).toThrow(/"every" must be a whole number of moves, 1 or more/);
  });
  it("rejects an index out of range, with the board size in the message", () => {
    expect(wind({ line: "row", index: 2, d: 1, every: 3 })).toThrow(/row index 2 is out of range: the board has 2 rows \(0 to 1\)/);
    expect(wind({ line: "col", index: 4, d: 1, every: 3 })).toThrow(/col index 4 is out of range: the board has 4 columns \(0 to 3\)/);
    expect(wind({ line: "row", index: -1, d: 1, every: 3 })).toThrow(/out of range/);
    expect(wind({ line: "row", index: 0.5, d: 1, every: 3 })).toThrow(/out of range/);
  });
  it("rejects a bad direction or line", () => {
    for (const d of [0, 2, -2, "1"]) expect(wind({ line: "row", index: 0, d, every: 3 }), String(d)).toThrow(/direction must be 1 or -1/);
    expect(wind({ line: "diagonal", index: 0, d: 1, every: 3 })).toThrow(/line must be "row" or "col"/);
  });
});

describe("parse(): ice", () => {
  it("says where the building and the ice are", () => {
    expect(() => parse({ grid: ["P EW EW EW", "* * # A"], parcels })).toThrow("Building A at column 4, row 2 cannot be adjacent to ice at column 3, row 2");
    expect(() => parse({ grid: ["P # EW A"], parcels })).toThrow("Building P at column 1, row 1 cannot be adjacent to ice at column 2, row 1");
  });
});
