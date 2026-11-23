// @vitest-environment jsdom
/**
 * Village transitions (#60): the way into Hollowmere opens once Thistledown is complete, Hollowmere has its own
 * map, Back returns, and the current village is saved and cleared by reset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES, SPRING, SUMMER } from "../src/levels";
import { ACTIVE_ENDING } from "../src/content/active";
import { CURRENT_VILLAGE_KEY, DATA_KEYS, ENDING_KEY, resetProgress } from "../src/save";
import { saveReduceMotion } from "../src/ui/motion";
import { mountApp, type App } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { HOLLOWMERE_SLOTS, MAP_H, MAP_W, NEIGHBOURHOODS, fogAt, sceneryOf } from "../src/village/data";
import { loadCurrent } from "../src/village/current";
import { NEIGHBOURS } from "../src/ui/cast";

const $ = (id: string) => document.getElementById(id)!;
const hollowmere = NEIGHBOURHOODS.find((n) => n.id === "hollowmere")!;
let app: App;

const stampAll = (count = SPRING.length) =>
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries(SPRING.slice(0, count).map((r) => [r.id, { stars: 2, moves: r.par + 1 }])) }));
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
    stampAll(SPRING.length - 1);
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
    expect($("villageSvg").getAttribute("aria-label")).toBe("Map of Hollowmere. 0 of 10 lanes stamped. Next: Summer route 1.");
    expect($("mapNews").textContent).toBe("10 stamps added. Summer route 1 is open.");
    expect(document.querySelectorAll("#villageSvg .vreserved")).toHaveLength(0);
    expect(document.querySelectorAll("#villageSvg .vnode")).toHaveLength(SUMMER.length);
    expect(document.querySelectorAll("#mapLanes .vchip")).toHaveLength(SUMMER.length);
    expect(document.querySelector('#villageSvg .vhood[data-hood="conker"]')).not.toBeNull();
    expect(document.querySelector('#villageSvg .vhood[data-hood="snowberry"]')).toBeNull(); // only the next village is named (#118)
    expect(document.querySelector('#villageSvg .vfar[data-hood="snowberry"]')).not.toBeNull();
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
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(SPRING.length);
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
    const onEnterVillage = vi.fn((id: string) => (id === "hollowmere" ? new Promise<void>((r) => (release = r)) : undefined)); // the first village's welcome (after a reset) is not slow
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
    const fog = (h: (typeof NEIGHBOURHOODS)[number]) => {
      const at = fogAt(h, "hollowmere"); // where the fog sits on Hollowmere's own map
      return { x0: at.x - 170, y0: at.y + 10 - 96, x1: at.x + 170, y1: at.y + 10 + 96 };
    };
    expect(hollowmere.slots).toBe(HOLLOWMERE_SLOTS);
    expect(hollowmere.routes).toEqual(SUMMER.map((r) => r.id));
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

describe("Hollowmere's map from the picked mockup (#127)", () => {
  const conker = NEIGHBOURHOODS.find((n) => n.id === "conker")!;
  const snowberry = NEIGHBOURHOODS.find((n) => n.id === "snowberry")!;

  it("has the mockup's ten lanes: each stop and its via point, in order", () => {
    expect(hollowmere.slots.map((s) => [s.x, s.y, ...s.via])).toEqual([
      [800, 520, 863, 531], [660, 572, 724, 529], [520, 540, 587, 570], [380, 575, 446, 541], [230, 500, 314, 520],
      [150, 360, 173, 440], [225, 222, 168, 281], [380, 150, 294, 167], [545, 182, 466, 150], [690, 250, 626, 199],
    ]);
  });

  it("puts the fog plate of the next village top right, where the mockup has it", () => {
    const at = fogAt(conker, "hollowmere");
    expect(at.x).toBeGreaterThan(MAP_W / 2);
    expect(at.y).toBeLessThan(MAP_H / 3);
    expect(snowberry.seenFrom?.hollowmere ?? snowberry.at).not.toEqual(snowberry.at); // its far mist on Hollowmere's map is placed for that map
    // Thistledown's map keeps the far mist where it was
    expect(fogAt(conker, "thistledown")).toEqual({ x: 175, y: 110 });
  });

  it("draws the next village's fog above any far mist, and the far mist clear of Hollowmere's lanes", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    const kids = [...document.querySelectorAll("#villageSvg > *")];
    const far = kids.findIndex((k) => k.matches('.vfar[data-hood="snowberry"]'));
    const next = kids.findIndex((k) => k.matches('.vfog[data-hood="conker"]'));
    const plate = kids.findIndex((k) => k.matches('.vhood[data-hood="conker"]'));
    expect(far).toBeGreaterThan(-1);
    expect(far).toBeLessThan(next); // the mist is under the next village's fog and ghost houses
    expect(next).toBeLessThan(plate);
    // the far mist (ellipse 170 x 96, centred 10 below its spot) stays inside the map and off every lane's stop
    const at = fogAt(snowberry, "hollowmere");
    expect([at.x - 170 >= 0, at.y + 10 - 96 >= 0, at.x + 170 <= MAP_W, at.y + 10 + 96 <= MAP_H]).toEqual([true, true, true, true]);
    for (const s of hollowmere.slots) expect(Math.hypot((s.x - at.x) / 170, (s.y - at.y - 10) / 96), `far mist over stop ${s.x},${s.y}`).toBeGreaterThan(1);
  });

  it("starts at the post office: it stands at the start, with a short footpath to the first lane", async () => {
    const { start, postOfficeAt, postOffice } = sceneryOf(hollowmere);
    expect(postOffice).toBe(true);
    expect(postOfficeAt).toEqual({ x: 916, y: 520, scale: 0.82 });
    expect(start.x).toBe(postOfficeAt!.x); // the path begins at the door, straight below it
    expect(start.y - postOfficeAt!.y).toBeLessThanOrEqual(60);
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    // its own post office sprite is drawn there, and the first lane's path begins at the start
    const po = document.querySelector<SVGUseElement>('#villageSvg use[href="#poHollowmere"]')!;
    expect(po).not.toBeNull();
    const w = Number(po.getAttribute("width")), h = Number(po.getAttribute("height"));
    expect([Number(po.getAttribute("x")) + w / 2, Number(po.getAttribute("y")) + h]).toEqual([916, 520]);
    const first = [...document.querySelectorAll('#villageSvg .vlaneLines path')].find((p) => p.getAttribute('d')?.startsWith(`M${start.x} ${start.y} Q`))!;
    expect(first.getAttribute("d")!.startsWith(`M${start.x} ${start.y} Q`)).toBe(true);
  });

  it("draws the mere, its shore, pads, reeds, jetty and the sunflower patches with two turn hints", async () => {
    complete();
    mount();
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    const mere = document.querySelector("#villageSvg .vmere")!;
    expect(mere.querySelectorAll("ellipse")).toHaveLength(3 + sceneryOf(hollowmere).mere!.lilies.length);
    expect(mere.querySelector('ellipse[fill="url(#vMere)"]')).not.toBeNull();
    expect(document.querySelectorAll('#villageSvg path[d^="M0 0 A22 22"]')).toHaveLength(2);
    expect(document.querySelectorAll('#villageSvg circle[fill="#6b4423"]')).toHaveLength(sceneryOf(hollowmere).sunflowers!.length);
  });

  it("keeps the mere clear of the lanes, and every prop off them with its base on the ground", () => {
    const sc = sceneryOf(hollowmere);
    const m = sc.mere!;
    const HALF = 16; // half the lane's drawn width (32)
    const samples: [number, number][] = [];
    let prev = sc.start;
    for (const L of hollowmere.slots) {
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const u = 1 - t;
        samples.push([u * u * prev.x + 2 * u * t * L.via[0] + t * t * L.x, u * u * prev.y + 2 * u * t * L.via[1] + t * t * L.y]);
      }
      prev = L;
    }
    const inEllipse = (e: { cx: number; cy: number; rx: number; ry: number }, x: number, y: number, pad = 0) => ((x - e.cx) / (e.rx + pad)) ** 2 + ((y - e.cy) / (e.ry + pad)) ** 2 < 1;
    const dist = (x0: number, y0: number, x1: number, y1: number) => Math.min(...samples.map(([x, y]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))));
    // water never reads as a road: no lane runs over the water
    for (const [x, y] of samples) expect(inEllipse(m.water, x, y, HALF), `lane over the water at ${x.toFixed(0)},${y.toFixed(0)}`).toBe(false);
    // reeds stand on the sand: inside the shore, outside the water
    for (const [x, y] of m.reeds) {
      expect(inEllipse(m.shore, x, y), `reed ${x},${y} off the shore`).toBe(true);
      expect(inEllipse(m.water, x, y), `reed ${x},${y} in the water`).toBe(false);
    }
    // pads float on the water
    for (const [x, y] of m.lilies) expect(inEllipse({ ...m.water, rx: m.water.rx - 14, ry: m.water.ry - 9 }, x, y), `pad ${x},${y}`).toBe(true);
    // the jetty's landward end is on the ground, past the water
    expect(inEllipse(m.water, m.jetty.x + m.jetty.w / 2, m.jetty.y + m.jetty.h)).toBe(false);
    // nothing sits on a lane
    const near: string[] = [];
    const R = (name: string, x0: number, y0: number, x1: number, y1: number) => { if (!(dist(x0, y0, x1, y1) > HALF)) near.push(`${name} (${dist(x0, y0, x1, y1).toFixed(1)})`); };
    const po = sc.postOfficeAt!;
    R("post office", po.x - 50 * po.scale + 12, po.y - 105 * po.scale, po.x + 50 * po.scale - 12, po.y);
    hollowmere.slots.forEach((s, i) => {
      const n = NEIGHBOURS[s.style], k = s.houseScale ?? 0.95;
      R(`house ${i + 1}`, s.x + s.house[0], s.y + s.house[1], s.x + s.house[0] + n.w * k, s.y + s.house[1] + n.h * k);
    });
    for (const [x, y, k] of sc.sunflowers!) {
      R(`sunflower ${x},${y} stem and leaves`, x - 12 * k, y - 26 * k, x + 12 * k, y);
      // the round head: petals reach 15.5 from the heart, 38 up the stem
      const head = Math.min(...samples.map(([sx, sy]) => Math.hypot(sx - x, sy - (y - 38 * k)))) - 15.5 * k;
      if (!(head > HALF)) near.push(`sunflower ${x},${y} head (${head.toFixed(1)})`);
    }
    for (const [x, y, k] of sc.trees) R(`tree ${x},${y}`, x - 30 * k, y - 36 * k, x + 30 * k, y + 34 * k);
    for (const [x, y, k] of m.reeds) R(`reed ${x},${y}`, x - 16 * k, y - 42 * k, x + 20 * k, y);
    for (const [x, y] of sc.turnHints!) R(`turn hint ${x},${y}`, x, y, x + 29, y + 25);
    expect(near, "props on a lane").toEqual([]);
  });

  it("is the map where the entry gate to Conker Corner opens once every Hollowmere lane is stamped", async () => {
    const ids = SUMMER.map((r) => r.id);
    const stamp = (n: number) =>
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ best: Object.fromEntries([...SPRING.map((r) => [r.id, { stars: 2, moves: r.par + 1 }]), ...ids.slice(0, n).map((id) => [id, { stars: 1, moves: 9 }])]) }),
      );
    const enterHollowmere = async () => {
      if (app.map.village !== "hollowmere") $("mapEnter").click(); // a saved current village already starts the map in Hollowmere
      await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    };
    seeEnding();
    stamp(9);
    mount();
    await enterHollowmere();
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(9);
    expect($("mapEnter").hidden).toBe(true); // one lane still open: Conker Corner stays fog
    expect(document.querySelector('#villageSvg .vhood[data-hood="conker"] .vplateName')!.textContent).toBe("Conker Corner");
    stamp(10);
    mount();
    await enterHollowmere();
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(10);
    expect($("mapEnter").hidden).toBe(false); // all ten stamped: the way in opens
    expect($("mapEnter").dataset.hood).toBe("conker");
    expect($("mapEnter").textContent).toBe("Go to Conker Corner");
    expect(document.querySelector('#villageSvg .vhood[data-hood="conker"]')).toBeNull();
    // and the stamped lanes are the lanes of the picked layout: each stamp sits on its stop
    const stamps = [...document.querySelectorAll("#villageSvg .vnode.done")].map((n) => n.getAttribute("transform"));
    expect(stamps).toEqual(hollowmere.slots.map((s) => `translate(${s.x} ${s.y})`));
  });
});


describe("season completion copy and gates", () => {
  it("shows the close for each village and gates later finales independently", () => {
    const later = NEIGHBOURHOODS.slice(1);
    const oldRoutes = later.map((h) => h.routes);
    const fakeFinale = { route: "summer-final", kicker: "Kicker", title: "Finale", envelope: "Envelope", lines: ["Line"] };
    try {
      later.forEach((h, i) => { h.routes = [["summer-final"], ["autumn-final"], ["winter-final"]][i]; });
      ACTIVE_ENDING.push(fakeFinale);
      const best = Object.fromEntries([...ROUTES.map((r) => r.id), "summer-final", "autumn-final", "winter-final"].map((id) => [id, { stars: 2, moves: 1 }]));
      localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
      localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
      const show = (id: string) => {
        localStorage.setItem(CURRENT_VILLAGE_KEY, JSON.stringify({ id, visited: [id] }));
        mount({ skipTitle: true });
      };
      show("thistledown");
      expect($("mapNews").textContent).toBe("Spring is done. Hollowmere next.");
      show("hollowmere");
      expect($("mapEnter").hidden).toBe(true);
      expect($("mapNews").textContent).toBe("Summer routes coming.");
      localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true, routes: ["summer-final"] }));
      show("hollowmere");
      expect($("mapEnter").hidden).toBe(false);
      expect($("mapNews").textContent).toBe("Summer is done. Conker Corner next.");
      show("conker");
      expect($("mapNews").textContent).toBe("Autumn is done. Snowberry End next.");
      expect($("mapEnter").hidden).toBe(false); // no autumn finale
      show("snowberry");
      expect($("mapNews").textContent).toBe("The year is complete.");
      expect($("villageSvg").getAttribute("aria-label")).toBe("Map of Snowberry End. The year is complete.");
    } finally {
      later.forEach((h, i) => { h.routes = oldRoutes[i]; });
      ACTIVE_ENDING.pop();
    }
  });
});
