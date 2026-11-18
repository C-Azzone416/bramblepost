/** Hollowmere's lane contract, placeholder houses and teaching mechanics. */
import { describe, expect, it } from "vitest";
import { deliverChain, parse, slide, solveOrder, step, SUN, validOrders } from "../src/engine";
import { ROUTES, SPRING, SUMMER } from "../src/levels";
import { NEIGHBOURS } from "../src/ui/cast";
import { HOLLOWMERE_SLOTS, LANES, NEIGHBOURHOODS, reservedSlots } from "../src/village/data";

const required = [
  ["letter:sh1", "parcel:sh2"],
  ["letter:sh2", "parcel:sh3", "parcel:sh1"],
  ["letter:sh3", "parcel:sh1", "parcel:sh2"],
  ["letter:sh1", "parcel:sh3", "parcel:sh2"],
  ["letter:sh2", "parcel:sh1", "parcel:sh3"],
  ["letter:sh3", "parcel:sh2"],
  ["letter:sh1", "parcel:sh3"],
  ["letter:sh2", "parcel:sh1"],
  ["letter:sh3", "parcel:sh1"],
  ["parcel:sh1", "parcel:sh2"],
];

describe("summer routes", () => {
  it("loads ten routes after spring and fills Hollowmere's slots in lane order", () => {
    expect(SUMMER).toHaveLength(10);
    expect(ROUTES).toEqual([...SPRING, ...SUMMER]);
    const village = NEIGHBOURHOODS.find((h) => h.id === "hollowmere")!;
    expect(village.routes).toEqual(SUMMER.map((r) => r.id));
    expect(village.slots).toBe(HOLLOWMERE_SLOTS);
    expect(reservedSlots(village)).toEqual([]);
    SUMMER.forEach((route, i) => expect(LANES[route.id]).toBe(HOLLOWMERE_SLOTS[i]));
  });

  it("carries every binding delivery in relative satchel order", () => {
    SUMMER.forEach((route, i) => {
      const actual = route.parcels.map((p) => `${p.kind}:${route.houses[p.to]}`);
      let next = 0;
      for (const parcel of actual) if (parcel === required[i][next]) next++;
      expect(next, route.id).toBe(required[i].length);
      expect(Object.values(route.houses).every((h) => ["sh1", "sh2", "sh3"].includes(h))).toBe(true);
    });
    expect(SUMMER[9].parcels.some((p) => p.kind === "letter")).toBe(false);
  });

  it("uses neutral house ids with the requested existing art", () => {
    for (const [id, style] of [["sh1", "tea"], ["sh2", "burrow"], ["sh3", "mush"]] as const) {
      expect(NEIGHBOURS[id]).toMatchObject({ id, house: id, who: id, sym: NEIGHBOURS[style].sym, vb: NEIGHBOURS[style].vb, w: NEIGHBOURS[style].w, h: NEIGHBOURS[style].h });
    }
    expect(HOLLOWMERE_SLOTS.every((s) => ["sh1", "sh2", "sh3"].includes(s.style))).toBe(true);
  });

  it("follows the board and par curve and brings the spring rules back", () => {
    expect(SUMMER.map((r) => r.par)).toEqual([3, 4, 4, 4, 5, 5, 5, 6, 6, 7]);
    expect(SUMMER.map((r) => parse(r).w)).toEqual([5, 5, 5, 5, 6, 5, 6, 6, 6, 6]);
    for (const r of SUMMER) {
      expect(parse(r).h).toBe(5);
      expect(r.blurb.length && r.teach.length && r.tag?.length, r.id).toBeTruthy();
      expect(parse(r).init.some((v) => v & SUN), r.id).toBe(true);
    }
    for (const i of [2, 6]) expect(parse(SUMMER[i]).init.filter((v) => v & SUN)).toHaveLength(2);
    expect(SUMMER[3].parcels.some((p) => p.kind === "pie")).toBe(true);
    expect(SUMMER[4].sunday).toBe(true);
    expect(parse(SUMMER[4]).kind).toContain("bridge");
    expect(SUMMER[5].parcels).toContainEqual({ to: "A", kind: "signed", key: "C" });
    for (const kind of ["parcel", "pie", "signed", "cat"]) expect(SUMMER[9].parcels.some((p) => p.kind === kind)).toBe(true);
  });

  it("walks through a sunflower in the intro and wraps a sunflower in route eight", () => {
    const audit = (index: number) => {
      const r = SUMMER[index], P = parse(r);
      let v = P.init, ids = P.init.map((x, i) => x & SUN ? i : -1), next = 0, moved = false, wrapped = false, walked = false;
      const used = new Set<number>();
      for (const [j, m] of r.solution.moves.entries()) {
        if (m.t !== "r") {
          const line = m.t === "row" ? P.rowsM[m.y] : P.colsM[m.x];
          const source = m.d === 1 ? line.at(-1)! : line[0];
          wrapped ||= !!(v[source] & SUN);
          moved ||= slide(P, v, m).some((x, i) => !!(x & SUN) && !(v[i] & SUN));
        }
        if (m.t !== "r") ids = slide(P, ids, m);
        v = step(P, v, m, j + 1);
        for (const delivery of deliverChain(P, v, r.solution.order, next)) {
          walked ||= delivery.path.some((i) => !!(v[i] & SUN));
          for (const i of delivery.path) if (v[i] & SUN) used.add(ids[i]);
          next++;
        }
      }
      return { moved, wrapped, walked, used: used.size };
    };
    expect(audit(0)).toMatchObject({ walked: true });
    expect(audit(7)).toMatchObject({ wrapped: true, walked: true });
    expect(audit(2).used).toBeGreaterThanOrEqual(1);
    expect(audit(6).used).toBeGreaterThanOrEqual(1);
  });
});

describe("summer routes need the sunflowers", () => {
  it("cannot be solved at par with sunflowers frozen as ordinary tiles", () => {
    // An ordinary rotatable tile can do everything a fixed one can, so this also covers fixed sunflowers.
    for (const route of SUMMER) {
      const frozen = parse({ ...route, grid: route.grid.map((row) => row.replace(/@/g, "")) });
      for (const order of validOrders(route)) {
        const r = solveOrder(frozen, order, route.par, 6e6);
        expect(r.capped, `${route.id} order ${order}`).toBeFalsy();
        expect(r.par, `${route.id} order ${order} solves at par without the sunflower`).toBeNull();
      }
    }
  });
});
