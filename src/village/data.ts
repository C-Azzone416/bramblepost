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
  /**
   * Lane positions, in opening order. Route `i` takes slot `i`, so adding a route is one id appended
   * to `routes`. Spare slots show as hedge and fog. Empty for a season that has no map yet.
   */
  slots: Lane[];
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

/** How many lanes a season's map has room for. Thistledown reserves all fifteen up front. */
export const SLOTS_PER_SEASON = 15;

const HOUSE_ABOVE: [number, number] = [-40, -100];
const PIP_LEFT: [number, number] = [-86, -34];

/**
 * Thistledown's fifteen lane slots, in the order the lanes open. A slot is a place on the map; a route
 * takes slot `i` when its id sits at index `i` of the neighbourhood's `routes`. Slots past the last
 * route stay reserved and the map draws them as hedge and fog.
 *
 * The path leaves the post office, crosses the stream by the footbridge (between slots 3 and 4), then
 * winds up the east bank in four rows of three. Rows are 130 apart across and 110 down so every stamp
 * (and its stars and house) still has room at phone width.
 *
 * Slots 6 to 15 keep placeholder houses and Pip spots; whoever adds the route may change `style`.
 */
export const THISTLEDOWN_SLOTS: Lane[] = [
  { x: 250, y: 350, via: [190, 350], style: "mush", house: [-40, 52], pip: [24, 4] },
  { x: 360, y: 440, via: [340, 360], style: "acorn", house: [26, -108], pip: [-96, -40] },
  { x: 390, y: 545, via: [340, 510], style: "tea", house: [-124, -34], pip: [-96, -40] },
  { x: 640, y: 520, via: [485, 471.5], style: "burrow", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 770, y: 520, via: [705, 520], style: "mush", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 900, y: 520, via: [835, 520], style: "acorn", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 900, y: 410, via: [960, 465], style: "tea", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 770, y: 410, via: [835, 410], style: "burrow", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 640, y: 410, via: [705, 410], style: "mush", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 640, y: 300, via: [585, 355], style: "acorn", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 770, y: 300, via: [705, 300], style: "tea", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 900, y: 300, via: [835, 300], style: "burrow", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 900, y: 190, via: [960, 245], style: "mush", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 770, y: 190, via: [835, 190], style: "acorn", house: HOUSE_ABOVE, pip: PIP_LEFT },
  { x: 640, y: 190, via: [705, 190], style: "tea", house: HOUSE_ABOVE, pip: PIP_LEFT },
];

/** Thistledown is the spring village. Later seasons are named placeholders until their routes exist. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "thistledown",
    name: "Thistledown",
    season: "spring",
    routes: ["primrose", "clover", "millpond", "footbridge", "hollow"],
    slots: THISTLEDOWN_SLOTS,
    at: { x: 420, y: 420 },
  },
  { id: "hollowmere", name: "Hollowmere", season: "summer", routes: [], slots: [], at: { x: 880, y: 40 } },
  { id: "conker", name: "Conker Corner", season: "autumn", routes: [], slots: [], at: { x: 140, y: 115 } },
  { id: "snowberry", name: "Snowberry End", season: "winter", routes: [], slots: [], at: { x: 130, y: 560 } },
];

/** The lane for each route on the map: route `i` of a neighbourhood takes slot `i`. */
export const LANES: Record<string, Lane> = Object.fromEntries(
  NEIGHBOURHOODS.flatMap((h) => h.routes.map((id, i) => [id, h.slots[i]] as const)),
);

/** Slots no route has claimed yet, in order. The map shows these as hedge and fog. */
export function reservedSlots(h: Neighbourhood): Lane[] {
  return h.slots.slice(h.routes.length);
}

/** The stream, the footbridge on the Footbridge Row lane, and the mill pond it runs into. */
export const STREAM = "M580 -20 C 530 140, 610 290, 540 400 S 490 470, 500 502 S 520 580, 490 660";
export const BRIDGE = { x: 500, y: 502, angle: -12 };
export const POND = { x: 520, y: 618, rx: 120, ry: 44 };

/** Trees scattered between the lanes (x, y, scale). */
export const TREES: [number, number, number][] = [
  [56, 250, 1.1],
  [90, 570, 1],
  [250, 585, 0.8],
  [285, 195, 0.8],
  [400, 230, 1],
  [450, 110, 0.9],
  [36, 420, 0.9],
  [210, 110, 0.8],
  [480, 330, 0.7],
  [610, 90, 0.8],
  [775, 95, 0.75],
];
