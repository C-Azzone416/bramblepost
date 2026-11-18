// @vitest-environment jsdom
/**
 * Plays the village map in jsdom: the map shows first, locked lanes can't start, finishing a route
 * stamps its lane and opens the next, and progress survives a reload.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SPRING as ROUTES, ROUTES as ALL_ROUTES } from "../src/levels";
import { mountApp, type App } from "../src/ui/mount";
import { ENDING_KEY } from "../src/save";
import { SAVE_KEY } from "../src/ui/save";
import { LANES, MAP_H, MAP_W, NEIGHBOURHOODS, POST_OFFICE, reservedSlots } from "../src/village/data";
import { PIP_SIZE, layoutMarkers, nearestOnLane, pipSpot } from "../src/village/pip";
import { mountVillage, type VillageMap } from "../src/village/map";
import { VILLAGE_KEY } from "../src/village/save";
import { MIN_TARGET_PX } from "../src/ui/board";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const spring = NEIGHBOURHOODS.find((h) => h.season === "spring")!;
const $ = (id: string) => document.getElementById(id)!;
let app: App;
let root: HTMLElement;

const chips = () => [...document.querySelectorAll<HTMLButtonElement>("#mapLanes .vchip")];
const chip = (id: string) => document.querySelector<HTMLButtonElement>(`#mapLanes .vchip[data-lane="${id}"]`)!;
const chipStates = () => chips().map((c) => c.className.replace("vchip ", ""));
const startBtn = () => document.querySelector<HTMLButtonElement>("#mapStart")!;

function mount() {
  app = mountApp(root, ALL_ROUTES, { skipTitle: true });
}

async function playAtPar(li: number) {
  const L = ROUTES[li];
  app.G!.order = [...L.solution.order];
  for (const m of L.solution.moves) {
    app.tryMove(m);
    for (let i = 0; i < 200 && app.G && app.G.busy; i++) await sleep(50);
  }
  expect(app.G!.phase).toBe("done");
}

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  root = document.createElement("div");
  document.body.appendChild(root);
  mount();
});

describe("village map", () => {
  it("is the first thing you see", () => {
    expect($("mapView").hidden).toBe(false);
    expect($("routesView").hidden).toBe(true);
    expect($("gameView").hidden).toBe(true);
    expect($("mapTitle").textContent).toBe("Thistledown");
    expect(root.dataset.season).toBe("spring"); // the village's season drives the light tokens
    expect($("mapSeason").textContent).toBe("Spring");
  });

  it("opens only the first lane for a new player", () => {
    expect(chips()).toHaveLength(ROUTES.length);
    expect(chipStates()).toEqual(["open", ...Array(ROUTES.length - 1).fill("locked")]);
    expect(document.querySelectorAll("#villageSvg .vnode")).toHaveLength(ROUTES.length);
    expect(document.querySelectorAll("#villageSvg .vnode.open")).toHaveLength(1);
    expect($("mapStamps").textContent).toBe("0");
    expect($("mapNews").hidden).toBe(true);
    expect(app.map.selected).toBe("primrose");
    expect($("mapLaneName").textContent).toBe("Primrose Lane");
    expect(startBtn().textContent).toBe("Start route");
    expect(document.querySelector("#villageSvg .vtoday")!.textContent).toBe("Today · Route 1");
  });

  it("draws the unclaimed Thistledown slots as hedge and fog, not empty space", () => {
    const reserved = [...document.querySelectorAll<SVGGElement>("#villageSvg .vreserved")];
    expect(reserved.map((g) => g.dataset.slot)).toEqual(spring.slots.slice(spring.routes.length).map((_, i) => String(spring.routes.length + i + 1)));
    for (const g of reserved) {
      expect(g.getAttribute("aria-hidden")).toBe("true");
      expect(g.querySelectorAll("a,button,input,select,textarea,[tabindex],[data-lane],[onclick]")).toHaveLength(0);
      expect(g.querySelector("path")).not.toBeNull(); // the hedge along the lane
      expect(g.querySelector("circle")).not.toBeNull(); // the bush where the stamp will go
      expect(g.querySelector("ellipse[fill='url(#vFog)']")).not.toBeNull(); // fog over it
    }
    // they are scenery: not stamps, not tappable, not in the lane list
    expect(document.querySelectorAll("#villageSvg .vnode")).toHaveLength(ROUTES.length);
    expect(document.querySelectorAll("#villageSvg .vreserved .vnode, #villageSvg .vreserved [data-lane]")).toHaveLength(0);
    expect(chips()).toHaveLength(ROUTES.length);
    expect($("villageSvg").getAttribute("aria-label")).toBe(`Map of Thistledown. 0 of ${ROUTES.length} lanes stamped. Next: Primrose Lane.`);
  });

  it("teases only the next season; the ones after it are unnamed mist (#118)", () => {
    const hoods = [...document.querySelectorAll("#villageSvg .vhood")].map((h) => h.textContent);
    expect(hoods).toEqual(["HollowmereOpens in summer"]);
    // the later corners keep a fog patch but no ghost houses and no name
    for (const id of ["conker", "snowberry"]) {
      const g = document.querySelector(`#villageSvg .vfog[data-hood="${id}"]`)!;
      expect(g.classList.contains("vfar")).toBe(true);
      expect(g.querySelectorAll("use")).toHaveLength(0);
      expect(g.textContent).toBe("");
    }
    expect(document.querySelectorAll('#villageSvg .vfog[data-hood="hollowmere"] use')).toHaveLength(2);
    expect($("villageSvg").textContent).not.toMatch(/Conker Corner|Snowberry End/);
    expect([...document.querySelectorAll("#mapSeasons .vseason")].map((s) => s.className)).toEqual([
      "vseason spring open",
      "vseason summer locked",
    ]);
    expect($("mapSeasons").textContent).not.toMatch(/Conker Corner|Snowberry End/);
  });

  it("a locked lane says what opens it and can't be started", () => {
    chip("millpond").click();
    expect(app.map.selected).toBe("millpond");
    expect(chip("millpond").getAttribute("aria-pressed")).toBe("true");
    expect($("mapPanel").textContent).toMatch(/Deliver Primrose Lane first/);
    expect(startBtn().disabled).toBe(true);
    startBtn().click();
    expect($("mapView").hidden).toBe(false);
    expect(app.G).toBeNull();
  });

  it("tapping a lane on the map selects it", () => {
    document.querySelector<SVGGElement>('#villageSvg .vnode[data-lane="primrose"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.map.selected).toBe("primrose");
  });

  it("Start route plays that lane", () => {
    startBtn().click();
    expect($("mapView").hidden).toBe(true);
    expect($("gameView").hidden).toBe(false);
    expect(app.G!.L.id).toBe("primrose");
  });

  it("finishing stamps the lane, shows its stars and opens the next lane", async () => {
    await playAtPar(0);
    document.querySelector<HTMLButtonElement>('#done [data-act="routes"]')!.click();
    expect($("gameView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect(chipStates()).toEqual(["done", "open", ...Array(ROUTES.length - 2).fill("locked")]);
    expect(chip("primrose").getAttribute("aria-label")).toBe("Route 1, Primrose Lane, 3 of 3 stars");
    expect($("mapStamps").textContent).toBe("1");
    expect($("mapStars").textContent).toBe("3");
    expect($("mapNews").hidden).toBe(false);
    expect($("mapNews").textContent).toBe("Stamp added for Primrose Lane. Mill Pond is open.");
    expect(document.querySelectorAll('#villageSvg .vnode[data-lane="primrose"] .vfresh')).toHaveLength(1);
    expect(document.querySelectorAll('#villageSvg .vnode[data-lane="primrose"] .vstars use[href="#rbStar"]')).toHaveLength(3);
    expect(app.map.selected).toBe("millpond");
    expect(document.querySelector("#villageSvg .vtoday")!.textContent).toBe("Today · Route 2");
  });

  it("a stamped lane offers a replay", () => {
    chip("primrose").click();
    expect(startBtn().textContent).toBe("Play again");
    expect($("mapPanel").textContent).toMatch(/Best 2 moves · par 2/);
  });

  it("the Map button in a route goes back to the map", () => {
    chip("millpond").click();
    startBtn().click();
    expect(app.G!.L.id).toBe("millpond");
    $("toRoutes").click();
    expect($("mapView").hidden).toBe(false);
    expect(app.G).toBeNull();
  });

  it("How to play opens the route list, and Village map comes back", () => {
    $("mapHowTo").click();
    expect($("mapView").hidden).toBe(true);
    expect($("routesView").hidden).toBe(false);
    $("toMap").click();
    expect($("routesView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
  });

  it("progress survives a reload, and a stamp only arrives once", () => {
    mount();
    expect($("mapView").hidden).toBe(false);
    expect(chipStates()).toEqual(["done", "open", ...Array(ROUTES.length - 2).fill("locked")]);
    expect($("mapNews").hidden).toBe(true);
    expect(document.querySelectorAll("#villageSvg .vfresh")).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(VILLAGE_KEY)!).stamped).toEqual(["primrose"]);
  });

  it("stamping the last spring lane points to summer", () => {
    const best = Object.fromEntries(ROUTES.map((r) => [r.id, { stars: 2, moves: r.par + 1 }]));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ROUTES.slice(0, 4).map((r) => r.id) }));
    mount();
    expect(chipStates()).toEqual(Array(ROUTES.length).fill("done"));
    expect($("mapNews").textContent).toBe("6 stamps added. Summer route 1 is open.");
    expect(document.querySelector("#villageSvg .vtoday")).toBeNull();
    expect(app.map.selected).toBe(ROUTES[ROUTES.length - 1].id);
    expect(startBtn().textContent).toBe("Try for three stars");
    expect(document.querySelector('#villageSvg .vhood[data-hood="hollowmere"]')!.textContent).toMatch(/Opens in summer/);
    // finishing spring brings summer on; Thistledown's map still names only Hollowmere
    expect(document.querySelectorAll("#villageSvg .vhood")).toHaveLength(1);
    expect([...document.querySelectorAll("#mapSeasons .vseason")].map((s) => s.className)).toEqual([
      "vseason spring open",
      "vseason summer open",
      "vseason autumn locked",
    ]);
    expect(document.querySelectorAll("#villageSvg .vreserved")).toHaveLength(spring.slots.length - spring.routes.length);
  });
});

describe("lane marker tap targets", () => {
  // jsdom has no SVG geometry: the map is drawn at `scale` CSS px per SVG unit
  const proto = SVGSVGElement.prototype as unknown as { getScreenCTM?: () => unknown };
  const setScale = (scale: number) => {
    proto.getScreenCTM = () => ({ a: scale, d: scale, e: 0, f: 0 });
  };
  const hits = () => [...box.querySelectorAll<SVGCircleElement>(".vnode .vhit")];
  const hitOf = (id: string) => box.querySelector<SVGCircleElement>(`.vnode[data-lane="${id}"] .vhit`);
  const radius = (c: SVGCircleElement) => Number(c.getAttribute("r"));
  let box: HTMLElement;
  let map: VillageMap;

  function mountMap() {
    box = document.createElement("div");
    document.body.appendChild(box);
    map = mountVillage(box, ALL_ROUTES, { onStart() {}, onRouteList() {} });
    map.show();
  }

  beforeEach(() => {
    localStorage.clear();
    setScale(0.33);
  });

  afterEach(() => {
    delete proto.getScreenCTM;
    box?.remove();
  });

  it("gives each open and stamped marker a hit circle at least 44 CSS px across, and no more than half the gap to its neighbour", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: { primrose: { stars: 3, moves: 2 } } }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ["primrose"] }));
    mountMap();
    const tappable = ["primrose", "millpond"];
    expect(hits()).toHaveLength(2);
    const all = spring.slots;
    for (const id of tappable) {
      const L = LANES[id];
      const c = hitOf(id)!;
      const nearest = Math.min(...all.filter((o) => o !== L).map((o) => Math.hypot(o.x - L.x, o.y - L.y)));
      const want = Math.min(MIN_TARGET_PX / 2 / 0.33, nearest / 2);
      expect(radius(c)).toBeCloseTo(want, 6);
      expect(c.parentElement!.getAttribute("data-lane")).toBe(id);
    }
    // the 44px is reachable for primrose, but millpond's neighbour is 109 units away, so its cap binds
    expect(radius(hitOf("primrose")!)).toBeCloseTo(MIN_TARGET_PX / 2 / 0.33, 6);
    expect(radius(hitOf("millpond")!)).toBeCloseTo(Math.min(...all.filter((o) => o !== LANES.millpond).map((o) => Math.hypot(o.x - LANES.millpond.x, o.y - LANES.millpond.y))) / 2, 6);
  });

  it("neighbouring hit circles never overlap, even when the map is tiny", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: { primrose: { stars: 3, moves: 2 }, millpond: { stars: 1, moves: 4 } } }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ["primrose", "millpond"] }));
    setScale(0.1); // so small that the cap, not the 44px target, limits every circle
    mountMap();
    const cs = hits();
    expect(cs.length).toBeGreaterThan(2);
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const a = LANES[cs[i].parentElement!.dataset.lane!];
        const b = LANES[cs[j].parentElement!.dataset.lane!];
        expect(radius(cs[i]) + radius(cs[j])).toBeLessThanOrEqual(Math.hypot(a.x - b.x, a.y - b.y) + 1e-9);
      }
  });

  it("locked and reserved markers get no hit circle", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: { primrose: { stars: 3, moves: 2 } } }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ["primrose"] }));
    mountMap();
    // counts come from the data: primrose is stamped and millpond is open, every other route on the map is locked
    const routesOnMap = spring.routes.length;
    const tappableOnMap = 2;
    expect(box.querySelectorAll(" .vnode.locked .vhit")).toHaveLength(0);
    expect(box.querySelectorAll(" .vnode.locked")).toHaveLength(routesOnMap - tappableOnMap);
    expect(box.querySelectorAll(" .vreserved .vhit")).toHaveLength(0);
    expect(box.querySelectorAll(" .vreserved")).toHaveLength(reservedSlots(spring).length);
    expect(box.querySelectorAll(" .vhit")).toHaveLength(tappableOnMap);
  });

  it("resizes the hit circles when the window resizes", () => {
    mountMap();
    setScale(0.5);
    window.dispatchEvent(new Event("resize"));
    expect(radius(hitOf("primrose")!)).toBeCloseTo(MIN_TARGET_PX / 2 / 0.5, 6);
  });

  it("without a rendered scale (null CTM) the circles are left alone and the map still draws", () => {
    proto.getScreenCTM = () => null;
    mountMap();
    expect(box.querySelectorAll(" .vnode")).toHaveLength(spring.routes.length);
    expect(radius(hitOf("primrose")!)).toBe(0);
  });

  it("tapping a hit circle selects its lane, as tapping the marker does", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: { primrose: { stars: 3, moves: 2 } } }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ["primrose"] }));
    mountMap();
    map.select("primrose");
    expect(map.selected).toBe("primrose");
    hitOf("millpond")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(map.selected).toBe("millpond");
  });
});

describe("Pip's spot on the map (#78)", () => {
  const slots = spring.slots;
  const prevOf = (i: number) => (i > 0 ? slots[i - 1] : POST_OFFICE);
  const cases: [string, number][] = [["fresh start", 0], ["mid-path", 6], ["complete (last lane)", spring.routes.length - 1]];

  for (const [name, i] of cases) {
    it(`${name}: stands before the open marker, beside the incoming lane, away from the outgoing one`, () => {
      const L = slots[i];
      const s = pipSpot(slots, i);
      const inc = nearestOnLane(prevOf(i), L.via, L, s.feet);
      expect(inc.t).toBeLessThanOrEqual(1);
      expect(s.t).toBeLessThan(1);
      expect(inc.t).toBeLessThan(0.95);
      expect(inc.dist).toBeGreaterThan(20); // beside the path, not on it
      expect(inc.dist).toBeLessThan(60);
      expect(Math.hypot(s.feet.x - L.x, s.feet.y - L.y)).toBeGreaterThan(40); // not on the marker
      const next = slots[i + 1];
      if (next) expect(nearestOnLane(L, next.via, next, s.feet).dist).toBeGreaterThan(inc.dist);
    });
  }

  it.each([
    ["fresh start", 0],
    ["mid-path", 2],
    ["complete", spring.routes.length - 1],
  ])("%s: the rendered Pip sits where pipSpot says", (_name, done) => {
    const ids = spring.routes;
    const best = Object.fromEntries(ids.slice(0, done === spring.routes.length - 1 ? ids.length : done).map((id) => [id, { stars: 3, moves: 1 }]));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: Object.keys(best) }));
    mount();
    const uses = document.querySelectorAll<SVGUseElement>("#villageSvg #mapPip");
    expect(uses).toHaveLength(1);
    const N = spring;
    const finished = new Set(Object.keys(best).map((id) => N.routes.indexOf(id)));
    const open = [...Array(N.routes.length).keys()].find((i) => !finished.has(i)) ?? null;
    const target = open ?? (finished.size ? Math.max(...finished) : 0);
    const s = layoutMarkers(slots, POST_OFFICE, N.routes.length, finished, target, open, 24 + `Today · Route ${N.slots.length}`.length * 8).pip;
    expect(Number(uses[0].getAttribute("x"))).toBeCloseTo(s.x, 5);
    expect(Number(uses[0].getAttribute("y"))).toBeCloseTo(s.y, 5);
  });

  it("in Hollowmere Pip heads for the first summer lane, inside the map", async () => {
    const best = Object.fromEntries(ROUTES.map((r) => [r.id, { stars: 2, moves: r.par + 1 }]));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: ROUTES.map((r) => r.id) }));
    localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
    const box = document.createElement("div");
    document.body.appendChild(box);
    const map = mountVillage(box, ALL_ROUTES, { onStart() {}, onRouteList() {} });
    map.show();
    box.querySelector<HTMLButtonElement>("#mapEnter")!.click();
    for (let i = 0; i < 50 && box.querySelector("#mapTitle")!.textContent !== "Hollowmere"; i++) await sleep(20);
    expect(box.querySelector("#mapTitle")!.textContent).toBe("Hollowmere");
    const hm = NEIGHBOURHOODS.find((h) => h.id === "hollowmere")!;
    const start = hm.scenery!.start;
    const s = layoutMarkers(hm.slots, start, hm.routes.length, new Set(), 0, 0, 24 + "Today · Route 1".length * 8).pip;
    const uses = box.querySelectorAll<SVGUseElement>("#mapPip");
    expect(uses).toHaveLength(1);
    expect(Number(uses[0].getAttribute("x"))).toBeCloseTo(s.x, 5);
    expect(Number(uses[0].getAttribute("y"))).toBeCloseTo(s.y, 5);
    box.remove();
    // inside the map, before the first marker, beside the lane and not on it
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x + PIP_SIZE.w).toBeLessThanOrEqual(MAP_W);
    expect(s.y + PIP_SIZE.h).toBeLessThanOrEqual(MAP_H);
    expect(s.t).toBeLessThan(1);
    expect(Math.hypot(s.feet.x - hm.slots[0].x, s.feet.y - hm.slots[0].y)).toBeGreaterThan(40);
    const inc = nearestOnLane(start, hm.slots[0].via, hm.slots[0], s.feet);
    expect(inc.dist).toBeGreaterThan(20);
  });
});
