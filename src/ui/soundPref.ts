/** The mute switch, saved on its own key so it survives route resets: { muted: boolean }. */

export const SOUND_KEY = "bramblepost-sound-v1";

export function loadMuted(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.muted === "boolean") return p.muted;
    }
  } catch {
    /* private mode or blocked storage: play unmuted */
  }
  return false;
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify({ muted }));
  } catch {
    /* ignore */
  }
}
