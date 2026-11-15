/**
 * Whether the closing scene has been seen, under `bramblepost-ending-v1` through the save module.
 * Shape: { seen: boolean }. Never throws; blocked storage plays unsaved. Reset clears it with the rest.
 */
import { ENDING_KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export type Store = Pick<Storage, "getItem" | "setItem">;

export function endingSeen(store?: Store | null): boolean {
  try {
    const raw = readRaw(ENDING_KEY, store);
    if (!raw) return false;
    const p = JSON.parse(raw);
    return !!p && typeof p === "object" && p.seen === true;
  } catch {
    return false;
  }
}

export function markEndingSeen(store?: Store | null): void {
  try {
    writeRaw(ENDING_KEY, JSON.stringify({ seen: true }), store);
  } catch {
    /* private mode: play without saving */
  }
}
