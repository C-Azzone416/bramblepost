// @vitest-environment jsdom
/** Village map data, unlock rules and the village save. No drawing here; tests/map.test.ts plays the page. */
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES, SPRING } from "../src/levels";
import { NEIGHBOURS } from "../src/ui/cast";
import { LANES, NEIGHBOURHOODS, SLOTS_PER_SEASON, THISTLEDOWN_SLOTS, MAP_H, MAP_W, POST_OFFICE, TREES, reservedSlots, type Lane } from "../src/village/data";
import { allLanes, newStamps, villageProgress, type Best } from "../src/village/progress";
import { VILLAGE_KEY, loadVillage, markStamped, updateVillage } from "../src/village/save";

const ids = SPRING.map((r) => r.id);
const best = (...done: [string, number][]): Record<string, Best> =>
  Object.fromEntries(done.map(([id, stars]) => [id, { stars, moves: 9 }]));
const states = (b: Record<string, Best>) => allLanes(villageProgress(b)).map((l) => l.state);

describe("map data", () => {
  it("every playable route has exactly one lane, in route order", () => {
    const onMap = NEIGHBOURHOODS.flatMap((h) => h.routes);
    expect(onMap).toEqual(ROUTES.map((r) => r.id));
    for (const id of onMap) expect(LANES[id], id).toBeDefined();
    expect(Object.keys(LANES).sort()).toEqual([...onMap].sort());
  });

  it("Thistledown has fifteen slots; route i takes slot i and the rest are reserved", () => {
    const spring = NEIGHBOURHOODS[0];
    expect(spring.slots).toBe(THISTLEDOWN_SLOTS);
    expect(spring.slots).toHaveLength(SLOTS_PER_SEASON);
    spring.routes.forEach((id, i) => expect(LANES[id]).toBe(spring.slots[i]));
    expect(reservedSlots(spring)).toEqual(spring.slots.slice(spring.routes.length));
    expect(reservedSlots(spring)).toHaveLength(SLOTS_PER_SEASON - spring.routes.length);
    for (const h of NEIGHBOURHOODS) expect(h.routes.length, h.name).toBeLessThanOrEqual(h.slots.length);
  });

  it("slots, houses, stars and tap areas never overlap, and stay inside the map", () => {
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const inMap = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= MAP_W && b.y1 <= MAP_H;
    // stamp, its 40-unit tap area and the stars under it
    const node = (s: Lane): Box => ({ x0: s.x - 40, y0: s.y - 40, x1: s.x + 40, y1: s.y + 46 });
    const house = (s: Lane): Box => {
      const n = NEIGHBOURS[s.style];
      const k = s.houseScale ?? 0.95;
      return { x0: s.x + s.house[0], y0: s.y + s.house[1], x1: s.x + s.house[0] + n.w * k, y1: s.y + s.house[1] + n.h * k };
    };
    const S = THISTLEDOWN_SLOTS;
    const po: Box = { x0: POST_OFFICE.x - 50, y0: POST_OFFICE.y - 98, x1: POST_OFFICE.x + 50, y1: POST_OFFICE.y + 7 };
    S.forEach((a, i) => {
      expect(inMap(node(a)), `node ${i + 1}`).toBe(true);
      expect(inMap(house(a)), `house ${i + 1}`).toBe(true);
      expect(hit(house(a), po), `house ${i + 1} on the post office`).toBe(false);
      expect(hit(node(a), po), `node ${i + 1} on the post office`).toBe(false);
      S.forEach((b, j) => {
        if (i === j) return;
        if (i < j) expect(hit(node(a), node(b)), `nodes ${i + 1}/${j + 1}`).toBe(false);
        expect(hit(house(a), node(b)), `house ${i + 1} over node ${j + 1}`).toBe(false);
        if (i < j) expect(hit(house(a), house(b)), `houses ${i + 1}/${j + 1}`).toBe(false);
      });
    });
    for (const [x, y] of TREES) for (const s of S) expect(Math.hypot(x - s.x, y - s.y)).toBeGreaterThan(70);
  });

  it("each neighbourhood's fog stays inside the map and off the reserved lane fog", () => {
    const fog = (h: (typeof NEIGHBOURHOODS)[number]) => ({ x0: h.at.x - 170, y0: h.at.y + 10 - 96, x1: h.at.x + 170, y1: h.at.y + 10 + 96 });
    for (const h of NEIGHBOURHOODS) {
      const f = fog(h);
      expect([f.x0 >= 0, f.y0 >= 0, f.x1 <= MAP_W, f.y1 <= MAP_H], h.name).toEqual([true, true, true, true]);
    }
    for (const s of reservedSlots(NEIGHBOURHOODS[0]))
      for (const h of NEIGHBOURHOODS.slice(1)) {
        const f = fog(h);
        expect(f.x1 <= s.x - 78 || f.x0 >= s.x + 78 || f.y1 <= s.y - 52 || f.y0 >= s.y + 52, `${h.name} fog vs slot at ${s.x},${s.y}`).toBe(true);
      }
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
    expect(states({})).toEqual(["open", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
    expect(p.today).toBe("primrose");
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "locked", "locked", "locked"]);
    expect([p.stamps, p.lanes, p.stars, p.maxStars]).toEqual([0, 9, 0, 27]);
  });

  it("finishing a route stamps its lane and opens the next", () => {
    const p = villageProgress(best(["primrose", 2]));
    expect(states(best(["primrose", 2]))).toEqual(["done", "open", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
    expect(p.today).toBe("clover");
    expect(p.hoods[0].lanes[0]).toMatchObject({ n: 1, stars: 2, moves: 9 });
    expect([p.stamps, p.stars]).toEqual([1, 2]);
  });

  it("one star is enough to stamp a lane", () => {
    expect(states(best(["primrose", 1], ["clover", 1]))).toEqual(["done", "done", "open", "locked", "locked", "locked", "locked", "locked", "locked"]);
  });

  it("a saved finish with no stars does not count", () => {
    expect(states(best(["primrose", 0]))).toEqual(["open", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
  });

  it("a gap in an older save keeps its stamps and opens the lane after each one", () => {
    // finished Mill Pond from the old route list without doing Clover Bend
    const b = best(["primrose", 3], ["millpond", 2]);
    expect(states(b)).toEqual(["done", "open", "done", "open", "locked", "locked", "locked", "locked", "locked"]);
    expect(villageProgress(b).today).toBe("clover");
  });

  it("stamping every spring lane finishes spring; summer has no routes yet", () => {
    const b = best(...ids.map((id, i) => [id, (i % 3) + 1] as [string, number]));
    const p = villageProgress(b);
    expect(p.today).toBeNull();
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "soon", "locked", "locked"]);
    expect([p.stamps, p.stars]).toEqual([9, 1 + 2 + 3 + 1 + 2 + 3 + 1 + 2 + 3]);
  });

  it("a later season opens when the one before is complete", () => {
    const hoods = [
      { id: "a", name: "A", season: "spring" as const, routes: ["a1", "a2"], at: { x: 0, y: 0 } },
      { id: "b", name: "B", season: "summer" as const, routes: ["b1", "b2"], at: { x: 0, y: 0 } },
    ];
    const half = villageProgress(best(["a1", 3]), hoods);
    expect(half.hoods[1].state).toBe("locked");
    expect(allLanes(half).map((l) => l.state)).toEqual(["done", "open", "locked", "locked"]);
    const full = villageProgress(best(["a1", 3], ["a2", 1]), hoods);
    expect(full.hoods[1].state).toBe("open");
    expect(full.today).toBe("b1");
    expect(allLanes(full).map((l) => l.n)).toEqual([1, 2, 1, 2]);
  });

  it("new stamps are the finished lanes the player has not seen yet", () => {
    const p = villageProgress(best(["primrose", 3], ["clover", 2]));
    expect(newStamps(p, [])).toEqual(["primrose", "clover"]);
    expect(newStamps(p, ["primrose"])).toEqual(["clover"]);
    expect(newStamps(p, ["primrose", "clover"])).toEqual([]);
  });
});

describe("village save", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(loadVillage()).toEqual({ stamped: [] });
  });

  it("remembers seen stamps once each", () => {
    markStamped(["primrose"]);
    markStamped(["primrose", "clover"]);
    expect(loadVillage().stamped).toEqual(["primrose", "clover"]);
    expect(JSON.parse(localStorage.getItem(VILLAGE_KEY)!)).toEqual({ stamped: ["primrose", "clover"] });
  });

  it("keeps fields that other features store under the same key", () => {
    updateVillage((v) => {
      v.replies = { primrose: "kind" };
    });
    markStamped(["clover"]);
    expect(loadVillage()).toEqual({ stamped: ["clover"], replies: { primrose: "kind" } });
  });

  it("shrugs off a broken save", () => {
    localStorage.setItem(VILLAGE_KEY, "{not json");
    expect(loadVillage()).toEqual({ stamped: [] });
    localStorage.setItem(VILLAGE_KEY, JSON.stringify({ stamped: "oops", replies: 1 }));
    expect(loadVillage()).toEqual({ stamped: [], replies: 1 });
  });
});
