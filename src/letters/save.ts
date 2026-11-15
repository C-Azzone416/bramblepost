/**
 * Which letters have been read, under `bramblepost-letters-v1` through the save module.
 * Shape: { read: string[] } in the order they were read. Never throws; blocked storage plays unsaved.
 */
import { LETTERS_KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export interface LettersSave {
  read: string[];
}

export type Store = Pick<Storage, "getItem" | "setItem">;

export function loadLetters(store?: Store | null): LettersSave {
  const out: LettersSave = { read: [] };
  try {
    const raw = readRaw(LETTERS_KEY, store);
    if (!raw) return out;
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && Array.isArray(p.read)) {
      for (const id of p.read) if (typeof id === "string" && !out.read.includes(id)) out.read.push(id);
    }
  } catch {
    /* blocked storage or bad JSON: start fresh */
  }
  return out;
}

export function persistLetters(save: LettersSave, store?: Store | null): void {
  try {
    writeRaw(LETTERS_KEY, JSON.stringify(save), store);
  } catch {
    /* private mode: play without saving */
  }
}

/** Record a letter as read (once) and save. */
export function markRead(save: LettersSave, id: string, store?: Store | null): void {
  if (!save.read.includes(id)) save.read.push(id);
  persistLetters(save, store);
}
