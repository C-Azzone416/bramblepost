/** Best stars per route, kept in this browser's localStorage only. */

import { STARS_KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export const SAVE_KEY = STARS_KEY;

export interface Best {
  stars: number;
  moves: number;
}
export interface SaveData {
  best: Record<string, Best>;
}

export function loadSave(): SaveData {
  try {
    const raw = readRaw(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.best) return p as SaveData;
    }
  } catch {
    /* private mode or blocked storage: play without saving */
  }
  return { best: {} };
}

export function persist(save: SaveData): void {
  try {
    writeRaw(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

/** Record a finish if it beats the saved best. */
export function recordBest(save: SaveData, id: string, stars: number, moves: number): void {
  const prev = save.best[id];
  if (!prev || stars > prev.stars || (stars === prev.stars && moves < prev.moves)) {
    save.best[id] = { stars, moves };
    persist(save);
  }
}
