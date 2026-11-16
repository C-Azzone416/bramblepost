/** The leak check's helpers, on synthetic data only: no real pack is read here. */
import { transformSync } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allStrings, checkTracked, decodePack, normalise, scan, scanDir, storyStrings } from "../tools/leak-check";
import { CANARY } from "../vite-plugins/content-pack";

const encode = (o: object) => zlib.gzipSync(JSON.stringify(o)).toString("base64");

// Stand-in-like text plus fake markers.
const COMMON = "[stand-in] sp-09, line 2, shared text";
const FAKE_A = "[fake-marker] alpha line one, plain"; // long
const FAKE_B = `[fake-marker] "quoted" it's, tab\tand ’ curly é`; // long, with characters that get escaped
const FAKE_C = "fake display 12"; // short display text (15)
const FAKE_NAME = "Fakename"; // a label (8)
const SHORT = "[fake] shrt"; // 11: too short for display text
const synthetic = {
  canary: CANARY,
  mode: "story",
  scenes: [{ speaker: FAKE_NAME, lines: [COMMON, FAKE_A, FAKE_C, SHORT, "Plainword"], choices: [{ label: "abcde" }] }],
  letters: [{ sender: COMMON }],
  ending: { title: [{ say: FAKE_B }] },
};
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
  it("marks strings under name and label fields", () => {
    expect(allStrings({ a: ["x", { speaker: "y" }], c: 1 })).toEqual(new Map([["x", false], ["y", true]]));
  });

  it("takes display text from 12 characters and names and labels from 6, minus anything known", () => {
    expect([...storyStrings(synthetic, known)].sort()).toEqual([FAKE_A, FAKE_B, FAKE_C, FAKE_NAME].sort());
  });

  it("drops text that sits inside a longer known string, or is a known string", () => {
    const withLonger = [...known, { x: `before ${FAKE_NAME} after, and ${FAKE_C} too` }];
    expect([...storyStrings(synthetic, withLonger)].sort()).toEqual([FAKE_A, FAKE_B].sort());
  });
});

describe("normalise", () => {
  it("decodes JS escapes and HTML entities", () => {
    expect(normalise("caf\\u00e9 \\u{1F600} \\x41\\n\\t\\\\ \\' \\\" \\/ \\q")).toBe("café 😀 A\n\t\\ ' \" / q");
    expect(normalise("&#233; &#xE9; &#XE9; &amp; &quot; &apos; &bogus; &#99999999;")).toBe("é é é & \" ' &bogus; &#99999999;");
    expect(normalise("\\\\u0041")).toBe("\\u0041"); // an escaped backslash is not an escape of what follows
  });
});

describe("scan", () => {
  const strings = () => storyStrings(synthetic, known);
  const one = (text: string) => scan([["f", Buffer.from(text)]], strings());

  it("matches short text only as whole words", () => {
    expect(one(`x = "${FAKE_NAME}";`)).toEqual({ files: ["f"], found: 1 });
    expect(one(`x = "My ${FAKE_NAME}, ok"`).found).toBe(1);
    expect(one(`x = "Not${FAKE_NAME}s";`).found).toBe(0);
    expect(one(`x = "${FAKE_C}s";`).found).toBe(0);
    expect(one(`x = "á${FAKE_NAME}";`).found).toBe(0);
  });

  it("matches long text anywhere", () => {
    expect(one(`x = "q${FAKE_A}q";`).found).toBe(1);
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
  const put = (name: string, text: string | Buffer) => fs.writeFileSync(path.join(dir, name), text);

  it("finds nothing in a clean dist", () => {
    expect(scanDir(dir, strings())).toEqual({ files: [], found: 0 });
  });

  it("finds a planted string, raw or as a JS string literal, and reports file names and counts", () => {
    put("assets/leak.js", `x = ${JSON.stringify(FAKE_B)};`);
    put("notes.txt", `raw ${FAKE_A} raw`);
    expect(scanDir(dir, strings())).toEqual({ files: ["assets/leak.js", "notes.txt"], found: 2 });
  });

  it("finds strings written with unicode, braced unicode and hex escapes, and as HTML entities", () => {
    const u4 = (s: string) => [...s].map((c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    put("unicode.js", `x = "${u4(FAKE_A)}";`);
    put("braced.js", `x = "${[...FAKE_C].map((c) => `\\u{${c.codePointAt(0)!.toString(16)}}`).join("")}";`);
    put("hex.js", `x = "${[...FAKE_NAME].map((c) => "\\x" + c.charCodeAt(0).toString(16)).join("")}";`);
    put("page.html", `<p>${[...FAKE_A].map((c) => `&#${c.charCodeAt(0)};`).join("")}</p><p>${[...FAKE_C].map((c) => `&#x${c.charCodeAt(0).toString(16)};`).join("")}</p>`);
    const r = scanDir(dir, strings());
    expect(r.files).toEqual(["braced.js", "hex.js", "page.html", "unicode.js"]);
    expect(r.found).toBe(3);
  });

  it("finds strings in esbuild's ascii-only minified output of a synthetic module", () => {
    const source = `export const a = ${JSON.stringify(FAKE_B)}; export const b = ${JSON.stringify(FAKE_A)}; export const c = ${JSON.stringify(FAKE_NAME)};`;
    const out = transformSync(source, { charset: "ascii", minify: true, loader: "js" }).code;
    expect(out).toMatch(/\\u/); // the output really is escaped
    expect(out.includes(FAKE_B)).toBe(false);
    put("assets/min.js", out);
    expect(scanDir(dir, strings())).toEqual({ files: ["assets/min.js"], found: 3 });
  });

  it("finds the marker on its own, in a binary file too", () => {
    put("blob.bin", Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(CANARY), Buffer.from([255])]));
    expect(scanDir(dir, [])).toEqual({ files: ["blob.bin"], found: 1 });
  });

  it("ignores text that is only in the known packs", () => {
    expect(scanDir(dir, storyStrings({ x: COMMON }, known)).found).toBe(0);
  });
});

describe("checkTracked", () => {
  const allowed = "content/story/story-pack.b64";
  const strings = storyStrings(synthetic, known);
  const read = (contents: Record<string, string | Buffer>) => (f: string) => (f in contents ? Buffer.from(contents[f]) : undefined);

  it("passes with only the allowed pack file, and does not scan it", () => {
    const files = [allowed, "src/main.ts", "docs/story-notes.md"];
    const r = checkTracked(files, read({ [allowed]: FAKE_A, "src/main.ts": "ok" }), strings, allowed);
    expect(r).toEqual({ badNames: [], files: [], found: 0 });
  });

  it("flags story-like names and any other .b64, and files holding the marker or a string", () => {
    const files = [allowed, "story-pack.b64", "x/storyline.md", "x/Storyline-2.md", "other.b64", "x/Y.B64", "src/ok.ts", "src/bad.ts", "src/esc.ts", "bin.dat"];
    const contents = { "src/bad.ts": `a ${CANARY} b`, "src/esc.ts": `x = "${FAKE_NAME}"; y = "\\u0066\\u0061ke display 12"`, "bin.dat": Buffer.concat([Buffer.from([0]), Buffer.from(FAKE_A)]) };
    const r = checkTracked(files, read(contents), strings, allowed);
    expect(r.badNames).toEqual(["story-pack.b64", "x/storyline.md", "x/Storyline-2.md", "other.b64", "x/Y.B64"]);
    expect(r.files).toEqual(["src/bad.ts", "src/esc.ts"]);
    expect(r.found).toBe(3); // the marker and two strings; the binary file is skipped
  });
});
