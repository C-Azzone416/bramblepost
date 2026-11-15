/**
 * The one place that touches browser storage. Everything else asks for a StorageAdapter, so a phone
 * app can hand in native storage with `setAdapter` and nothing else changes.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage, looked up on every call. Missing or blocked storage (no `localStorage`, or touching
 * it throws) reads as empty and drops writes. Errors from the storage itself are NOT swallowed here:
 * they propagate so the save module can tell "failed" from "empty" (see core.ts, which catches them).
 */
export function localStorageAdapter(): StorageAdapter {
  const ls = (): Storage | null => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null; // accessing it can throw when storage is blocked
    }
  };
  return {
    getItem: (key) => ls()?.getItem(key) ?? null,
    setItem(key, value) {
      ls()?.setItem(key, value);
    },
    removeItem(key) {
      ls()?.removeItem(key);
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
