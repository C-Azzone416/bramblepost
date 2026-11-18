/**
 * The one place the game reads its content from: the active pack (VITE_STORY_PACK, see vite-plugins/content-pack.ts).
 * Standard unless the build or dev server was started with another pack.
 */
import pack from "virtual:content-pack";
import type { PlayableEnding } from "../door/ending";
import type { DoorScene } from "../door/story";
import type { Letter, LetterSlot } from "../letters/types";
import type { ContentPack } from "./types";

export const ACTIVE_PACK: ContentPack = pack;
const all = <K extends "scenes" | "letters" | "slots">(key: K): ContentPack[K] => {
  const entries = Object.values(ACTIVE_PACK.seasons ?? {}).map((season) => season[key] as ContentPack[K]);
  return [...ACTIVE_PACK[key], ...entries.flat()] as ContentPack[K];
};

export const ACTIVE_SCENES: DoorScene[] = all("scenes");
export const ACTIVE_LETTERS: Letter[] = all("letters");
export const ACTIVE_SLOTS: LetterSlot[] = all("slots");
export const ACTIVE_ENDING: PlayableEnding[] = [pack.ending];
