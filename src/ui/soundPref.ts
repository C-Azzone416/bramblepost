/** The mute switch, saved on its own key so it survives route resets: { muted: boolean }. */
import { SOUND_KEY, readRaw, writeRaw } from "../save";

export { SOUND_KEY };

export function loadMuted(): boolean {
  try {
    const raw = readRaw(SOUND_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.muted === "boolean") return p.muted;
    }
  } catch {
    /* garbage in storage: play unmuted */
  }
  return false;
}

export function saveMuted(muted: boolean): void {
  writeRaw(SOUND_KEY, JSON.stringify({ muted }));
}
