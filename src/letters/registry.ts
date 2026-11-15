/**
 * Which letters ride on which routes. The spring letters themselves are in spring.ts (#8).
 * A letter rides the parcel `placement.slot` (an index into the route's parcels) of route `placement.route`.
 */
import { ACTIVE_LETTERS, ACTIVE_SLOTS } from "../content/active";
import { availableLetters, letterForSlot } from "./rules";
import type { Letter, LetterSlot, LetterState } from "./types";

/** The letters of the active content pack (the shipped spring letters unless a pack was chosen). */
export const SPRING_LETTERS: Letter[] = ACTIVE_LETTERS;

/** The swap slots of the active pack. */
export const SPRING_SLOTS: LetterSlot[] = ACTIVE_SLOTS;

let current: Letter[] = SPRING_LETTERS;
let currentSlots: readonly LetterSlot[] = SPRING_SLOTS;

/** The ids a swap slot can carry: its default plus every alternative. */
const slotIds = (s: LetterSlot): Set<string> => new Set([s.letter, ...Object.values(s.by ?? {})]);

/**
 * Throws if two letters share an id, or two letters ride the same (route, slot) without being versions of
 * one swap slot. Versions of a swap slot share a placement on purpose (#9).
 */
export function assertUniquePlacements(list: readonly Letter[], slots: readonly LetterSlot[] = currentSlots): void {
  const ids = new Set<string>();
  const seen = new Map<string, string[]>();
  for (const l of list) {
    if (ids.has(l.id)) throw new Error(`Duplicate letter id "${l.id}"`);
    ids.add(l.id);
    if (!l.placement) continue;
    const key = `${l.placement.route}#${l.placement.slot}`;
    const others = seen.get(key) ?? [];
    for (const other of others) {
      if (!slots.some((s) => slotIds(s).has(l.id) && slotIds(s).has(other)))
        throw new Error(`Letters "${other}" and "${l.id}" both ride route ${l.placement.route}, slot ${l.placement.slot}`);
    }
    seen.set(key, [...others, l.id]);
  }
}

/** Swap the whole letter list and its swap slots (tests use this; returns a function that puts the old ones back). Throws on duplicates. */
export function setLetters(list: Letter[], slots: readonly LetterSlot[] = []): () => void {
  assertUniquePlacements(list, slots);
  const prev = current;
  const prevSlots = currentSlots;
  current = list;
  currentSlots = slots;
  return () => {
    current = prev;
    currentSlots = prevSlots;
  };
}

/** Every letter that rides this route, in slot order. */
export const lettersForRoute = (routeId: string, list: readonly Letter[] = current): Letter[] =>
  list.filter((l) => l.placement?.route === routeId).sort((a, b) => a.placement!.slot - b.placement!.slot);

/**
 * The letter riding one parcel slot of a route, if any. This is the one lookup the satchel (envelope),
 * the reading queue and the album agree on. A swap slot (#9) holds the version `letterForSlot` picks for
 * the door-reply `flags`; with no flags it holds its default.
 */
export function letterForParcel(
  routeId: string,
  slot: number,
  flags: Readonly<Record<string, string>> = {},
  list: readonly Letter[] = current,
  slots: readonly LetterSlot[] = currentSlots,
): Letter | undefined {
  const here = list.filter((l) => l.placement?.route === routeId && l.placement.slot === slot);
  if (here.length <= 1 && !slots.some((s) => here[0] && s.letter === here[0].id)) return here[0];
  const swap = slots.find((s) => here.some((l) => l.id === s.letter));
  if (!swap) return here[0];
  const id = letterForSlot(swap, flags);
  return here.find((l) => l.id === id) ?? here.find((l) => l.id === swap.letter);
}

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
    const l = letterForParcel(routeId, slot, state.flags, list);
    if (l) riding.push(l);
  }
  return availableLetters(riding, state);
}

/** The letter list in use now (SPRING_LETTERS unless a test swapped it with setLetters). */
export const currentLetters = (): readonly Letter[] => current;
