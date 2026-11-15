import type { Letter, LetterSlot, LetterState, Requirement } from "./types";

const has = (read: LetterState["read"], id: string): boolean => (Array.isArray(read) ? read.includes(id) : (read as ReadonlySet<string>).has(id));

/** An `all` of nothing holds; an `any` of nothing does not. */
export function isMet(req: Requirement | undefined, state: LetterState): boolean {
  if (!req) return true;
  switch (req.kind) {
    case "read":
      return has(state.read, req.letter);
    case "flag":
      return Object.prototype.hasOwnProperty.call(state.flags, req.key) && state.flags[req.key] === req.value;
    case "all":
      return req.of.every((r) => isMet(r, state));
    case "any":
      return req.of.some((r) => isMet(r, state));
  }
}

/** True when the letter's requirements hold. Says nothing about whether it was already read. */
export const isAvailable = (letter: Letter, state: LetterState): boolean => isMet(letter.requires, state);

/** Letters that are unlocked and not yet read, in the order given. */
export const availableLetters = (letters: readonly Letter[], state: LetterState): Letter[] =>
  letters.filter((l) => !has(state.read, l.id) && isAvailable(l, state));

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** The id of the letter this slot carries, given the door-reply flags. Only own properties count: "toString" is not a reply. */
export function letterForSlot(slot: LetterSlot, flags: Readonly<Record<string, string>>): string {
  if (!slot.flag || !slot.by || !own(flags, slot.flag)) return slot.letter;
  const v = flags[slot.flag];
  return typeof v === "string" && own(slot.by, v) ? slot.by[v] : slot.letter;
}
