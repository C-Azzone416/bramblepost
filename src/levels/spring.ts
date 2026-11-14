/**
 * Spring routes in Thistledown. Grid tokens are documented in src/engine/board.ts (parse).
 * After editing a grid, run `npm run solve -- <id>` to find the new par and a solution line,
 * then update `par` and `solution` here. `npm test` fails if they drift.
 */
import type { Route } from "./types";

export const SPRING: Route[] = [
  {
    id: "primrose",
    name: "Primrose Lane",
    blurb: "Two deliveries to learn the ropes: turn a tile, slide a row.",
    teach: "Tap tiles to turn them and try the red arrows to slide a row.",
    grid: ["NW NW NW EW NS", "NS P SW EW NE", "NES NSW T NW NE", "ES EW NE A EW", "B * NW ESW NW"],
    houses: { A: "mush", B: "tea" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "seeds" },
    ],
    par: 2,
    solution: {
      order: [0, 1],
      moves: [
        { t: "r", i: 16, d: 1 },
        { t: "row", y: 3, d: -1 },
      ],
    },
  },
  {
    id: "clover",
    name: "Clover Bend",
    blurb: "Seeds and a warm pie. The satchel order decides your best score.",
    tag: "First pie",
    teach: "The pie cools after move 3. Try the satchel both ways round.",
    grid: ["NS A EW EW SW", "P EW EW ES B", "NS NS EW NS NW"],
    houses: { A: "acorn", B: "tea" },
    parcels: [
      { to: "A", kind: "pie", limit: 3 },
      { to: "B", kind: "seeds" },
    ],
    par: 2,
    solution: {
      order: [1, 0],
      moves: [
        { t: "r", i: 13, d: 1 },
        { t: "col", x: 3, d: 1 },
      ],
    },
  },
  {
    id: "millpond",
    name: "Mill Pond",
    blurb: "Three parcels around the pond. Tiles slide around the water.",
    teach: "Water never moves, so slides skip over it.",
    grid: ["NE EW * A *", "NE ES ~ EW *", "P ES ~ * NS", "NS NW NE NS C", "NW B NW NE EW"],
    houses: { A: "acorn", B: "tea", C: "burrow" },
    parcels: [
      { to: "C", kind: "letter" },
      { to: "B", kind: "seeds" },
      { to: "A", kind: "pie", limit: 4 },
    ],
    def: [1, 2, 0],
    par: 4,
    solution: {
      order: [1, 0, 2],
      moves: [
        { t: "r", i: 22, d: 1 },
        { t: "row", y: 2, d: -1 },
        { t: "col", x: 3, d: -1 },
        { t: "row", y: 4, d: -1 },
      ],
    },
  },
  {
    id: "footbridge",
    name: "Footbridge Row",
    blurb: "A footbridge crosses the stream. It turns but never slides. The cat rides last.",
    tag: "New: footbridge",
    teach: "The footbridge turns but never slides. The cat always rides last.",
    grid: ["B SW ~ NS NW", "NW EW ~ ES A", "P NES =NS NW NS", "EW T ~ * NW", "EW NW ~ C NS"],
    houses: { A: "burrow", B: "tea", C: "mush" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "seeds" },
      { to: "C", kind: "cat" },
    ],
    par: 5,
    solution: {
      order: [1, 0, 2],
      moves: [
        { t: "r", i: 6, d: 1 },
        { t: "r", i: 11, d: -1 },
        { t: "r", i: 12, d: 1 },
        { t: "row", y: 0, d: 1 },
        { t: "col", x: 4, d: 1 },
      ],
    },
  },
  {
    id: "hollow",
    name: "Hollow Lane",
    sunday: true,
    blurb: "Four parcels, a latched gate and a pie on a timer. No spare tea.",
    tag: "Sunday puzzle",
    teach: "The Burrow's gate opens once Old Barnaby has his letter.",
    grid: ["B NW NW ~ T *", "NEW NE NW ~ NS D", "NS P NS =EW SW NS", "NS NS ES ~ NS NS", "A * NS ~ ES C"],
    houses: { A: "acorn", B: "tea", C: "burrow", D: "mush" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "pie", limit: 5 },
      { to: "D", kind: "cat" },
    ],
    def: [0, 2, 1, 3],
    par: 6,
    solution: {
      order: [2, 0, 1, 3],
      moves: [
        { t: "r", i: 1, d: -1 },
        { t: "r", i: 6, d: 1 },
        { t: "r", i: 19, d: 1 },
        { t: "r", i: 28, d: -1 },
        { t: "col", x: 1, d: 1 },
        { t: "col", x: 2, d: -1 },
      ],
    },
  },
];
