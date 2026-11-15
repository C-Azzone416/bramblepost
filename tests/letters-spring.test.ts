/** The shipped spring letters (#8): placements are real letter parcels, text is short, and every thread can be read through in route order. */
import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { NEIGHBOUR_IDS } from "../src/letters/cast";
import { isMet } from "../src/letters/rules";
import { SPRING_LETTERS, assertUniquePlacements } from "../src/letters/registry";
import type { Requirement } from "../src/letters";
import { NEIGHBOURS } from "../src/ui/cast";

const routeIndex = (id: string) => ROUTES.findIndex((r) => r.id === id);
const parcelOf = (l: (typeof SPRING_LETTERS)[number]) => ROUTES[routeIndex(l.placement!.route)]?.parcels[l.placement!.slot];
const reqLetters = (r: Requirement | undefined): string[] =>
  !r ? [] : r.kind === "read" ? [r.letter] : r.kind === "flag" ? [] : r.of.flatMap(reqLetters);
const threads = [...new Set(SPRING_LETTERS.map((l) => l.thread))];

describe("spring letters", () => {
  it("ids are unique and no two letters share a slot", () => {
    expect(new Set(SPRING_LETTERS.map((l) => l.id)).size).toBe(SPRING_LETTERS.length);
    expect(() => assertUniquePlacements(SPRING_LETTERS)).not.toThrow();
  });

  it("recipients are valid neighbour ids", () => {
    for (const l of SPRING_LETTERS) expect(NEIGHBOUR_IDS, l.id).toContain(l.recipient);
  });

  it("every letter rides a real letter or signed parcel, delivered to its recipient's house", () => {
    for (const l of SPRING_LETTERS) {
      expect(l.placement, l.id).toBeDefined();
      expect(routeIndex(l.placement!.route), `${l.id} route`).toBeGreaterThanOrEqual(0);
      const p = parcelOf(l);
      expect(p, `${l.id} slot`).toBeDefined();
      expect(["letter", "signed"], l.id).toContain(p!.kind);
      const route = ROUTES[routeIndex(l.placement!.route)];
      expect(NEIGHBOURS[route.houses[p!.to]].id, `${l.id} house`).toBe(l.recipient);
    }
  });

  it("the final route carries no letter", () => {
    expect(SPRING_LETTERS.filter((l) => l.placement!.route === ROUTES[ROUTES.length - 1].id)).toEqual([]);
  });

  it("envelope and body lines are under 140 characters, and nothing is empty", () => {
    for (const l of SPRING_LETTERS) {
      expect(l.body.length, l.id).toBeGreaterThan(0);
      for (const line of [l.envelope, l.sender, ...l.body]) {
        expect(line.trim().length, l.id).toBeGreaterThan(0);
        expect(line.length, `${l.id}: ${line}`).toBeLessThan(140);
      }
    }
  });

  it("every letter can be read, simulating a play-through in route order", () => {
    const read = new Set<string>();
    for (const route of ROUTES) {
      const riding = SPRING_LETTERS.filter((l) => l.placement!.route === route.id).sort((a, b) => a.placement!.slot - b.placement!.slot);
      for (const l of riding) {
        expect(isMet(l.requires, { read, flags: {} }), `${l.id} on ${route.id} needs ${reqLetters(l.requires)}`).toBe(true);
        read.add(l.id);
      }
    }
    expect([...read].sort()).toEqual(SPRING_LETTERS.map((l) => l.id).sort());
  });

  it("requirements only name real letters, and need no door reply", () => {
    const ids = new Set(SPRING_LETTERS.map((l) => l.id));
    for (const l of SPRING_LETTERS) {
      for (const dep of reqLetters(l.requires)) expect(ids, `${l.id} requires ${dep}`).toContain(dep);
      expect(JSON.stringify(l.requires ?? {}), l.id).not.toContain('"flag"');
    }
  });

  it("each thread has at least 3 letters", () => {
    expect([...threads].sort()).toEqual(["carrots", "fair", "supper", "tunnel"]);
    for (const t of threads) expect(SPRING_LETTERS.filter((l) => l.thread === t).length, t).toBeGreaterThanOrEqual(3);
  });

  it("no thread dead-ends: every letter but the last of its thread leads on to another", () => {
    for (const t of threads) {
      const all = SPRING_LETTERS.filter((l) => l.thread === t);
      const mine = [...all].sort((a, b) => routeIndex(a.placement!.route) - routeIndex(b.placement!.route) || a.placement!.slot - b.placement!.slot);
      const needed = new Set(SPRING_LETTERS.flatMap((l) => reqLetters(l.requires)));
      for (const l of mine.slice(0, -1)) expect(needed, `${l.id} leads nowhere`).toContain(l.id);
      expect(all.filter((l) => !l.requires), `${t} starts once`).toHaveLength(1);
    }
  });
});
