/**
 * The one place the game reads its content from: the active pack (VITE_STORY_PACK, see vite-plugins/content-pack.ts).
 * Standard unless the build or dev server was started with another pack.
 */
import pack from "virtual:content-pack";
import type { PlayableEnding } from "../door/ending";
import type { DoorScene } from "../door/story";
import type { Letter, LetterSlot } from "../letters/types";
import type { ContentPack } from "./types";
import { NEIGHBOURHOODS } from "../village/data";

export const ACTIVE_PACK: ContentPack = pack;
const all = <K extends "scenes" | "letters" | "slots">(key: K): ContentPack[K] => {
  const entries = Object.values(ACTIVE_PACK.seasons ?? {}).map((season) => season[key] as ContentPack[K]);
  return [...ACTIVE_PACK[key], ...entries.flat()] as ContentPack[K];
};

export const ACTIVE_SCENES: DoorScene[] = all("scenes");
export const ACTIVE_LETTERS: Letter[] = all("letters");
export const ACTIVE_SLOTS: LetterSlot[] = all("slots");
/** The last spring village route also identifies the legacy spring ending save. */
export const springEndingRoute = () => NEIGHBOURHOODS.find((village) => village.season === "spring")?.routes.at(-1);

/** Bind each supplied finale to the last route in its season. */
export function endingsForPack(content: ContentPack): PlayableEnding[] {
  const springLast = springEndingRoute() ?? content.ending.route;
  const spring = content.ending.route === springLast ? content.ending : { ...content.ending, route: springLast };
  return [spring, ...(["summer", "autumn", "winter"] as const).flatMap((season) => {
    const part = content.seasons?.[season];
    const last = part?.routes?.at(-1);
    return part?.ending && last ? [{ ...part.ending, route: last.id }] : [];
  })];
}

export const ACTIVE_ENDING = endingsForPack(ACTIVE_PACK);
