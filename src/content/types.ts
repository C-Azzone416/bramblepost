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

/** The closing scene. Every text can be a list of versions (the first matching version is played). */
export interface PackEnding {
  /** The route whose finish triggers it. */
  route: string;
  kicker: Said[];
  title: Said[];
  envelope: Said[];
  /** One line per entry: a plain string, or a list of versions. */
  lines: (string | Said[])[];
}

export interface SeasonPack {
  village?: string;
  intro?: string[];
  /** Parcel codes use the engine kind followed by a house id, e.g. `parcel:house`. */
  routes?: { id: string; parcels: string[] }[];
  houses?: string[];
  ending?: PackEnding;
  scenes: DoorScene[];
  letters: Letter[];
  slots: LetterSlot[];
  /** Placeholder copy until the season has routes. */
  placeholder?: { scene: string; letter: string };
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
  seasons?: Partial<Record<"summer" | "autumn" | "winter", SeasonPack>>;
  ending: PackEnding;
}

/** Backwards-compatible name for season content. */
export type SeasonContent = SeasonPack;
