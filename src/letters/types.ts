/** Letter threads as plain data. No DOM, no storage: see rules.ts for the logic and save.ts for saving. */

/** What must be true before a letter is sent. Compose `all` and `any` freely. */
export type Requirement =
  | { kind: "read"; letter: string }
  | { kind: "flag"; key: string; value: string }
  | { kind: "all"; of: Requirement[] }
  | { kind: "any"; of: Requirement[] };

/** Where a letter rides: a route's parcel slot (route id, slot index). */
export interface Placement {
  route: string;
  slot: number;
  /** A note tucked onto any parcel kind; untucked letters ride `letter` or `signed` parcels only. The satchel marks it "note attached". */
  tucked?: boolean;
}

import type { NeighbourId } from "./cast";

export interface Letter {
  id: string;
  sender: string;
  /** Who receives it: a stable neighbour id, not a display name. */
  recipient: NeighbourId;
  thread: string;
  /** What Pip can see on the outside. */
  envelope: string;
  /** What the neighbour reads out, one line per entry. */
  body: string[];
  /** Absent means the letter is available from the start. */
  requires?: Requirement;
  placement?: Placement;
}

/**
 * A parcel slot whose letter depends on an earlier door reply: `by[flags[flag]]` if the player gave
 * a reply that has an entry, else `letter`. Every alternative rides in the same slot, so par and
 * parcels don't change (#9).
 */
export interface LetterSlot {
  letter: string;
  flag?: string;
  by?: Record<string, string>;
  /** Checked in order before `flag`/`by`; the first met requirement wins. Typed now; not yet read by the game. */
  cases?: { if: Requirement; letter: string }[];
}

/** What unlock rules look at: letters read so far and the door-reply flags. */
export interface LetterState {
  read: ReadonlySet<string> | readonly string[];
  flags: Readonly<Record<string, string>>;
}
