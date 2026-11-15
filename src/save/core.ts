/**
 * Versioned reads and writes shared by every feature save.
 *
 * The version number lives in its own key. Saves from before versions existed have no such key and
 * count as version 0; since their shape is already what version 1 expects, migrating them only
 * stamps the version. To change a shape later: bump CURRENT_VERSION and add a step to MIGRATIONS
 * that rewrites the raw keys it affects.
 */
import { getAdapter, type StorageAdapter } from "./adapter";
import { DATA_KEYS, VERSION_KEY } from "./keys";

export const CURRENT_VERSION = 1;

/**
 * MIGRATIONS[n] upgrades a save from version n to n + 1. Each step must be idempotent: if storage
 * fails before the version is stamped, the step runs again next time.
 */
export const MIGRATIONS: Array<(a: StorageAdapter) => void> = [
  () => {
    /* 0 -> 1: unversioned saves are already in the version 1 shape */
  },
];

/**
 * The stored version: 0 when the key is missing (a save from before versions), null when it can't be
 * known (the read threw, or the value is garbage).
 */
export function saveVersion(a: StorageAdapter = getAdapter()): number | null {
  try {
    const raw = a.getItem(VERSION_KEY);
    if (raw === null) return 0;
    return /^\d+$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

export interface MigrateResult {
  /** The version found before migrating (null if unknown). */
  version: number | null;
  /** True only when storage is safe to write: version known, not newer, and every step plus the stamp succeeded (or none was needed). */
  ok: boolean;
}

/**
 * Bring stored data up to CURRENT_VERSION. Data from a newer app, or of unknown version, is left
 * alone and reported as not ok, as is any failure part way (the next call tries again).
 */
export function migrate(a: StorageAdapter = getAdapter()): MigrateResult {
  const version = saveVersion(a);
  if (version === null || version > CURRENT_VERSION) return { version, ok: false };
  if (version === CURRENT_VERSION) return { version, ok: true };
  try {
    for (let v = version; v < CURRENT_VERSION; v++) MIGRATIONS[v](a);
    a.setItem(VERSION_KEY, String(CURRENT_VERSION));
  } catch {
    return { version, ok: false };
  }
  return { version, ok: true };
}

/**
 * Read one key's raw text. With no `store` it uses the shared adapter and migrates first; a `store`
 * passed in by a test is used as it is.
 */
export function readRaw(key: string, store?: Pick<StorageAdapter, "getItem"> | null): string | null {
  try {
    if (store !== undefined) return store?.getItem(key) ?? null;
    const a = getAdapter();
    migrate(a);
    return a.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write one key's raw text. With the shared adapter this migrates first, like readRaw, and refuses
 * to write unless migration fully succeeded: an unknown or newer version, or a failed migration,
 * means the data may be in a format this code doesn't understand (reads still return whatever is stored).
 */
export function writeRaw(key: string, value: string, store?: Pick<StorageAdapter, "setItem"> | null): void {
  try {
    if (store !== undefined) {
      store?.setItem(key, value);
      return;
    }
    const a = getAdapter();
    if (!migrate(a).ok) return; // never mutate storage unless the version is known and migration succeeded
    a.setItem(key, value);
  } catch {
    /* private mode: play without saving */
  }
}

/**
 * Wipe all progress. Data keys go first; the version key is removed only if every data removal
 * succeeded, so surviving data is never left without its version marker. Returns whether everything
 * was cleared.
 */
export function resetProgress(a: StorageAdapter = getAdapter()): boolean {
  let ok = true;
  for (const k of DATA_KEYS) {
    try {
      a.removeItem(k);
    } catch {
      ok = false;
    }
  }
  if (!ok) return false;
  try {
    a.removeItem(VERSION_KEY);
  } catch {
    return false;
  }
  return true;
}
