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
  /** Where the fog and name plate sit on the maps of the villages before it, while it is locked. */
  at: { x: number; y: number };
  /** This village's own map: where the path starts, and what stands around it. Defaults to a plain meadow. */
  scenery?: Scenery;
}

/** The look of one village's own map, besides its lane slots. */
export interface Scenery {
  /** Where the first lane starts: the post office in Thistledown, a gate or signpost elsewhere. */
  start: { x: number; y: number };
  /** Draw the tree-stump post office at `start`. */
  postOffice: boolean;
  /** Draw the stream, footbridge and mill pond. */
  water: boolean;
  trees: [number, number, number][];
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
  /** Size of the cottage relative to its symbol's natural size. Defaults to 0.95. */
  houseScale?: number;
  /** Where Pip stands, relative to the node, while this is the next lane. */
  pip: [number, number];
}

export const MAP_W = 1000;
export const MAP_H = 640;

/** The tree-stump post office, where every round starts. */
export const POST_OFFICE = { x: 150, y: 440 };

/** How many lanes a season's map has room for. Thistledown reserves all fifteen up front. */
export const SLOTS_PER_SEASON = 15;

/** East-bank cottages are drawn small and sit above their stamp, on the side away from the lane's turn. */
const HOUSE_SCALE = 0.6;
const HOUSE_LEFT: [number, number] = [-58, -72];
const HOUSE_RIGHT: [number, number] = [4, -72];
const PIP_LEFT: [number, number] = [-86, -34];

/** One east-bank slot. */
const bank = (x: number, y: number, via: [number, number], style: HouseStyle, house = HOUSE_LEFT): Lane => ({
  x, y, via, style, house, houseScale: HOUSE_SCALE, pip: PIP_LEFT,
});

/**
 * Thistledown's fifteen lane slots, in the order the lanes open. A slot is a place on the map; a route
 * takes slot `i` when its id sits at index `i` of the neighbourhood's `routes`. Slots past the last
 * route stay reserved and the map draws them as hedge and fog.
 *
 * The path leaves the post office, crosses the stream by the footbridge (between slots 3 and 4), then
 * winds up the east bank in four rows of three: 130 apart across and 120 down. Each cottage sits above
 * its stamp in the gap before the row above, clear of that row's stamp, stars and tap area
 * (tests/village.test.ts checks the boxes), and on the side away from the lane's turn at the bank edges.
 *
 * Slots 6 to 15 keep placeholder houses and Pip spots; whoever adds the route may change `style`.
 */
export const THISTLEDOWN_SLOTS: Lane[] = [
  { x: 250, y: 350, via: [190, 350], style: "mush", house: [-40, 52], pip: [24, 4] },
  { x: 360, y: 440, via: [340, 360], style: "acorn", house: [26, -108], pip: [-96, -40] },
  { x: 390, y: 545, via: [340, 510], style: "tea", house: [-124, -34], pip: [-96, -40] },
  bank(640, 540, [485, 461.5], "burrow", HOUSE_RIGHT),
  bank(770, 540, [705, 540], "mush"),
  bank(900, 540, [835, 540], "acorn"),
  bank(900, 420, [960, 480], "tea"),
  bank(770, 420, [835, 420], "burrow"),
  bank(640, 420, [705, 420], "mush", HOUSE_RIGHT),
  bank(640, 300, [580, 360], "acorn", HOUSE_RIGHT),
  bank(770, 300, [705, 300], "tea"),
  bank(900, 300, [835, 300], "burrow"),
  bank(900, 180, [960, 240], "mush"),
  bank(770, 180, [835, 180], "acorn"),
  bank(640, 180, [705, 180], "tea", HOUSE_RIGHT),
];

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

/**
 * Hollowmere's five lane slots, empty until its routes exist. They show as hedge and fog. The path comes in
 * from the east gate and winds up and west toward Conker Corner's fog. Keep clear of that fog (top left) and
 * Snowberry End's (bottom left), which sit at the same spots as on Thistledown's map.
 */
export const HOLLOWMERE_SLOTS: Lane[] = [
  bank(780, 480, [840, 520], "mush"),
  bank(650, 420, [715, 450], "acorn"),
  bank(520, 360, [585, 390], "tea"),
  bank(560, 230, [510, 290], "burrow"),
  bank(430, 160, [490, 190], "mush"),
];

const HOLLOWMERE_SCENERY: Scenery = {
  start: { x: 900, y: 540 },
  postOffice: false,
  water: false,
  trees: [[60, 330, 1], [300, 480, 0.9], [860, 340, 0.9], [700, 110, 0.8], [330, 300, 0.8]],
};

/** Thistledown is the spring village. Later seasons are named placeholders until their routes exist. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "thistledown",
    name: "Thistledown",
    season: "spring",
    routes: ["primrose", "clover", "millpond", "footbridge", "hollow", "willow", "brook", "bridgeway", "latch", "hedgerow", "pietin", "sealed", "kitten", "dovecote", "lastround"],
    slots: THISTLEDOWN_SLOTS,
    at: { x: 420, y: 420 },
    scenery: { start: POST_OFFICE, postOffice: true, water: true, trees: TREES },
  },
  { id: "hollowmere", name: "Hollowmere", season: "summer", routes: [], slots: HOLLOWMERE_SLOTS, at: { x: 385, y: 100 }, scenery: HOLLOWMERE_SCENERY },
  { id: "conker", name: "Conker Corner", season: "autumn", routes: [], slots: [], at: { x: 175, y: 110 } },
  { id: "snowberry", name: "Snowberry End", season: "winter", routes: [], slots: [], at: { x: 175, y: 530 } },
];

/** The lane for each route on the map: route `i` of a neighbourhood takes slot `i`. */
export const LANES: Record<string, Lane> = Object.fromEntries(
  NEIGHBOURHOODS.flatMap((h) => h.routes.map((id, i) => [id, h.slots[i]] as const)),
);

for (const h of NEIGHBOURHOODS)
  if (h.routes.length > h.slots.length) throw new Error(`${h.name} has ${h.routes.length} routes but only ${h.slots.length} lane slots`);

/** Slots no route has claimed yet, in order. The map shows these as hedge and fog. */
export function reservedSlots(h: Neighbourhood): Lane[] {
  return h.slots.slice(h.routes.length);
}

/** The stream, the footbridge on the Footbridge Row lane, and the mill pond it runs into. */
export const STREAM = "M580 -20 C 530 140, 610 290, 540 400 S 490 470, 500 502 S 520 580, 490 660";
export const BRIDGE = { x: 500, y: 502, angle: -1 };
export const POND = { x: 520, y: 618, rx: 120, ry: 44 };


/** The scenery of a village's own map. */
export const sceneryOf = (h: Neighbourhood): Scenery => h.scenery ?? { start: POST_OFFICE, postOffice: false, water: false, trees: [] };
