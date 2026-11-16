/** The leak check's helpers, on synthetic data only: no real pack is read here. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allStrings, checkTracked, decodePack, scanDir, storyStrings } from "../tools/leak-check";
import { CANARY } from "../vite-plugins/content-pack";

const encode = (o: object) => zlib.gzipSync(JSON.stringify(o)).toString("base64");

// Stand-in-like text plus fake markers. Each marker is at least 24 characters.
const COMMON = "[stand-in] sp-09, line 2, shared text";
const FAKE_A = "[fake-marker] alpha line one, plain";
const FAKE_B = `[fake-marker] "quoted" it's, tab\tand ’ curly`;
const SHORT = "[fake] short";
const synthetic = { canary: CANARY, mode: "story", scenes: [{ lines: [COMMON, FAKE_A, SHORT] }], ending: { title: [{ say: FAKE_B }] } };
const known = [{ scenes: [{ lines: [COMMON] }] }];

describe("decodePack", () => {
  it("decodes a pack with the marker, and rejects everything else without throwing", () => {
    expect(decodePack(encode(synthetic))).toEqual(synthetic);
    expect(decodePack(encode({ canary: "wrong" }))).toBeUndefined();
    expect(decodePack(encode({ nope: 1 }))).toBeUndefined();
    expect(decodePack("not base64 gzip at all")).toBeUndefined();
    expect(decodePack("")).toBeUndefined();
  });
});

describe("storyStrings", () => {
  it("collects long strings that no known pack has", () => {
    expect(allStrings({ a: ["x", { b: "y" }], c: 1 })).toEqual(new Set(["x", "y"]));
    expect([...storyStrings(synthetic, known)].sort()).toEqual([FAKE_A, FAKE_B].sort());
  });
});

describe("scanDir", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-leak-test-"));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "index.html"), "<html>nothing here</html>");
    fs.writeFileSync(path.join(dir, "assets", "app.js"), `const a = ${JSON.stringify(COMMON)};`);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const strings = () => storyStrings(synthetic, known);

  it("finds nothing in a clean dist", () => {
    expect(scanDir(dir, strings())).toEqual({ files: [], found: 0 });
  });

  it("finds a planted string, raw or as a JS string literal, and reports file names and counts", () => {
    fs.writeFileSync(path.join(dir, "assets", "leak.js"), `x = ${JSON.stringify(FAKE_B)};`);
    fs.writeFileSync(path.join(dir, "notes.txt"), `raw ${FAKE_A} raw`);
    expect(scanDir(dir, strings())).toEqual({ files: ["assets/leak.js", "notes.txt"], found: 2 });
  });

  it("finds the marker on its own, in a binary file too", () => {
    fs.writeFileSync(path.join(dir, "blob.bin"), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(CANARY), Buffer.from([255])]));
    expect(scanDir(dir, [])).toEqual({ files: ["blob.bin"], found: 1 });
  });

  it("ignores text that is only in the known packs", () => {
    expect(scanDir(dir, storyStrings({ x: COMMON }, known)).found).toBe(0);
  });
});

describe("checkTracked", () => {
  const allowed = "content/story/story-pack.b64";
  const read = (contents: Record<string, string>) => (f: string) => (f in contents ? Buffer.from(contents[f]) : undefined);

  it("passes with only the allowed pack file", () => {
    const files = [allowed, "src/main.ts", "docs/story-notes.md"];
    expect(checkTracked(files, read({}), allowed)).toEqual({ badNames: [], withCanary: [] });
  });

  it("flags story-like names elsewhere and files holding the marker", () => {
    const files = [allowed, "story-pack.b64", "x/storyline.md", "x/Storyline-2.md", "src/ok.ts", "src/bad.ts"];
    const r = checkTracked(files, read({ "src/bad.ts": `a ${CANARY} b` }), allowed);
    expect(r.badNames).toEqual(["story-pack.b64", "x/storyline.md", "x/Storyline-2.md"]);
    expect(r.withCanary).toEqual(["src/bad.ts"]);
  });
});
