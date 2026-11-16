/** Structure checks for content packs (src/content/check.ts). Failures show codes, ids and counts only: never pack text. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Requirement } from "../src/letters/types";
import { checkPack, checkStructure, sweepPlaythroughs } from "../src/content/check";
import standInJson from "../src/content/stand-in-pack.json";
import { STANDARD_PACK } from "../src/content/standard";
import type { ContentPack } from "../src/content/types";

const standIn = standInJson as unknown as ContentPack;

describe("stand-in pack structure", () => {
  it("has no structural problems", () => {
    expect(checkStructure(standIn)).toEqual([]);
  });

  it("every combination of door replies reads one letter per slot with nothing locked", () => {
    const t = performance.now();
    const sweep = sweepPlaythroughs(standIn);
    const ms = Math.round(performance.now() - t);
    console.log(`stand-in sweep: ${sweep.combos} combinations, ${sweep.expected} slots per playthrough, ${sweep.failures} failures, ${ms} ms`);
    expect(sweep.combos).toBe(2 ** standIn.scenes.length);
    expect(sweep.expected).toBe(new Set(standIn.letters.map((l) => `${l.placement!.route}#${l.placement!.slot}`)).size);
    expect(sweep.problems).toEqual([]);
  });
});

describe("standard pack structure", () => {
  it("has no structural problems", () => {
    expect(checkPack(STANDARD_PACK)).toEqual([]);
  });
});

describe("the checker finds problems (synthetic copies of the stand-in pack)", () => {
  const copy = (): ContentPack => JSON.parse(JSON.stringify(standIn));
  const codes = (p: ContentPack) => checkStructure(p).map((x) => x.split(":")[0]);

  it("flags a duplicate letter id, a wrong recipient and a bad placement", () => {
    const dup = copy();
    dup.letters[1].id = dup.letters[0].id;
    expect(codes(dup)).toContain("dup-letter");
    const wrong = copy();
    wrong.letters[0].recipient = wrong.letters[0].recipient === "bea" ? "clementine" : "bea";
    expect(codes(wrong)).toContain("recipient");
    const lost = copy();
    lost.letters[0].placement!.slot = 99;
    expect(codes(lost)).toContain("placement");
  });

  it("flags an untucked letter on a non-letter parcel, and a flag that reaches an earlier route", () => {
    const p = copy();
    const t = p.letters.find((l) => l.placement?.tucked)!;
    t.placement!.tucked = false;
    expect(codes(p)).toContain("untucked-kind");
    const q = copy();
    q.slots.find((s) => s.flag)!.flag = q.scenes[q.scenes.length - 1].flag;
    expect(codes(q)).toContain("flag-order");
  });

  it("flags a locked letter in the sweep, with a structurally valid but unmet requirement", () => {
    const p = copy();
    const inSlot = new Set(p.slots.flatMap((s) => [s.letter, ...Object.values(s.by ?? {}), ...(s.cases ?? []).map((c) => c.letter)]));
    const later = p.letters.find((l) => !inSlot.has(l.id) && p.scenes.findIndex((s) => s.route === l.placement!.route) > 0)!;
    later.requires = { kind: "flag", key: p.scenes[0].flag, value: p.scenes[0].choices[0].id };
    expect(checkStructure(p)).toEqual([]);
    const sweep = sweepPlaythroughs(p);
    expect(sweep.failures).toBe(sweep.combos / 2);
    expect(sweep.problems.some((x) => x.startsWith("playthrough:"))).toBe(true);
  });

  it("the sweep models the route queue: a requirement on a letter of the same route is locked", () => {
    const p = copy();
    const route = p.letters.find((l) => p.letters.filter((m) => m.placement!.route === l.placement!.route && m.placement!.slot > l.placement!.slot).length > 0)!.placement!.route;
    const here = p.letters.filter((l) => l.placement!.route === route);
    const first = here.reduce((a, b) => (b.placement!.slot < a.placement!.slot ? b : a));
    const second = here.filter((l) => l.placement!.slot !== first.placement!.slot).reduce((a, b) => (b.placement!.slot < a.placement!.slot ? b : a));
    for (const l of here.filter((x) => x.placement!.slot === second.placement!.slot)) l.requires = { kind: "read", letter: first.id };
    expect(checkStructure(p)).toEqual([]);
    expect(sweepPlaythroughs(p).failures).toBeGreaterThan(0);
  });

  it("flags a duplicate door flag", () => {
    const p = copy();
    p.scenes[1].flag = p.scenes[0].flag;
    expect(checkStructure(p)).toContain(`dup-flag:${p.scenes[0].flag}`);
  });

  it("flags a swap version on a different placement", () => {
    const p = copy();
    const alt = p.slots.flatMap((s) => Object.values(s.by ?? {}).filter((id) => id !== s.letter))[0];
    const moved = p.letters.find((l) => l.id === alt)!;
    moved.placement = { ...moved.placement!, route: p.scenes[p.scenes.length - 1].route, slot: 0 };
    expect(codes(p)).toContain("slot-versions");
  });

  it("flags a bad letter, flag or value in a requirement", () => {
    const run = (r: Requirement) => {
      const p = copy();
      p.letters[0].requires = r;
      return checkStructure(p);
    };
    expect(run({ kind: "read", letter: "no-such-letter" })).toContain(`req-letter:${standIn.letters[0].id}`);
    expect(run({ kind: "flag", key: "no-such-flag", value: "a" })).toContain(`req-flag:${standIn.letters[0].id}`);
    expect(run({ kind: "flag", key: standIn.scenes[0].flag, value: "no-such-value" })).toContain(`req-flag:${standIn.letters[0].id}`);
  });

  it("flags lines of 140 characters but not 139, and labels over 32 but not 32", () => {
    const withLine = (n: number) => {
      const p = copy();
      p.letters[0].body[0] = "x".repeat(n);
      return checkStructure(p);
    };
    const withLabel = (n: number) => {
      const p = copy();
      p.scenes[0].choices[0].label = "x".repeat(n);
      return checkStructure(p);
    };
    expect(withLine(139)).toEqual([]);
    expect(withLine(140)).toEqual(["long-lines:1"]);
    expect(withLabel(32)).toEqual([]);
    expect(withLabel(33)).toEqual(["long-labels:1"]);
  });
});

// Local only: runs when BRAMBLEPOST_STORY_PACK points at an existing file, so it is always skipped in CI.
const storyFile = process.env.BRAMBLEPOST_STORY_PACK?.replace(/^~(?=\/)/, os.homedir());
describe.skipIf(!!process.env.CI || !storyFile || !fs.existsSync(storyFile))("story pack structure (local only; prints counts only)", () => {
  it("has no structural problems", () => {
    const pack = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.resolve(storyFile!), "utf8"), "base64")).toString("utf8")) as ContentPack;
    const problems = checkPack(pack);
    const sweep = sweepPlaythroughs(pack);
    console.log(`story pack: ${problems.length} problems, ${sweep.combos} combinations, ${sweep.failures} failures`);
    if (problems.length) console.log(problems.join(" "));
    expect(problems.length).toBe(0);
  });
});
