/**
 * Which letters ride on which routes. Empty by default: the real spring letters (#8) are added here
 * when they are signed off, so until then nothing about the shipped game changes.
 * A letter rides the parcel `placement.slot` (an index into the route's parcels) of route `placement.route`.
 */
import { availableLetters } from "./rules";
import type { Letter, LetterState } from "./types";

/** The shipped letters. Add to this list in #8. */
export const SPRING_LETTERS: Letter[] = [];

let current: Letter[] = SPRING_LETTERS;

/** Throws if two letters share an id, or two letters ride the same (route, slot). */
export function assertUniquePlacements(list: readonly Letter[]): void {
  const ids = new Set<string>();
  const slots = new Map<string, string>();
  for (const l of list) {
    if (ids.has(l.id)) throw new Error(`Duplicate letter id "${l.id}"`);
    ids.add(l.id);
    if (!l.placement) continue;
    const key = `${l.placement.route}#${l.placement.slot}`;
    const other = slots.get(key);
    if (other !== undefined) throw new Error(`Letters "${other}" and "${l.id}" both ride route ${l.placement.route}, slot ${l.placement.slot}`);
    slots.set(key, l.id);
  }
}

/** Swap the whole letter list (tests use this; returns a function that puts the old list back). Throws on duplicates. */
export function setLetters(list: Letter[]): () => void {
  assertUniquePlacements(list);
  const prev = current;
  current = list;
  return () => {
    current = prev;
  };
}

/** Every letter that rides this route, in slot order. */
export const lettersForRoute = (routeId: string, list: readonly Letter[] = current): Letter[] =>
  list.filter((l) => l.placement?.route === routeId).sort((a, b) => a.placement!.slot - b.placement!.slot);

/**
 * The letter riding one parcel slot of a route, if any. This is the one lookup the satchel (envelope)
 * and the reading queue both use, so they always agree.
 * TODO(#9): exactly one letter per (route, slot) for now. Flag-dependent alternatives for a slot are
 * resolved there, through letterForSlot, and this is where that goes.
 */
export const letterForParcel = (routeId: string, slot: number, list: readonly Letter[] = current): Letter | undefined =>
  list.find((l) => l.placement?.route === routeId && l.placement.slot === slot);

/**
 * Letters to read after a route, in parcel order: unlocked and unread.
 * A route only finishes once every parcel is delivered, so "delivered on this route" is simply every
 * valid parcel index (0 up to `parcelCount`): no per-parcel delivery tracking is needed.
 * A placement whose slot is not an integer in that range never rides anything and is ignored.
 */
export function unreadForRoute(routeId: string, parcelCount: number, state: LetterState, list: readonly Letter[] = current): Letter[] {
  for (const l of lettersForRoute(routeId, list)) {
    const s = l.placement!.slot;
    if (!Number.isInteger(s) || s < 0 || s >= parcelCount) {
      if (import.meta.env?.DEV) console.warn(`Letter "${l.id}" has slot ${s}, but route ${routeId} has ${parcelCount} parcels: ignored`);
    }
  }
  const riding: Letter[] = [];
  for (let slot = 0; slot < parcelCount; slot++) {
    const l = letterForParcel(routeId, slot, list);
    if (l) riding.push(l);
  }
  return availableLetters(riding, state);
}

/** The letter list in use now (SPRING_LETTERS unless a test swapped it with setLetters). */
export const currentLetters = (): readonly Letter[] => current;
