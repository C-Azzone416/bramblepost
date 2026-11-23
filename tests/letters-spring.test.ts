/** The shipped spring letters (#8): placements are real letter parcels, text is short, and every thread can be read through in route order. */
import { describe, expect, it } from "vitest";
import { SPRING as ROUTES } from "../src/levels";
import { NEIGHBOUR_IDS } from "../src/letters/cast";
import { isMet } from "../src/letters/rules";
import { SPRING_LETTERS, SPRING_SLOTS, assertUniquePlacements } from "../src/letters/registry";
import type { Requirement } from "../src/letters";
import { NEIGHBOURS } from "../src/ui/cast";

const routeIndex = (id: string) => ROUTES.findIndex((r) => r.id === id);
const parcelOf = (l: (typeof SPRING_LETTERS)[number]) => ROUTES[routeIndex(l.placement!.route)]?.parcels[l.placement!.slot];
// Swap alternates (#9) share their default's placement; the checks below that expect one letter per slot look at the defaults,
// reading an alternate id in a requirement as its default (so `any` of both versions counts as needing the slot).
const ALT_OF = new Map(SPRING_SLOTS.flatMap((s) => Object.values(s.by ?? {}).filter((id) => id !== s.letter).map((id) => [id, s.letter] as const)));
const canon = (id: string) => ALT_OF.get(id) ?? id;
const DEFAULTS = SPRING_LETTERS.filter((l) => !ALT_OF.has(l.id));
const reqLetters = (r: Requirement | undefined): string[] =>
  !r ? [] : r.kind === "read" ? [canon(r.letter)] : r.kind === "flag" ? [] : r.of.flatMap(reqLetters);
const threads = [...new Set(SPRING_LETTERS.map((l) => l.thread))];

describe("spring letters", () => {
  it("ids are unique and only versions of a swap slot share a slot", () => {
    expect(new Set(SPRING_LETTERS.map((l) => l.id)).size).toBe(SPRING_LETTERS.length);
    expect(() => assertUniquePlacements(SPRING_LETTERS, SPRING_SLOTS)).not.toThrow();
    expect(() => assertUniquePlacements(SPRING_LETTERS, [])).toThrow(/both ride/);
  });

  it("recipients are valid neighbour ids", () => {
    for (const l of SPRING_LETTERS) expect(NEIGHBOUR_IDS, l.id).toContain(l.recipient);
  });

  it("every letter rides a real parcel (untucked ones a letter or signed parcel), delivered to its recipient's house", () => {
    for (const l of SPRING_LETTERS) {
      expect(l.placement, l.id).toBeDefined();
      expect(routeIndex(l.placement!.route), `${l.id} route`).toBeGreaterThanOrEqual(0);
      const p = parcelOf(l);
      expect(p, `${l.id} slot`).toBeDefined();
      if (!l.placement!.tucked) expect(["letter", "signed"], l.id).toContain(p!.kind);
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
      const riding = DEFAULTS.filter((l) => l.placement!.route === route.id).sort((a, b) => a.placement!.slot - b.placement!.slot);
      for (const l of riding) {
        expect(isMet(l.requires, { read, flags: {} }), `${l.id} on ${route.id} needs ${reqLetters(l.requires)}`).toBe(true);
        read.add(l.id);
      }
    }
    expect([...read].sort()).toEqual(DEFAULTS.map((l) => l.id).sort());
  });

  it("requirements only name real letters, and need no door reply", () => {
    const ids = new Set(DEFAULTS.map((l) => l.id));
    for (const l of SPRING_LETTERS) {
      for (const dep of reqLetters(l.requires)) expect(ids, `${l.id} requires ${dep}`).toContain(dep);
      expect(JSON.stringify(l.requires ?? {}), l.id).not.toContain('"flag"');
    }
  });

  it("each thread keeps its opening and closing letters", () => {
    expect([...threads].sort()).toEqual(["carrots", "fair", "supper", "tunnel"]);
    for (const t of threads) expect(DEFAULTS.filter((l) => l.thread === t).length, t).toBeGreaterThanOrEqual(2);
  });

  it("no thread dead-ends: every letter but the last is required by a later letter of its own thread", () => {
    const intendedLast: Record<string, string> = { fair: "fair-3", tunnel: "tunnel-4", supper: "supper-5", carrots: "carrots-3" };
    const needs = (r: Requirement | undefined, id: string): boolean =>
      !r ? false : r.kind === "read" ? canon(r.letter) === id : r.kind === "flag" ? false : r.kind === "all" ? r.of.some((c) => needs(c, id)) : r.of.every((c) => needs(c, id));
    for (const t of threads) {
      const all = DEFAULTS.filter((l) => l.thread === t);
      const mine = [...all].sort((a, b) => routeIndex(a.placement!.route) - routeIndex(b.placement!.route) || a.placement!.slot - b.placement!.slot);
      expect(mine[mine.length - 1].id, `${t} last letter`).toBe(intendedLast[t]);
      mine.slice(0, -1).forEach((l, i) => {
        const later = mine.slice(i + 1);
        expect(later.some((m) => needs(m.requires, l.id)), `${l.id} is not required by a later ${t} letter`).toBe(true);
      });
      expect(all.filter((l) => !l.requires), `${t} starts once`).toHaveLength(1);
    }
  });

  it("no single letter gives away its thread's secret", () => {
    const revealWords: Record<string, string[]> = { supper: ["Spring Supper", "long table", "supper"] };
    for (const l of SPRING_LETTERS) {
      for (const w of revealWords[l.thread] ?? []) {
        expect(l.body.join(" ").toLowerCase(), `${l.id} gives away "${w}"`).not.toContain(w.toLowerCase());
      }
    }
  });
});
