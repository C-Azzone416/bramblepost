/**
 * Resident posties (#142): each later village has a resident postie, and Pip covers for them that season.
 * This is the neutral slot: the look (sprite ids in src/ui/sprites.svg) and a neutral label. Names, lines and reasons come
 * only from the content pack. Thistledown has none (Pip is its postie). Residents never host door scenes, and are not
 * placed on the maps yet.
 */
import { NEIGHBOURHOODS } from "./data";

export interface Postie {
  /** Map-scale figure (30 x 46), a symbol id in sprites.svg. */
  sprite: string;
  /** Portrait-scale bust (420 x 520), a symbol id in sprites.svg. */
  portrait: string;
  /** The neutral label, used as alt / aria text. */
  label: string;
}

const LOOK: Record<string, { sprite: string; portrait: string }> = {
  hollowmere: { sprite: "nbPostieDuck", portrait: "postieDuck" },
  conker: { sprite: "nbPostieChipmunk", portrait: "postieChipmunk" },
  snowberry: { sprite: "nbPostieRobin", portrait: "postieRobin" },
};

/** Village id -> its resident postie. Later villages only, built from NEIGHBOURHOODS. */
export const POSTIES: Record<string, Postie> = Object.fromEntries(
  NEIGHBOURHOODS.filter((n) => n.season !== "spring").map((n) => [n.id, { ...LOOK[n.id], label: `${n.name}'s postie` }]),
);

export function postieOf(villageId: string): Postie | undefined {
  return POSTIES[villageId];
}
