/**
 * The one place the game reads its content from: the active pack (VITE_STORY_PACK, see vite-plugins/content-pack.ts).
 * Standard unless the build or dev server was started with another pack.
 */
import pack from "virtual:content-pack";
import type { EndingScene } from "../door/ending";
import type { DoorScene } from "../door/story";
import type { Letter, LetterSlot } from "../letters/types";
import { packToEndingScene } from "./ending";
import type { ContentPack } from "./types";

export const ACTIVE_PACK: ContentPack = pack;
export const ACTIVE_SCENES: DoorScene[] = pack.scenes;
export const ACTIVE_LETTERS: Letter[] = pack.letters;
export const ACTIVE_SLOTS: LetterSlot[] = pack.slots;
export const ACTIVE_ENDING: EndingScene[] = [packToEndingScene(pack.ending)];
