/** Hollowmere’s summer routes. House codes and copy are neutral placeholders. */
import type { Route } from "./types";

export const SUMMER: Route[] = [
  {
    id: "summer-1",
    name: "Summer route 1",
    blurb: "Summer route 1.",
    teach: "Sunflowers turn clockwise after every move. Let this one turn while you arrange the path.",
    tag: "New: sunflower",
    grid: ["T T A T T", "T NEW @NE ES B", "P NE T NS T", "T ES EW NES T", "T T T T T"],
    houses: { A: "sh1", B: "sh2" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 3,
    solution: {"order": [0, 1], "moves": [{"t": "r", "i": 6, "d": -1}, {"t": "r", "i": 18, "d": -1}, {"t": "col", "x": 1, "d": 1}]},
  },
  {
    id: "summer-2",
    name: "Summer route 2",
    blurb: "Summer route 2.",
    teach: "Plan the path for the sunflower’s next turn.",
    tag: "Sunflower timing",
    grid: ["T A T B T", "NEW SW @ES NES NS", "P NS T ESW C", "T NS NE ES T", "T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "B", kind: "letter" },
      { to: "C", kind: "parcel" }, // plain
      { to: "A", kind: "parcel" }, // plain
    ],
    par: 4,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 8, "d": -1}, {"t": "r", "i": 9, "d": 1}, {"t": "row", "y": 1, "d": -1}, {"t": "row", "y": 1, "d": -1}]},
  },
  {
    id: "summer-3",
    name: "Summer route 3",
    blurb: "Summer route 3.",
    teach: "These two sunflowers start out of step. Check both after every move.",
    tag: "Two sunflowers",
    grid: ["T A T B T", "ES NS @NE EW NEW", "P SW T SW C", "T NW @NS NW T", "T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "C", kind: "letter" },
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 4,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 5, "d": 1}, {"t": "r", "i": 13, "d": -1}, {"t": "r", "i": 16, "d": 1}, {"t": "row", "y": 1, "d": -1}]},
  },
  {
    id: "summer-4",
    name: "Summer route 4",
    blurb: "Summer route 4.",
    teach: "Keep the pie warm while the sunflower turns.",
    tag: "Sunflower + pie",
    grid: ["T A T B T", "NES EW @NW NS NW", "P NEW T ES C", "T SW NW SW T", "T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "parcel" }, // plain
      { to: "B", kind: "parcel" }, // plain
      { to: "A", kind: "pie", limit: 4 },
    ],
    par: 4,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "col", "x": 3, "d": 1}, {"t": "row", "y": 1, "d": 1}, {"t": "row", "y": 2, "d": 1}, {"t": "col", "x": 3, "d": -1}]},
  },
  {
    id: "summer-5",
    name: "Summer route 5",
    blurb: "Summer route 5.",
    teach: "The footbridge turns but never slides. The sunflower turns after every move; the cat rides last.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["B EW ~ EW NW T", "NE NS ~ @NE A T", "P NW =NS EW NES T", "T NSW ~ ES C T", "T T ~ T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "B", kind: "letter" },
      { to: "A", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
      { to: "B", kind: "cat" },
    ],
    par: 5,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "r", "i": 13, "d": -1}, {"t": "r", "i": 14, "d": 1}, {"t": "r", "i": 21, "d": -1}, {"t": "col", "x": 1, "d": -1}, {"t": "row", "y": 2, "d": 1}]},
  },
  {
    id: "summer-6",
    name: "Summer route 6",
    blurb: "Summer route 6.",
    teach: "Deliver to sh3 before the signed parcel for sh1. The sunflower keeps turning.",
    tag: "Sunflower + signed",
    grid: ["T A T B T", "EW NES @SW NS NW", "P NE T NS C", "T ES * ES T", "T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "C", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "A", kind: "signed", key: "C" },
    ],
    par: 5,
    solution: {"order": [0, 1, 2], "moves": [{"t": "r", "i": 6, "d": -1}, {"t": "row", "y": 1, "d": 1}, {"t": "row", "y": 1, "d": 1}, {"t": "col", "x": 1, "d": 1}, {"t": "r", "i": 6, "d": -1}]},
  },
  {
    id: "summer-7",
    name: "Summer route 7",
    blurb: "Summer route 7.",
    teach: "Two sunflowers turn together. Deliver the pie by move 5.",
    tag: "Two sunflowers + pie",
    grid: ["T A T B T T", "SW NW @NE NW NE T", "P ES T NS C T", "T NS @NS NS T T", "T T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "parcel" }, // plain
      { to: "B", kind: "pie", limit: 5 },
    ],
    par: 5,
    solution: {"order": [0, 1, 2], "moves": [{"t": "col", "x": 3, "d": -1}, {"t": "row", "y": 1, "d": -1}, {"t": "col", "x": 1, "d": 1}, {"t": "r", "i": 19, "d": -1}, {"t": "row", "y": 2, "d": 1}]},
  },
  {
    id: "summer-8",
    name: "Summer route 8",
    blurb: "Summer route 8.",
    teach: "Slide the sunflower off the end of a row to bring it round the other side. The cat rides last.",
    tag: "Sunflower + wrap-around",
    grid: ["T A T B T T", "@ES ES ES NS NS T", "P NSW T NS C T", "T NS NES ES T T", "T T T T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "B", kind: "letter" },
      { to: "A", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
      { to: "B", kind: "cat" },
    ],
    par: 6,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "r", "i": 19, "d": 1}, {"t": "r", "i": 21, "d": -1}, {"t": "row", "y": 1, "d": -1}, {"t": "row", "y": 1, "d": -1}, {"t": "row", "y": 3, "d": 1}, {"t": "col", "x": 3, "d": -1}]},
  },
  {
    id: "summer-9",
    name: "Summer route 9",
    blurb: "Summer route 9.",
    teach: "Plan the sunflower, the footbridge and the pie together. The cat rides last.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["T B ~ T T T", "ES * ~ @SW A T", "P NSW =NS ES NW T", "T T ~ NEW C T", "T T ~ T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "C", kind: "letter" },
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "pie", limit: 6 },
      { to: "C", kind: "cat" },
    ],
    par: 6,
    solution: {"order": [0, 1, 2, 3], "moves": [{"t": "r", "i": 14, "d": 1}, {"t": "r", "i": 16, "d": -1}, {"t": "row", "y": 1, "d": 1}, {"t": "col", "x": 3, "d": -1}, {"t": "row", "y": 1, "d": 1}, {"t": "col", "x": 1, "d": 1}]},
  },
  {
    id: "summer-10",
    name: "Summer route 10",
    blurb: "Summer route 10.",
    teach: "Keep the pie warm, visit sh3 before the signed parcel, and take the cat last. Sunflowers turn; footbridges only rotate.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["T B ~ T T T", "NE NS ~ @NW A T", "P NS =NS NW * T", "T T ~ NE C T", "T T ~ T T T"],
    houses: { A: "sh1", B: "sh2", C: "sh3" },
    parcels: [
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "pie", limit: 7 },
      { to: "B", kind: "signed", key: "C" },
      { to: "A", kind: "cat" },
    ],
    par: 7,
    solution: {"order": [0, 1, 2, 3, 4], "moves": [{"t": "r", "i": 13, "d": 1}, {"t": "r", "i": 14, "d": 1}, {"t": "row", "y": 2, "d": -1}, {"t": "col", "x": 3, "d": -1}, {"t": "row", "y": 2, "d": -1}, {"t": "r", "i": 16, "d": -1}, {"t": "r", "i": 16, "d": 1}]},
  },
];
