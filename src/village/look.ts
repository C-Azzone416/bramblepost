import type { Season } from "./data";

/**
 * Colours on the village map that carry text or icons. The drawing code (map.ts) uses these, village.css repeats a few
 * (checked against them by tests/seasonal-light.test.ts), and the contrast test imports them, so the numbers it
 * checks are the numbers that are drawn.
 */
export const LOOK = {
  plateFill: "#2a2b1f",
  plateOpacity: 0.88,
  plateName: "#fffaf0",
  plateNote: "#f7e9c6",
  /** Dark marks on light node fills: the stamp check and the padlock. */
  iconDark: "#2a2b1f",
  nodeRim: "#fffaf0",
  ringHalo: "#fffaf0",
  ringDash: "#1f3558",
  pillFill: "#2a2b1f",
  pillOpacity: 0.88,
  stampLight: "#ffe6a3",
  stampDark: "#d58f26",
  nodeGrey: "#b8b29a",
  nodeRed: "#c4452e",
  /** The number on an open node, and the Today callout: background and text. */
  numberText: "#fffaf0",
  calloutBg: "#c4452e",
  calloutText: "#fffaf0",
  /** Star colours (src/ui/sprites.svg): the gold star's darker stop, the empty star's fill and stroke. */
  starGold: "#d08f22",
  starOff: "#e6dec8",
  starOffRim: "#cbbd99",
} as const;

export interface MapPalette {
  meadow: readonly [string, string, string];
  patches: readonly [string, string];
  grass: string | null;
  specks: readonly [string, string, string];
  speckShape: "flower" | "leaf" | "sparkle";
  tree: {
    shadow: string;
    trunk: string;
    foliage: readonly [string, string, string, string];
    accents: readonly [string, string];
    snow: string | null;
  };
}

/** Map ground and tree colours. The contrast model imports the same table, so every painted colour is sampled (#136). */
export const MAP_PALETTES: Record<Season, MapPalette> = {
  spring: {
    meadow: ["#b9d98a", "#9cc66e", "#7fae58"], patches: ["#c6e19a", "#8dbb62"], grass: "#6f9c48",
    specks: ["#fff4e0", "#f6b9c4", "#ffd97a"], speckShape: "flower",
    tree: { shadow: "#4f7a35", trunk: "#7a4d2a", foliage: ["#5f8d3e", "#6fa24b", "#8fc263", "#b5dc84"], accents: ["#fff4e0", "#f6b9c4"], snow: null },
  },
  summer: {
    meadow: ["#e9e08e", "#c8cf6a", "#a7b452"], patches: ["#f1e6a3", "#b8bf59"], grass: "#879f43",
    specks: ["#fffaf0", "#d95a4f", "#f5ca45"], speckShape: "flower",
    tree: { shadow: "#6e792c", trunk: "#8a5a33", foliage: ["#627f32", "#78953d", "#9daf50", "#c2ca68"], accents: ["#f5ca45", "#fff1b0"], snow: null },
  },
  autumn: {
    meadow: ["#d8b86a", "#c4974a", "#a8763a"], patches: ["#e6c77a", "#bd8242"], grass: "#936b31",
    specks: ["#d0672f", "#f6c45a", "#a8501f"], speckShape: "leaf",
    tree: { shadow: "#765129", trunk: "#6f4528", foliage: ["#a8501f", "#d0672f", "#e8913a", "#f6c45a"], accents: ["#7e3f1d", "#ffd56d"], snow: null },
  },
  winter: {
    meadow: ["#eef3f6", "#e0e8ef", "#cfdbe5"], patches: ["#f8fbfc", "#d8e3eb"], grass: null,
    specks: ["#ffffff", "#d7eef8", "#b9d7e5"], speckShape: "sparkle",
    tree: { shadow: "#7b8d91", trunk: "#6f5845", foliage: ["#355f46", "#497a57", "#5f8c65", "#7ba07a"], accents: ["#d7eef8", "#ffffff"], snow: "#fffaf0" },
  },
};
