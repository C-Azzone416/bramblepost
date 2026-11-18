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
