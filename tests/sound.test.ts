// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ding, kettle, pluck, armSound } from "../src/ui/sound";
import { SOUND_KEY, loadMuted, saveMuted } from "../src/ui/soundPref";

describe("mute save", () => {
  beforeEach(() => localStorage.clear());
  it("defaults to unmuted", () => expect(loadMuted()).toBe(false));
  it("round trips under its own key", () => {
    saveMuted(true);
    expect(JSON.parse(localStorage.getItem(SOUND_KEY)!)).toEqual({ muted: true });
    expect(loadMuted()).toBe(true);
    saveMuted(false);
    expect(loadMuted()).toBe(false);
  });
  it("ignores junk", () => {
    localStorage.setItem(SOUND_KEY, "{nope");
    expect(loadMuted()).toBe(false);
    localStorage.setItem(SOUND_KEY, JSON.stringify({ muted: "yes" }));
    expect(loadMuted()).toBe(false);
  });
});

describe("sound without Web Audio", () => {
  it("is a safe no-op, even after a gesture", () => {
    expect(() => {
      armSound();
      document.dispatchEvent(new Event("pointerdown"));
      ding();
      kettle();
      pluck(3);
    }).not.toThrow();
  });
});
