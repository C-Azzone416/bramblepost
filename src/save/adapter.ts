/**
 * The one place that touches browser storage. Everything else asks for a StorageAdapter, so a phone
 * app can hand in native storage with `setAdapter` and nothing else changes.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage, looked up on every call. Blocked or missing storage reads as empty and drops writes. */
export function localStorageAdapter(): StorageAdapter {
  const ls = (): Storage | null => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null; // accessing it can throw when storage is blocked
    }
  };
  return {
    getItem(key) {
      try {
        return ls()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        ls()?.setItem(key, value);
      } catch {
        /* private mode or quota: play without saving */
      }
    },
    removeItem(key) {
      try {
        ls()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** A Map-backed adapter for tests. `data` is exposed so tests can look inside. */
export function memoryAdapter(initial: Record<string, string> = {}): StorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

let current: StorageAdapter = localStorageAdapter();

export const getAdapter = (): StorageAdapter => current;

/** Swap the storage backend (native storage, or a memory adapter in tests). */
export function setAdapter(a: StorageAdapter): void {
  current = a;
}
