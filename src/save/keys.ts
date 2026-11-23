/**
 * Every key Bramblepost writes. A new feature adds its key to `keysFor` so `resetProgress` clears it.
 *
 * Progress keys are per content pack: standard keeps the original strings (so existing saves stay valid),
 * the other packs get a pack prefix. Sound and prefs are shared across packs.
 */
import pack from "virtual:content-pack";
import type { PackMode } from "../content/types";

export const SOUND_KEY = "bramblepost-sound-v1";
export const PREFS_KEY = "bramblepost-prefs-v1";

export interface KeySet {
  STARS_KEY: string;
  VILLAGE_KEY: string;
  DOOR_KEY: string;
  SOUND_KEY: string;
  PREFS_KEY: string;
  LETTERS_KEY: string;
  CURRENT_VILLAGE_KEY: string;
  ENDING_KEY: string;
  /** Which villages' welcome intro has been seen. */
  INTRO_KEY: string;
  /** Which save layout the keys are in (CURRENT_VERSION in core.ts). Key names survive migrations. */
  VERSION_KEY: string;
  /** Every data key, shared ones included (not the version key). */
  DATA_KEYS: readonly string[];
  /** DATA_KEYS plus the version key. */
  ALL_KEYS: readonly string[];
}

/** The key set for a pack mode. Pure. */
export function keysFor(mode: PackMode): KeySet {
  const p = mode === "standard" ? "bramblepost" : `bramblepost-${mode}`;
  const STARS_KEY = mode === "standard" ? "bramblepost-playtest-v1" : `${p}-playtest-v1`;
  const VILLAGE_KEY = `${p}-village-v1`;
  const DOOR_KEY = `${p}-door-v1`;
  const LETTERS_KEY = `${p}-letters-v1`;
  const CURRENT_VILLAGE_KEY = `${p}-current-village-v1`;
  const ENDING_KEY = `${p}-ending-v1`;
  const INTRO_KEY = `${p}-intro-v1`;
  const VERSION_KEY = `${p}-save-version`;
  const DATA_KEYS = [STARS_KEY, VILLAGE_KEY, DOOR_KEY, SOUND_KEY, LETTERS_KEY, PREFS_KEY, ENDING_KEY, INTRO_KEY, CURRENT_VILLAGE_KEY];
  return {
    STARS_KEY, VILLAGE_KEY, DOOR_KEY, SOUND_KEY, PREFS_KEY, LETTERS_KEY, CURRENT_VILLAGE_KEY, ENDING_KEY, INTRO_KEY, VERSION_KEY,
    DATA_KEYS,
    ALL_KEYS: [...DATA_KEYS, VERSION_KEY],
  };
}

export const ACTIVE_KEYS: KeySet = keysFor(pack.mode);

export const { STARS_KEY, VILLAGE_KEY, DOOR_KEY, LETTERS_KEY, CURRENT_VILLAGE_KEY, ENDING_KEY, INTRO_KEY, VERSION_KEY, DATA_KEYS, ALL_KEYS } = ACTIVE_KEYS;
