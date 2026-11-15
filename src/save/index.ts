export { getAdapter, localStorageAdapter, memoryAdapter, setAdapter, type StorageAdapter } from "./adapter";
export { ALL_KEYS, DATA_KEYS, DOOR_KEY, LETTERS_KEY, PREFS_KEY, SOUND_KEY, STARS_KEY, VERSION_KEY, VILLAGE_KEY } from "./keys";
export { CURRENT_VERSION, MIGRATIONS, migrate, type MigrateResult, readRaw, resetProgress, saveVersion, writeRaw } from "./core";

import { loadDoorSave, type DoorSave } from "../door/save";
import { loadSave, type SaveData } from "../ui/save";
import { loadVillage, type VillageSave } from "../village/save";
import { saveVersion } from "./core";

export interface AllSaves {
  /** null when the stored version can't be read. */
  version: number | null;
  stars: SaveData;
  village: VillageSave;
  door: DoorSave;
}

/** Read every feature's save in one go. */
export function loadAll(): AllSaves {
  return { stars: loadSave(), village: loadVillage(), door: loadDoorSave(), version: saveVersion() };
}
