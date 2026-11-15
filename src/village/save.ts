/**
 * Village save, kept in this browser's localStorage under its own key.
 *
 * Best stars per route stay in src/ui/save.ts (key "bramblepost-playtest-v1"); the map reads them
 * from there. This key holds what only the village needs: which stamps the player has already seen
 * land on the map, so a new one can arrive with a little flourish.
 *
 * Other village features can keep their own fields here (for example a door-scene reply per route).
 * Writes go through `updateVillage`, which keeps any fields it does not know about.
 */

import { VILLAGE_KEY as KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export const VILLAGE_KEY = KEY;

export interface VillageSave {
  /** Route ids whose stamp has already been shown on the map. */
  stamped: string[];
  /** Fields owned by other modules are kept as they are. */
  [field: string]: unknown;
}

export function loadVillage(): VillageSave {
  try {
    const raw = readRaw(VILLAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return { ...p, stamped: Array.isArray(p.stamped) ? p.stamped.filter((s: unknown) => typeof s === "string") : [] };
      }
    }
  } catch {
    /* private mode, blocked storage or bad JSON: start fresh */
  }
  return { stamped: [] };
}

/** Read the save, let `fn` change it, write it back. Returns the saved object. */
export function updateVillage(fn: (v: VillageSave) => void): VillageSave {
  const v = loadVillage();
  fn(v);
  try {
    writeRaw(VILLAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
  return v;
}

/** Remember that these stamps have been shown. */
export function markStamped(ids: string[]): void {
  if (!ids.length) return;
  updateVillage((v) => {
    for (const id of ids) if (!v.stamped.includes(id)) v.stamped.push(id);
  });
}
