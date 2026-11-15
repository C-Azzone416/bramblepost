/**
 * Reduced motion: on when the system asks for it OR the player turned it on in Settings.
 * The saved preference lives in the prefs key ({ reduceMotion: boolean }). JS asks `reducedMotion()`;
 * CSS animations are cut by the `reduce-motion` class on <html> (see styles.css), kept in step by
 * `applyMotion()`.
 */
import { PREFS_KEY, readRaw, writeRaw } from "../save";

export function loadReduceMotion(): boolean {
  try {
    const raw = readRaw(PREFS_KEY);
    if (raw) return JSON.parse(raw)?.reduceMotion === true;
  } catch {
    /* garbage in storage: motion stays on */
  }
  return false;
}

export function saveReduceMotion(on: boolean): void {
  writeRaw(PREFS_KEY, JSON.stringify({ reduceMotion: on }));
  applyMotion(on);
}

/** Set or clear the `reduce-motion` class on <html>. */
export function applyMotion(on: boolean = loadReduceMotion()): void {
  document.documentElement.classList.toggle("reduce-motion", on);
}

export function reducedMotion(): boolean {
  if (loadReduceMotion()) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
