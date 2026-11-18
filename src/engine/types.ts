/** Shared types for the Bramblepost rules engine. No DOM in here. */

/** Lane edges as a 4-bit mask: N=1, E=2, S=4, W=8. Flowerbeds use BED (16). */
export type Edges = number;

/** What sits in a board cell. Only "m" (movable garden tiles) ever slide. */
export type CellKind =
  | "m" // movable garden tile (path or flowerbed)
  | "ice" // frozen stream, rooted
  | "water" // stream, rooted
  | "tree" // old oak, rooted
  | "b" // building: post office or a neighbour's house, rooted
  | "bridge"; // footbridge: turns but never slides

export type ParcelKind = "letter" | "parcel" | "seeds" | "pie" | "cat" | "signed";

export interface Parcel {
  /** Building letter (A..F) this parcel goes to. */
  to: string;
  kind: ParcelKind;
  /** Pie timer: on time if delivered by this move number. */
  limit?: number;
  /** Signed letter: building whose post must arrive first (the key holder). */
  key?: string;
}

/** The minimum a puzzle needs: a grid and a satchel. Used by the solver and level tools. */
export interface Puzzle {
  wind?: { line: "row" | "col"; index: number; d: 1 | -1; every: number };
  grid: string[];
  parcels: Parcel[];
}

export type Dir = 1 | -1;

/**
 * A move.
 *  - r:   rotate cell i (d = +1 clockwise, -1 counterclockwise)
 *  - row: slide row y (d = +1 right, -1 left)
 *  - col: slide column x (d = +1 down, -1 up)
 */
export type Move =
  | { t: "r"; i: number; d: Dir }
  | { t: "row"; y: number; d: Dir }
  | { t: "col"; x: number; d: Dir };

/** A parsed board. `init` is the starting value of every cell (edges, BED, or 0). */
export interface Board {
  w: number;
  h: number;
  kind: CellKind[];
  hasIce: boolean;
  init: number[];
  /** Building letter -> cell index ("P" is the post office). */
  bld: Record<string, number>;
  /** Cell index -> building letter, for building cells. */
  name: Record<number, string>;
  /** Movable cell indices in each row / column, in order. Slides cycle these. */
  rowsM: number[][];
  colsM: number[][];
  level: Puzzle;
}

/** One leg of a delivery: parcel index and the cells Pip walks through. */
export interface Delivery {
  k: number;
  path: number[];
}

export interface SolveResult {
  /** Fewest moves, null if none found within maxDepth, -1 if the board is already solved at move 0. */
  par: number | null;
  line?: Move[];
  states?: number;
  solutions?: number;
  capped?: boolean;
}
