import type { Move, Puzzle } from "../../src/engine";

// Reproduce with: node --import tsx tools/gen.ts headroom <par> <seed> <seed+1>
// No playable level data or spring pars are changed by these solver fixtures.
const parcels: Puzzle["parcels"] = [
  { to: "A", kind: "pie", limit: 6 },
  { to: "B", kind: "signed", key: "A" },
  { to: "C", kind: "cat" },
];
const wind: Puzzle["wind"] = { line: "row", index: 1, d: 1, every: 3 };

export const HEADROOM: { seed: number; par: number; puzzle: Puzzle; moves: Move[] }[] = [
  {
    seed: 7,
    par: 7,
    puzzle: {
      grid: ["T T T T T T", "P EW # NS A T", "~ NW =NS EW ~ T", "B NW # @N C T", "T T T T T T"],
      parcels,
      wind,
    },
    moves: [
      { t: "r", i: 9, d: 1 },
      { t: "r", i: 9, d: 1 },
      { t: "r", i: 19, d: 1 },
      { t: "r", i: 19, d: 1 },
      { t: "col", x: 1, d: 1 },
      { t: "col", x: 3, d: -1 },
      { t: "col", x: 1, d: -1 },
    ],
  },
  {
    seed: 10,
    par: 8,
    puzzle: {
      grid: ["T T T T T T", "P ES # NS A T", "~ NW =NS EW ~ T", "B NS # @N C T", "T T T T T T"],
      parcels,
      wind,
    },
    moves: [
      { t: "r", i: 9, d: 1 },
      { t: "r", i: 15, d: 1 },
      { t: "col", x: 1, d: 1 },
      { t: "r", i: 9, d: 1 },
      { t: "row", y: 2, d: 1 },
      { t: "col", x: 3, d: -1 },
      { t: "r", i: 13, d: 1 },
      { t: "col", x: 1, d: 1 },
    ],
  },
];
