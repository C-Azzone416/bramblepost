/**
 * Which village the player is in, and which they have entered before, under `bramblepost-current-village-v1`
 * through the save module. Shape: { id, visited }. Thistledown is always the first village and counts as visited.
 * Never throws; blocked or garbled storage means Thistledown. Reset clears it with the rest.
 */
import { CURRENT_VILLAGE_KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";
import { NEIGHBOURHOODS } from "./data";

export interface CurrentVillage {
  id: string;
  visited: string[];
}

const FIRST = NEIGHBOURHOODS[0].id;

export function loadCurrent(): CurrentVillage {
  try {
    const raw = readRaw(CURRENT_VILLAGE_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const known = (id: unknown): id is string => typeof id === "string" && NEIGHBOURHOODS.some((n) => n.id === id);
      const visited = Array.isArray(p.visited) ? p.visited.filter(known) : [];
      return { id: known(p.id) ? p.id : FIRST, visited: [...new Set([FIRST, ...visited])] };
    }
  } catch {
    /* private mode, blocked storage or bad JSON: start in Thistledown */
  }
  return { id: FIRST, visited: [FIRST] };
}

/** Make `id` the current village and note it as visited. */
export function saveCurrent(id: string): void {
  const cur = loadCurrent();
  try {
    writeRaw(CURRENT_VILLAGE_KEY, JSON.stringify({ id, visited: [...new Set([...cur.visited, id])] }));
  } catch {
    /* play without saving */
  }
}
