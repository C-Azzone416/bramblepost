/** Structure checks for content packs (src/content/check.ts). Failures show codes, ids and counts only: never pack text. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
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

  it("flags a locked letter in the sweep", () => {
    const p = copy();
    p.letters[p.letters.length - 1].requires = { kind: "flag", key: p.scenes[0].flag, value: "nope" };
    expect(sweepPlaythroughs(p).failures + checkStructure(p).length).toBeGreaterThan(0);
  });
});

// Local only: runs when BRAMBLEPOST_STORY_PACK points at an existing file, so it is always skipped in CI.
const storyFile = process.env.BRAMBLEPOST_STORY_PACK?.replace(/^~(?=\/)/, os.homedir());
describe.skipIf(!storyFile || !fs.existsSync(storyFile))("story pack structure (local only; prints counts only)", () => {
  it("has no structural problems", () => {
    const pack = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.resolve(storyFile!), "utf8"), "base64")).toString("utf8")) as ContentPack;
    const problems = checkPack(pack);
    const sweep = sweepPlaythroughs(pack);
    console.log(`story pack: ${problems.length} problems, ${sweep.combos} combinations, ${sweep.failures} failures`);
    if (problems.length) console.log(problems.join(" "));
    expect(problems.length).toBe(0);
  });
});
