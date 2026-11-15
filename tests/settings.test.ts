// @vitest-environment jsdom
/** Settings: switches, reduced motion, reset with confirm, keyboard focus. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOOR_KEY,
  PREFS_KEY,
  SOUND_KEY,
  STARS_KEY,
  VERSION_KEY,
  getAdapter,
  memoryAdapter,
  setAdapter,
  type StorageAdapter,
} from "../src/save";
import { loadDoorSave } from "../src/door/save";
import * as voice from "../src/door/voice";
import { showDoorScene } from "../src/door/view";
import { SPRING_SCENES } from "../src/door/scenes";
import { ROUTES } from "../src/levels";
import { reducedMotion, saveReduceMotion } from "../src/ui/motion";
import { mountApp } from "../src/ui/mount";
import { isMuted, setMuted } from "../src/ui/sound";
import { loadMuted } from "../src/ui/soundPref";

const $ = (id: string) => document.getElementById(id)!;
const original = getAdapter();
let mem: ReturnType<typeof memoryAdapter>;

function boot(returning = true) {
  const best = returning ? { [ROUTES[0].id]: { stars: 3, moves: 5 } } : {};
  mem.setItem(STARS_KEY, JSON.stringify({ best }));
  document.body.innerHTML = "";
  const root = document.body.appendChild(document.createElement("div"));
  const app = mountApp(root, ROUTES);
  return app;
}
const openSettings = () => $("titleSettings").click();
const key = (k: string, el: Element = document.activeElement!) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  );

beforeEach(() => {
  mem = memoryAdapter();
  setAdapter(mem);
  setMuted(false);
  mem.data.clear();
  document.documentElement.className = "";
  vi.unstubAllGlobals();
  window.scrollTo = () => {};
});
afterEach(() => setAdapter(original));

describe("settings switches", () => {
  it("the Settings button is enabled and opens the view", () => {
    boot();
    expect($("titleSettings").getAttribute("aria-disabled")).toBeNull();
    openSettings();
    expect($("settingsView").hidden).toBe(false);
    expect($("titleView").hidden).toBe(true);
  });

  it("voices toggles and persists in the door save", () => {
    boot();
    openSettings();
    expect($("setVoices").getAttribute("aria-pressed")).toBe("true");
    $("setVoices").click();
    expect($("setVoices").getAttribute("aria-pressed")).toBe("false");
    expect(loadDoorSave().voices).toBe(false);
    expect(JSON.parse(mem.getItem(DOOR_KEY)!).voices).toBe(false);
    $("setVoices").click();
    expect(loadDoorSave().voices).toBe(true);
  });

  it("a door scene opened with voices off never calls blip; with voices on it does", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(voice, "blip").mockImplementation(() => {});
    const scene = () => {
      const h = showDoorScene({
        scene: SPRING_SCENES[0],
        result: { route: ROUTES[0], index: 0, stars: 3, moves: 5, coldPie: false } as never,
        onContinue: () => {},
        typeMs: 1,
      });
      vi.advanceTimersByTime(500);
      return h;
    };
    try {
      boot();
      openSettings();
      $("setVoices").click(); // off
      let h = scene();
      expect(h.el.querySelector('[data-door="voice"]')).toBeNull();
      expect(loadDoorSave().voices).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      h.close();
      $("setVoices").click(); // on again
      h = scene();
      expect(spy).toHaveBeenCalled();
      h.close();
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
    }
  });

  it("sound is the mute, applied at once and saved; the game panel button is gone", () => {
    boot();
    expect(document.getElementById("soundBtn")).toBeNull();
    openSettings();
    expect($("setSound").getAttribute("aria-pressed")).toBe("true");
    $("setSound").click();
    expect($("setSound").getAttribute("aria-pressed")).toBe("false");
    expect(isMuted()).toBe(true);
    expect(loadMuted()).toBe(true);
    $("setSound").click();
    expect(isMuted()).toBe(false);
    expect(loadMuted()).toBe(false);
  });

  it("reduced motion toggles, persists and sets the html class", () => {
    boot();
    openSettings();
    expect($("setMotion").getAttribute("aria-pressed")).toBe("false");
    $("setMotion").click();
    expect($("setMotion").getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(mem.getItem(PREFS_KEY)!)).toEqual({ reduceMotion: true });
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(
      true,
    );
    $("setMotion").click();
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(
      false,
    );
  });

  it("reopening shows the saved states", () => {
    boot();
    openSettings();
    $("setMotion").click();
    key("Escape");
    openSettings();
    expect($("setMotion").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("reducedMotion()", () => {
  const mq = (matches: boolean) =>
    vi.stubGlobal("matchMedia", () => ({ matches }));
  it("is false with neither", () => {
    mq(false);
    expect(reducedMotion()).toBe(false);
  });
  it("is true when the media query matches", () => {
    mq(true);
    expect(reducedMotion()).toBe(true);
  });
  it("is true when the setting is on, even if the query says no", () => {
    mq(false);
    mem.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    expect(reducedMotion()).toBe(true);
  });
  it("survives a missing matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(reducedMotion()).toBe(false);
  });
});

describe("reset progress", () => {
  it("needs the second button; Keep cancels", () => {
    boot();
    openSettings();
    $("resetAsk").click();
    expect($("resetConfirm").hidden).toBe(false);
    expect(document.activeElement).toBe($("resetNo"));
    $("resetNo").click();
    expect($("resetConfirm").hidden).toBe(true);
    expect(mem.getItem(STARS_KEY)).not.toBeNull();
  });

  it("wipes every key and lands on the map as a new player", () => {
    boot();
    openSettings();
    $("setVoices").click();
    $("setMotion").click();
    $("setSound").click();
    $("resetAsk").click();
    $("resetYes").click();
    // Only the version stamp may come back, written when the map reads the (empty) save.
    expect([...mem.data.keys()].filter((k) => k !== VERSION_KEY)).toEqual([]);
    expect($("settingsView").hidden).toBe(true);
    expect($("titleView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect(isMuted()).toBe(false);
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(
      false,
    );
  });

  it("tells the player when reset did not fully clear", () => {
    boot();
    const flaky: StorageAdapter = {
      ...mem,
      getItem: mem.getItem,
      setItem: mem.setItem,
      removeItem: (k) => {
        if (k === DOOR_KEY) throw new Error("nope");
        mem.removeItem(k);
      },
    };
    setAdapter(flaky);
    openSettings();
    $("resetAsk").click();
    $("resetYes").click();
    expect($("resetMsg").textContent).toMatch(/didn't clear/);
    expect($("settingsView").hidden).toBe(false);
    expect($("mapView").hidden).toBe(true);
  });

  it("after a partial reset the title and cached bests match what survives in storage", () => {
    const app = boot();
    setAdapter({
      ...mem,
      getItem: mem.getItem,
      setItem: mem.setItem,
      removeItem: (k) => {
        if (k === DOOR_KEY) throw new Error("nope");
        mem.removeItem(k);
      },
    });
    openSettings();
    $("resetAsk").click();
    $("resetYes").click();
    // The stars key was removed before the door key failed, so nothing is left to continue.
    expect(mem.getItem(STARS_KEY)).toBeNull();
    expect(app.title.returning).toBe(false);
    expect($("titleContinue").hidden).toBe(true);
  });

  it("after a partial reset mute, motion and the switches match storage", () => {
    boot();
    setMuted(true);
    saveReduceMotion(true);
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
    setAdapter({
      ...mem,
      getItem: mem.getItem,
      setItem: mem.setItem,
      removeItem: (k) => {
        if (k === DOOR_KEY) throw new Error("nope");
        mem.removeItem(k);
      },
    });
    openSettings();
    $("resetAsk").click();
    $("resetYes").click();
    // Sound and prefs keys were removed even though another key failed.
    expect(mem.getItem(SOUND_KEY)).toBeNull();
    expect(mem.getItem(PREFS_KEY)).toBeNull();
    expect(loadMuted()).toBe(false);
    expect(isMuted()).toBe(false);
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(false);
    expect($("setSound").getAttribute("aria-pressed")).toBe("true");
    expect($("setMotion").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("keyboard", () => {
  it("focus moves in on open, and Escape returns to the title's Settings button", () => {
    boot();
    openSettings();
    expect($("settingsView").contains(document.activeElement)).toBe(true);
    key("Escape");
    expect($("settingsView").hidden).toBe(true);
    expect($("titleView").hidden).toBe(false);
    expect(document.activeElement).toBe($("titleSettings"));
  });

  it("Back does the same", () => {
    boot();
    openSettings();
    $("settingsBack").click();
    expect(document.activeElement).toBe($("titleSettings"));
  });

  it("Escape on the confirm step only cancels the confirm", () => {
    boot();
    openSettings();
    $("resetAsk").click();
    key("Escape");
    expect($("settingsView").hidden).toBe(false);
    expect($("resetConfirm").hidden).toBe(true);
    expect(document.activeElement).toBe($("resetAsk"));
  });
});
