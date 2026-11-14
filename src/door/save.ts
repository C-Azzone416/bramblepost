/**
 * Door scene progress, kept in this browser's localStorage under its own key so it never clashes
 * with saved stars (bramblepost-playtest-v1).
 *
 * Shape of `bramblepost-door-v1`:
 *   flags:  reply flags, e.g. { "clementine.sisterNote": "read" }. Later scenes and letters read these.
 *   stamps: route id -> true once that route's stamp is collected.
 *   voices: false when the player turned the gibberish voices off.
 * Other features (the village map) can read stamps and flags with loadDoorSave().
 */

export const DOOR_KEY = "bramblepost-door-v1";

export interface DoorSave {
  flags: Record<string, string>;
  stamps: Record<string, true>;
  voices: boolean;
}

/** The bit of Storage this module uses, so tests can pass a fake. */
export type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const isStrMap = (o: unknown): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o);

export function loadDoorSave(store: Store | null = defaultStore()): DoorSave {
  const out: DoorSave = { flags: {}, stamps: {}, voices: true };
  try {
    const raw = store?.getItem(DOOR_KEY);
    if (!raw) return out;
    const p = JSON.parse(raw);
    if (!isStrMap(p)) return out;
    if (isStrMap(p.flags)) for (const k in p.flags) if (typeof p.flags[k] === "string") out.flags[k] = p.flags[k] as string;
    if (isStrMap(p.stamps)) for (const k in p.stamps) if (p.stamps[k]) out.stamps[k] = true;
    if (p.voices === false) out.voices = false;
  } catch {
    /* blocked storage or bad JSON: start fresh */
  }
  return out;
}

export function persistDoorSave(save: DoorSave, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(DOOR_KEY, JSON.stringify(save));
  } catch {
    /* private mode: play without saving */
  }
}

/** Record a reply. Picking again on a replay replaces the earlier reply. */
export function setFlag(save: DoorSave, key: string, value: string, store?: Store | null): void {
  save.flags[key] = value;
  persistDoorSave(save, store);
}

/** Collect a route's stamp. Returns true the first time. */
export function collectStamp(save: DoorSave, routeId: string, store?: Store | null): boolean {
  if (save.stamps[routeId]) return false;
  save.stamps[routeId] = true;
  persistDoorSave(save, store);
  return true;
}

/** How many of these routes' stamps are collected. */
export function stampCount(save: DoorSave, routeIds: string[]): number {
  return routeIds.filter((id) => save.stamps[id]).length;
}

export function setVoices(save: DoorSave, on: boolean, store?: Store | null): void {
  save.voices = on;
  persistDoorSave(save, store);
}
