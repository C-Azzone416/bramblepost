/** Every key Bramblepost writes. A new feature adds its key here so `resetProgress` clears it. */

export const STARS_KEY = "bramblepost-playtest-v1";
export const VILLAGE_KEY = "bramblepost-village-v1";
export const DOOR_KEY = "bramblepost-door-v1";
export const LETTERS_KEY = "bramblepost-letters-v1";
/** Which save layout the keys above are in. Kept apart so the data shapes stay as they were. */
export const VERSION_KEY = "bramblepost-save-version";

export const DATA_KEYS: readonly string[] = [STARS_KEY, VILLAGE_KEY, DOOR_KEY, LETTERS_KEY];
export const ALL_KEYS: readonly string[] = [...DATA_KEYS, VERSION_KEY];
