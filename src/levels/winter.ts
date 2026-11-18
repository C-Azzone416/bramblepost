/** Snowberry End’s winter routes. House codes and copy are neutral placeholders. */
import type { Route } from "./types";

export const WINTER: Route[] = [
  {
    id: "winter-1",
    name: "Winter route 1",
    blurb: "Winter route 1.",
    teach: "Ice cannot be turned or slid. Line up a lane on each bank and Pip slides straight across.",
    tag: "New: ice",
    grid: ["T A T T T","T EW ~ NS T","P SW # ES B","T NW ~ * T","T T T T T"],
    houses: { A: "wh1", B: "wh2" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 4,
    solution: {"order":[0,1],"moves":[{"t":"r","i":11,"d":1},{"t":"row","y":1,"d":1},{"t":"r","i":11,"d":1},{"t":"col","x":3,"d":1}]},
  },
  {
    id: "winter-2",
    name: "Winter route 2",
    blurb: "Winter route 2.",
    teach: "A crossing needs a lane facing the ice on both banks, in the same row. Slide a bank to line them up.",
    tag: "Both banks",
    grid: ["T A T T T","T NE # NS T","P NS ~ NW T","T * ~ NE B","T T T T T"],
    houses: { A: "wh2", B: "wh3" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
    ],
    par: 5,
    solution: {"order":[0,1],"moves":[{"t":"row","y":1,"d":1},{"t":"row","y":2,"d":1},{"t":"r","i":11,"d":-1},{"t":"col","x":1,"d":-1},{"t":"row","y":1,"d":1}]},
  },
  {
    id: "winter-3",
    name: "Winter route 3",
    blurb: "Winter route 3.",
    teach: "Two ice cells make one longer crossing. Line up the banks across both.",
    tag: "Long ice",
    grid: ["T A T T C T","T EW ~ ~ NS T","P SW # # ES B","T NW ~ ~ * T","T T T T T T"],
    houses: { A: "wh3", B: "wh4", C: "wh1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
    ],
    par: 5,
    solution: {"order":[0,2,1],"moves":[{"t":"r","i":7,"d":1},{"t":"r","i":13,"d":1},{"t":"r","i":16,"d":-1},{"t":"row","y":2,"d":1},{"t":"r","i":16,"d":1}]},
  },
  {
    id: "winter-4",
    name: "Winter route 4",
    blurb: "Winter route 4.",
    teach: "Cross the ice and still deliver the pie before it cools.",
    tag: "Ice + pie",
    def: [2,0,1], // the listed order cannot finish inside the teapot
    grid: ["T A T T T T","T NW SW ~ NW T","P NEW NW # EW B","T SW NEW ~ ES C","T T T T T T"],
    houses: { A: "wh4", B: "wh1", C: "wh2" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "pie", limit: 3 },
    ],
    par: 5,
    solution: {"order":[2,0,1],"moves":[{"t":"r","i":14,"d":-1},{"t":"row","y":2,"d":1},{"t":"row","y":3,"d":1},{"t":"r","i":7,"d":1},{"t":"col","x":4,"d":-1}]},
  },
  {
    id: "winter-5",
    name: "Winter route 5",
    blurb: "Winter route 5.",
    teach: "Plan the ice, the footbridge and the cat together. The cat rides last.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["T A ~ T C T","T NE # EW NW B","P ES ~ =NS ~ T","T NW ~ NE NEW D","T T T T T T"],
    houses: { A: "wh1", B: "wh2", C: "wh3", D: "wh4" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
      { to: "D", kind: "cat" },
    ],
    par: 6,
    solution: {"order":[1,0,2,3],"moves":[{"t":"r","i":21,"d":1},{"t":"col","x":1,"d":-1},{"t":"col","x":4,"d":1},{"t":"r","i":7,"d":-1},{"t":"col","x":3,"d":1},{"t":"row","y":3,"d":1}]},
  },
  {
    id: "winter-6",
    name: "Winter route 6",
    blurb: "Winter route 6.",
    teach: "A gust slides row 2 left after every third move. Time your crossing around the gust.",
    tag: "Ice + gust",
    grid: ["T A T T C T","T EW NE ~ * T","P * NE # ES B","T NES NE ~ * T","T T T T T T"],
    wind: { line: "row", index: 1, d: -1, every: 3 },
    houses: { A: "wh2", B: "wh4", C: "wh1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "parcel" }, // plain
    ],
    par: 6,
    solution: {"order":[0,1,2],"moves":[{"t":"r","i":8,"d":-1},{"t":"r","i":16,"d":1},{"t":"col","x":4,"d":-1},{"t":"col","x":1,"d":1},{"t":"col","x":4,"d":1},{"t":"row","y":2,"d":1}]},
  },
  {
    id: "winter-7",
    name: "Winter route 7",
    blurb: "Winter route 7.",
    teach: "Deliver the signed parcel after its key holder. The sunflower keeps turning, so catch it on the ice's bank.",
    tag: "Ice + signed",
    grid: ["T A T T D T","T NSW T ~ NSW T","P NS ES # NW B","T SW @NE ~ ESW T","T C T T T T"],
    houses: { A: "wh3", B: "wh2", C: "wh4", D: "wh1" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "signed", key: "B" },
      { to: "D", kind: "parcel" }, // plain
    ],
    par: 6,
    solution: {"order":[0,3,1,2],"moves":[{"t":"col","x":2,"d":1},{"t":"col","x":4,"d":-1},{"t":"row","y":2,"d":-1},{"t":"col","x":4,"d":-1},{"t":"r","i":16,"d":1},{"t":"row","y":3,"d":-1}]},
  },
  {
    id: "winter-8",
    name: "Winter route 8",
    blurb: "Winter route 8.",
    teach: "A gust slides row 2 right after every third move. Three rules against the clock: cross the ice and keep the pie warm while the gust blows.",
    tag: "Ice + gust + pie",
    def: [1,2,0,3], // the listed order cannot finish inside the teapot
    grid: ["T A T T T T","P EW NES SW ES T","T ~ ~ # ~ T","T EW * NSW NE B","T T C T D T"],
    wind: { line: "row", index: 1, d: 1, every: 3 },
    houses: { A: "wh4", B: "wh3", C: "wh1", D: "wh2" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "pie", limit: 4 },
      { to: "D", kind: "parcel" }, // plain
    ],
    par: 7,
    solution: {"order":[1,2,0,3],"moves":[{"t":"r","i":8,"d":-1},{"t":"row","y":3,"d":-1},{"t":"r","i":20,"d":-1},{"t":"col","x":3,"d":1},{"t":"r","i":7,"d":1},{"t":"col","x":4,"d":1},{"t":"row","y":1,"d":1}]},
  },
  {
    id: "winter-9",
    name: "Winter route 9",
    blurb: "Winter route 9.",
    teach: "Plan the ice, the footbridge, the sunflower and the pie together.",
    tag: "Sunday puzzle",
    sunday: true,
    grid: ["T A ~ T C T","T NEW ~ @NE EW B","P NS ~ =NS ~ T","T NES # NE NSW D","T T ~ T T T"],
    houses: { A: "wh2", B: "wh1", C: "wh3", D: "wh4" },
    parcels: [
      { to: "A", kind: "letter" },
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "pie", limit: 4 },
      { to: "D", kind: "parcel" }, // plain
    ],
    par: 7,
    solution: {"order":[0,1,2,3],"moves":[{"t":"row","y":3,"d":1},{"t":"col","x":1,"d":-1},{"t":"col","x":3,"d":1},{"t":"row","y":1,"d":1},{"t":"row","y":1,"d":-1},{"t":"row","y":3,"d":1},{"t":"col","x":4,"d":1}]},
  },
  {
    id: "winter-10",
    name: "Winter route 10",
    blurb: "Winter route 10.",
    teach: "A gust slides row 2 right after every third move. Almost everything so far: ice, footbridge, sunflower, signed parcel and gust.",
    tag: "Last lane",
    grid: ["T B ~ T D T","T ES # @NE NEW C","P NS ~ =NS ~ T","T * ~ EW NE A","T T T T T T"],
    wind: { line: "row", index: 1, d: 1, every: 3 },
    houses: { A: "wh1", B: "wh2", C: "wh3", D: "wh4" },
    parcels: [
      { to: "A", kind: "parcel" }, // plain
      { to: "B", kind: "parcel" }, // plain
      { to: "C", kind: "signed", key: "A" },
      { to: "D", kind: "parcel" }, // plain
    ],
    par: 7,
    solution: {"order":[1,0,2,3],"moves":[{"t":"col","x":1,"d":-1},{"t":"row","y":1,"d":-1},{"t":"col","x":1,"d":1},{"t":"r","i":7,"d":1},{"t":"col","x":1,"d":-1},{"t":"row","y":3,"d":-1},{"t":"row","y":1,"d":-1}]},
  },
];
