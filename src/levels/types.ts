import type { Move, Puzzle } from "../engine";

/** Which neighbour lives in a house (see src/ui/cast.ts for names and art). */
export type HouseStyle = "tea" | "acorn" | "burrow" | "mush" | "sh1" | "sh2" | "sh3" | "ah1" | "ah2" | "ah3";

export interface Route extends Puzzle {
  id: string;
  name: string;
  /** One line on the route card. */
  blurb: string;
  /** Hint shown in the banner while sorting the satchel. */
  teach: string;
  /** Small label on the route card, e.g. "New: footbridge". */
  tag?: string;
  /** Sunday puzzle styling. */
  sunday?: boolean;
  /** Building letter -> neighbour. */
  houses: Record<string, HouseStyle>;
  /** Starting satchel order (parcel indices). Defaults to the order listed. */
  def?: number[];
  /** Fewest moves over every valid satchel order. Checked by tests/levels.test.ts. */
  par: number;
  /** One known par solution, replayed by the tests. */
  solution: { order: number[]; moves: Move[] };
}
