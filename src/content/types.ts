/**
 * A content pack: everything the game says, as plain data. The game reads one active pack (see active.ts).
 * `standard` is built in code from the shipped modules; `stand-in` is placeholder text in stand-in-pack.json;
 * `story` is read from a local file at dev-server time (vite-plugins/content-pack.ts).
 */
import type { DoorScene } from "../door/story";
import type { Letter, LetterSlot, Requirement } from "../letters/types";

export type PackMode = "standard" | "stand-in" | "story";

/** One version of some text. The first entry whose `when` holds wins; the last entry has no `when`. */
export interface Said {
  when?: Requirement;
  say: string;
}

/** The closing scene. Every text can be a list of versions (typed now; the game resolves the last entry for now). */
export interface PackEnding {
  /** The route whose finish triggers it. */
  route: string;
  kicker: Said[];
  title: Said[];
  envelope: Said[];
  /** One line per entry: a plain string, or a list of versions. */
  lines: (string | Said[])[];
}

export interface ContentPack {
  /** Story pack only: a marker checked by the plugin. */
  canary?: string;
  version: 1;
  mode: PackMode;
  season: "spring";
  scenes: DoorScene[];
  letters: Letter[];
  slots: LetterSlot[];
  ending: PackEnding;
}
