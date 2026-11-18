/** Structure checks for content packs (src/content/check.ts). Failures show codes, ids and counts only: never pack text. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Requirement } from "../src/letters/types";
import { decodePack } from "../tools/leak-check";
import { CANARY } from "../vite-plugins/content-pack";
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

/** Reads an encoded pack file for the local-only check. Fails with a fixed message, never with file or error text. */
function readLocalPack(file: string): ContentPack {
  let pack: unknown;
  try {
    pack = decodePack(fs.readFileSync(file, "utf8"));
  } catch {
    pack = undefined;
  }
  if (!pack) throw new Error("pack could not be decoded");
  return pack as ContentPack;
}

describe("local pack reading", () => {
  it("fails with a fixed message and no file text on invalid files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-structure-test-"));
    const fake = "FAKE-PAYLOAD-TEXT-NOT-A-PACK";
    const encode = (text: string) => zlib.gzipSync(text).toString("base64");
    try {
      const files: Record<string, string> = {
        "garbage.b64": fake,
        "bad-json.b64": encode(`{"a": ${fake}}`), // JSON.parse would quote this in its message
        "no-marker.b64": encode(JSON.stringify({ canary: "wrong", text: fake })),
        "empty.b64": "",
      };
      for (const [name, text] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), text);
        let message = "";
        try {
          readLocalPack(path.join(dir, name));
        } catch (e) {
          message = String((e as Error).message);
        }
        expect(message).toBe("pack could not be decoded");
      }
      let missing = "";
      try {
        readLocalPack(path.join(dir, "no-such-file.b64"));
      } catch (e) {
        missing = String((e as Error).message);
      }
      expect(missing).toBe("pack could not be decoded");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a valid synthetic file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-structure-test-"));
    try {
      fs.writeFileSync(path.join(dir, "ok.b64"), zlib.gzipSync(JSON.stringify({ ...standIn, canary: CANARY })).toString("base64"));
      expect(readLocalPack(path.join(dir, "ok.b64")).scenes).toHaveLength(standIn.scenes.length);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * What the local-only test may say about a real pack: problem codes and counts, never the ids after the colon
 * (a real pack's ids and flags could be descriptive). Throws only a fixed message.
 */
function packReport(pack: ContentPack) {
  try {
    const sweep = sweepPlaythroughs(pack);
    const problems = [...checkStructure(pack), ...sweep.problems];
    const counts = new Map<string, number>();
    for (const p of problems) {
      const code = p.split(":")[0];
      const safe = /^[a-z]+(-[a-z]+)*$/.test(code) && code.length <= 24 ? code : "other";
      counts.set(safe, (counts.get(safe) ?? 0) + 1);
    }
    const codes = [...counts].map(([c, n]) => `${c} x${n}`).join(", ");
    return { total: problems.length, codes, line: `story pack: ${problems.length} problems${codes ? ` (${codes})` : ""}, ${sweep.combos} combinations, ${sweep.failures} failures` };
  } catch {
    throw new Error("pack check could not run"); // an error from the checks could quote pack text
  }
}

describe("local pack report", () => {
  const SENTINEL = "SENTINEL-ID-TEXT";

  it("summarises problems as codes and counts, with no ids", () => {
    const pack = JSON.parse(JSON.stringify(standIn)) as ContentPack;
    pack.letters[0].id = `${SENTINEL}-1`;
    pack.letters[0].recipient = "no-such-neighbour" as never; // recipient problem
    pack.letters[1].id = `${SENTINEL}-2`;
    pack.letters[1].placement = undefined; // placement problem
    pack.scenes[0].flag = `${SENTINEL}-flag`;
    expect(checkStructure(pack).join(" ")).toContain(SENTINEL); // the checker itself does put ids in its problems
    const report = packReport(pack);
    expect(report.total).toBeGreaterThan(0);
    let failure = "";
    try {
      expect(report.total).toBe(0); // what the local-only test does when problems exist
    } catch (e) {
      failure = String((e as Error).message);
    }
    expect(failure).not.toBe("");
    for (const text of [failure, report.line, report.codes]) expect(text).not.toContain(SENTINEL);
    expect(report.codes).toMatch(/^[a-z]+(-[a-z]+)* x\d+(, [a-z]+(-[a-z]+)* x\d+)*$/);
    expect(report.line).toMatch(/^story pack: \d+ problems \(.+\), \d+ combinations, \d+ failures$/);
  });

  it("is clean for the stand-in pack", () => {
    expect(packReport(standIn)).toMatchObject({ total: 0, codes: "" });
  });
});

// Local only: runs when BRAMBLEPOST_STORY_PACK points at an existing file, so it is always skipped in CI.
const storyFile = process.env.BRAMBLEPOST_STORY_PACK?.replace(/^~(?=\/)/, os.homedir());
describe.skipIf(!!process.env.CI || !storyFile || !fs.existsSync(storyFile))("story pack structure (local only; prints counts only)", () => {
  it("has no structural problems", () => {
    const report = packReport(readLocalPack(path.resolve(storyFile!)));
    console.log(report.line);
    expect(report.total).toBe(0);
  });
});

describe("later season structure", () => {
  const laterPack = (): ContentPack => {
    const p = structuredClone(standIn);
    const season = p.seasons!.summer!;
    season.houses = ["test-house"];
    season.routes = Array.from({ length: 10 }, (_, i) => ({ id: `test-${i}`, parcels: i === 9 ? [] : ["letter:test-house"] }));
    const letter = structuredClone(p.letters[0]);
    letter.id = "later-letter";
    letter.recipient = "test-house" as typeof letter.recipient;
    letter.placement = { route: "test-2", slot: 0 };
    delete letter.requires;
    season.letters = [letter];
    season.slots = [];
    const scene = structuredClone(p.scenes[0]);
    scene.route = "test-1";
    scene.flag = "test-flag";
    scene.lines = ["placeholder"];
    season.scenes = [scene];
    return p;
  };

  it("validates later placements and recipients", () => {
    const p = laterPack();
    expect(checkStructure(p)).not.toContain("placement:later-letter");
    expect(checkStructure(p)).not.toContain("recipient:later-letter");
    p.seasons!.summer!.letters[0].recipient = "wrong" as never;
    expect(checkStructure(p)).toContain("recipient:later-letter");
    p.seasons!.summer!.letters[0].placement!.slot = 99;
    expect(checkStructure(p)).toContain("placement:later-letter");
  });

  it("orders flags across later routes", () => {
    const p = laterPack();
    const season = p.seasons!.summer!;
    season.letters[0].requires = { kind: "flag", key: "test-flag", value: season.scenes[0].choices[0].id };
    expect(checkStructure(p)).not.toContain("flag-order:later-letter");
    season.scenes[0].route = "test-2";
    expect(checkStructure(p)).toContain("flag-order:later-letter");
    season.scenes[0].route = "test-3";
    expect(checkStructure(p)).toContain("flag-order:later-letter");
  });

  it("uses season order even if pack keys were inserted out of order", () => {
    const p = laterPack();
    const summer = p.seasons!.summer!;
    const autumn = p.seasons!.autumn!;
    autumn.routes = Array.from({ length: 10 }, (_, i) => ({ id: `autumn-${i}`, parcels: [] }));
    autumn.scenes = [structuredClone(summer.scenes[0])];
    autumn.scenes[0].flag = "autumn-flag";
    autumn.scenes[0].route = "autumn-0";
    summer.letters[0].requires = { kind: "flag", key: "autumn-flag", value: autumn.scenes[0].choices[0].id };
    p.seasons = { autumn, summer };
    expect(checkStructure(p)).toContain("flag-order:later-letter");
  });

  it("requires ten routes when populated and unique ids across seasons", () => {
    const p = laterPack();
    expect(checkStructure(p).filter((x) => x.startsWith("route-count:") || x.startsWith("dup-route:"))).toEqual([]);
    p.seasons!.summer!.routes!.pop();
    expect(checkStructure(p)).toContain("route-count:summer");
    p.seasons!.summer!.routes![0].id = p.scenes[0].route;
    expect(checkStructure(p)).toContain(`dup-route:${p.scenes[0].route}`);
    p.seasons!.autumn!.routes = [{ id: "test-1", parcels: [] }];
    expect(checkStructure(p)).toContain("dup-route:test-1");
  });
});
