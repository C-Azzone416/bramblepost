// @vitest-environment jsdom
/**
 * Conker Corner's map from the picked mockup (#128): the ten lanes, the fog plate, the post office start, the brook, windmill and
 * pumpkin patch, the geometry rules (water never a road, nothing on a lane, nothing floating), and the map where the gate to
 * Snowberry End opens. The mockup is docs/village-mockups on #148 (not in this branch).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTUMN, ROUTES, SPRING } from "../src/levels";
import { ENDING_KEY } from "../src/save";
import { NEIGHBOURS } from "../src/ui/cast";
import { mountApp, type App } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { HALF, distBox, distLine, distPoint, laneSamples } from "./fixtures/map-geometry";
import { MAP_H, MAP_W, NEIGHBOURHOODS, fogAt, sceneryOf, type Lane } from "../src/village/data";

const $ = (id: string) => document.getElementById(id)!;
const hollowmere = NEIGHBOURHOODS.find((n) => n.id === "hollowmere")!;
const conker = NEIGHBOURHOODS.find((n) => n.id === "conker")!;
const snowberry = NEIGHBOURHOODS.find((n) => n.id === "snowberry")!;
let app: App;

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

describe("Conker Corner's map from the picked mockup (#128)", () => {
  const sc = sceneryOf(conker);

  it("has the mockup's ten lanes: each stop and its via point, in order, from the post office", () => {
    expect(conker.slots.map((s) => [s.x, s.y, ...s.via])).toEqual([
      [170, 470, 135, 517], [290, 575, 215, 539], [345, 425, 342, 509], [240, 320, 278, 387], [325, 205, 266, 251],
      [590, 130, 449, 136], [640, 215, 605, 179], [780, 150, 702, 166], [880, 290, 850, 206], [745, 405, 801, 334],
    ]);
    expect(conker.slots).toHaveLength(10);
    expect(conker.slots.every((s) => ["ah1", "ah2", "ah3"].includes(s.style))).toBe(true); // neutral house styles only
  });

  it("puts Snowberry End's fog plate bottom right on this map, and leaves every other map's fog where it was", () => {
    const at = fogAt(snowberry, "conker");
    expect(at.x).toBeGreaterThan(MAP_W / 2);
    expect(at.y).toBeGreaterThan((MAP_H * 2) / 3);
    // the fog ellipse (170 x 96, centred 10 below its spot) and its plate fit inside the map
    expect([at.x - 170 >= 0, at.y + 10 - 96 >= 0, at.x + 170 <= MAP_W, at.y + 10 + 96 <= MAP_H]).toEqual([true, true, true, true]);
    // ...and stay off every lane's stop
    for (const s of conker.slots) expect(Math.hypot((s.x - at.x) / 170, (s.y - at.y - 10) / 96), `fog over stop ${s.x},${s.y}`).toBeGreaterThan(1);
    expect(fogAt(snowberry, "hollowmere")).toEqual({ x: 828, y: 86 });
    expect(fogAt(snowberry, "thistledown")).toEqual({ x: 175, y: 530 });
    expect(fogAt(conker, "hollowmere")).toEqual({ x: 828, y: 86 });
    expect(fogAt(conker, "thistledown")).toEqual({ x: 175, y: 110 });
  });

  it("starts at the post office: it stands near the start, with a short footpath to the first lane", async () => {
    const { start, postOfficeAt, postOffice } = sc;
    expect(postOffice).toBe(true);
    expect(postOfficeAt).toEqual({ x: 74, y: 492, scale: 0.82 });
    expect(start).toEqual({ x: 80, y: 538 });
    expect(Math.abs(start.x - postOfficeAt!.x)).toBeLessThanOrEqual(10); // the path begins at the door, just below it
    expect(start.y - postOfficeAt!.y).toBeLessThanOrEqual(60);
    await enterConker();
    const po = document.querySelector<SVGUseElement>('#villageSvg use[href="#rbPO"]')!;
    expect(po).not.toBeNull();
    const w = Number(po.getAttribute("width")), h = Number(po.getAttribute("height"));
    expect([Number(po.getAttribute("x")) + w / 2, Number(po.getAttribute("y")) + h]).toEqual([74, 492]);
    const first = [...document.querySelectorAll("#villageSvg .vlaneLines path")].find((p) => p.getAttribute("d")?.startsWith(`M${start.x} ${start.y} Q`))!;
    expect(first.getAttribute("d")!.startsWith(`M${start.x} ${start.y} Q`)).toBe(true);
  });

  it("draws the brook with its pool, pebbles, stepping stones and footbridge, the windmill, the patch with its scarecrow, and the gusts", async () => {
    await enterConker();
    const brook = document.querySelector("#villageSvg .vbrook")!;
    expect(brook.querySelector('path[stroke="url(#vBrook)"]')).not.toBeNull();
    expect(brook.querySelector('ellipse[fill="url(#vBrook)"]')).not.toBeNull();
    expect(brook.querySelectorAll("[stroke-dasharray]")).toHaveLength(0); // no dashed line down the water: it must never read as a road
    expect(brook.querySelectorAll('path[stroke="#e6f7fa"]')).toHaveLength(sc.brook!.ripples.length + 1); // the ripple arcs, and the pool's
    expect(brook.querySelectorAll('ellipse[fill="#fffaf0"]')).toHaveLength(sc.brook!.pebbles.length + sc.brook!.stones.length);
    expect(document.querySelectorAll("#villageSvg .vpatch")).toHaveLength(1);
    expect(document.querySelectorAll('#villageSvg .vpatch ellipse[fill="#e05a3c"]')).toHaveLength(sc.patch!.pumpkins.length);
    expect(document.querySelectorAll('#villageSvg path[d^="M0 0 C39 -18"]')).toHaveLength(2); // two gusts
    // the windmill's four sails and the footbridge sit above the lanes
    expect(document.querySelectorAll('#villageSvg g[transform="translate(0 -98) rotate(35)"] > rect[fill="#7a4d2a"]')).toHaveLength(4);
    expect(document.querySelectorAll(`#villageSvg g[transform^="translate(${sc.brook!.bridge.x} ${sc.brook!.bridge.y}) rotate("]`)).toHaveLength(1);
  });

  it("keeps the brook off the lanes except where lane 6 crosses it on the footbridge", () => {
    const b = sc.brook!;
    const edge = b.water + HALF;
    for (let n = 1; n <= conker.slots.length; n++) {
      const dists = laneSamples(sc.start, conker.slots, n).map(([x, y]) => distLine(b.points, x, y));
      if (n === 6) {
        expect(Math.min(...dists), "lane 6 never meets the brook").toBeLessThan(2);
        // it crosses at the footbridge
        expect(distPoint(laneSamples(sc.start, conker.slots, 6), b.bridge.x, b.bridge.y), "the bridge is off lane 6").toBeLessThan(3);
        expect(distLine(b.points, b.bridge.x, b.bridge.y), "the bridge is off the brook").toBeLessThan(10);
        const crossing = laneSamples(sc.start, conker.slots, 6).filter(([x, y]) => distLine(b.points, x, y) < edge);
        for (const [x, y] of crossing) expect(Math.hypot(x - b.bridge.x, y - b.bridge.y), "lane 6 is in the water away from the bridge").toBeLessThan(38);
      } else expect(Math.min(...dists), `lane ${n} runs in the brook`).toBeGreaterThan(edge + 4); // water never reads as a road
    }
    // the pool is clear of every lane
    for (const [x, y] of laneSamples(sc.start, conker.slots)) expect(((x - b.pool.cx) / (b.pool.rx + HALF)) ** 2 + ((y - b.pool.cy) / (b.pool.ry + HALF)) ** 2).toBeGreaterThan(1);
    // ripples are short arcs inside the water, uneven in length, and none is a dashed line along the brook
    for (const [x, y, w] of b.ripples) for (const e of [x, x + w]) expect(distLine(b.points, e, y), `ripple ${x},${y} leaves the water`).toBeLessThan(b.water - 2);
    expect(new Set(b.ripples.map((r) => r[2])).size).toBeGreaterThan(6);
    // stones sit in the water; pebbles and reeds on the banks, not in it
    for (const [x, y] of b.stones) expect(distLine(b.points, x, y), `stone ${x},${y}`).toBeLessThan(b.water);
    for (const [x, y] of b.pebbles) expect(distLine(b.points, x, y) > b.water || Math.hypot(x - b.pool.cx, y - b.pool.cy) < 40, `pebble ${x},${y} in the water`).toBe(true);
    for (const [x, y] of sc.reeds!) {
      expect(distLine(b.points, x, y), `reed ${x},${y} in the water`).toBeGreaterThan(b.water + 6);
      expect(distLine(b.points, x, y), `reed ${x},${y} off the bank`).toBeLessThan(b.bank + 12);
    }
  });

  it("keeps every prop off the lanes, with its base on the ground", () => {
    const samples = laneSamples(sc.start, conker.slots);
    const near: string[] = [];
    const R = (name: string, x0: number, y0: number, x1: number, y1: number) => {
      const d = distBox(samples, x0, y0, x1, y1);
      if (!(d > HALF)) near.push(`${name} (${d.toFixed(1)})`);
    };
    const po = sc.postOfficeAt!;
    R("post office", po.x - 50 * po.scale + 12, po.y - 105 * po.scale, po.x + 50 * po.scale - 12, po.y);
    conker.slots.forEach((s, i) => {
      const n = NEIGHBOURS[s.style], k = s.houseScale ?? 0.95;
      R(`house ${i + 1}`, s.x + s.house[0], s.y + s.house[1], s.x + s.house[0] + n.w * k, s.y + s.house[1] + n.h * k);
    });
    for (const [x, y, k] of sc.trees) R(`tree ${x},${y}`, x - 30 * k, y - 36 * k, x + 30 * k, y + 34 * k);
    for (const [x, y, k] of sc.reeds!) R(`reed ${x},${y}`, x - 16 * k, y - 42 * k, x + 20 * k, y);
    for (const [x, y, k] of sc.bushes!) R(`leaf pile ${x},${y}`, x - 34 * k, y - 26 * k, x + 34 * k, y + 8 * k);
    const w = sc.windmill!;
    R("windmill tower", w.x - 30 * w.scale, w.y - 118 * w.scale, w.x + 30 * w.scale, w.y);
    const hub = { x: w.x, y: w.y - 98 * w.scale };
    const sails = distPoint(samples, hub.x, hub.y) - 82 * w.scale;
    if (!(sails > HALF)) near.push(`windmill sails (${sails.toFixed(1)})`);
    const f = sc.patch!.fence;
    R("pumpkin patch", f.x0 - 3, f.y0 - 21, f.x1 + 3, f.y1);
    const [sx, sy] = sc.patch!.scarecrow;
    R("scarecrow", sx - 29, sy - 71, sx + 29, sy);
    expect(near, "props on a lane").toEqual([]);
    // pumpkins stay inside the fence
    for (const [x, y] of sc.patch!.pumpkins) expect([x - 13 >= f.x0, x + 13 <= f.x1, y - 21 >= f.y0, y <= f.y1], `pumpkin ${x},${y}`).toEqual([true, true, true, true]);
    // the windmill stands on the east bank of the brook, and the patch on the east edge
    expect(w.x).toBeGreaterThan(Math.max(...sc.brook!.points.map((p) => p[0])));
    expect(f.x0).toBeGreaterThan(MAP_W * 0.8);
  });

  it("keeps props off the stamps, stars and Today pills, and inside the map", () => {
    const stampBox = (s: Lane) => ({ x0: s.x - 30, y0: s.y - 30, x1: s.x + 40, y1: s.y + 52 }); // the stamp, its ring and the star pill under it
    const boxes: [string, number, number, number, number][] = [];
    const w = sc.windmill!;
    boxes.push(["windmill sails", w.x - 82 * w.scale, w.y - 98 * w.scale - 82 * w.scale, w.x + 82 * w.scale, w.y - 98 * w.scale + 82 * w.scale]);
    boxes.push(["pumpkin patch", sc.patch!.fence.x0, sc.patch!.fence.y0 - 21, sc.patch!.fence.x1, sc.patch!.fence.y1]);
    for (const [x, y, k] of sc.trees) boxes.push([`tree ${x},${y}`, x - 30 * k, y - 36 * k, x + 30 * k, y + 34 * k]);
    for (const [name, x0, y0, x1, y1] of boxes)
      for (const s of conker.slots) {
        const b = stampBox(s);
        // the sails are open lattice (a gust-free hint of the wind), so only their hub and tower are held to the stamps
        if (name === "windmill sails") continue;
        expect(x1 <= b.x0 || x0 >= b.x1 || y1 <= b.y0 || y0 >= b.y1, `${name} over stop ${s.x},${s.y}`).toBe(true);
      }
    for (const [name, x0, y0, x1, y1] of boxes) expect([x0 >= 0, y0 >= -30, x1 <= MAP_W, y1 <= MAP_H + 30], name).toEqual([true, true, true, true]);
  });

  it("is the map where the entry gate to Snowberry End opens once every Conker Corner lane is stamped", async () => {
    const hm = [...hollowmere.routes];
    const ck = AUTUMN.map((r) => r.id);
    expect(conker.routes).toEqual(ck);
    {
      const stamp = (n: number) =>
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({ best: Object.fromEntries([...SPRING.map((r) => [r.id, { stars: 2, moves: r.par + 1 }]), ...hm.map((id) => [id, { stars: 1, moves: 9 }]), ...ck.slice(0, n).map((id) => [id, { stars: 1, moves: 9 }])]) }),
        );
      localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
      stamp(9);
      mount();
      await enterConker();
      expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(9);
      expect($("mapEnter").hidden).toBe(true); // one lane still open: Snowberry End stays fog
      expect(document.querySelector('#villageSvg .vhood[data-hood="snowberry"] .vplateName')!.textContent).toBe("Snowberry End");
      expect(document.querySelector('#villageSvg .vfog[data-hood="snowberry"]')!.getAttribute("transform")).toBe(`translate(${fogAt(snowberry, "conker").x} ${fogAt(snowberry, "conker").y})`);
      stamp(10);
      mount();
      await enterConker();
      expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(10);
      expect($("mapEnter").hidden).toBe(false); // all ten stamped: the way in opens
      expect($("mapEnter").dataset.hood).toBe("snowberry");
      expect($("mapEnter").textContent).toBe("Go to Snowberry End");
      expect(document.querySelector('#villageSvg .vhood[data-hood="snowberry"]')).toBeNull();
      // and the stamped lanes are the lanes of the picked layout: each stamp sits on its stop
      const stamps = [...document.querySelectorAll("#villageSvg .vnode.done")].map((n) => n.getAttribute("transform"));
      expect(stamps).toEqual(conker.slots.map((s) => `translate(${s.x} ${s.y})`));
    }
  });
});

/** Show Conker Corner's map. With no routes there, it is entered by opening the way from Hollowmere (the preview tools do this on a scratch save). */
async function enterConker() {
  if (!document.getElementById("villageSvg")) mount();
  const best = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}").best ?? {};
  const wasPlayed = hollowmere.routes.every((id) => best[id]?.stars > 0);
  if (!wasPlayed) {
    // the way in is opened for a map with no routes the same way the preview does: every village open
    mount({ skipTitle: true, openAll: true });
  }
  for (let hop = 0; hop < 2 && app.map.village !== "conker"; hop++) {
    await vi.waitFor(() => expect($("mapEnter").hidden).toBe(false));
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe(hop === 0 ? "hollowmere" : "conker"));
  }
  expect(app.map.village).toBe("conker");
}
