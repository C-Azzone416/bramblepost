/**
 * The preview tools' scratch save (#120). Dev preview only: src/main.ts loads this folder only when
 * `import.meta.env.DEV` is true and the story pack is not active, so none of it reaches a production build.
 *
 * Jumps never touch the real save. They play on a scratch save held as ONE value (a JSON object of the save's
 * keys) under SNAPSHOT_KEY in the same browser storage, so it is built whole in memory and written with a single
 * setItem: there is never a half-written scratch save. Whether the scratch save is on lives in sessionStorage
 * (the session flag), so a reload keeps it. The flag is always set last, after the snapshot is in place.
 * A tab opened fresh starts on the real save, but one opened from a preview tab (a link or window.open) starts
 * with a copy of that tab's choice, as sessionStorage does. There is one scratch save per browser, shared by
 * every tab that has it on, so two tabs jumping at once overwrite each other's scratch progress (never the real
 * save). That is fine for a single dev tab; per-tab scratch saves would need the prefix to carry a tab id.
 * No DOM here, so tests can use it directly.
 */
import type { Route } from "../levels";
import type { StorageAdapter } from "../save/adapter";
import { CURRENT_VERSION } from "../save/core";
import type { KeySet } from "../save/keys";
import { NEIGHBOURHOODS, type Neighbourhood } from "../village/data";

/** Everything the preview tools store in the real storage starts with this. */
export const SCRATCH_PREFIX = "bramblepost-preview:";

/** The one key the whole scratch save lives under (a JSON object of save key -> stored string). */
export const SNAPSHOT_KEY = SCRATCH_PREFIX + "snapshot";

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

/** Read the preview state at boot. A storage error or garbage reads as off: the real save, the safe side. */
export function readSession(store: SessionStore | null): PreviewSession {
  try {
    return readSessionStrict(store);
  } catch {
    return { ...OFF };
  }
}

/** Read the preview state, letting a storage error throw (garbage still reads as off). Used to check a write. */
export function readSessionStrict(store: SessionStore | null): PreviewSession {
  const raw = store ? store.getItem(SESSION_KEY) : null;
  let p: unknown = null;
  try {
    p = JSON.parse(raw ?? "null");
  } catch {
    /* bad JSON: off */
  }
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    return { scratch: o.scratch === true, openAll: o.openAll === true };
  }
  return { ...OFF };
}

/**
 * Store the preview state, then read it back. Throws if the write or removal throws, if the read-back throws, or
 * if a reload would not read exactly `s`, so a failed write is caught even when the old value already matched.
 * With no store, only "off" holds.
 */
export function writeSession(store: SessionStore | null, s: PreviewSession): void {
  const off = !s.scratch && !s.openAll;
  if (!store) {
    if (off) return;
    throw new Error("no session storage");
  }
  if (off) store.removeItem(SESSION_KEY);
  else store.setItem(SESSION_KEY, JSON.stringify(s));
  const now = readSessionStrict(store);
  if (now.scratch !== s.scratch || now.openAll !== s.openAll) throw new Error("session flag did not read back");
}

/**
 * Switch the flag off: remove it, or if that fails overwrite it with "off". True only when a strict read-back
 * shows a reload would start on the real save. Never throws.
 */
export function clearSession(store: SessionStore | null): boolean {
  try {
    writeSession(store, OFF);
    return true;
  } catch {
    /* try overwriting instead */
  }
  try {
    store!.setItem(SESSION_KEY, JSON.stringify(OFF));
    const now = readSessionStrict(store);
    return !now.scratch && !now.openAll;
  } catch {
    return false;
  }
}

/** The scratch save stored in `base`, or an empty one if it is missing or unreadable. Storage errors propagate. */
export function readSnapshot(base: StorageAdapter): Record<string, string> {
  const raw = base.getItem(SNAPSHOT_KEY);
  if (raw === null) return {};
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p)) return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    /* bad JSON: empty */
  }
  return {};
}

/** Whether a valid scratch save is stored: the snapshot key holds a JSON object. A storage error reads as no. */
export function hasSnapshot(base: StorageAdapter): boolean {
  try {
    const p = JSON.parse(base.getItem(SNAPSHOT_KEY) ?? "null");
    return !!p && typeof p === "object" && !Array.isArray(p);
  } catch {
    return false;
  }
}

/** Delete the scratch save. Throws if the removal throws or the snapshot is still there afterwards. */
export function removeSnapshot(base: StorageAdapter): void {
  base.removeItem(SNAPSHOT_KEY);
  if (base.getItem(SNAPSHOT_KEY) !== null) throw new Error("scratch snapshot is still there");
}

/** Replace the whole scratch save with `data`, in a single write. Throws if the write does. */
export function writeSnapshot(base: StorageAdapter, data: Record<string, string>): void {
  base.setItem(SNAPSHOT_KEY, JSON.stringify(data));
}

/**
 * The adapter the game runs on while the scratch save is on. Reads and writes happen inside the one snapshot
 * value; each change rewrites it with a single setItem. It never touches any other key of `base`.
 */
export function scratchAdapter(base: StorageAdapter): StorageAdapter {
  return {
    getItem: (key) => readSnapshot(base)[key] ?? null,
    setItem(key, value) {
      writeSnapshot(base, { ...readSnapshot(base), [key]: value });
    },
    removeItem(key) {
      const d = readSnapshot(base);
      if (!(key in d)) return;
      delete d[key];
      writeSnapshot(base, d);
    },
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

/** Every key of the save in `from`, as stored. A key that can't be read throws, so a copy is never silently short. */
export function snapshot(from: StorageAdapter, keys: KeySet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys.ALL_KEYS) {
    const v = from.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}
