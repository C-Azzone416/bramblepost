// @vitest-environment jsdom
/**
 * Snowberry End's map from the picked mockup (#129): the ten lanes, the post office start, no village ahead, the frozen lake with
 * the planks on lanes 3 and 4 and the slide hint on lane 10, the geometry rules (water never a road, nothing on a lane, nothing
 * floating), and the way in from Conker Corner. The mockup is docs/village-mockups on #148 (not in this branch).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTUMN, ROUTES, SPRING, WINTER } from "../src/levels";
import { ENDING_KEY } from "../src/save";
import { NEIGHBOURS } from "../src/ui/cast";
import { mountApp, type App } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { MAP_H, MAP_W, NEIGHBOURHOODS, fogAt, sceneryOf } from "../src/village/data";
import { HALF, distBox, distOutline, distPoint, inside, laneSamples } from "./fixtures/map-geometry";

const $ = (id: string) => document.getElementById(id)!;
const hollowmere = NEIGHBOURHOODS.find((n) => n.id === "hollowmere")!;
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

/** Show Snowberry End's map (the preview way: every village open, since the villages before it have no routes yet). */
async function enterSnowberry() {
  mount({ skipTitle: true, openAll: true });
  const order = ["hollowmere", "conker", "snowberry"];
  for (const id of order) {
    await vi.waitFor(() => expect($("mapEnter").hidden).toBe(false));
    $("mapEnter").click();
    await vi.waitFor(() => expect(app.map.village).toBe(id));
  }
}

describe("Snowberry End's map from the picked mockup (#129)", () => {
  const sc = sceneryOf(snowberry);
  const lake = sc.lake!;
  const S = snowberry.slots;

  it("has the mockup's ten lanes: each stop and its via point, in order, from the post office", () => {
    expect(S.map((s) => [s.x, s.y, ...s.via])).toEqual([
      [190, 175, 124, 170], [345, 140, 272, 176], [470, 300, 424, 208], [665, 140, 587, 243], [830, 190, 754, 145],
      [905, 340, 850, 274], [830, 490, 886, 424], [665, 565, 740, 511], [505, 565, 585, 584], [300, 565, 403, 540],
    ]);
    expect(S.every((s) => ["wh1", "wh2", "wh3", "wh4"].includes(s.style))).toBe(true); // neutral house codes only
    expect(lake.planks).toEqual([3, 4]);
    expect(lake.slide.lane).toBe(10);
  });

  it("is the last village: no fog or plate ahead and no way on, and the other maps' fog is where it was", async () => {
    expect(NEIGHBOURHOODS[NEIGHBOURHOODS.length - 1]).toBe(snowberry);
    await enterSnowberry();
    expect(document.querySelectorAll("#villageSvg .vfog, #villageSvg .vhood")).toHaveLength(0);
    expect($("mapEnter").hidden).toBe(true);
    expect(document.querySelectorAll('#villageSvg path[stroke-width="16"]')).toHaveLength(0); // no faint track toward a next village
    // its fog on the earlier maps: bottom right on Conker Corner's, unchanged elsewhere
    expect(fogAt(snowberry, "conker")).toEqual({ x: 820, y: 524 });
    expect(fogAt(snowberry, "hollowmere")).toEqual({ x: 828, y: 86 });
    expect(fogAt(snowberry, "thistledown")).toEqual({ x: 175, y: 530 });
  });

  it("starts at the post office: it stands near the start, with a short footpath to the first lane", async () => {
    const { start, postOfficeAt, postOffice } = sc;
    expect(postOffice).toBe(true);
    expect(postOfficeAt).toEqual({ x: 76, y: 158, scale: 0.82 });
    expect(start).toEqual({ x: 64, y: 196 });
    expect(Math.abs(start.x - postOfficeAt!.x)).toBeLessThanOrEqual(15); // the path begins at the door, just below it
    expect(start.y - postOfficeAt!.y).toBeLessThanOrEqual(60);
    await enterSnowberry();
    const po = document.querySelector<SVGUseElement>('#villageSvg use[href="#rbPO"]')!;
    expect(po).not.toBeNull();
    const w = Number(po.getAttribute("width")), h = Number(po.getAttribute("height"));
    expect([Number(po.getAttribute("x")) + w / 2, Number(po.getAttribute("y")) + h]).toEqual([76, 158]);
    const first = [...document.querySelectorAll("#villageSvg .vlaneLines path")].find((p) => p.getAttribute("d")?.startsWith(`M${start.x} ${start.y} Q`))!;
    expect(first.getAttribute("d")!.startsWith(`M${start.x} ${start.y} Q`)).toBe(true);
  });

  it("draws the lake, its planks on lanes 3 and 4, the slide hint, the ring, three fishing huts, the jetty, firs, lanterns and a bench", async () => {
    await enterSnowberry();
    const g = document.querySelector("#villageSvg .vlake")!;
    expect(g.querySelector('path[fill="url(#vLake)"]')).not.toBeNull();
    expect([...g.querySelectorAll("[stroke-dasharray]")].filter((e) => !e.closest(".vplanks"))).toHaveLength(0); // no dashed line on the ice (only the planks' rungs): water never reads as a road
    expect([...new Set([...document.querySelectorAll("#villageSvg .vplanks")].map((p) => p.getAttribute("data-lane-n")))].sort()).toEqual(["3", "4"]);
    expect(document.querySelectorAll("#villageSvg .vslide")).toHaveLength(1);
    // no regular dashed line in any water or ice cue (the lake, the slide hint above the lanes): they must never read as a road
    expect([...document.querySelectorAll("#villageSvg .vlake [stroke-dasharray], #villageSvg .vslide [stroke-dasharray], #villageSvg .vslide[stroke-dasharray]")].filter((e) => !e.closest(".vplanks"))).toHaveLength(0);
    expect(document.querySelectorAll('#villageSvg ellipse[fill="#3f6f8c"][rx="6"]')).toHaveLength(lake.huts.length); // each hut's fishing hole
    expect(lake.huts).toHaveLength(3);
    expect(document.querySelectorAll('#villageSvg g[transform$="scale(0.95)"] path[fill="#fffaf0"]').length).toBeGreaterThan(0); // snow on the firs
    expect(document.querySelectorAll('#villageSvg circle[fill="#ffd97a"][r="26"]')).toHaveLength(sc.lanterns!.length);
  });

  it("keeps the ice off every lane but 3, 4 (planks) and 10 (bare ice, with its slide hint)", () => {
    const outline = lake.outline;
    for (let n = 1; n <= S.length; n++) {
      const pts = laneSamples(sc.start, S, n);
      const onIce = pts.filter(([x, y]) => inside(outline, x, y)).length;
      if (lake.planks.includes(n) || n === lake.slide.lane) expect(onIce, `lane ${n} should cross the ice`).toBeGreaterThan(5);
      else expect(Math.min(...pts.map(([x, y]) => distOutline(outline, x, y)) ), `lane ${n} runs on the ice`).toBeGreaterThan(HALF - 2); // water never reads as a road
    }
    // stop 3 stands on the ice, on its planks; every other stop is on the ground
    S.forEach((s, i) => expect(inside(outline, s.x, s.y), `stop ${i + 1}`).toBe(i === 2));
    // the slide hint lies along lane 10, over the ice, pointing the way Pip slides (toward the lane's end)
    const { from, to } = lake.slide;
    const lane10 = laneSamples(sc.start, S, 10);
    for (const [x, y] of [from, to]) expect(distPoint(lane10, x, y), `slide end ${x},${y} off lane 10`).toBeLessThan(HALF);
    expect(inside(outline, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2)).toBe(true);
    expect(to[0]).toBeLessThan(from[0]); // lane 10 runs west
  });

  it("keeps every prop off the lanes, with its base on the ground (or on the ice for what belongs there)", () => {
    const samples = laneSamples(sc.start, S);
    const outline = lake.outline;
    const near: string[] = [];
    const R = (name: string, x0: number, y0: number, x1: number, y1: number) => {
      const d = distBox(samples, x0, y0, x1, y1);
      if (!(d > HALF)) near.push(`${name} (${d.toFixed(1)})`);
    };
    const po = sc.postOfficeAt!;
    R("post office", po.x - 50 * po.scale + 12, po.y - 105 * po.scale, po.x + 50 * po.scale - 12, po.y);
    S.forEach((s, i) => {
      const n = NEIGHBOURS[s.style], k = s.houseScale ?? 0.95;
      const b = [s.x + s.house[0], s.y + s.house[1], s.x + s.house[0] + n.w * k, s.y + s.house[1] + n.h * k] as const;
      R(`house ${i + 1}`, ...b);
      // a house stands on the ground: its base centre is off the ice
      expect(inside(outline, (b[0] + b[2]) / 2, b[3]), `house ${i + 1} is on the ice`).toBe(false);
    });
    for (const [x, y, k] of sc.trees) R(`fir ${x},${y}`, x - 30 * k, y - 86 * k, x + 30 * k, y + 4 * k);
    for (const [x, y, k] of sc.reeds!) R(`reed ${x},${y}`, x - 16 * k, y - 42 * k, x + 20 * k, y + 2 * k);
    for (const [x, y, k] of sc.bushes!) R(`shrub ${x},${y}`, x - 34 * k, y - 26 * k, x + 34 * k, y + 8 * k);
    for (const [x, y, k] of sc.lanterns!) R(`lantern ${x},${y}`, x - 9 * k, y - 78 * k, x + 9 * k, y);
    const [bx, by] = sc.bench!;
    R("bench", bx - 1, by - 32, bx + 49, by);
    for (const [x, y] of lake.huts) R(`hut ${x},${y}`, x - 22, y - 44, x + 39, y + 2);
    const j = lake.jetty;
    R("jetty", j.x, j.y - 9, j.x + j.w, j.y + 15 + 4);
    R("skating ring", lake.ring.cx - lake.ring.rx, lake.ring.cy - lake.ring.ry, lake.ring.cx + lake.ring.rx, lake.ring.cy + lake.ring.ry);
    expect(near, "props on a lane").toEqual([]);

    // standing on the ground: firs, shrubs, reeds, lanterns and the bench are on the bank, off the ice
    for (const [x, y] of [...sc.trees, ...sc.bushes!, ...sc.reeds!, ...sc.lanterns!]) expect(inside(outline, x, y), `prop base ${x},${y} is on the ice`).toBe(false);
    expect(inside(outline, bx + 24, by)).toBe(false);
    for (const [x, y] of sc.thawed!) expect(inside(outline, x, y), `thawed earth ${x},${y} is on the ice`).toBe(false);
    // the huts, with the stop-3 hut among them, and the skating ring stand on the ice; the hut is scenery, so stop 3 keeps a stand-in house
    for (const [x, y] of lake.huts) expect(inside(outline, x, y), `hut ${x},${y} off the ice`).toBe(true);
    expect(lake.huts.some(([x, y]) => x === 408 && y === 374)).toBe(true);
    expect(S[2].style).toBe("wh3");
    for (const a of [0, 1, 2, 3, 4, 5, 6, 7]) expect(inside(outline, lake.ring.cx + lake.ring.rx * Math.cos((a * Math.PI) / 4), lake.ring.cy + lake.ring.ry * Math.sin((a * Math.PI) / 4)), `ring point ${a}`).toBe(true);
    // the jetty is joined to the shore: its landward end is on the ground, its far end out on the ice
    expect(inside(outline, j.x, j.y)).toBe(false);
    expect(inside(outline, j.x + j.w - 2, j.y + 2)).toBe(true);
    // the lanterns, firs and everything else stay inside the map
    for (const [x, y, k] of sc.trees) expect([x - 30 * k >= 0, y - 86 * k >= -30, x + 30 * k <= MAP_W, y + 4 * k <= MAP_H]).toEqual([true, true, true, true]);
  });

  it("is the map you reach through Conker Corner's gate: it opens only once every Conker Corner lane is stamped, and nothing leads on from it", async () => {
    const hm = [...hollowmere.routes];
    const ck = AUTUMN.map((r) => r.id);
    const sn = WINTER.map((r) => r.id);
    try {
      const stamp = (conkerDone: number, winterDone: number) =>
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            best: Object.fromEntries([
              ...SPRING.map((r) => [r.id, { stars: 2, moves: r.par + 1 }]),
              ...hm.map((id) => [id, { stars: 1, moves: 9 }]),
              ...ck.slice(0, conkerDone).map((id) => [id, { stars: 1, moves: 9 }]),
              ...sn.slice(0, winterDone).map((id) => [id, { stars: 1, moves: 9 }]),
            ]),
          }),
        );
      const hop = async (to: string) => {
        await vi.waitFor(() => expect($("mapEnter").hidden).toBe(false));
        $("mapEnter").click();
        await vi.waitFor(() => expect(app.map.village).toBe(to));
      };
      localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
      stamp(9, 0);
      mount();
      await hop("hollowmere");
      await hop("conker");
      expect($("mapEnter").hidden).toBe(true); // one Conker Corner lane still open: Snowberry End stays fog
      stamp(10, 0);
      mount();
      await vi.waitFor(() => expect(app.map.village).toBe("conker")); // the saved current village
      await hop("snowberry");
      expect($("mapSeason").textContent).toBe("Winter");
      expect($("mapTitle").textContent).toBe("Snowberry End");
      expect(document.querySelectorAll("#villageSvg .vnode")).toHaveLength(10);
      expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(0);
      expect(document.querySelectorAll("#villageSvg .vnode.open")).toHaveLength(1); // the first lane is today's
      // the lanes of the picked layout: each stamp sits on its stop
      expect([...document.querySelectorAll("#villageSvg .vnode")].map((n) => n.getAttribute("transform"))).toEqual(snowberry.slots.map((s) => `translate(${s.x} ${s.y})`));
      // all ten stamped: the whole path is done, and there is no village beyond it
      stamp(10, 10);
      mount();
      await vi.waitFor(() => expect(app.map.village).toBe("snowberry"));
      expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(10);
      expect($("mapEnter").hidden).toBe(true);
      expect(document.querySelectorAll("#villageSvg .vfog, #villageSvg .vhood")).toHaveLength(0);
    } finally {
      localStorage.clear(); // the real winter routes are in the village now: nothing else to put back
    }
  });
});
