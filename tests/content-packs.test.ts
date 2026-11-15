import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import zlib from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_ENDING, ACTIVE_LETTERS, ACTIVE_PACK, ACTIVE_SCENES, ACTIVE_SLOTS } from "../src/content/active";
import { endingToPack, packToEndingScene } from "../src/content/ending";
import standInJson from "../src/content/stand-in-pack.json";
import { STANDARD_PACK } from "../src/content/standard";
import type { ContentPack } from "../src/content/types";
import { ENDING_SCENES } from "../src/door/ending";
import { SPRING_SCENES } from "../src/door/scenes";
import { SPRING_LETTER_LIST, SPRING_SLOTS } from "../src/letters/spring";
import { contentPackPlugin } from "../vite-plugins/content-pack";

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
    expect(packToEndingScene(STANDARD_PACK.ending)).toEqual(ENDING_SCENES[0]);
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
    expect(ACTIVE_SCENES === SPRING_SCENES).toBe(true);
    expect(ACTIVE_LETTERS === SPRING_LETTER_LIST).toBe(true);
    expect(ACTIVE_SLOTS === SPRING_SLOTS).toBe(true);
    expect(isDeepStrictEqual(ACTIVE_ENDING, ENDING_SCENES)).toBe(true);
  });
});

describe("stand-in pack", () => {
  it("loads with the expected shape and counts", () => {
    expect(standIn.version).toBe(1);
    expect(standIn.mode).toBe("stand-in");
    expect(standIn.season).toBe("spring");
    expect(standIn.canary).toBeUndefined();
    expect(standIn.scenes).toHaveLength(15);
    expect(standIn.letters).toHaveLength(40);
    expect(standIn.slots).toHaveLength(13);
  });

  it("has unique letter ids and its ending lists end with a plain entry", () => {
    expect(new Set(standIn.letters.map((l) => l.id)).size).toBe(40);
    const e = standIn.ending;
    for (const list of [e.kicker, e.title, e.envelope, ...e.lines.filter((l) => typeof l !== "string")]) {
      const said = list as { when?: unknown }[];
      expect(said[said.length - 1].when).toBeUndefined();
    }
  });

  it("converts to a playable ending scene", () => {
    const scene = packToEndingScene(standIn.ending);
    expect(scene.lines).toHaveLength(standIn.ending.lines.length);
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
});
