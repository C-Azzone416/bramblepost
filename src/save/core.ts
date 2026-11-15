/**
 * Versioned reads and writes shared by every feature save.
 *
 * The version number lives in its own key. Saves from before versions existed have no such key and
 * count as version 0; since their shape is already what version 1 expects, migrating them only
 * stamps the version. To change a shape later: bump CURRENT_VERSION and add a step to MIGRATIONS
 * that rewrites the raw keys it affects.
 */
import { getAdapter, type StorageAdapter } from "./adapter";
import { ALL_KEYS, VERSION_KEY } from "./keys";

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

export function saveVersion(a: StorageAdapter = getAdapter()): number {
  try {
    const n = Number(a.getItem(VERSION_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Bring stored data up to CURRENT_VERSION. Data from a newer app is left alone. Returns the version found afterwards. */
export function migrate(a: StorageAdapter = getAdapter()): number {
  let v = saveVersion(a);
  if (v >= CURRENT_VERSION) return v;
  try {
    for (; v < CURRENT_VERSION; v++) MIGRATIONS[v](a);
    a.setItem(VERSION_KEY, String(CURRENT_VERSION));
  } catch {
    /* storage failed half way: try again next time */
  }
  return v;
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
 * to write when the stored version is newer than this code: an older app must not overwrite data in
 * a format it doesn't understand (reads still return whatever is stored).
 */
export function writeRaw(key: string, value: string, store?: Pick<StorageAdapter, "setItem"> | null): void {
  try {
    if (store !== undefined) {
      store?.setItem(key, value);
      return;
    }
    const a = getAdapter();
    migrate(a); // owns the version stamp
    if (saveVersion(a) > CURRENT_VERSION) return;
    a.setItem(key, value);
  } catch {
    /* private mode: play without saving */
  }
}

/** Wipe all progress: every Bramblepost key, including the version. */
export function resetProgress(a: StorageAdapter = getAdapter()): void {
  for (const k of ALL_KEYS) {
    try {
      a.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}
