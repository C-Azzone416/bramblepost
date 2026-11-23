// @vitest-environment jsdom
/** Village map data, unlock rules and the village save. No drawing here; tests/map.test.ts plays the page. */
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES, SPRING, SUMMER } from "../src/levels";
import { NEIGHBOURS } from "../src/ui/cast";
import { LANES, NEIGHBOURHOODS, fogAt, THISTLEDOWN_SLOTS, MAP_H, MAP_W, POST_OFFICE, reservedSlots, type Lane } from "../src/village/data";
import { MIN_TARGET_PX } from "../src/ui/board";
import { calloutShape, layoutMarkers, pipRect } from "../src/village/pip";
import { allLanes, newStamps, villageProgress, type Best } from "../src/village/progress";
import { VILLAGE_KEY, loadVillage, markStamped, updateVillage } from "../src/village/save";

const ids = SPRING.map((r) => r.id);
const best = (...done: [string, number][]): Record<string, Best> =>
  Object.fromEntries(done.map(([id, stars]) => [id, { stars, moves: 9 }]));
const states = (b: Record<string, Best>) => allLanes(villageProgress(b)).filter((l) => l.hood.id === "thistledown").map((l) => l.state);

describe("map data", () => {
  it("every playable route has exactly one lane, in route order", () => {
    const onMap = NEIGHBOURHOODS.flatMap((h) => h.routes);
    expect(onMap).toEqual(ROUTES.map((r) => r.id));
    for (const id of onMap) expect(LANES[id], id).toBeDefined();
    expect(Object.keys(LANES).sort()).toEqual([...onMap].sort());
  });

  it("Thistledown fills its lane slots; route i takes slot i and the rest are reserved", () => {
    const spring = NEIGHBOURHOODS[0];
    expect(spring.slots).toBe(THISTLEDOWN_SLOTS);
    expect(spring.slots).toHaveLength(SPRING.length);
    spring.routes.forEach((id, i) => expect(LANES[id]).toBe(spring.slots[i]));
    expect(reservedSlots(spring)).toEqual(spring.slots.slice(spring.routes.length));
    expect(reservedSlots(spring)).toHaveLength(spring.slots.length - spring.routes.length);
    for (const h of NEIGHBOURHOODS) expect(h.routes.length, h.name).toBeLessThanOrEqual(h.slots.length);
  });

  it("later villages have the same number of placeholder slots and a post office", () => {
    for (const h of NEIGHBOURHOODS.slice(1)) {
      expect(h.slots).toHaveLength(THISTLEDOWN_SLOTS.length);
      expect(reservedSlots(h)).toHaveLength(h.slots.length - h.routes.length);
      expect(h.scenery?.postOffice).toBe(true);
    }
  });

  it("slots, houses, stars and tap areas never overlap, and stay inside the map", () => {
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const shrink = (b: Box, d: number): Box => ({ x0: b.x0 + d, y0: b.y0 + d, x1: b.x1 - d, y1: b.y1 - d });
    const inMap = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= MAP_W && b.y1 <= MAP_H;
    // stamp, its 40-unit tap area and the stars under it
    const node = (s: Lane): Box => ({ x0: s.x - 40, y0: s.y - 40, x1: s.x + 40, y1: s.y + 46 });
    const house = (s: Lane): Box => {
      const n = NEIGHBOURS[s.style];
      const k = s.houseScale ?? 0.95;
      return { x0: s.x + s.house[0], y0: s.y + s.house[1], x1: s.x + s.house[0] + n.w * k, y1: s.y + s.house[1] + n.h * k };
    };
    // Thistledown's houses are scenery, not one per stop: see the clearance test below
    const villages: [string, Lane[], { x: number; y: number }, Box, [number, number, number][]][] = [];
    const hm = NEIGHBOURHOODS.find((h) => h.id === "hollowmere")!;
    const hs = hm.scenery!, hpo = hs.postOfficeAt!;
    villages.push(["Hollowmere", hm.slots, hs.start, { x0: hpo.x - 50 * hpo.scale, y0: hpo.y - 105 * hpo.scale, x1: hpo.x + 50 * hpo.scale, y1: hpo.y }, hs.trees]);
    for (const id of ["conker", "snowberry"]) {
      const h = NEIGHBOURHOODS.find((n) => n.id === id)!;
      const sc = h.scenery!, po = sc.postOfficeAt!;
      villages.push([h.name, h.slots, sc.start, { x0: po.x - 50 * po.scale, y0: po.y - 105 * po.scale, x1: po.x + 50 * po.scale, y1: po.y }, sc.trees]);
    }
    for (const [name, S, , po, trees] of villages) {
      S.forEach((a, i) => {
        expect(inMap(node(a)), `${name} node ${i + 1}`).toBe(true);
        expect(inMap(house(a)), `${name} house ${i + 1}`).toBe(true);
        expect(hit(house(a), po), `${name} house ${i + 1} on the post office`).toBe(false);
        expect(hit(node(a), po), `${name} node ${i + 1} on the post office`).toBe(false);
        S.forEach((b, j) => {
          if (i === j) return;
          // Conker Corner's lanes 6 and 7 (picked mockup): the square boxes touch by one unit at the corner, but the round tap areas
          // are about 98.6 units apart, well beyond the 80 combined, so that one pair is allowed 2 units; every other pair is exact
          const slack = name === "Conker Corner" && i === 5 && j === 6 ? 2 : 0;
          if (i < j) expect(hit(shrink(node(a), slack), node(b)), `${name} nodes ${i + 1}/${j + 1}`).toBe(false);
          expect(hit(house(a), node(b)), `${name} house ${i + 1} over node ${j + 1}`).toBe(false);
          if (i < j) expect(hit(house(a), house(b)), `${name} houses ${i + 1}/${j + 1}`).toBe(false);
        });
      });
      for (const [x, y] of trees) for (const s of S) expect(Math.hypot(x - s.x, y - s.y), `${name} tree ${x},${y}`).toBeGreaterThan(70);
    }
  });

  it("Thistledown's scenery (houses, trees, bushes, reeds) stays clear of lanes, badges, Pip and the callout in every progress state (#175)", () => {
    const N = NEIGHBOURHOODS[0], sc = N.scenery!;
    type R = [number, number, number, number];
    const hit = (a: R, b: R) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const lane: [number, number][] = [];
    let prev: { x: number; y: number } = POST_OFFICE;
    for (const s of THISTLEDOWN_SLOTS) {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, u = 1 - t;
        lane.push([u * u * prev.x + 2 * u * t * s.via[0] + t * t * s.x, u * u * prev.y + 2 * u * t * s.via[1] + t * t * s.y]);
      }
      prev = s;
    }
    const items: [string, R][] = [
      ...sc.houses!.map(([st, x, y, k], i): [string, R] => [`house ${i + 1}`, [x, y, x + NEIGHBOURS[st].w * k, y + NEIGHBOURS[st].h * k]]),
      ...sc.trees.map(([x, y, k], i): [string, R] => [`tree ${i + 1}`, [x - 36 * k, y - 6 - 36 * k, x + 36 * k, y - 6 + 36 * k]]),
      ...(sc.bushes ?? []).map(([x, y, k], i): [string, R] => [`bush ${i + 1}`, [x - 28 * k, y - 8 - 28 * k, x + 28 * k, y - 8 + 28 * k]]),
      ...(sc.reeds ?? []).map(([x, y, k], i): [string, R] => [`reed ${i + 1}`, [x - 10 * k, y - 20 * k, x + 10 * k, y]]),
    ];
    // the real tap circle (the map sizes it to MIN_TARGET_PX on a phone at scale 0.33, as tests/map.test.ts checks) and the star pill
    const TAP_R = MIN_TARGET_PX / 2 / 0.33, LANE_HALF = 16; // the lane is drawn 32 units wide
    const circleHit = (b: R, cx: number, cy: number, r: number) => Math.hypot(Math.max(b[0] - cx, 0, cx - b[2]), Math.max(b[1] - cy, 0, cy - b[3])) < r;
    const fixed: R[] = [
      ...THISTLEDOWN_SLOTS.map((s): R => [s.x - 31, s.y + 24, s.x + 31, s.y + 48]), // the star pill
      [POST_OFFICE.x - 50, POST_OFFICE.y - 98, POST_OFFICE.x + 50, POST_OFFICE.y + 7],
    ];
    const dynamic: R[] = [];
    for (let open = 0; open <= THISTLEDOWN_SLOTS.length; open++) {
      const done = new Set(Array.from({ length: open }, (_, i) => i));
      const target = Math.min(open, THISTLEDOWN_SLOTS.length - 1);
      const w = 24 + `Today · Route ${target + 1}`.length * 8;
      const m = layoutMarkers(THISTLEDOWN_SLOTS, POST_OFFICE, N.routes.length, done, target, open < THISTLEDOWN_SLOTS.length ? open : null, w);
      dynamic.push(pipRect(m.pip));
      if (m.callout) dynamic.push(calloutShape(THISTLEDOWN_SLOTS[target], w, m.callout).rect);
    }
    for (const [name, b] of items) {
      expect(b[0] >= 0 && b[1] >= 0 && b[2] <= MAP_W && b[3] <= MAP_H, `${name} on the map`).toBe(true);
      for (const f of [...fixed, ...dynamic]) expect(hit(b, f), `${name} over a star pill, the post office, Pip or the callout`).toBe(false);
      for (const t of THISTLEDOWN_SLOTS) expect(circleHit(b, t.x, t.y, TAP_R), `${name} inside a stamp's tap circle`).toBe(false);
      for (const [x, y] of lane) expect(circleHit(b, x, y, LANE_HALF), `${name} on a lane's drawn stroke`).toBe(false);
    }
    // spread over the canvas: every quarter of the map has houses
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const n = sc.houses!.filter(([, x, y]) => Math.floor(x / (MAP_W / 2)) === qx && Math.floor(y / (MAP_H / 2)) === qy).length;
      expect(n, `houses in quarter ${qx},${qy}`).toBeGreaterThan(0);
    }
    expect(THISTLEDOWN_SLOTS).toHaveLength(10);
  });

  it("each neighbourhood's fog stays inside the map and off the reserved lane fog, on every map it shows on", () => {
    const fog = (h: (typeof NEIGHBOURHOODS)[number], on: string) => {
      const at = fogAt(h, on);
      return { x0: at.x - 170, y0: at.y + 10 - 96, x1: at.x + 170, y1: at.y + 10 + 96 };
    };
    for (const [i, h] of NEIGHBOURHOODS.entries())
      for (const on of NEIGHBOURHOODS.slice(i - 1, i).filter(Boolean)) {
        const f = fog(h, on.id);
        expect([f.x0 >= 0, f.y0 >= 0, f.x1 <= MAP_W, f.y1 <= MAP_H], `${h.name} on ${on.name}`).toEqual([true, true, true, true]);
      }
    for (const s of reservedSlots(NEIGHBOURHOODS[0]))
      for (const h of NEIGHBOURHOODS.slice(1)) {
        const f = fog(h, "thistledown");
        expect(f.x1 <= s.x - 78 || f.x0 >= s.x + 78 || f.y1 <= s.y - 52 || f.y0 >= s.y + 52, `${h.name} fog vs slot at ${s.x},${s.y}`).toBe(true);
      }
  });

  it("each map teases only the next season's village, near the end of its route (#118, #175)", () => {
    NEIGHBOURHOODS.forEach((h, i) => {
      const next = NEIGHBOURHOODS[i + 1];
      if (!next) return; // winter teases nothing
      const at = fogAt(next, h.id);
      const d = (s: Lane) => Math.hypot(s.x - at.x, s.y - at.y);
      expect(d(h.slots[h.slots.length - 1]), `${next.name} on ${h.name}: nearer the last lane than the first`).toBeLessThan(d(h.slots[0]));
      expect(d(h.slots[h.slots.length - 1]), `${next.name} on ${h.name}: near the route's end`).toBeLessThan(420);
    });
    // spring's tease is Hollowmere in the top right corner, where the path ends
    const at = fogAt(NEIGHBOURHOODS[1], "thistledown");
    expect([at.x > MAP_W * 0.75, at.y < MAP_H * 0.3]).toEqual([true, true]);
    // no village is seen from a map more than one season before it
    expect(NEIGHBOURHOODS.flatMap((h, i) => Object.keys(h.seenFrom ?? {}).filter((id) => NEIGHBOURHOODS[i - 1]?.id !== id))).toEqual([]);
  });

  it("spring is Thistledown and the later seasons wait in order", () => {
    expect(NEIGHBOURHOODS.map((h) => h.season)).toEqual(["spring", "summer", "autumn", "winter"]);
    expect(NEIGHBOURHOODS[0].name).toBe("Thistledown");
    expect(NEIGHBOURHOODS[0].routes).toEqual(ids);
  });
});

describe("unlocking", () => {
  it("a new player has the first lane open and the rest locked", () => {
    const p = villageProgress({});
    expect(states({})).toEqual(["open", ...Array(ids.length - 1).fill("locked")]);
    expect(p.today).toBe("primrose");
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "locked", "locked", "locked"]);
    expect([p.stamps, p.lanes, p.stars, p.maxStars]).toEqual([0, ROUTES.length, 0, ROUTES.length * 3]);
  });

  it("finishing a route stamps its lane and opens the next", () => {
    const p = villageProgress(best(["primrose", 2]));
    expect(states(best(["primrose", 2]))).toEqual(["done", "open", ...Array(ids.length - 2).fill("locked")]);
    expect(p.today).toBe("millpond");
    expect(p.hoods[0].lanes[0]).toMatchObject({ n: 1, stars: 2, moves: 9 });
    expect([p.stamps, p.stars]).toEqual([1, 2]);
  });

  it("one star is enough to stamp a lane", () => {
    expect(states(best(["primrose", 1], ["millpond", 1]))).toEqual(["done", "done", "open", ...Array(ids.length - 3).fill("locked")]);
  });

  it("a saved finish with no stars does not count", () => {
    expect(states(best(["primrose", 0]))).toEqual(["open", ...Array(ids.length - 1).fill("locked")]);
  });

  it("a gap in an older save keeps its stamps and opens the lane after each one", () => {
    // finished Footbridge Row without doing Mill Pond
    const b = best(["primrose", 3], ["footbridge", 2]);
    expect(states(b)).toEqual(["done", "open", "done", "open", ...Array(ids.length - 4).fill("locked")]);
    expect(villageProgress(b).today).toBe("millpond");
  });

  it("stamping every spring lane finishes spring and opens summer", () => {
    const b = best(...ids.map((id, i) => [id, (i % 3) + 1] as [string, number]));
    const p = villageProgress(b);
    expect(p.today).toBe(SUMMER[0].id);
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "open", "locked", "locked"]);
    expect([p.stamps, p.stars]).toEqual([ids.length, ids.reduce((n, _, i) => n + (i % 3) + 1, 0)]);
  });

  it("a later season opens when the one before is complete", () => {
    const hoods = [
      { id: "a", name: "A", season: "spring" as const, routes: ["a1", "a2"], at: { x: 0, y: 0 } },
      { id: "b", name: "B", season: "summer" as const, routes: ["b1", "b2"], at: { x: 0, y: 0 } },
      { id: "c", name: "C", season: "autumn" as const, routes: ["c1"], at: { x: 0, y: 0 } },
      { id: "d", name: "D", season: "winter" as const, routes: [], at: { x: 0, y: 0 } },
    ];
    const half = villageProgress(best(["a1", 3]), hoods);
    expect(half.hoods[1].state).toBe("locked");
    expect(allLanes(half).map((l) => l.state)).toEqual(["done", "open", "locked", "locked", "locked"]);
    const full = villageProgress(best(["a1", 3], ["a2", 1]), hoods);
    expect(full.hoods[1].state).toBe("open");
    expect(full.today).toBe("b1");
    expect(allLanes(full).map((l) => l.n)).toEqual([1, 2, 1, 2, 1]);
    const later = villageProgress(best(["a1", 3], ["a2", 1], ["b1", 1], ["b2", 1], ["c1", 1]), hoods);
    expect(later.hoods.map((h) => h.state)).toEqual(["open", "open", "open", "soon"]);
  });

  it("new stamps are the finished lanes the player has not seen yet", () => {
    const p = villageProgress(best(["primrose", 3], ["millpond", 2]));
    expect(newStamps(p, [])).toEqual(["primrose", "millpond"]);
    expect(newStamps(p, ["primrose"])).toEqual(["millpond"]);
    expect(newStamps(p, ["primrose", "millpond"])).toEqual([]);
  });
});

describe("village save", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(loadVillage()).toEqual({ stamped: [] });
  });

  it("remembers seen stamps once each", () => {
    markStamped(["primrose"]);
    markStamped(["primrose", "millpond"]);
    expect(loadVillage().stamped).toEqual(["primrose", "millpond"]);
    expect(JSON.parse(localStorage.getItem(VILLAGE_KEY)!)).toEqual({ stamped: ["primrose", "millpond"] });
  });

  it("keeps fields that other features store under the same key", () => {
    updateVillage((v) => {
      v.replies = { primrose: "kind" };
    });
    markStamped(["millpond"]);
    expect(loadVillage()).toEqual({ stamped: ["millpond"], replies: { primrose: "kind" } });
  });

  it("shrugs off a broken save", () => {
    localStorage.setItem(VILLAGE_KEY, "{not json");
    expect(loadVillage()).toEqual({ stamped: [] });
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: "oops", replies: 1 }));
    expect(loadVillage()).toEqual({ stamped: [], replies: 1 });
  });
});
