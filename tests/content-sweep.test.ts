/** In-memory sweep oracle and later-season regressions. No story files are loaded. */
import { describe, expect, it } from "vitest";
import { checkStructure, MAX_SWEEP_STATES, sweepPlaythroughs } from "../src/content/check";
import type { Sweep } from "../src/content/check";
import { STANDARD_PACK } from "../src/content/standard";
import type { ContentPack } from "../src/content/types";
import standInJson from "../src/content/stand-in-pack.json";
import { AUTUMN, SPRING, SUMMER, WINTER } from "../src/levels";
import { NEIGHBOURHOODS } from "../src/village/data";
import { isMet, letterForSlot } from "../src/letters/rules";
import type { Letter, LetterSlot, Requirement } from "../src/letters/types";

const standIn = standInJson as unknown as ContentPack;
/** The spring and summer routes, which are the ones the synthetic packs below place letters and scenes on. */
const ROUTES = [...SPRING, ...SUMMER];
const versions = (s: LetterSlot) => [s.letter, ...Object.values(s.by ?? {}), ...(s.cases ?? []).map((c) => c.letter)];

/** Independent enumeration of the original algorithm; deliberately keeps every flag and read. */
function bruteForce(original: ContentPack): Sweep {
  const seasons = [original, ...(["summer", "autumn", "winter"] as const).flatMap((s) => original.seasons?.[s] ? [original.seasons[s]!] : [])];
  const letters = seasons.flatMap((s) => s.letters);
  const scenes = seasons.flatMap((s) => s.scenes);
  const slots = seasons.flatMap((s) => s.slots);
  const byId = new Map(letters.map((l) => [l.id, l]));
  const slotOf = new Map(slots.flatMap((s) => versions(s).map((id) => [id, s] as const)));
  const plan = ROUTES.map((r) => {
    const at = new Map<number, Letter>();
    for (const l of letters.filter((l) => l.placement?.route === r.id).sort((a, b) => a.placement!.slot - b.placement!.slot)) {
      if (!at.has(l.placement!.slot)) at.set(l.placement!.slot, l);
    }
    return { scene: scenes.find((s) => s.route === r.id), items: [...at.values()] };
  });
  const n = plan.filter((p) => p.scene).length;
  if (n > 16) throw new Error("oracle is restricted to at most 16 flags");
  const combos = 2 ** n;
  const expected = plan.reduce((sum, p) => sum + p.items.length, 0);
  let failures = 0;
  const bad: number[] = [];
  for (let mask = 0; mask < combos; mask++) {
    const flags: Record<string, string> = {};
    const read = new Set<string>();
    let locked = 0;
    let bit = 0;
    for (const p of plan) {
      if (p.scene) flags[p.scene.flag] = p.scene.choices[(mask >> bit++) & 1].id;
      const before = new Set(read);
      for (const item of p.items) {
        const slot = slotOf.get(item.id);
        const letter = slot ? byId.get(letterForSlot(slot, flags, before)) : item;
        if (letter && isMet(letter.requires, { read: before, flags })) read.add(letter.id);
        else locked++;
      }
    }
    if (locked || read.size !== expected) {
      failures++;
      if (bad.length < 3) bad.push(mask);
    }
  }
  return { combos, expected, failures, problems: failures ? [`playthrough:${failures}-of-${combos}`, ...bad.map((m) => `playthrough-sample:${m}`)] : [] };
}

function syntheticPack(flags = 20): ContentPack {
  const pack = structuredClone(standIn);
  pack.scenes = [];
  pack.letters = [];
  pack.slots = [];
  pack.seasons = { summer: { scenes: [], letters: [], slots: [], houses: [], routes: SUMMER.map((r) => ({ id: r.id, parcels: [] })) } };
  pack.ending = { route: ROUTES.at(-1)!.id, kicker: [{ say: "end" }], title: [], envelope: [], lines: [] };
  ROUTES.forEach((route, i) => {
    const season = i < SPRING.length ? pack : pack.seasons!.summer!;
    if (i < flags) {
      const scene = structuredClone(standIn.scenes[0]);
      scene.route = route.id;
      scene.flag = `flag-${i}`;
      scene.lines = ["test"];
      scene.choices[0].id = "a";
      scene.choices[1].id = "b";
      season.scenes.push(scene);
    }
    const letter = structuredClone(standIn.letters[0]);
    letter.id = `letter-${i}`;
    letter.placement = { route: route.id, slot: 0 };
    delete letter.requires;
    season.letters.push(letter);
  });
  return pack;
}

function populatedSummer(): ContentPack {
  const pack = structuredClone(standIn);
  pack.seasons!.summer!.routes = SUMMER.map((r) => ({ id: r.id, parcels: [] }));
  return pack;
}

describe("game route ids in season packs", () => {
  it("allows the game's summer ids in order", () => expect(checkStructure(populatedSummer())).toEqual([]));
  it("reports wrong order", () => {
    const p = populatedSummer();
    p.seasons!.summer!.routes!.reverse();
    expect(checkStructure(p)).toEqual(["route-order:summer"]);
  });
  it("rejects a spring game id reused in summer", () => {
    const p = populatedSummer();
    p.seasons!.summer!.routes![0].id = SPRING[0].id;
    expect(checkStructure(p)).toContain(`dup-route:${SPRING[0].id}`);
  });
  it("rejects repetition within a season and across pack seasons", () => {
    const p = populatedSummer();
    p.seasons!.summer!.routes![1].id = SUMMER[0].id;
    expect(checkStructure(p)).toContain(`dup-route:${SUMMER[0].id}`);
    p.seasons!.autumn!.routes = [{ id: SUMMER[2].id, parcels: [] }];
    expect(checkStructure(p)).toContain(`dup-route:${SUMMER[2].id}`);
  });
  it("allows unique invented ids for a season the game has no routes for (synthetic: winter's routes taken off the map for the test)", () => {
    // Every season now has game routes, so the "no game routes yet" case is kept alive by emptying Snowberry End's list for this test only.
    const snowberry = NEIGHBOURHOODS.find((n) => n.id === "snowberry")!;
    const kept = snowberry.routes;
    try {
      snowberry.routes = [];
      const p = populatedSummer();
      p.seasons!.autumn!.routes = AUTUMN.map((r) => ({ id: r.id, parcels: [] }));
      p.seasons!.winter!.routes = Array.from({ length: 10 }, (_, i) => ({ id: `invented-${i}`, parcels: [] }));
      expect(checkStructure(p)).toEqual([]);
      p.seasons!.autumn!.routes![0].id = "invented-0";
      expect(checkStructure(p)).toContain("dup-route:invented-0");
    } finally {
      snowberry.routes = kept;
    }
  });
  it("accepts the real winter route ids in order, and rejects invented ones now that the game has winter routes", () => {
    const p = populatedSummer();
    p.seasons!.autumn!.routes = AUTUMN.map((r) => ({ id: r.id, parcels: [] }));
    p.seasons!.winter!.routes = WINTER.map((r) => ({ id: r.id, parcels: [] }));
    expect(checkStructure(p)).toEqual([]);
    p.seasons!.winter!.routes = Array.from({ length: 10 }, (_, i) => ({ id: `invented-${i}`, parcels: [] }));
    expect(checkStructure(p)).toContain("route-order:winter");
    p.seasons!.winter!.routes = [{ id: AUTUMN[0].id, parcels: [] }];
    expect(checkStructure(p)).toContain(`dup-route:${AUTUMN[0].id}`);
  });
  it("accepts the real autumn route ids in order, and rejects one reused in winter", () => {
    const p = populatedSummer();
    p.seasons!.autumn!.routes = AUTUMN.map((r) => ({ id: r.id, parcels: [] }));
    expect(checkStructure(p)).toEqual([]);
    p.seasons!.winter!.routes = [{ id: AUTUMN[0].id, parcels: [] }];
    expect(checkStructure(p)).toContain(`dup-route:${AUTUMN[0].id}`);
  });
});

describe("weighted forward playthrough sweep", () => {
  it("matches the complete brute-force result for standard and stand-in", () => {
    for (const p of [STANDARD_PACK, standIn]) expect(sweepPlaythroughs(p)).toEqual(bruteForce(p));
  });

  it("matches seeded random packs with nested requirements, versions, cases and cross-season reads", () => {
    let seed = 0x5ea50;
    const random = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    for (let trial = 0; trial < 25; trial++) {
      const n = trial === 24 ? 16 : random(10);
      const p = syntheticPack(n);
      const all = [p, p.seasons!.summer!];
      const req = (depth = 0): Requirement => {
        const kind = random(depth < 2 ? 4 : 2);
        if (kind === 0) return { kind: "flag", key: `flag-${random(Math.max(1, n))}`, value: random(2) ? "a" : "b" };
        if (kind === 1) return { kind: "read", letter: `letter-${random(20)}` };
        return { kind: kind === 2 ? "all" : "any", of: Array.from({ length: random(3) }, () => req(depth + 1)) };
      };
      for (const season of all) for (const letter of [...season.letters]) {
        if (random(3)) letter.requires = req();
        if (random(2)) {
          const alt = structuredClone(letter);
          alt.id = `${letter.id}-alt`;
          alt.requires = req();
          season.letters.push(alt);
          season.slots.push({ letter: letter.id, flag: `flag-${random(Math.max(1, n))}`, by: { a: alt.id }, cases: [{ if: req(), letter: alt.id }, { if: req(), letter: letter.id }] });
        }
      }
      // Force reads across the season boundary in both cases and letter requirements.
      p.seasons!.summer!.slots.push({ letter: "letter-10", cases: [{ if: { kind: "read", letter: "letter-0" }, letter: "letter-10" }] });
      p.seasons!.summer!.letters[1].requires = { kind: "flag", key: "flag-0", value: "a" };
      p.ending.lines = [[{ when: req(), say: "variant" }, { say: "fallback" }]];
      expect(sweepPlaythroughs(p), `seeded trial ${trial}, ${n} flags`).toEqual(bruteForce(p));
    }
  });

  it("completes all 2^20 spring and summer combinations with correct counts", () => {
    expect(sweepPlaythroughs(syntheticPack())).toEqual({ combos: 2 ** 20, expected: 20, failures: 0, problems: [] });
  });

  it("catches a structurally valid broken cross-season requirement with exact multiplicity and masks", () => {
    const p = populatedSummer();
    const summer = p.seasons!.summer!;
    summer.houses = ["test-house"];
    summer.routes![0].parcels = ["letter:test-house"];
    summer.scenes = syntheticPack().seasons!.summer!.scenes;
    const letter = structuredClone(standIn.letters[0]);
    letter.id = "summer-test";
    letter.recipient = "test-house" as typeof letter.recipient;
    letter.placement = { route: SUMMER[0].id, slot: 0 };
    letter.requires = { kind: "all", of: [
      { kind: "read", letter: standIn.letters[0].id },
      { kind: "flag", key: p.scenes[0].flag, value: p.scenes[0].choices[0].id },
    ] };
    summer.letters = [letter];
    expect(checkStructure(p)).toEqual([]);
    const expected = bruteForce(standIn).expected + 1;
    expect(sweepPlaythroughs(p)).toEqual({ combos: 2 ** 20, expected, failures: 2 ** 19,
      problems: ["playthrough:524288-of-1048576", "playthrough-sample:1", "playthrough-sample:3", "playthrough-sample:5"] });
  });

  it("preserves the before-route snapshot for cases and requirements", () => {
    const p = syntheticPack(4);
    const first = p.letters[0];
    const second = structuredClone(first);
    second.id = "same-route";
    second.placement!.slot = 1;
    second.requires = { kind: "read", letter: first.id };
    p.letters.push(second);
    p.slots.push({ letter: second.id, cases: [{ if: { kind: "read", letter: first.id }, letter: "missing" }] });
    expect(sweepPlaythroughs(p)).toEqual(bruteForce(p));
    expect(sweepPlaythroughs(p).failures).toBe(16);
  });

  it("caps distinct states and retains dependencies of every ending field and scene lines", () => {
    const p = syntheticPack(17);
    const refs = Array.from({ length: 17 }, (_, i): Requirement => ({ kind: "flag", key: `flag-${i}`, value: "a" }));
    p.ending.kicker = [{ when: { kind: "all", of: refs.slice(0, 4) }, say: "k" }, { say: "k" }];
    p.ending.title = [{ when: { kind: "all", of: refs.slice(4, 8) }, say: "t" }, { say: "t" }];
    p.ending.envelope = [{ when: { kind: "all", of: refs.slice(8, 12) }, say: "e" }, { say: "e" }];
    p.ending.lines = [[{ when: { kind: "all", of: refs.slice(12, 16) }, say: "l" }, { say: "l" }]];
    const scene = structuredClone(standIn.scenes[0]);
    scene.route = ROUTES.at(-1)!.id;
    scene.flag = "final-flag";
    scene.lines = [[{ if: { flag: "flag-16", is: "a" }, say: "v" }, { say: "fallback" }]];
    p.seasons!.summer!.scenes.push(scene);
    expect(MAX_SWEEP_STATES).toBe(2 ** 16);
    expect(sweepPlaythroughs(p)).toEqual({ combos: 0, expected: 20, failures: 0, problems: ["sweep-skipped:states"] });
  });
});
