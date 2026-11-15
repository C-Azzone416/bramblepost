// @vitest-environment jsdom
/** Settings reachable from the map (new and returning players) and the title's drift. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFS_KEY, STARS_KEY, getAdapter, memoryAdapter, setAdapter } from "../src/save";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import { setMuted } from "../src/ui/sound";

const $ = (id: string) => document.getElementById(id)!;
const original = getAdapter();
let mem: ReturnType<typeof memoryAdapter>;

function boot(returning: boolean) {
  const best = returning ? { [ROUTES[0].id]: { stars: 3, moves: 5 } } : {};
  mem.setItem(STARS_KEY, JSON.stringify({ best }));
  document.body.innerHTML = "";
  const root = document.body.appendChild(document.createElement("div"));
  return mountApp(root, ROUTES);
}
const esc = () =>
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

beforeEach(() => {
  mem = memoryAdapter();
  setAdapter(mem);
  setMuted(false);
  document.documentElement.className = "";
  vi.unstubAllGlobals();
  window.scrollTo = () => {};
});
afterEach(() => setAdapter(original));

describe("Settings from the map", () => {
  it("a new player opens Settings from the map; Back returns with focus on the button", () => {
    boot(false);
    $("titleNew").click();
    expect($("titleView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    $("mapSettings").click();
    expect($("settingsView").hidden).toBe(false);
    expect($("mapView").hidden).toBe(true);
    $("settingsBack").click();
    expect($("settingsView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect($("titleView").hidden).toBe(true);
    expect(document.activeElement).toBe($("mapSettings"));
  });

  it("Escape also returns to the map", () => {
    boot(false);
    $("mapSettings").click();
    esc();
    expect($("mapView").hidden).toBe(false);
    expect(document.activeElement).toBe($("mapSettings"));
  });

  it("a returning player opens Settings from the map after Continue", () => {
    boot(true);
    expect($("titleView").hidden).toBe(false);
    $("titleContinue").click();
    $("mapSettings").click();
    expect($("settingsView").hidden).toBe(false);
    esc();
    expect($("mapView").hidden).toBe(false);
    expect($("titleView").hidden).toBe(true);
    expect(document.activeElement).toBe($("mapSettings"));
  });

  it("from the title, Back still returns to the title", () => {
    boot(true);
    $("titleSettings").click();
    $("settingsBack").click();
    expect($("titleView").hidden).toBe(false);
    expect(document.activeElement).toBe($("titleSettings"));
  });
});

describe("title drift follows the motion setting", () => {
  it("reduced motion at startup, off in Settings, back at the title: drift is present", () => {
    mem.setItem(PREFS_KEY, JSON.stringify({ reduceMotion: true }));
    boot(true);
    const sky = () => document.querySelector("#titleView .tsky")!;
    expect(sky().classList.contains("drift")).toBe(false);
    $("titleSettings").click();
    $("setMotion").click();
    $("settingsBack").click();
    expect(sky().classList.contains("drift")).toBe(true);
  });
});
