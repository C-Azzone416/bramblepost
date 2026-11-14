// @vitest-environment jsdom
/** Village map data, unlock rules and the village save. No drawing here; tests/map.test.ts plays the page. */
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES, SPRING } from "../src/levels";
import { LANES, NEIGHBOURHOODS } from "../src/village/data";
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

  it("spring is Thistledown and the later seasons wait in order", () => {
    expect(NEIGHBOURHOODS.map((h) => h.season)).toEqual(["spring", "summer", "autumn", "winter"]);
    expect(NEIGHBOURHOODS[0].name).toBe("Thistledown");
    expect(NEIGHBOURHOODS[0].routes).toEqual(ids);
  });
});

describe("unlocking", () => {
  it("a new player has the first lane open and the rest locked", () => {
    const p = villageProgress({});
    expect(states({})).toEqual(["open", "locked", "locked", "locked", "locked"]);
    expect(p.today).toBe("primrose");
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "locked", "locked", "locked"]);
    expect([p.stamps, p.lanes, p.stars, p.maxStars]).toEqual([0, 5, 0, 15]);
  });

  it("finishing a route stamps its lane and opens the next", () => {
    const p = villageProgress(best(["primrose", 2]));
    expect(states(best(["primrose", 2]))).toEqual(["done", "open", "locked", "locked", "locked"]);
    expect(p.today).toBe("clover");
    expect(p.hoods[0].lanes[0]).toMatchObject({ n: 1, stars: 2, moves: 9 });
    expect([p.stamps, p.stars]).toEqual([1, 2]);
  });

  it("one star is enough to stamp a lane", () => {
    expect(states(best(["primrose", 1], ["clover", 1]))).toEqual(["done", "done", "open", "locked", "locked"]);
  });

  it("a saved finish with no stars does not count", () => {
    expect(states(best(["primrose", 0]))).toEqual(["open", "locked", "locked", "locked", "locked"]);
  });

  it("a gap in an older save keeps its stamps and opens the lane after each one", () => {
    // finished Mill Pond from the old route list without doing Clover Bend
    const b = best(["primrose", 3], ["millpond", 2]);
    expect(states(b)).toEqual(["done", "open", "done", "open", "locked"]);
    expect(villageProgress(b).today).toBe("clover");
  });

  it("stamping every spring lane finishes spring; summer has no routes yet", () => {
    const b = best(...ids.map((id, i) => [id, (i % 3) + 1] as [string, number]));
    const p = villageProgress(b);
    expect(p.today).toBeNull();
    expect(p.hoods.map((h) => h.state)).toEqual(["open", "soon", "locked", "locked"]);
    expect([p.stamps, p.stars]).toEqual([5, 1 + 2 + 3 + 1 + 2]);
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
