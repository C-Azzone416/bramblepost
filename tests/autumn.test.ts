/** Conker Corner's lane contract, placeholder houses, teaching mechanics and the proof that the gusts (and sunflowers) matter. */
import { describe, expect, it } from "vitest";
import { defaultOrder, gustMove, parse, solveOrder, SUN, teapot, validOrders } from "../src/engine";
import { AUTUMN, ROUTES, SPRING, SUMMER } from "../src/levels";
import { NEIGHBOURS } from "../src/ui/cast";
import { CONKER_SLOTS, LANES, NEIGHBOURHOODS, reservedSlots } from "../src/village/data";

const required = [
  ["letter:ah1", "parcel:ah1"],
  ["letter:ah3", "parcel:ah2"],
  ["letter:ah2", "parcel:ah3", "parcel:ah1"],
  ["letter:ah3", "parcel:ah1"],
  ["letter:ah1", "parcel:ah2"],
  ["letter:ah2", "parcel:ah1"],
  ["letter:ah3", "parcel:ah2"],
  ["letter:ah1", "parcel:ah3"],
  ["letter:ah2", "parcel:ah1"],
  ["parcel:ah3", "parcel:ah2"],
];
const HOUSES = ["ah1", "ah2", "ah3"];

describe("autumn routes", () => {
  it("loads ten routes after summer and fills Conker Corner's slots in lane order", () => {
    expect(AUTUMN).toHaveLength(10);
    expect(ROUTES).toEqual([...SPRING, ...SUMMER, ...AUTUMN]);
    const village = NEIGHBOURHOODS.find((h) => h.id === "conker")!;
    expect(village.routes).toEqual(AUTUMN.map((r) => r.id));
    expect(village.slots).toBe(CONKER_SLOTS);
    expect(reservedSlots(village)).toEqual([]);
    AUTUMN.forEach((route, i) => expect(LANES[route.id]).toBe(CONKER_SLOTS[i]));
  });

  it("carries every binding delivery in relative satchel order", () => {
    AUTUMN.forEach((route, i) => {
      const actual = route.parcels.map((p) => `${p.kind}:${route.houses[p.to]}`);
      let next = 0;
      for (const parcel of actual) if (parcel === required[i][next]) next++;
      expect(next, route.id).toBe(required[i].length);
      expect(Object.values(route.houses).every((h) => HOUSES.includes(h)), route.id).toBe(true);
    });
    expect(AUTUMN[9].parcels.some((p) => p.kind === "letter")).toBe(false);
  });

  it("gives each slot its route's letter house (route ten: its first house)", () => {
    AUTUMN.forEach((route, i) => {
      const first = route.parcels.find((p) => p.kind === "letter") ?? route.parcels[0];
      expect(CONKER_SLOTS[i].style, route.id).toBe(route.houses[first.to]);
    });
  });

  it("uses neutral house ids with existing art", () => {
    for (const [id, style] of [["ah1", "acorn"], ["ah2", "burrow"], ["ah3", "tea"]] as const) {
      expect(NEIGHBOURS[id]).toMatchObject({ id, house: id, who: id, sym: NEIGHBOURS[style].sym, vb: NEIGHBOURS[style].vb, w: NEIGHBOURS[style].w, h: NEIGHBOURS[style].h });
    }
    expect(CONKER_SLOTS.every((s) => HOUSES.includes(s.style))).toBe(true);
  });

  it("follows the board and par curve, with gusts everywhere and the earlier rules mixed in", () => {
    expect(AUTUMN.map((r) => r.par)).toEqual([4, 4, 5, 5, 5, 6, 6, 6, 7, 7]);
    expect(AUTUMN.map((r) => parse(r).w)).toEqual([5, 5, 5, 5, 6, 6, 6, 6, 6, 6]);
    for (const r of AUTUMN) {
      expect(parse(r).h).toBe(5);
      expect(r.wind, r.id).toBeDefined();
      expect(r.blurb.length && r.teach.length && r.tag?.length, r.id).toBeTruthy();
    }
    const kinds = (i: number) => AUTUMN[i].parcels.map((p) => p.kind);
    expect(kinds(3)).toContain("pie");
    expect(AUTUMN[4].sunday).toBe(true);
    expect(parse(AUTUMN[4]).kind).toContain("bridge");
    expect(kinds(4)).toContain("cat");
    expect(kinds(6)).toEqual(expect.arrayContaining(["signed", "cat"]));
    expect(kinds(7)).toContain("pie");
    expect(parse(AUTUMN[5]).init.some((v) => v & SUN)).toBe(true);
    expect(AUTUMN[8].sunday).toBe(true);
    expect(parse(AUTUMN[8]).kind).toContain("bridge");
    for (const kind of ["signed", "cat"]) expect(kinds(9), kind).toContain(kind);
    expect(parse(AUTUMN[9]).kind).toContain("bridge");
    expect(parse(AUTUMN[9]).init.some((v) => v & SUN)).toBe(true);
  });

  it("makes at least one gust slide in each known solution", () => {
    for (const r of AUTUMN) {
      const P = parse(r);
      const gusts = r.solution.moves.filter((_, j) => gustMove(P, j + 1) !== null);
      expect(gusts.length, r.id).toBeGreaterThan(0);
    }
  });
});

describe("autumn routes fit the teapot", () => {
  it("can finish from the starting satchel order within the teapot", () => {
    for (const route of AUTUMN) {
      const r = solveOrder(parse(route), defaultOrder(route), teapot(route.par), 6e6);
      expect(r.capped, route.id).toBeFalsy();
      expect(r.par, `${route.id} default order`).not.toBeNull();
    }
  });
});

describe("autumn routes need the gusts", () => {
  it("cannot be solved at par with the wind removed", () => {
    for (const route of AUTUMN) {
      const calm = parse({ ...route, wind: undefined });
      for (const order of validOrders(route)) {
        const r = solveOrder(calm, order, route.par, 6e6);
        expect(r.capped, `${route.id} order ${order}`).toBeFalsy();
        expect(r.par, `${route.id} order ${order} solves at par without the gusts`).toBeNull();
      }
    }
  });
});

describe("autumn routes that mix sunflowers need them", () => {
  it("cannot be solved at par with sunflowers frozen as ordinary tiles", () => {
    // An ordinary rotatable tile can do everything a fixed one can, so this also covers fixed sunflowers.
    const sunny = AUTUMN.filter((r) => parse(r).init.some((v) => v & SUN));
    expect(sunny.map((r) => r.id)).toEqual(["autumn-6", "autumn-9", "autumn-10"]);
    for (const route of sunny) {
      const frozen = parse({ ...route, grid: route.grid.map((row) => row.replace(/@/g, "")) });
      for (const order of validOrders(route)) {
        const r = solveOrder(frozen, order, route.par, 6e6);
        expect(r.capped, `${route.id} order ${order}`).toBeFalsy();
        expect(r.par, `${route.id} order ${order} solves at par without the sunflower`).toBeNull();
      }
    }
  });
});
