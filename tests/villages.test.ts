// @vitest-environment jsdom
/**
 * Village transitions (#60): the way into Hollowmere opens once Thistledown is complete, Hollowmere has its own
 * map, Back returns, and the current village is saved and cleared by reset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { CURRENT_VILLAGE_KEY, DATA_KEYS, ENDING_KEY, resetProgress } from "../src/save";
import { saveReduceMotion } from "../src/ui/motion";
import { mountApp, type App } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { HOLLOWMERE_SLOTS, MAP_H, MAP_W, NEIGHBOURHOODS, sceneryOf } from "../src/village/data";
import { loadCurrent } from "../src/village/current";

const $ = (id: string) => document.getElementById(id)!;
const hollowmere = NEIGHBOURHOODS.find((n) => n.id === "hollowmere")!;
let app: App;

const stampAll = (count = ROUTES.length) =>
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries(ROUTES.slice(0, count).map((r) => [r.id, { stars: 2, moves: r.par + 1 }])) }));
const seeEnding = () => localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
const complete = () => (stampAll(), seeEnding());
function mount(opts: Parameters<typeof mountApp>[2] = { skipTitle: true }) {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  document.body.appendChild(root);
  app = mountApp(root, ROUTES, opts);
  return app;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("reduce-motion");
  window.scrollTo = () => {};
});

describe("the way into the next village", () => {
  it("stays locked fog until Thistledown is complete: stamped AND the ending seen", () => {
    mount();
    expect($("mapEnter").hidden).toBe(true);
    expect(document.querySelector('#villageSvg .vhood[data-hood="hollowmere"] .vplateName')!.textContent).toBe("Hollowmere");
    stampAll(ROUTES.length - 1);
    seeEnding();
    mount();
    expect($("mapEnter").hidden).toBe(true); // ending seen but a lane is still open
    localStorage.removeItem(ENDING_KEY);
    stampAll();
    mount();
    expect($("mapEnter").hidden).toBe(true); // all stamped but the ending not yet seen
  });

  it("opens as a real, named, finger-sized button once complete", () => {
    complete();
    mount();
    const b = $("mapEnter");
    expect(b.hidden).toBe(false);
    expect(b.tagName).toBe("BUTTON");
    expect(b.textContent).toBe("Go to Hollowmere");
    expect(b.tabIndex).toBe(0);
    expect(readFileSync(resolve(process.cwd(), "src/village/village.css"), "utf8")).toMatch(/\.vgo\{[^}]*min-height:44px[^}]*min-width:44px/);
    expect(document.querySelector('#villageSvg .vhood[data-hood="hollowmere"] .vplateName')).toBeNull();
  });
});

describe("entering and leaving Hollowmere", () => {
  it("shows Hollowmere's own map and calls the hook once with firstTime, before the map changes", async () => {
    complete();
    let release!: () => void;
    const onEnterVillage = vi.fn(() => new Promise<void>((r) => (release = r)));
    mount({ skipTitle: true, onEnterVillage });
    $("mapEnter").click();
    $("mapEnter").click(); // a second tap while the intro is still going does nothing
    expect(onEnterVillage).toHaveBeenCalledTimes(1);
    expect(onEnterVillage).toHaveBeenCalledWith("hollowmere", true, expect.any(AbortSignal));
    expect($("mapTitle").textContent).toBe("Thistledown");
    release();
    await vi.waitFor(() => expect($("mapTitle").textContent).toBe("Hollowmere"));
    expect(app.map.village).toBe("hollowmere");
    expect($("mapSeason").textContent).toBe("Summer");
    expect($("villageSvg").getAttribute("aria-label")).toBe("Map of Hollowmere. Summer routes coming.");
    expect($("mapNews").textContent).toBe("Summer routes coming.");
    expect(document.querySelectorAll("#villageSvg .vreserved")).toHaveLength(HOLLOWMERE_SLOTS.length);
    expect(document.querySelectorAll("#villageSvg .vnode")).toHaveLength(0);
    expect(document.querySelectorAll("#mapLanes .vchip")).toHaveLength(0);
    expect(document.querySelector('#villageSvg .vhood[data-hood="conker"]')).not.toBeNull();
    expect($("mapEnter").hidden).toBe(true); // Conker Corner stays fog
    expect($("mapBack").hidden).toBe(false);
    expect($("mapBack").textContent).toBe("Back to Thistledown");
    expect(document.activeElement).toBe($("mapTitle"));
  });

  it("Back restores Thistledown with focus on the way in, and re-entering is not a first time", async () => {
    complete();
    const onEnterVillage = vi.fn();
    mount({ skipTitle: true, onEnterVillage });
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    $("mapBack").click();
    expect(app.map.village).toBe("thistledown");
    expect($("mapTitle").textContent).toBe("Thistledown");
    expect($("mapBack").hidden).toBe(true);
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(ROUTES.length);
    expect(document.activeElement).toBe($("mapEnter"));
    $("mapEnter").click();
    await vi.waitFor(() => expect(onEnterVillage).toHaveBeenCalledTimes(2));
    expect(onEnterVillage).toHaveBeenLastCalledWith("hollowmere", false, expect.any(AbortSignal));
  });

  it("stays put if the intro hook fails", async () => {
    complete();
    mount({ skipTitle: true, onEnterVillage: () => Promise.reject(new Error("no intro")) });
    $("mapEnter").click();
    await new Promise((r) => setTimeout(r, 10));
    expect(app.map.village).toBe("thistledown");
    expect(loadCurrent().id).toBe("thistledown");
  });

  it("fades in, except under reduced motion", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    expect($("mapView").classList.contains("vfade")).toBe(true);
    saveReduceMotion(true);
    $("mapBack").click();
    expect($("mapView").classList.contains("vfade")).toBe(false);
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    expect($("mapView").classList.contains("vfade")).toBe(false);
  });
});

describe("a slow intro hook", () => {
  const pending = () => {
    let release!: () => void;
    const onEnterVillage = vi.fn(() => new Promise<void>((r) => (release = r)));
    complete();
    mount({ skipTitle: true, onEnterVillage });
    $("mapEnter").click();
    expect(onEnterVillage).toHaveBeenCalledTimes(1);
    return () => {
      release();
      return new Promise((r) => setTimeout(r, 10));
    };
  };

  it("disables the entry button while pending, without locking the rest", () => {
    pending();
    expect($("mapEnter").getAttribute("aria-disabled")).toBe("true");
    $("mapEnter").click(); // ignored
    expect($("mapSettings").getAttribute("aria-disabled")).toBeNull();
  });

  it("does nothing if the player resets from Settings meanwhile", async () => {
    const resolve = pending();
    $("mapSettings").click();
    $("resetAsk").click();
    $("resetYes").click();
    await resolve();
    expect(app.map.village).toBe("thistledown");
    expect($("mapTitle").textContent).toBe("Thistledown");
    expect(localStorage.getItem(CURRENT_VILLAGE_KEY)).toBeNull();
    expect($("mapEnter").hidden).toBe(true);
    expect($("mapEnter").getAttribute("aria-disabled")).toBeNull();
  });

  it("does nothing if a route is opened meanwhile", async () => {
    const resolve = pending();
    $("mapStart").click();
    expect(app.map.visible).toBe(false);
    await resolve();
    expect(app.map.visible).toBe(false);
    expect(app.map.village).toBe("thistledown");
    expect(localStorage.getItem(CURRENT_VILLAGE_KEY)).toBeNull();
  });

  it("does nothing if the player goes back to the title or elsewhere meanwhile", async () => {
    const resolve = pending();
    $("mapAlbum").click();
    await resolve();
    expect(app.map.visible).toBe(false);
    expect(localStorage.getItem(CURRENT_VILLAGE_KEY)).toBeNull();
  });

  it("does nothing if the app is mounted again on the same root meanwhile", async () => {
    let release!: () => void;
    const onEnterVillage = vi.fn(() => new Promise<void>((r) => (release = r)));
    complete();
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountApp(root, ROUTES, { skipTitle: true, onEnterVillage });
    $("mapEnter").click();
    expect(onEnterVillage).toHaveBeenCalledTimes(1);
    app = mountApp(root, ROUTES, { skipTitle: true });
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(localStorage.getItem(CURRENT_VILLAGE_KEY)).toBeNull();
    expect(app.map.village).toBe("thistledown");
    expect($("mapTitle").textContent).toBe("Thistledown");
  });

  it("still enters normally", async () => {
    const resolve = pending();
    await resolve();
    expect(app.map.village).toBe("hollowmere");
    expect(loadCurrent().id).toBe("hollowmere");
  });
});

describe("the current village is saved", () => {
  it("survives a reload, and Continue opens it", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    expect(JSON.parse(localStorage.getItem(CURRENT_VILLAGE_KEY)!)).toEqual({ id: "hollowmere", visited: ["thistledown", "hollowmere"] });
    mount({}); // reload: the title shows first
    expect($("titleContinue").hidden).toBe(false);
    $("titleContinue").click();
    expect($("mapTitle").textContent).toBe("Hollowmere");
    expect($("mapBack").hidden).toBe(false);
  });

  it("the Album still opens from Hollowmere and returns to it", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    $("mapAlbum").click();
    expect($("albumView").hidden).toBe(false);
    expect(app.map.visible).toBe(false);
    $("albumBack").click();
    expect($("mapTitle").textContent).toBe("Hollowmere");
  });

  it("reset clears it and the map goes back to Thistledown", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    expect(DATA_KEYS).toContain(CURRENT_VILLAGE_KEY);
    expect(resetProgress()).toBe(true);
    expect(localStorage.getItem(CURRENT_VILLAGE_KEY)).toBeNull();
    app.map.show();
    expect(app.map.village).toBe("thistledown");
    expect($("mapTitle").textContent).toBe("Thistledown");
  });

  it("a saved village that is not open falls back to Thistledown", () => {
    localStorage.setItem(CURRENT_VILLAGE_KEY, JSON.stringify({ id: "hollowmere", visited: ["hollowmere"] }));
    mount();
    expect(app.map.village).toBe("thistledown");
    localStorage.setItem(CURRENT_VILLAGE_KEY, "{not json");
    expect(loadCurrent()).toEqual({ id: "thistledown", visited: ["thistledown"] });
  });
});

describe("Hollowmere's map data", () => {
  it("keeps its slots on the map, off the fog of the villages ahead and off the trees", () => {
    const fog = (h: (typeof NEIGHBOURHOODS)[number]) => ({ x0: h.at.x - 170, y0: h.at.y + 10 - 96, x1: h.at.x + 170, y1: h.at.y + 10 + 96 });
    expect(hollowmere.slots).toBe(HOLLOWMERE_SLOTS);
    expect(hollowmere.routes).toEqual([]);
    for (const s of HOLLOWMERE_SLOTS) {
      expect(s.x - 78 >= 0 && s.x + 78 <= MAP_W && s.y - 52 >= 0 && s.y + 52 <= MAP_H, `slot ${s.x},${s.y}`).toBe(true);
      for (const h of NEIGHBOURHOODS.slice(2)) {
        const f = fog(h);
        expect(f.x1 <= s.x - 78 || f.x0 >= s.x + 78 || f.y1 <= s.y - 52 || f.y0 >= s.y + 52, `${h.name} fog vs slot ${s.x},${s.y}`).toBe(true);
      }
      for (const [x, y] of sceneryOf(hollowmere).trees) expect(Math.hypot(x - s.x, y - s.y)).toBeGreaterThan(70);
    }
  });
});
