// @vitest-environment jsdom
/**
 * Snowberry End's winter routes (#132): the lane contract, placeholder houses, the curve, the teapot, the header, the year end, and
 * the proof that EVERY rule a route mixes in matters (ice first of all). The rules are derived from each route's own data; see
 * tools/lib/ablate.ts for what "switched off" means for each rule.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_ENDING, endingsForPack } from "../src/content/active";
import { STANDARD_PACK } from "../src/content/standard";
import { endingFor } from "../src/door/ending";
import { defaultOrder, deliverChain, gustMove, parse, solveOrder, step, teapot } from "../src/engine";
import { AUTUMN, ROUTES, SPRING, SUMMER, WINTER } from "../src/levels";
import { CURRENT_VILLAGE_KEY, ENDING_KEY } from "../src/save";
import { NEIGHBOURS } from "../src/ui/cast";
import { routeLabel } from "../src/ui/game";
import { mountApp } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { LANES, NEIGHBOURHOODS, SNOWBERRY_SLOTS, reservedSlots } from "../src/village/data";
import { ablations, bestPar, matters, type Rule } from "../tools/lib/ablate";

const required = [
  ["letter:wh1", "parcel:wh2"],
  ["letter:wh2", "parcel:wh3"],
  ["letter:wh3", "parcel:wh4"],
  ["letter:wh4", "parcel:wh1"],
  ["letter:wh1", "parcel:wh2", "parcel:wh3"],
  ["letter:wh2", "parcel:wh4", "parcel:wh1"],
  ["letter:wh3", "parcel:wh2"],
  ["letter:wh4", "parcel:wh3"],
  ["letter:wh2", "parcel:wh1"],
  ["parcel:wh1", "parcel:wh2"],
];
const HOUSES = ["wh1", "wh2", "wh3", "wh4"];
/** The rules each route mixes in. The test derives them from the data too and checks they are these. */
const RULES: Rule[][] = [
  ["ice"], ["ice"], ["ice"], ["ice", "pie"], ["ice", "bridge", "cat"],
  ["ice", "gust"], ["ice", "sunflower", "signed"], ["ice", "gust", "pie"], ["ice", "bridge", "sunflower", "pie"],
  ["ice", "gust", "sunflower", "bridge", "signed"],
];

describe("winter routes", () => {
  it("loads ten routes after autumn and fills Snowberry End's slots in lane order", () => {
    expect(WINTER).toHaveLength(10);
    expect(ROUTES).toEqual([...SPRING, ...SUMMER, ...AUTUMN, ...WINTER]);
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
    const village = NEIGHBOURHOODS.find((h) => h.id === "snowberry")!;
    expect(village.routes).toEqual(WINTER.map((r) => r.id));
    expect(village.slots).toBe(SNOWBERRY_SLOTS);
    expect(reservedSlots(village)).toEqual([]);
    WINTER.forEach((route, i) => expect(LANES[route.id]).toBe(SNOWBERRY_SLOTS[i]));
  });

  it("carries every binding delivery in relative satchel order", () => {
    WINTER.forEach((route, i) => {
      const actual = route.parcels.map((p) => `${p.kind}:${route.houses[p.to]}`);
      let next = 0;
      for (const parcel of actual) if (parcel === required[i][next]) next++;
      expect(next, route.id).toBe(required[i].length);
      expect(Object.values(route.houses).every((h) => HOUSES.includes(h)), route.id).toBe(true);
    });
  });

  it("route ten has no letter", () => {
    expect(WINTER[9].parcels.some((p) => p.kind === "letter")).toBe(false);
    expect(WINTER.slice(0, 9).every((r) => r.parcels.some((p) => p.kind === "letter"))).toBe(true);
  });

  it("gives each slot its route's letter house (route ten: its first house)", () => {
    WINTER.forEach((route, i) => {
      const first = route.parcels.find((p) => p.kind === "letter") ?? route.parcels[0];
      expect(SNOWBERRY_SLOTS[i].style, route.id).toBe(route.houses[first.to]);
    });
  });

  it("uses neutral house ids with existing art", () => {
    for (const [id, style] of [["wh1", "acorn"], ["wh2", "burrow"], ["wh3", "tea"], ["wh4", "mush"]] as const) {
      expect(NEIGHBOURS[id]).toMatchObject({ id, house: id, who: id, sym: NEIGHBOURS[style].sym, vb: NEIGHBOURS[style].vb, w: NEIGHBOURS[style].w, h: NEIGHBOURS[style].h });
    }
    expect(SNOWBERRY_SLOTS.every((s) => HOUSES.includes(s.style))).toBe(true);
  });

  it("follows the par and board curve, with ice on every route and the earlier rules mixed in", () => {
    const pars = WINTER.map((r) => r.par);
    expect(pars[0]).toBeGreaterThanOrEqual(4);
    expect(pars[0]).toBeLessThanOrEqual(5);
    expect(pars.slice(1, 7)).toEqual([5, 5, 5, 6, 6, 6]);
    expect(pars[7]).toBe(7);
    expect(pars[8]).toBe(7);
    expect(pars[9]).toBeGreaterThanOrEqual(7);
    expect(pars[9]).toBeLessThanOrEqual(8);
    expect(WINTER.map((r) => parse(r).w)).toEqual([5, 5, 6, 6, 6, 6, 6, 6, 6, 6]);
    expect(WINTER.map((r) => r.parcels.length)).toEqual([2, 2, 3, 3, 4, 3, 4, 4, 4, 4]);
    for (const r of WINTER) {
      const P = parse(r);
      expect(P.h, r.id).toBe(5);
      expect(P.hasIce, r.id).toBe(true);
      expect(r.blurb.length && r.teach.length && r.tag?.length, r.id).toBeTruthy();
    }
    expect(WINTER.map((r) => !!r.sunday)).toEqual([false, false, false, false, true, false, false, false, true, false]);
  });

  it("introduces the crossing with one cell, then two cells", () => {
    const crossings = (i: number) => {
      const P = parse(WINTER[i]);
      return P.kind.filter((k) => k === "ice").length;
    };
    expect(crossings(0)).toBe(1);
    expect(crossings(2)).toBe(2);
  });

  it("mixes in the rules the lane teaches, read from each route's data", () => {
    const rules = WINTER.map((r) => ablations(r).map((a) => a.rule));
    expect(rules.map((x) => [...x].sort())).toEqual(RULES.map((x) => [...x].sort()));
  });

  it("makes every known solution cross ice", () => {
    for (const r of WINTER) {
      const P = parse(r);
      const { order, moves } = r.solution;
      let v = P.init.slice();
      let next = 0;
      let crossed = false;
      moves.forEach((m, j) => {
        v = step(P, v, m, j + 1);
        for (const d of deliverChain(P, v, order, next)) if (d.path.some((c) => P.kind[c] === "ice")) crossed = true;
        next += deliverChain(P, v, order, next).length;
      });
      expect(next, r.id).toBe(order.length);
      expect(crossed, `${r.id} crosses ice`).toBe(true);
    }
  });

  it("makes at least one gust slide in each known solution of a gust route", () => {
    for (const r of WINTER.filter((x) => x.wind)) {
      const P = parse(r);
      const gusts = r.solution.moves.filter((_, j) => gustMove(P, j + 1) !== null);
      expect(gusts.length, r.id).toBeGreaterThan(0);
    }
  });
});

describe("winter header", () => {
  it("reads Winter · Route n for each winter route", () => {
    WINTER.forEach((r, i) => expect(routeLabel(r.id, ROUTES.indexOf(r))).toBe(`Winter · Route ${i + 1}`));
  });
});

describe("winter routes fit the teapot", () => {
  // One check per route, each with its own timeout: all ten in one check timed out at the 60s default on CI.
  it.each(WINTER)("$id can finish from the starting satchel order within the teapot", (route) => {
    const r = solveOrder(parse(route), defaultOrder(route), teapot(route.par), Infinity);
    expect(r.par, `${route.id} default order`).not.toBeNull();
  }, 300_000);
});

describe("winter routes: every rule matters", { timeout: 1_800_000 }, () => {
  WINTER.forEach((route, i) => {
    it(`${route.id}: par ${route.par}, nothing solves below it, and each rule matters`, () => {
      // the stored par is the true par: no valid order solves below it, and the known order solves at it
      expect(bestPar(route, route.par - 1), `${route.id} solves below par`).toBeNull();
      expect(bestPar(route, route.par)).toBe(route.par);
      const rules = ablations(route);
      expect(rules.map((a) => a.rule).sort()).toEqual([...RULES[i]].sort());
      for (const a of rules) {
        // help rules: with the rule off, no valid order solves within par. limit rules: with it lifted, some order beats par.
        expect(matters(a, route.par), `${route.id}: ${a.rule} (${a.mode}) must matter at par ${route.par}`).toBe(true);
      }
      expect(rules.find((a) => a.rule === "ice"), route.id).toBeDefined();
    });
  });

  it("the ablations really switch a rule off (a synthetic board)", () => {
    const p = { grid: ["P EW # EW A"], parcels: [{ to: "A", kind: "letter" as const }] };
    expect(bestPar(p, 1)).toBe(-1); // solved at move 0
    const q = { grid: ["P NS # EW A"], parcels: p.parcels };
    expect(bestPar(q, 1)).toBe(1);
    const [ice] = ablations(q);
    expect(ice.rule).toBe("ice");
    expect(ice.puzzle.grid).toEqual(["P NS ~ EW A"]);
    expect(matters(ice, 1)).toBe(true); // stream: the lane can never be completed
    const noIceNeeded = { grid: ["P NS EW EW A"], parcels: p.parcels };
    expect(ablations(noIceNeeded)).toEqual([]);
  });
});

describe("the end of the year", () => {
  const $ = (id: string) => document.getElementById(id)!;
  const fake = { route: "winter-10", kicker: "Kicker", title: "Finale", envelope: "Envelope", lines: ["Line"] };
  const stamp = (n: number) =>
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries([...ROUTES.filter((r) => !r.id.startsWith("winter")), ...WINTER.slice(0, n)].map((r) => [r.id, { stars: 2, moves: r.par + 1 }])) }));
  const show = () => {
    localStorage.setItem(CURRENT_VILLAGE_KEY, JSON.stringify({ id: "snowberry", visited: ["snowberry"] }));
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountApp(root, ROUTES, { skipTitle: true });
  };
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = () => {};
    localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
  });
  afterEach(() => {
    const at = ACTIVE_ENDING.indexOf(fake);
    if (at >= 0) ACTIVE_ENDING.splice(at, 1);
  });

  it("with the standard content there is no winter finale: ten stamps complete the year and nothing leads on", () => {
    expect(ACTIVE_ENDING.some((e) => e.route.startsWith("winter"))).toBe(false);
    stamp(9);
    show();
    expect($("mapTitle").textContent).toBe("Snowberry End");
    expect($("mapNews").textContent).not.toBe("The year is complete.");
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(9);
    stamp(10);
    show();
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(10);
    expect($("mapNews").textContent).toBe("The year is complete.");
    expect($("mapEnter").hidden).toBe(true);
    expect($("villageSvg").getAttribute("aria-label")).toBe("Map of Snowberry End. The year is complete.");
  });

  it("a pack's winter finale binds to the last winter route and holds the year open until it has been seen", () => {
    const pack = structuredClone(STANDARD_PACK);
    pack.seasons!.winter!.routes = WINTER.map((r) => ({ id: r.id, parcels: [] }));
    const winter = endingsForPack(pack).at(-1);
    expect(winter?.route).toBe("winter-10");
    expect(endingFor(endingsForPack(pack), "winter-10")).toEqual(winter);
    expect(endingFor(endingsForPack(pack), "winter-9")).toBeUndefined();
    ACTIVE_ENDING.push(fake);
    stamp(10);
    show();
    expect($("mapNews").textContent).not.toBe("The year is complete."); // ten stamps, finale not yet seen
    localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true, routes: ["winter-10"] }));
    show();
    expect($("mapNews").textContent).toBe("The year is complete.");
    expect($("mapEnter").hidden).toBe(true);
  });
});
