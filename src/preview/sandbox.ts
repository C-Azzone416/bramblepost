/**
 * The preview tools' scratch save (#120). Dev preview only: src/main.ts loads this folder only when
 * `import.meta.env.DEV` is true and the story pack is not active, so none of it reaches a production build.
 *
 * Jumps never touch the real save. They play on a scratch save: the same keys with SCRATCH_PREFIX in front,
 * in the same browser storage. Whether the scratch save is on lives in sessionStorage, so a reload keeps it.
 * A tab opened fresh starts on the real save, but one opened from a preview tab (a link or window.open) starts
 * with a copy of that tab's choice, as sessionStorage does. There is one scratch save per browser, shared by
 * every tab that has it on, so two tabs jumping at once overwrite each other's scratch progress (never the real
 * save). That is fine for a single dev tab; per-tab scratch saves would need the prefix to carry a tab id.
 * No DOM here, so tests can use it directly.
 */
import type { Route } from "../levels";
import type { StorageAdapter } from "../save/adapter";
import { CURRENT_VERSION, resetProgress } from "../save/core";
import type { KeySet } from "../save/keys";
import { NEIGHBOURHOODS, type Neighbourhood } from "../village/data";

/** Put in front of every key of the scratch save. */
export const SCRATCH_PREFIX = "bramblepost-preview:";

/** sessionStorage key for the preview state. */
export const SESSION_KEY = "bramblepost-preview-session";

export interface PreviewSession {
  /** Play on the scratch save instead of the real one. */
  scratch: boolean;
  /** Let every village be entered, even past a season with no routes yet. */
  openAll: boolean;
}

export type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const OFF: PreviewSession = { scratch: false, openAll: false };

export function readSession(store: SessionStore | null): PreviewSession {
  try {
    const p = JSON.parse(store?.getItem(SESSION_KEY) ?? "null");
    if (p && typeof p === "object") return { scratch: p.scratch === true, openAll: p.openAll === true };
  } catch {
    /* blocked storage or bad JSON: the real save */
  }
  return { ...OFF };
}

export function writeSession(store: SessionStore | null, s: PreviewSession): void {
  try {
    if (!s.scratch && !s.openAll) store?.removeItem(SESSION_KEY);
    else store?.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* the state then lasts until the page reloads */
  }
}

/** The same storage, with every key moved under `prefix`. Keys without the prefix are never read or written. */
export function prefixedAdapter(base: StorageAdapter, prefix = SCRATCH_PREFIX): StorageAdapter {
  return {
    getItem: (key) => base.getItem(prefix + key),
    setItem: (key, value) => base.setItem(prefix + key, value),
    removeItem: (key) => base.removeItem(prefix + key),
  };
}

/**
 * The scratch save for arriving at village `hoodId` with every season before it complete: each earlier route
 * stamped at par with three stars (and already shown on the map), the closing scene seen once spring is behind
 * you, and that village current. Thistledown gives an empty save: the very start of spring. Unknown ids throw.
 */
export function seedVillage(hoodId: string, keys: KeySet, routes: Pick<Route, "id" | "par">[], hoods: Neighbourhood[] = NEIGHBOURHOODS): Record<string, string> {
  const at = hoods.findIndex((h) => h.id === hoodId);
  if (at < 0) throw new Error(`No village "${hoodId}"`);
  if (at === 0) return {};
  const par = new Map(routes.map((r) => [r.id, r.par]));
  const done = hoods.slice(0, at).flatMap((h) => h.routes);
  const best = Object.fromEntries(done.map((id) => [id, { stars: 3, moves: par.get(id) ?? 1 }]));
  return {
    [keys.VERSION_KEY]: String(CURRENT_VERSION),
    [keys.STARS_KEY]: JSON.stringify({ best }),
    [keys.VILLAGE_KEY]: JSON.stringify({ stamped: done }),
    [keys.ENDING_KEY]: JSON.stringify({ seen: true }),
    [keys.CURRENT_VILLAGE_KEY]: JSON.stringify({ id: hoodId, visited: hoods.slice(0, at + 1).map((h) => h.id) }),
  };
}

/** Whether a jump to this village needs `openAll`: the season before it can't be completed yet (it has no routes). */
export function needsOpenAll(hoodId: string, hoods: Neighbourhood[] = NEIGHBOURHOODS): boolean {
  const at = hoods.findIndex((h) => h.id === hoodId);
  return hoods.slice(0, Math.max(at, 0)).some((h) => !h.routes.length);
}

/** Empty the scratch save, then write `data` into it. Returns whether the wipe fully worked. */
export function fillScratch(scratch: StorageAdapter, keys: KeySet, data: Record<string, string>): boolean {
  const ok = resetProgress(scratch, keys);
  for (const [k, v] of Object.entries(data)) scratch.setItem(k, v);
  return ok;
}

/** Every key of the save in `from`, as stored, for copying the real save into the scratch one. */
export function snapshot(from: StorageAdapter, keys: KeySet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys.ALL_KEYS) {
    try {
      const v = from.getItem(k);
      if (v !== null) out[k] = v;
    } catch {
      /* skip what can't be read */
    }
  }
  return out;
}
