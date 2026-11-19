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
  /** Draw the stream, its footbridges and its pools (STREAM, BRIDGES, PONDS). */
  water: boolean;
  /** Decorative cottages (style, top-left x, y, scale). When present the lanes draw no house of their own. */
  houses?: [HouseStyle, number, number, number][];
  /** Draw the faint dotted track from the last lane on to the next village's fog, even when that village has routes. */
  trackToNext?: boolean;
  trees: [number, number, number][];
  /** A round mere with a sandy shore (Hollowmere). */
  mere?: Mere;
  /** Sunflower patches beside the lanes where the sunflowers matter. */
  sunflowers?: Sunflower[];
  /** Small turn arrows, drawn beside the lanes where a turning sunflower matters. */
  turnHints?: [number, number][];
  /** Draw the trees as snow-dusted firs rather than leafy trees (Snowberry End). */
  firs?: boolean;
  /** A pale brook from a spring pool, with a plank footbridge where a lane crosses it (Conker Corner). */
  brook?: Brook;
  windmill?: Windmill;
  patch?: PumpkinPatch;
  /** Leaf gusts blowing across the lanes where a gust matters (#125): left end x, y, angle in degrees, length. */
  gusts?: [number, number, number, number][];
  /** Lumpy leafy clumps (leaf piles in autumn, snowy shrubs in winter): base x, base y, scale. */
  bushes?: [number, number, number][];
  /** Reed clumps standing on the bank: base x, base y, scale. Frosted on a map with a lake. */
  reeds?: [number, number, number][];
  /** A frozen lake with boardwalks over it, huts, a skating ring and a jetty (Snowberry End). */
  lake?: Lake;
  /** Lamp posts and a bench (Snowberry End): base x, base y, scale. */
  lanterns?: [number, number, number][];
  bench?: [number, number];
  /** Patches of thawed earth showing through the snow: centre x, y. */
  thawed?: [number, number][];
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

/** Snowberry End's frozen lake and what stands on or at it. */
export interface Lake {
  /** The ice's outline, clockwise (the picked mockup's `lakeOutline`). */
  outline: [number, number][];
  /** Lanes (1 to 10) that cross the ice on planks; the planks make them safe (#126). */
  planks: number[];
  /** The slide hint where a lane crosses bare ice: Pip slides from `from` to `to` (lane 10). */
  slide: { lane: number; from: [number, number]; to: [number, number] };
  ring: { cx: number; cy: number; rx: number; ry: number };
  /** Ice-fishing huts out on the ice (base centre). The stop-3 hut is among them: scenery, not a stop's house. */
  huts: [number, number, string][];
  /** The jetty: its landward end (base on the shore) is the left end, then it runs out onto the ice. */
  jetty: { x: number; y: number; w: number; angle: number };
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

/** The tree-stump post office, where every round starts (bottom left). */
export const POST_OFFICE = { x: 112, y: 568 };

/** Cottages on the later villages' maps are drawn at this scale beside their stamp. */
const HOUSE_SCALE = 0.6;

/**
 * One Thistledown slot: the stop and the bend of the lane leading to it. Spring draws no house per stop (the houses are
 * scenery, see THISTLEDOWN_HOUSES), so `house` is the unused origin; `style` stays the stop's neighbour code.
 */
const stop = (x: number, y: number, via: [number, number], style: HouseStyle): Lane => ({ x, y, via, style, house: [0, 0] });

/** Houses on the spring map are decorative scenery (owner pick B, #175): style, top-left x, y, and scale. Never tied to a stop. */
export const THISTLEDOWN_HOUSES: [HouseStyle, number, number, number][] = [["mush",572,68,0.7],["acorn",34,404,0.7],["tea",806,414,0.7],["burrow",178,41,0.7],["mush",290,358,0.7],["tea",65,209,0.7],["acorn",944,267,0.7],["burrow",397,189,0.7],["mush",31,59,0.7]];

/**
 * Thistledown's ten lane slots, in the order the lanes open, laid out over the whole canvas (#175). A slot is a place on the
 * map; a route takes slot `i` when its id sits at index `i` of the neighbourhood's `routes`. Slots past the last route stay
 * reserved and the map draws them as hedge and fog.
 *
 * The path leaves the post office at the bottom left and runs east along the bottom (1, 2), crosses the river by the first
 * bridge (lane 3), reaches the bottom right (4), climbs the east side (5, 6), comes back west through the middle (7), crosses
 * the river by the second bridge (lane 8) to the centre left, then climbs the west side (9) and runs across the top (10)
 * toward Hollowmere's fog in the top right corner. No cottage is tied to a stop: the houses are scenery.
 */
export const THISTLEDOWN_SLOTS: Lane[] = [
  stop(261, 528, [190, 575], "mush"),
  stop(439, 572, [350, 592], "acorn"),
  stop(628, 538, [535, 592], "tea"),
  stop(800, 568, [715, 578], "burrow"),
  stop(914, 418, [950, 540], "mush"),
  stop(752, 333, [880, 340], "acorn"),
  stop(578, 371, [665, 330], "tea"),
  stop(392, 336, [490, 376], "burrow"),
  stop(205, 268, [285, 352], "mush"),
  stop(432, 139, [225, 150], "acorn"),
];

/** Trees scattered over the whole canvas, between the lanes (x, y, scale). */
export const TREES: [number, number, number][] = [[42,366,0.99],[209,386,1.08],[129,324,0.85],[43,204,0.89],[170,131,0.88],[543,137,0.73],[138,417,0.82],[136,59,1.03],[85,157,0.76],[57,299,0.78],[533,195,0.76],[603,172,0.82]];

/** Reed clumps on the river bank (x, y, scale). The bush sprite is autumn's leaf pile, so spring has none. */
export const REEDS: [number, number, number][] = [[417, 412, 0.85]];

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
 * east along the north, and ends toward Conker Corner's fog in the top right. Neutral house codes reuse existing art:
 * sh1 = tea, sh2 = burrow, sh3 = mush.
 */
export const HOLLOWMERE_SLOTS: Lane[] = [
  { x: 800, y: 520, via: [863, 531], style: "sh3", house: [-22.8, -104], houseScale: HOUSE_SCALE },
  { x: 660, y: 572, via: [724, 529], style: "sh2", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 520, y: 540, via: [587, 570], style: "sh1", house: [36.8, -72.8], houseScale: HOUSE_SCALE },
  { x: 380, y: 575, via: [446, 541], style: "sh3", house: [53, -104.8], houseScale: HOUSE_SCALE },
  { x: 230, y: 500, via: [314, 520], style: "sh3", house: [39.2, -74], houseScale: HOUSE_SCALE },
  { x: 150, y: 360, via: [173, 440], style: "sh2", house: [-87.2, -70.4], houseScale: HOUSE_SCALE },
  { x: 225, y: 222, via: [168, 281], style: "sh3", house: [-84.8, -74], houseScale: HOUSE_SCALE },
  { x: 380, y: 150, via: [294, 167], style: "sh2", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 545, y: 182, via: [466, 150], style: "sh1", house: [-25.2, -102.8], houseScale: HOUSE_SCALE },
  { x: 690, y: 250, via: [626, 199], style: "sh3", house: [39.2, -74], houseScale: HOUSE_SCALE },
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
 * Snowberry End's fog in the bottom right. Neutral house codes reuse existing art: ah1 = acorn, ah2 = burrow, ah3 = tea;
 * each slot takes its route's letter house (route 10: its first house).
 */
export const CONKER_SLOTS: Lane[] = [
  { x: 170, y: 470, via: [135, 517], style: "ah1", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 290, y: 575, via: [215, 539], style: "ah3", house: [-50.2, -128.4], houseScale: HOUSE_SCALE },
  { x: 345, y: 425, via: [342, 509], style: "ah2", house: [36.8, -72.8], houseScale: HOUSE_SCALE },
  { x: 240, y: 320, via: [278, 387], style: "ah3", house: [-105.0, -72.8], houseScale: HOUSE_SCALE },
  { x: 325, y: 205, via: [266, 251], style: "ah1", house: [-87.2, -70.4], houseScale: HOUSE_SCALE },
  { x: 590, y: 130, via: [449, 136], style: "ah2", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 640, y: 215, via: [605, 179], style: "ah3", house: [-7.2, -102.8], houseScale: HOUSE_SCALE },
  { x: 780, y: 150, via: [702, 166], style: "ah1", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 880, y: 290, via: [850, 206], style: "ah2", house: [41.0, -72.8], houseScale: HOUSE_SCALE },
  { x: 745, y: 405, via: [801, 334], style: "ah3", house: [-87.2, -72.8], houseScale: HOUSE_SCALE },
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

/**
 * Snowberry End's ten lane slots, from the picked mockup. The route starts at the post office in the top left, runs east along
 * the north shore, out over the ice on a boardwalk to stop 3 and back, round the east side and west along the south shore.
 * Neutral house codes reuse existing art: wh1 = acorn, wh2 = burrow, wh3 = tea, wh4 = mush; each slot takes its route's letter
 * house (route 10: its first house). Stop 3's mockup house is an ice-fishing hut, which is scenery here, so its stop is a stand-in
 * house on the north shore.
 */
export const SNOWBERRY_SLOTS: Lane[] = [
  { x: 190, y: 175, via: [124, 170], style: "wh1", house: [-22.8, -104.0], houseScale: HOUSE_SCALE },
  { x: 345, y: 140, via: [272, 176], style: "wh2", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 470, y: 300, via: [424, 208], style: "wh3", house: [9.8, -140.8], houseScale: HOUSE_SCALE },
  { x: 665, y: 140, via: [587, 243], style: "wh4", house: [55.2, -106.0], houseScale: HOUSE_SCALE },
  { x: 830, y: 190, via: [754, 145], style: "wh1", house: [41.0, -72.8], houseScale: HOUSE_SCALE },
  { x: 905, y: 340, via: [850, 274], style: "wh2", house: [36.8, -70.4], houseScale: HOUSE_SCALE },
  { x: 830, y: 490, via: [886, 424], style: "wh3", house: [-84.8, -74.0], houseScale: HOUSE_SCALE },
  { x: 665, y: 565, via: [740, 511], style: "wh4", house: [-21.0, -102.8], houseScale: HOUSE_SCALE },
  { x: 505, y: 565, via: [585, 584], style: "wh2", house: [-25.2, -100.4], houseScale: HOUSE_SCALE },
  { x: 300, y: 565, via: [403, 540], style: "wh1", house: [-84.8, -74.0], houseScale: HOUSE_SCALE },
];

const SNOWBERRY_SCENERY: Scenery = {
  start: { x: 64, y: 196 },
  postOffice: true,
  postOfficeAt: { x: 76, y: 158, scale: 0.82 },
  water: false,
  firs: true,
  trees: [[46, 300, 0.95], [150, 335, 0.85], [55, 405, 1], [160, 425, 0.85], [65, 540, 1], [140, 605, 0.9], [880, 45, 0.85], [945, 190, 0.9], [925, 560, 0.9], [430, 52, 0.8], [250, 45, 0.8], [575, 72, 0.75]],
  bushes: [[106, 240, 0.7], [205, 440, 0.7], [585, 505, 0.7], [940, 500, 0.7]],
  reeds: [[768, 318, 0.85], [255, 402, 0.85], [690, 455, 0.85], [328, 238, 0.85]],
  lanterns: [[790, 425, 0.85], [255, 445, 0.85], [440, 196, 0.85]],
  bench: [770, 592],
  thawed: [[90, 292], [125, 468], [520, 185], [858, 598], [610, 52]],
  lake: {
    outline: [[262, 315], [275, 291], [294, 267], [318, 250], [350, 239], [385, 232], [422, 228], [460, 228], [500, 229], [540, 231], [580, 235], [618, 239], [653, 245], [686, 257], [718, 274], [742, 295], [754, 318], [757, 343], [751, 367], [737, 390], [715, 410], [684, 425], [648, 436], [613, 442], [579, 444], [548, 445], [521, 448], [497, 453], [480, 465], [470, 484], [462, 505], [457, 528], [452, 550], [442, 569], [425, 584], [408, 592], [389, 591], [371, 581], [365, 564], [369, 537], [372, 510], [368, 489], [359, 469], [342, 452], [316, 436], [292, 420], [272, 400], [256, 379], [250, 358], [253, 337]],
    planks: [3, 4],
    slide: { lane: 10, from: [470, 556], to: [347, 554] },
    ring: { cx: 610, cy: 329, rx: 71, ry: 31 },
    huts: [[318, 318, "#c4452e"], [408, 374, "#4f9fb8"], [548, 408, "#5f9a48"]],
    jetty: { x: 228, y: 352, w: 58, angle: 4 },
  },
};

/** Thistledown is the spring village. Later seasons are named placeholders until their routes exist. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "thistledown",
    name: "Thistledown",
    season: "spring",
    routes: ["primrose", "millpond", "footbridge", "hollow", "willow", "brook", "latch", "pietin", "sealed", "lastround"],
    slots: THISTLEDOWN_SLOTS,
    at: { x: 420, y: 420 },
    scenery: { start: POST_OFFICE, postOffice: true, water: true, trees: TREES, reeds: REEDS, houses: THISTLEDOWN_HOUSES, trackToNext: true },
  },
  { id: "hollowmere", name: "Hollowmere", season: "summer", routes: ["summer-1", "summer-2", "summer-3", "summer-4", "summer-5", "summer-6", "summer-7", "summer-8", "summer-9", "summer-10"], slots: HOLLOWMERE_SLOTS, at: { x: 830, y: 150 }, scenery: HOLLOWMERE_SCENERY },
  // Conker Corner's fog is top right on Hollowmere's map (the mockup)
  { id: "conker", name: "Conker Corner", season: "autumn", routes: ["autumn-1", "autumn-2", "autumn-3", "autumn-4", "autumn-5", "autumn-6", "autumn-7", "autumn-8", "autumn-9", "autumn-10"], slots: CONKER_SLOTS, at: { x: 828, y: 86 }, scenery: CONKER_SCENERY },
  // Snowberry End's fog is bottom right on Conker Corner's map (the mockup)
  { id: "snowberry", name: "Snowberry End", season: "winter", routes: ["winter-1", "winter-2", "winter-3", "winter-4", "winter-5", "winter-6", "winter-7", "winter-8", "winter-9", "winter-10"], slots: SNOWBERRY_SLOTS, at: { x: 175, y: 530 }, seenFrom: { conker: { x: 820, y: 524 } }, scenery: SNOWBERRY_SCENERY },
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

/** Through-points of the river, from the pool at the top centre down to the bottom centre. */
const RIVER: [number, number][] = [[609, 222], [565, 258], [525, 296], [497, 336], [488, 364], [466, 404], [452, 448], [470, 486], [512, 514], [538, 550], [535, 568], [512, 606], [500, 640], [510, 670]];

/** A smooth path (Catmull-Rom through the points, as cubic Béziers). */
const smooth = (pts: [number, number][]): string =>
  pts.reduce((d, p, i) => {
    if (!i) return `M${p[0]} ${p[1]}`;
    const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], c = p, e = pts[i + 1] ?? p;
    const f = (n: number) => Math.round(n * 10) / 10;
    return `${d} C ${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)}, ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)}, ${c[0]} ${c[1]}`;
  }, "");

/** The river, the two footbridges where lanes 3 and 8 cross it, and the pools it runs between. */
export const STREAM = smooth(RIVER);
export const BRIDGES = [
  { x: 535, y: 568, angle: -10 },
  { x: 488, y: 364, angle: 10 },
];
export const PONDS = [
  { x: 609, y: 222, rx: 50, ry: 22 },
  { x: 540, y: 650, rx: 90, ry: 30 },
];


/** Where `h`'s fog sits on the map of `viewer` (a village id). */
export const fogAt = (h: Neighbourhood, viewer: string): { x: number; y: number } => h.seenFrom?.[viewer] ?? h.at;

/** The scenery of a village's own map. */
export const sceneryOf = (h: Neighbourhood): Scenery => h.scenery ?? { start: POST_OFFICE, postOffice: false, water: false, trees: [] };
