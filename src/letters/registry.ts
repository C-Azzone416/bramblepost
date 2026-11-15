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

/** Swap the whole letter list (tests use this; returns a function that puts the old list back). */
export function setLetters(list: Letter[]): () => void {
  const prev = current;
  current = list;
  return () => {
    current = prev;
  };
}

/** Every letter that rides this route, in slot order. */
export const lettersForRoute = (routeId: string, list: readonly Letter[] = current): Letter[] =>
  list.filter((l) => l.placement?.route === routeId).sort((a, b) => a.placement!.slot - b.placement!.slot);

/** The letter riding one parcel slot of a route, if any. */
export const letterForParcel = (routeId: string, slot: number, list: readonly Letter[] = current): Letter | undefined =>
  lettersForRoute(routeId, list).find((l) => l.placement!.slot === slot);

/** Letters on this route that are unlocked and still unread. */
export const unreadForRoute = (routeId: string, state: LetterState, list: readonly Letter[] = current): Letter[] =>
  availableLetters(lettersForRoute(routeId, list), state);
