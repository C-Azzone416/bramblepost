/**
 * Door scene progress, kept in this browser's localStorage under its own key so it never clashes
 * with saved stars (bramblepost-playtest-v1).
 *
 * Shape of `bramblepost-door-v1`:
 *   flags:  reply flags, e.g. { "clementine.sisterNote": "read" }. Later scenes and letters read these.
 *   voices: false when the player turned the gibberish voices off (Settings, src/ui/settings.ts).
 * Stamps belong to the village map: a route's stamp is its saved finish (see src/village/progress.ts).
 * Other features can read the reply flags with loadDoorSave().
 */

import { DOOR_KEY as KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export const DOOR_KEY = KEY;

export interface DoorSave {
  flags: Record<string, string>;
  voices: boolean;
}

/** The bit of Storage this module uses, so tests can pass a fake. */
export type Store = Pick<Storage, "getItem" | "setItem">;

const isStrMap = (o: unknown): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o);

export function loadDoorSave(store?: Store | null): DoorSave {
  const out: DoorSave = { flags: {}, voices: true };
  try {
    const raw = readRaw(DOOR_KEY, store);
    if (!raw) return out;
    const p = JSON.parse(raw);
    if (!isStrMap(p)) return out;
    if (isStrMap(p.flags)) for (const k in p.flags) if (typeof p.flags[k] === "string") out.flags[k] = p.flags[k] as string;
    if (p.voices === false) out.voices = false;
  } catch {
    /* blocked storage or bad JSON: start fresh */
  }
  return out;
}

export function persistDoorSave(save: DoorSave, store?: Store | null): void {
  try {
    writeRaw(DOOR_KEY, JSON.stringify(save), store);
  } catch {
    /* private mode: play without saving */
  }
}

/** Record a reply. Picking again on a replay replaces the earlier reply. */
export function setFlag(save: DoorSave, key: string, value: string, store?: Store | null): void {
  save.flags[key] = value;
  persistDoorSave(save, store);
}

export function setVoices(save: DoorSave, on: boolean, store?: Store | null): void {
  save.voices = on;
  persistDoorSave(save, store);
}
