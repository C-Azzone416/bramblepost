import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import zlib from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_ENDING, ACTIVE_LETTERS, ACTIVE_PACK, ACTIVE_SCENES, ACTIVE_SLOTS } from "../src/content/active";
import { endingToPack } from "../src/content/ending";
import standInJson from "../src/content/stand-in-pack.json";
import { ROUTES } from "../src/levels";
import { STANDARD_PACK } from "../src/content/standard";
import type { ContentPack } from "../src/content/types";
import { ENDING_SCENES, resolveLines, resolveText, type EndingCond, type EndingState } from "../src/door/ending";
import { isMet } from "../src/letters/rules";
import type { Requirement } from "../src/letters/types";
import { SPRING_SCENES } from "../src/door/scenes";
import { SPRING_LETTER_LIST, SPRING_SLOTS } from "../src/letters/spring";
import { CANARY, contentPackPlugin, DEFAULT_STORY_PATH } from "../vite-plugins/content-pack";

const standIn = standInJson as unknown as ContentPack;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("standard pack", () => {
  it("is today's content, unchanged", () => {
    expect(STANDARD_PACK.mode).toBe("standard");
    expect(STANDARD_PACK.scenes).toBe(SPRING_SCENES);
    expect(STANDARD_PACK.letters).toBe(SPRING_LETTER_LIST);
    expect(STANDARD_PACK.slots).toBe(SPRING_SLOTS);
    expect(ENDING_SCENES).toHaveLength(1);
  });

  it("wraps the ending in version lists that end with a plain entry", () => {
    const e = endingToPack(ENDING_SCENES[0]);
    expect(e.route).toBe(ENDING_SCENES[0].route);
    for (const list of [e.kicker, e.title, e.envelope]) expect(list).toHaveLength(1);
    expect(e.lines).toHaveLength(ENDING_SCENES[0].lines.length);
    for (const l of e.lines) if (typeof l !== "string") expect(l[l.length - 1].when).toBeUndefined();
  });

  it("is what the game reads when no pack is chosen", () => {
    // Content-free guard first, so a failure below can never print pack text.
    expect(ACTIVE_PACK.mode).toBe("standard");
    expect(ACTIVE_PACK === STANDARD_PACK).toBe(true);
    expect(ACTIVE_SCENES).toEqual(SPRING_SCENES);
    expect(ACTIVE_LETTERS).toEqual(SPRING_LETTER_LIST);
    expect(ACTIVE_SLOTS).toEqual(SPRING_SLOTS);
    expect(ACTIVE_ENDING[0] === STANDARD_PACK.ending).toBe(true);
  });
});

describe("stand-in pack", () => {
  it("loads with the expected shape and counts", () => {
    expect(standIn.version).toBe(1);
    expect(standIn.mode).toBe("stand-in");
    expect(standIn.season).toBe("spring");
    expect(standIn.canary).toBeUndefined();
    expect(standIn.scenes.map((s) => s.route)).toEqual(ROUTES.map((r) => r.id));
    expect(standIn.letters.length).toBe(new Set(standIn.letters.map((l) => l.id)).size);
    expect(standIn.slots.every((s) => standIn.letters.some((l) => l.id === s.letter))).toBe(true);
  });

  it("has unique letter ids and its ending lists end with a plain entry", () => {
    expect(new Set(standIn.letters.map((l) => l.id)).size).toBe(standIn.letters.length);
    const e = standIn.ending;
    for (const list of [e.kicker, e.title, e.envelope, ...e.lines.filter((l) => typeof l !== "string")]) {
      const said = list as { when?: unknown }[];
      expect(said[said.length - 1].when).toBeUndefined();
    }
  });

  it("has a 21-line ending whose conditions all refer to real letters and door flags", () => {
    expect(standIn.ending.lines).toHaveLength(21);
    const ids = new Set(standIn.letters.map((l) => l.id));
    const flags = new Set(standIn.scenes.flatMap((sc) => JSON.stringify(sc).match(/"flag":"[^"]+"/g) ?? []).map((m) => m.slice(8, -1)));
    const whens = endingLists(standIn.ending).flatMap((l) => l.flatMap((v) => (v.when ? [v.when] : [])));
    const leaves = (r: Requirement): Requirement[] => (r.kind === "all" || r.kind === "any" ? r.of.flatMap(leaves) : [r]);
    const bad = whens.flatMap(leaves).filter((r) => (r.kind === "read" ? !ids.has(r.letter) : r.kind === "flag" ? !flags.has(r.key) : false));
    expect(bad.length).toBe(0);
  });

  it("resolves every part to a short string in a sample of states", () => {
    const e = standIn.ending;
    const ids = standIn.letters.map((l) => l.id);
    const keys = [...new Set(endingLists(e).flatMap((l) => l.flatMap((v) => JSON.stringify(v.when ?? {}).match(/"key":"[^"]+"/g) ?? [])))].map((m) => m.slice(7, -1));
    const states: EndingState[] = [{ read: [], flags: {} }, { read: ids, flags: {} }];
    for (let i = 0; i < 8; i++) states.push({ read: ids.filter((_, n) => (n + i) % 3 === 0), flags: Object.fromEntries(keys.filter((_, n) => (n + i) % 2 === 0).map((k) => [k, i % 2 ? "told" : "other"])) });
    let nonString = 0;
    let tooLong = 0;
    for (const st of states) {
      const parts = [resolveText(e.kicker, st), resolveText(e.title, st), resolveText(e.envelope, st)];
      for (const p of [...parts, ...resolveLines(e.lines, st)]) {
        if (typeof p !== "string") nonString++;
        else if (p.length >= 140 && !parts.includes(p)) tooLong++;
      }
      for (const l of e.lines) if (typeof l !== "string" && resolveText(l, st) === undefined) nonString++;
    }
    expect(nonString).toBe(0);
    expect(tooLong).toBe(0);
  });
});

/** Every version list in an ending. */
function endingLists(e: ContentPack["ending"]) {
  return [e.kicker, e.title, e.envelope, ...e.lines.filter((l): l is Exclude<typeof l, string> => typeof l !== "string")];
}

describe("ending versions", () => {
  it("every list of the stand-in ending ends with an unconditional entry", () => {
    expect(endingLists(standIn.ending).filter((l) => l[l.length - 1].when !== undefined).length).toBe(0);
  });

  it("picks the first entry whose condition is met", () => {
    const list = [{ when: { kind: "read", letter: "a" } as const, say: "x" }, { when: { kind: "flag", key: "k", value: "v" } as const, say: "y" }, { say: "z" }];
    expect(resolveText(list, { read: ["a"], flags: { k: "v" } })).toBe("x");
    expect(resolveText(list, { read: [], flags: { k: "v" } })).toBe("y");
    expect(resolveText(list, { read: [], flags: {} })).toBe("z");
    expect(resolveText("plain", { read: [], flags: {} })).toBe("plain");
  });

  it("the standard ending plays exactly as before in every state of its conditions", () => {
    const scene = ENDING_SCENES[0];
    const conds = scene.lines.flatMap((l) => (typeof l === "string" || Array.isArray(l) ? [] : [l.if]));
    const key = (c: EndingCond) => JSON.stringify(c);
    const uniq = [...new Map(conds.map((c) => [key(c), c])).values()];
    expect(uniq.length).toBeGreaterThan(0);
    let differing = 0;
    let checked = 0;
    for (let mask = 0; mask < 1 << uniq.length; mask++) {
      const read: string[] = [];
      const flags: Record<string, string> = {};
      uniq.forEach((c, i) => {
        const on = (mask >> i) & 1;
        if ("read" in c) {
          if (on) read.push(c.read[c.read.length - 1]);
        } else flags[c.flag] = on ? c.is : "other";
      });
      const st: EndingState = { read, flags };
      const old = resolveLines(scene.lines, st);
      const next = resolveLines(STANDARD_PACK.ending.lines, st);
      const parts = [scene.kicker, scene.title, scene.envelope].map((t, i) => resolveText(STANDARD_PACK.ending[(["kicker", "title", "envelope"] as const)[i]], st) === t);
      checked++;
      if (!isDeepStrictEqual(old, next) || parts.includes(false)) differing++;
    }
    expect(checked).toBe(1 << uniq.length);
    expect(differing).toBe(0);
    expect(isMet(undefined, { read: [], flags: {} })).toBe(true);
  });
});

/** Runs the plugin's load hook for the virtual module. */
function loadVirtual(opts: Parameters<typeof contentPackPlugin>[0]): string {
  const plugin = contentPackPlugin(opts);
  const id = (plugin.resolveId as (id: string) => string)("virtual:content-pack");
  return (plugin.load as (id: string) => string)(id);
}

describe("content-pack plugin", () => {
  const STORY_PATH = path.join(os.tmpdir(), "bramblepost-test-no-such-dir", "story-pack.b64");

  const spies = () => ({
    readFileSync: vi.spyOn(fs, "readFileSync"),
    existsSync: vi.spyOn(fs, "existsSync"),
    statSync: vi.spyOn(fs, "statSync"),
    openSync: vi.spyOn(fs, "openSync"),
    readFile: vi.spyOn(fs, "readFile"),
  });
  const touchedStory = (s: ReturnType<typeof spies>) =>
    Object.values(s).some((spy) => spy.mock.calls.some((args) => String(args[0]).includes(path.basename(STORY_PATH)) || String(args[0]).includes("bramblepost-test-no-such-dir")));

  it("standard (and unset) re-exports the standard pack and never touches the story path", () => {
    const s = spies();
    const log = vi.fn();
    for (const pack of ["standard", undefined, "something-else"]) {
      const code = loadVirtual({ pack, storyPath: STORY_PATH, log });
      expect(code).toContain("STANDARD_PACK");
      expect(code).toContain("standard.ts");
    }
    expect(touchedStory(s)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("stand-in imports the stand-in file and never touches the story path", () => {
    const s = spies();
    const log = vi.fn();
    const code = loadVirtual({ pack: "stand-in", storyPath: STORY_PATH, log });
    expect(code).toContain("stand-in-pack.json");
    expect(code).not.toContain("STANDARD_PACK");
    expect(touchedStory(s)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("under Vitest an ambient VITE_STORY_PACK=story is ignored: standard, and the story path is never read", () => {
    vi.stubEnv("VITE_STORY_PACK", "story");
    vi.stubEnv("VITEST", "true");
    const s = spies();
    const log = vi.fn();
    const plugin = contentPackPlugin({ storyPath: STORY_PATH, log }); // no `pack` option
    const root = process.cwd();
    for (const mode of ["test", "development"]) {
      (plugin.configResolved as (c: unknown) => void)({ root, mode, envDir: root });
      const id = (plugin.resolveId as (id: string) => string)("virtual:content-pack");
      expect((plugin.load as (id: string) => string)(id)).toContain("STANDARD_PACK");
    }
    expect(touchedStory(s)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("story with a missing file falls back to standard with one content-free log line", () => {
    const s = spies();
    const log = vi.fn();
    const plugin = contentPackPlugin({ pack: "story", storyPath: STORY_PATH, log });
    const id = (plugin.resolveId as (id: string) => string)("virtual:content-pack");
    const load = plugin.load as (id: string) => string;
    const first = load(id);
    const second = load(id);
    expect(touchedStory(s)).toBe(true); // the spy does see story-path reads
    expect(first).toContain("STANDARD_PACK");
    expect(second).toBe(first);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^\[content-pack\] story pack not found or not valid, using standard$/);
  });

  it("story with a file that lacks the canary falls back the same way", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-pack-test-"));
    try {
      const file = path.join(dir, "pack.b64");
      fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ canary: "wrong", scenes: [] })).toString("base64"));
      const log = vi.fn();
      expect(loadVirtual({ pack: "story", storyPath: file, log })).toContain("STANDARD_PACK");
      expect(log).toHaveBeenCalledTimes(1);
      fs.writeFileSync(file, "not base64 gzip at all");
      const log2 = vi.fn();
      expect(loadVirtual({ pack: "story", storyPath: file, log: log2 })).toContain("STANDARD_PACK");
      expect(log2).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("story reads a valid file from the given path, resolved against the project root, and drops the marker", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-pack-test-"));
    try {
      const encode = (o: object) => zlib.gzipSync(JSON.stringify(o)).toString("base64");
      fs.writeFileSync(path.join(dir, "synthetic.b64"), encode({ canary: CANARY, marker: "synthetic-only" }));
      const log = vi.fn();
      const plugin = contentPackPlugin({ pack: "story", storyPath: "synthetic.b64", log });
      (plugin.configResolved as (c: unknown) => void)({ root: dir, mode: "development", envDir: dir });
      const id = (plugin.resolveId as (id: string) => string)("virtual:content-pack");
      const code = (plugin.load as (id: string) => string)(id);
      expect(code).toBe('export default {"marker":"synthetic-only"};');
      expect(log).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("story defaults to the in-repo path, and BRAMBLEPOST_STORY_PACK overrides it", () => {
    expect(DEFAULT_STORY_PATH).toBe("content/story/story-pack.b64");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bramblepost-pack-test-"));
    try {
      const file = path.join(dir, "env.b64");
      fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ canary: CANARY, marker: "from-env" })).toString("base64"));
      vi.stubEnv("BRAMBLEPOST_STORY_PACK", file);
      expect(loadVirtual({ pack: "story", log: vi.fn() })).toContain("from-env");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
