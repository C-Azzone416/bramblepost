/**
 * Where everything sits on the village map. Display data only: which lanes are open is
 * worked out in progress.ts from the saved stars.
 *
 * Coordinates are in the map's SVG space, 1000 × 640.
 */

import type { HouseStyle } from "../levels";

export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export interface Neighbourhood {
  id: string;
  name: string;
  season: Season;
  /** Route ids in the order the lanes open. Empty for a season that has no routes yet. */
  routes: string[];
  /** Where the fog and name plate sit while it is locked. */
  at: { x: number; y: number };
}

/** One lane: it runs from the previous stop (or the post office) to this route's stamp. */
export interface Lane {
  /** The stamp / node position. */
  x: number;
  y: number;
  /** Bezier control point for the lane leading here. */
  via: [number, number];
  /** Which cottage stands by the lane, and where it is drawn relative to the node. */
  style: HouseStyle;
  house: [number, number];
  /** Where Pip stands, relative to the node, while this is the next lane. */
  pip: [number, number];
}

export const MAP_W = 1000;
export const MAP_H = 640;

/** The tree-stump post office, where every round starts. */
export const POST_OFFICE = { x: 150, y: 440 };

/** Thistledown is the spring village. Later seasons are named placeholders until their routes exist. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "thistledown",
    name: "Thistledown",
    season: "spring",
    routes: ["primrose", "clover", "millpond", "footbridge", "hollow"],
    at: { x: 420, y: 420 },
  },
  { id: "hollowmere", name: "Hollowmere", season: "summer", routes: [], at: { x: 870, y: 105 } },
  { id: "conker", name: "Conker Corner", season: "autumn", routes: [], at: { x: 140, y: 115 } },
  { id: "snowberry", name: "Snowberry End", season: "winter", routes: [], at: { x: 130, y: 560 } },
];

export const LANES: Record<string, Lane> = {
  primrose: { x: 290, y: 330, via: [190, 350], style: "mush", house: [-40, 52], pip: [24, 4] },
  clover: { x: 420, y: 440, via: [380, 350], style: "acorn", house: [26, -108], pip: [-96, -40] },
  millpond: { x: 520, y: 545, via: [440, 530], style: "tea", house: [-170, -10], pip: [-96, -40] },
  footbridge: { x: 720, y: 430, via: [620, 520], style: "burrow", house: [40, 20], pip: [-60, 22] },
  hollow: { x: 840, y: 300, via: [810, 410], style: "mush", house: [-110, -104], pip: [16, 6] },
};

/** The stream, the footbridge on the Footbridge Row lane, and the mill pond it runs into. */
export const STREAM = "M700 -20 C 650 140, 730 290, 660 400 S 610 470, 620 502 S 640 580, 610 660";
export const BRIDGE = { x: 620, y: 502, angle: -29 };
export const POND = { x: 640, y: 618, rx: 120, ry: 44 };

/** Trees scattered between the lanes (x, y, scale). */
export const TREES: [number, number, number][] = [
  [56, 250, 1.1],
  [90, 570, 1],
  [250, 560, 0.9],
  [285, 195, 0.8],
  [380, 220, 1],
  [480, 290, 0.8],
  [560, 210, 1],
  [575, 380, 0.75],
  [770, 210, 0.8],
  [960, 330, 0.9],
  [965, 430, 0.8],
  [420, 90, 0.9],
  [600, 80, 0.8],
  [36, 420, 0.9],
  [905, 590, 0.9],
];
