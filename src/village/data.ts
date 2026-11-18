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
   * to `routes`. Spare slots show as hedge and fog.
   */
  slots: Lane[];
  /** Where the fog and name plate sit on the map of the village before it, while it is locked. */
  at: { x: number; y: number };
  /** Where its fog sits on a particular earlier village's map, when that is not `at` (keyed by the map's village id). */
  seenFrom?: Record<string, { x: number; y: number }>;
  /** This village's own map: where the path starts, and what stands around it. Defaults to a plain meadow. */
  scenery?: Scenery;
}

/** The look of one village's own map, besides its lane slots. */
export interface Scenery {
  /** Where the first lane starts: the post office in Thistledown, a gate or signpost elsewhere. */
  start: { x: number; y: number };
  /** Draw the tree-stump post office at `start`, or at `postOfficeAt` when it has one. */
  postOffice: boolean;
  /** Where the post office stands when that is not `start`: its base centre, and its size relative to the usual 100 × 105. */
  postOfficeAt?: { x: number; y: number; scale: number };
  /** Draw the stream, footbridge and mill pond. */
  water: boolean;
  trees: [number, number, number][];
  /** A round mere with a sandy shore (Hollowmere). */
  mere?: Mere;
  /** Sunflower patches beside the lanes where the sunflowers matter. */
  sunflowers?: Sunflower[];
  /** Small turn arrows, drawn beside the lanes where a turning sunflower matters. */
  turnHints?: [number, number][];
  /** A pale brook from a spring pool, with a plank footbridge where a lane crosses it (Conker Corner). */
  brook?: Brook;
  windmill?: Windmill;
  patch?: PumpkinPatch;
  /** Leaf gusts blowing across the lanes where a gust matters (#125): left end x, y, angle in degrees, length. */
  gusts?: [number, number, number, number][];
  /** Lumpy leafy clumps (leaf piles): base x, base y, scale. */
  bushes?: [number, number, number][];
  /** Reed clumps standing on the bank: base x, base y, scale. */
  reeds?: [number, number, number][];
}

/** Conker Corner's brook: it runs south through the wood from a spring pool; pebbles on the banks, stepping stones across it. */
export interface Brook {
  /** The centre line, north to south (the pool sits at its first point). */
  points: [number, number][];
  /** Half the width of the water, and of the bank round it. */
  water: number;
  bank: number;
  pool: { cx: number; cy: number; rx: number; ry: number };
  /** Short ripple arcs across the flow, irregular in length and spacing, inside the water: left end x, y, length. Never a line along the middle. */
  ripples: [number, number, number][];
  pebbles: [number, number][];
  stones: [number, number][];
  /** The footbridge, where lane 6 crosses: centre and angle in degrees. */
  bridge: { x: number; y: number; angle: number };
}

/** A windmill on the east bank: base centre, and its scale. */
export interface Windmill { x: number; y: number; scale: number }

/** A fenced pumpkin patch with a scarecrow: the fence's box, the pumpkins (x, y, scale) and the scarecrow's base. */
export interface PumpkinPatch {
  fence: { x0: number; y0: number; x1: number; y1: number };
  pumpkins: [number, number, number][];
  scarecrow: [number, number];
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
}

export const MAP_W = 1000;
export const MAP_H = 640;

/** The tree-stump post office, where every round starts. */
export const POST_OFFICE = { x: 150, y: 440 };

/** East-bank cottages are drawn small and sit above their stamp, on the side away from the lane's turn. */
const HOUSE_SCALE = 0.6;
const HOUSE_LEFT: [number, number] = [-58, -72];
const HOUSE_RIGHT: [number, number] = [4, -72];

/** One east-bank slot. */
const bank = (x: number, y: number, via: [number, number], style: HouseStyle, house = HOUSE_LEFT): Lane => ({
  x, y, via, style, house, houseScale: HOUSE_SCALE,
});

/**
 * Thistledown's ten lane slots, in the order the lanes open. A slot is a place on the map; a route
 * takes slot `i` when its id sits at index `i` of the neighbourhood's `routes`. Slots past the last
 * route stay reserved and the map draws them as hedge and fog.
 *
 * The path leaves the post office, crosses the stream by the footbridge (between slots 3 and 4), then
 * winds up the east bank with stops 130 apart across and 120 down. Each cottage sits above
 * its stamp in the gap before the row above, clear of that row's stamp, stars and tap area
 * (tests/village.test.ts checks the boxes), and on the side away from the lane's turn at the bank edges.
 *
 * Slots 6 onward keep placeholder houses and Pip spots; whoever adds the route may change `style`.
 */
export const THISTLEDOWN_SLOTS: Lane[] = [
  { x: 250, y: 350, via: [190, 350], style: "mush", house: [-40, 52] },
  { x: 360, y: 440, via: [340, 360], style: "acorn", house: [26, -108] },
  { x: 390, y: 545, via: [340, 510], style: "tea", house: [-124, -34] },
  bank(640, 540, [485, 461.5], "burrow", HOUSE_RIGHT),
  bank(770, 540, [705, 540], "mush"),
  bank(900, 540, [835, 540], "acorn"),
  bank(900, 420, [960, 480], "tea"),
  bank(770, 420, [835, 420], "burrow"),
  bank(640, 420, [705, 420], "mush", HOUSE_RIGHT),
  bank(640, 300, [580, 360], "acorn", HOUSE_RIGHT),
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

/** A mere: the round pond in Hollowmere's middle, with its sandy shore, ripples, lily pads, reeds, jetty and boat. */
export interface Mere {
  /** Shore (sand), the soft ring of deeper water, and the open water, as ellipses. */
  shore: { cx: number; cy: number; rx: number; ry: number };
  deep: { cx: number; cy: number; rx: number; ry: number };
  water: { cx: number; cy: number; rx: number; ry: number };
  /** Ripple strokes: x, y, half-width. */
  ripples: [number, number, number][];
  lilies: [number, number][];
  /** A pink flower sits on the lily pad at this spot. */
  lilyFlower: [number, number];
  /** Reed clumps: base x, base y, scale. Bases are on the shore. */
  reeds: [number, number, number][];
  /** The jetty: its landward end (base on the ground) is the bottom of the planks. */
  jetty: { x: number; y: number; w: number; h: number };
  boat: [number, number];
}

/** A sunflower: base x, base y, scale. */
export type Sunflower = [number, number, number];

/**
 * Hollowmere's ten lane slots, in the order the lanes open, from the picked mockup (docs/village-mockups/layouts.json on
 * #148). The route starts at the post office in the bottom right, runs west along the south shore, up the west side and back
 * east along the north, and ends toward Conker Corner's fog in the top right. The houses are stand-ins from the existing styles
 * (strawberry house = mush, skep = burrow, flowerpot = tea, boathouse = acorn); #147 swaps in the real ones.
 */
export const HOLLOWMERE_SLOTS: Lane[] = [
  { x: 800, y: 520, via: [863, 531], style: "mush", house: [-22.8, -104], houseScale: HOUSE_SCALE },
  { x: 660, y: 572, via: [724, 529], style: "burrow", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 520, y: 540, via: [587, 570], style: "tea", house: [36.8, -72.8], houseScale: HOUSE_SCALE },
  { x: 380, y: 575, via: [446, 541], style: "acorn", house: [57, -104.8], houseScale: HOUSE_SCALE },
  { x: 230, y: 500, via: [314, 520], style: "mush", house: [39.2, -74], houseScale: HOUSE_SCALE },
  { x: 150, y: 360, via: [173, 440], style: "burrow", house: [-87.2, -70.4], houseScale: HOUSE_SCALE },
  { x: 225, y: 222, via: [168, 281], style: "mush", house: [-84.8, -74], houseScale: HOUSE_SCALE },
  { x: 380, y: 150, via: [294, 167], style: "burrow", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 545, y: 182, via: [466, 150], style: "tea", house: [-25.2, -102.8], houseScale: HOUSE_SCALE },
  { x: 690, y: 250, via: [626, 199], style: "mush", house: [39.2, -74], houseScale: HOUSE_SCALE },
];

const HOLLOWMERE_SCENERY: Scenery = {
  start: { x: 916, y: 566 },
  postOffice: true,
  postOfficeAt: { x: 916, y: 520, scale: 0.82 },
  water: false,
  trees: [[60, 250, 1], [70, 560, 0.9], [300, 610, 0.75], [470, 622, 0.8], [880, 330, 0.9], [972, 372, 0.75], [600, 80, 0.75], [140, 90, 0.85], [470, 70, 0.7], [960, 60, 0.7]],
  mere: {
    shore: { cx: 394, cy: 368, rx: 209, ry: 124 },
    deep: { cx: 390, cy: 364, rx: 185, ry: 106 },
    water: { cx: 390, cy: 360, rx: 175, ry: 98 },
    ripples: [[300, 320, 30], [430, 300, 40], [360, 400, 35], [470, 390, 25]],
    lilies: [[270, 360], [292, 380], [500, 330], [520, 352], [440, 420]],
    lilyFlower: [506, 326],
    reeds: [[250, 420, 0.9], [560, 330, 0.9], [545, 410, 1]],
    jetty: { x: 448, y: 418, w: 26, h: 80 },
    boat: [410, 404],
  },
  sunflowers: [[735, 609, 1], [757, 610, 0.85], [586, 630, 0.9], [252, 584, 1], [232, 579, 0.85], [220, 317, 0.95], [229, 299, 0.8], [465, 231, 1], [490, 229, 0.85], [599, 270, 0.95], [619, 274, 0.85], [860, 610, 0.9], [880, 617, 0.9], [300, 120, 0.9], [318, 111, 0.9]],
  // beside lanes 5 and 9 (nudged a few units off the lanes, where the mockup's touch them): where a turning sunflower matters (#124); top-left of each small turn arrow
  turnHints: [[256, 538], [449, 180]],
};

/**
 * Conker Corner's ten lane slots, from the picked mockup (docs/village-mockups/layouts.json on #148). The route starts at the
 * post office on the left, zigzags north up the west bank, crosses the footbridge (lane 6) and ends on the east side, toward
 * Snowberry End's fog in the bottom right. Houses are stand-ins from the existing styles (conker house = acorn, hollow log =
 * burrow, pumpkin house = tea); #147 swaps in the real ones.
 */
export const CONKER_SLOTS: Lane[] = [
  { x: 170, y: 470, via: [135, 517], style: "acorn", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 290, y: 575, via: [215, 539], style: "burrow", house: [-50.2, -128.4], houseScale: HOUSE_SCALE },
  { x: 345, y: 425, via: [342, 509], style: "tea", house: [36.8, -72.8], houseScale: HOUSE_SCALE },
  { x: 240, y: 320, via: [278, 387], style: "acorn", house: [-105.0, -72.8], houseScale: HOUSE_SCALE },
  { x: 325, y: 205, via: [266, 251], style: "burrow", house: [-87.2, -70.4], houseScale: HOUSE_SCALE },
  { x: 590, y: 130, via: [449, 136], style: "acorn", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 640, y: 215, via: [605, 179], style: "tea", house: [-7.2, -102.8], houseScale: HOUSE_SCALE },
  { x: 780, y: 150, via: [702, 166], style: "burrow", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 880, y: 290, via: [850, 206], style: "acorn", house: [41.0, -72.8], houseScale: HOUSE_SCALE },
  { x: 745, y: 405, via: [801, 334], style: "tea", house: [-87.2, -72.8], houseScale: HOUSE_SCALE },
];

const CONKER_SCENERY: Scenery = {
  start: { x: 80, y: 538 },
  postOffice: true,
  postOfficeAt: { x: 74, y: 492, scale: 0.82 },
  water: false,
  trees: [[60, 120, 1.1], [150, 195, 0.9], [90, 330, 0.85], [400, 300, 0.75], [680, 80, 0.9], [940, 90, 0.95], [880, 520, 0.9], [650, 560, 0.85], [400, 610, 0.85], [180, 610, 0.8], [260, 80, 0.8]],
  brook: {
    points: [[452, 40], [456, 100], [474, 150], [487, 200], [476, 260], [465, 310], [468, 350], [495, 400], [520, 445], [515, 500], [497, 555], [489, 600], [492, 645]],
    water: 13,
    bank: 20,
    pool: { cx: 450, cy: 32, rx: 32, ry: 13 },
    ripples: [[444, 62, 9], [450, 81, 14], [455, 119, 7], [467, 134, 11], [470, 171, 16], [483, 215, 8], [470, 238, 12], [475, 279, 6], [458, 296, 15], [467, 326, 9], [468, 371, 13], [489, 388, 7], [497, 423, 10], [513, 468, 14], [509, 483, 8], [505, 523, 12], [493, 541, 6], [490, 578, 11], [481, 620, 9]],
    pebbles: [[428, 46], [474, 42], [436, 104], [497, 153], [455, 190], [500, 236], [450, 282], [489, 330], [522, 402], [538, 452], [527, 521], [469, 590]],
    stones: [[457, 337], [467, 335], [477, 339], [469, 346]],
    bridge: { x: 466, y: 149, angle: -14 },
  },
  reeds: [[457, 225, 0.8], [486, 436, 0.8], [474, 548, 0.8]],
  windmill: { x: 572, y: 420, scale: 1 },
  patch: {
    fence: { x0: 838, y0: 372, x1: 972, y1: 470 },
    pumpkins: [[862, 410, 1], [896, 428, 1.15], [934, 408, 1], [946, 444, 0.9], [872, 450, 0.85]],
    scarecrow: [822, 455],
  },
  gusts: [[200, 380, 8, 130], [560, 250, -10, 150]],
  bushes: [[700, 308, 0.85], [560, 478, 0.85], [126, 418, 0.8]],
};

/** Snowberry End keeps Hollowmere's layout and a plain meadow until #129 gives it its own. */
const { mere: _mere, sunflowers: _sunflowers, turnHints: _turnHints, ...PLACEHOLDER_SCENERY } = HOLLOWMERE_SCENERY;

/** Thistledown is the spring village. Later seasons are named placeholders until their routes exist. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "thistledown",
    name: "Thistledown",
    season: "spring",
    routes: ["primrose", "millpond", "footbridge", "hollow", "willow", "brook", "latch", "pietin", "sealed", "lastround"],
    slots: THISTLEDOWN_SLOTS,
    at: { x: 420, y: 420 },
    scenery: { start: POST_OFFICE, postOffice: true, water: true, trees: TREES },
  },
  { id: "hollowmere", name: "Hollowmere", season: "summer", routes: [], slots: HOLLOWMERE_SLOTS, at: { x: 385, y: 100 }, scenery: HOLLOWMERE_SCENERY },
  // Conker Corner's fog is top right on Hollowmere's map (the mockup); on Thistledown's it stays the old far mist, top left
  { id: "conker", name: "Conker Corner", season: "autumn", routes: [], slots: CONKER_SLOTS, at: { x: 828, y: 86 }, seenFrom: { thistledown: { x: 175, y: 110 } }, scenery: CONKER_SCENERY },
  // Snowberry End's fog is bottom right on Conker Corner's map (the mockup); its far mist on Hollowmere's map sits behind Conker Corner's, clear of Hollowmere's lanes
  { id: "snowberry", name: "Snowberry End", season: "winter", routes: [], slots: HOLLOWMERE_SLOTS.map((slot) => ({ ...slot })), at: { x: 175, y: 530 }, seenFrom: { hollowmere: { x: 828, y: 86 }, conker: { x: 820, y: 524 } }, scenery: PLACEHOLDER_SCENERY },
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


/** Where `h`'s fog sits on the map of `viewer` (a village id). */
export const fogAt = (h: Neighbourhood, viewer: string): { x: number; y: number } => h.seenFrom?.[viewer] ?? h.at;

/** The scenery of a village's own map. */
export const sceneryOf = (h: Neighbourhood): Scenery => h.scenery ?? { start: POST_OFFICE, postOffice: false, water: false, trees: [] };
