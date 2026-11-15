// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import { ding, kettle, pluck, armSound, isMuted, setMuted } from "../src/ui/sound";
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

describe("mute toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    mountApp(document.getElementById("app")!, ROUTES);
  });
  it("flips aria-pressed and persists", () => {
    const b = document.getElementById("soundBtn")!;
    expect(b.getAttribute("aria-pressed")).toBe("false");
    b.click();
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(isMuted()).toBe(true);
    expect(loadMuted()).toBe(true);
    b.click();
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(loadMuted()).toBe(false);
  });
});
