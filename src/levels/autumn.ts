/** Conker Corner’s autumn routes. House codes and copy are neutral placeholders. */
import type { Route } from "./types";

export const AUTUMN: Route[] = [
  {
    id: "autumn-1",
    name: "Autumn route 1",
    blurb: "Autumn route 1.",
    teach: "A gust slides row 2 right after every second move. The gust makes the last slide for you.",
    tag: "New: gust",
    grid: ["T T A T T", "T EW NS SW B", "P ES NW * T", "T * SW * T", "T T T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah1", B: "ah1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 4,
    solution: {"order": [0, 1], "moves": [{"t": "col", "x": 1, "d": 1},{"t": "col", "x": 1, "d": -1},{"t": "r", "i": 6, "d": 1},{"t": "r", "i": 6, "d": 1}]},
  },
  {
    id: "autumn-2",
    name: "Autumn route 2",
    blurb: "Autumn route 2.",
    teach: "A gust slides row 2 left after every second move. A gust can undo a fix, so time your moves around it.",
    tag: "Gust timing",
    grid: ["T A T B T", "T EW NS SW T", "P ES NW * T", "T * SW * T", "T T T T T"],
    wind: { line: "row", index: 1, d: -1, every: 2 },
    houses: { A: "ah3", B: "ah2" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 4,
    solution: {"order": [0, 1], "moves": [{"t": "r", "i": 8, "d": 1},{"t": "r", "i": 8, "d": 1},{"t": "row", "y": 2, "d": -1},{"t": "col", "x": 1, "d": -1}]},
  },
  {
    id: "autumn-3",
    name: "Autumn route 3",
    blurb: "Autumn route 3.",
    teach: "A gust slides column 2 down after every second move. Feed a tile into the windy line and let the gust carry it.",
    tag: "Windy line",
    grid: ["T A T B T", "T ES ES NS T", "P NS NSW NS C", "T NS NES ES T", "T T T T T"],
    wind: { line: "col", index: 1, d: 1, every: 2 },
    houses: { A: "ah2", B: "ah3", C: "ah1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
    ],
    par: 5,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 12, "d": 1},{"t": "r", "i": 13, "d": 1},{"t": "col", "x": 2, "d": -1},{"t": "row", "y": 1, "d": -1},{"t": "row", "y": 2, "d": -1}]},
  },
  {
    id: "autumn-4",
    name: "Autumn route 4",
    blurb: "Autumn route 4.",
    teach: "A gust slides row 2 right after every second move. Deliver the pie in time, gust included.",
    tag: "Gust + pie",
    grid: ["T A T T T", "T NE NS NS B", "P NW * NE T", "T NES NS NE C", "T T T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah3", B: "ah2", C: "ah1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "pie", limit: 5 },
      { to: "C", kind: "parcel" }, // plain
    ],
    par: 5,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 6, "d": 1},{"t": "r", "i": 7, "d": 1},{"t": "row", "y": 2, "d": 1},{"t": "col", "x": 1, "d": 1},{"t": "row", "y": 2, "d": -1}]},
  },
  {
    id: "autumn-5",
    name: "Autumn route 5",
    blurb: "Autumn route 5.",
    teach: "A gust slides column 2 up after every second move. Plan the gust, the footbridge and the cat together. The cat rides last.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["T B ~ T T T", "T * ~ ES A T", "P ES =NS NS EW T", "T ESW ~ NW C T", "T T ~ T T T"],
    wind: { line: "col", index: 1, d: -1, every: 2 },
    houses: { A: "ah1", B: "ah2", C: "ah3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "cat" },
    ],
    par: 5,
    solution: {"order": [1, 0, 2], "moves": [{"t": "r", "i": 14, "d": 1},{"t": "r", "i": 19, "d": 1},{"t": "row", "y": 2, "d": -1},{"t": "row", "y": 3, "d": 1},{"t": "r", "i": 13, "d": 1}]},
  },
  {
    id: "autumn-6",
    name: "Autumn route 6",
    blurb: "Autumn route 6.",
    teach: "A gust slides row 2 left after every third move. The gust and the sunflower both move on their own. Plan for both.",
    tag: "Gust + sunflower",
    grid: ["T A T B T T", "T EW @NE NS SW T", "P ES NW T C T", "T T * T T T", "T T T T T T"],
    wind: { line: "row", index: 1, d: -1, every: 3 },
    houses: { A: "ah2", B: "ah1", C: "ah3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
    ],
    par: 6,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 13, "d": -1},{"t": "col", "x": 1, "d": 1},{"t": "r", "i": 9, "d": 1},{"t": "r", "i": 9, "d": 1},{"t": "r", "i": 8, "d": 1},{"t": "r", "i": 8, "d": 1}]},
  },
  {
    id: "autumn-7",
    name: "Autumn route 7",
    blurb: "Autumn route 7.",
    teach: "A gust slides row 2 right after every second move. Deliver the signed parcel after its key holder, and take the cat last.",
    tag: "Gust + signed",
    grid: ["T A T B T T", "T NE NS NS T T", "P NW * NE C T", "T T T NES D T", "T T T T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah3", B: "ah2", C: "ah1", D: "ah3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "parcel" }, // plain
      { to: "D", kind: "cat" },
    ],
    par: 6,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "row", "y": 1, "d": 1},{"t": "col", "x": 1, "d": 1},{"t": "r", "i": 7, "d": 1},{"t": "col", "x": 3, "d": -1},{"t": "r", "i": 9, "d": -1},{"t": "r", "i": 8, "d": 1}]},
  },
  {
    id: "autumn-8",
    name: "Autumn route 8",
    blurb: "Autumn route 8.",
    teach: "A gust slides row 2 right after every second move. Two rules against the clock: keep the pie warm while the gust blows.",
    tag: "Gust + pie",
    grid: ["T A T B T T", "T NE NS NS T T", "P NW * NE C T", "T T T NES D T", "T T T T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah1", B: "ah3", C: "ah2", D: "ah1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "pie", limit: 5 },
      { to: "B", kind: "parcel" }, // plain
      { to: "D", kind: "parcel" }, // plain
    ],
    par: 6,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "row", "y": 1, "d": 1},{"t": "col", "x": 1, "d": 1},{"t": "r", "i": 7, "d": 1},{"t": "col", "x": 3, "d": -1},{"t": "r", "i": 9, "d": -1},{"t": "r", "i": 8, "d": 1}]},
  },
  {
    id: "autumn-9",
    name: "Autumn route 9",
    blurb: "Autumn route 9.",
    teach: "A gust slides row 2 right after every second move. Plan the sunflower, the footbridge, the pie and the gust together.",
    tag: "Sunday puzzle",
    sunday: true,
    def: [2, 0, 1, 3], // the pie first: the listed order cannot finish inside the teapot
    grid: ["T B ~ T T T", "T NW ~ @EW A T", "P EW =NS NS * T", "T T ~ NW C T", "T T ~ T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah1", B: "ah3", C: "ah2" },
    parcels: [
      { to: "C", kind: "letter" },
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "pie", limit: 6 },
      { to: "C", kind: "cat" },
    ],
    par: 7,
    solution: {"order": [2, 1, 0, 3], "moves": [{"t": "col", "x": 1, "d": 1},{"t": "col", "x": 3, "d": -1},{"t": "row", "y": 2, "d": -1},{"t": "col", "x": 3, "d": -1},{"t": "r", "i": 13, "d": 1},{"t": "r", "i": 14, "d": 1},{"t": "row", "y": 2, "d": 1}]},
  },
  {
    id: "autumn-10",
    name: "Autumn route 10",
    blurb: "Autumn route 10.",
    teach: "A gust slides row 2 right after every second move. Everything so far: sunflower, signed parcel, cat and gust. The cat rides last.",
    tag: "Last lane",
    grid: ["T B ~ T T T", "T EW ~ @EW A T", "P NE =NS * * T", "T NE ~ ES C T", "T T ~ T T T"],
    wind: { line: "row", index: 1, d: 1, every: 2 },
    houses: { A: "ah3", B: "ah2", C: "ah1" },
    parcels: [
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "signed", key: "B" },
      { to: "A", kind: "cat" },
    ],
    par: 7,
    solution: {"order": [1, 0, 2, 3], "moves": [{"t": "r", "i": 7, "d": 1},{"t": "r", "i": 13, "d": -1},{"t": "r", "i": 14, "d": 1},{"t": "col", "x": 1, "d": -1},{"t": "col", "x": 3, "d": 1},{"t": "col", "x": 1, "d": 1},{"t": "row", "y": 2, "d": -1}]},
  },
];
