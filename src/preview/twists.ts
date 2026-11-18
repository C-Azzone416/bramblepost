/**
 * Preview-only routes for the later-season rules (#124 sunflowers; gusts and ice follow in their own PRs). They are NOT in
 * ROUTES: the real Hollowmere, Conker Corner and Snowberry End routes are #130, #131 and #132. This file is loaded only by the
 * dev-server preview panel (see src/main.ts), so a production build has none of it. Standard content only: no story text.
 */
import type { Route } from "../levels";

/** One sunflower on the only lane to the house. It is lined up after two moves of any kind. */
export const SUNFLOWER_PREVIEW: Route = {
  id: "preview-sunflowers",
  name: "Sunflower lane (preview)",
  blurb: "A sunflower turns a quarter after every move.",
  teach: "Sunflowers turn a quarter after every move.",
  tag: "New: sunflowers",
  grid: ["P @NE * *", "* A * *", "* * * T"],
  parcels: [{ to: "A", kind: "letter" }],
  houses: { A: "tea" },
  par: 2,
  solution: {
    order: [0],
    moves: [
      { t: "row", y: 1, d: 1 },
      { t: "row", y: 1, d: 1 },
    ],
  },
};

/** Every preview route, in the order the panel lists them. */
export const TWIST_PREVIEW: Route[] = [SUNFLOWER_PREVIEW];
