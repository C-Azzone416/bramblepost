/**
 * Serves the virtual module `virtual:content-pack`: the active content pack, chosen by VITE_STORY_PACK.
 *
 *   standard (default, also when unset or unknown): re-exports the pack built in code. Reads nothing from disk.
 *   stand-in: imports src/content/stand-in-pack.json. Reads nothing else.
 *   story:    reads the file at BRAMBLEPOST_STORY_PACK (default: content/story/story-pack.b64 in the repo) in Node only:
 *             base64 -> gunzip -> JSON, checks the `canary` field. A missing or wrong file falls back to standard
 *             with one log line that says nothing about the contents.
 *
 * Under Vitest the env choice is ignored (no env or .env* lookup): tests always get standard, so an ambient
 * VITE_STORY_PACK can never load the story pack into `npm test`. Only an explicit `pack` option overrides that.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { loadEnv, type Plugin } from "vite";

const VIRTUAL_ID = "virtual:content-pack";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

// Split so the whole marker never appears in the repo (a CI guard greps for it).
export const CANARY = "BRAMBLEPOST-SECRET-" + "STORY-PACK-DO-NOT-COMMIT";

/** Relative to the project root. The one tracked copy of the encoded pack; read only in story mode. */
export const DEFAULT_STORY_PATH = "content/story/story-pack.b64";

export type PackChoice = "standard" | "stand-in" | "story";

export interface ContentPackOptions {
  /** The pack to serve. Default: VITE_STORY_PACK (env or .env files), else standard. */
  pack?: string;
  /** Where the story pack lives. Default: BRAMBLEPOST_STORY_PACK, else content/story/story-pack.b64 in the repo. */
  storyPath?: string;
  /** Where log lines go. Default: console.log. */
  log?: (line: string) => void;
}

const expandHome = (p: string): string => (p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p);

/** Reads and decodes the story file. Returns undefined (never throws) when it is missing or not a valid pack. */
function readStoryPack(file: string): object | undefined {
  try {
    const text = fs.readFileSync(file, "utf8");
    const json: unknown = JSON.parse(zlib.gunzipSync(Buffer.from(text, "base64")).toString("utf8"));
    if (typeof json !== "object" || json === null || (json as { canary?: unknown }).canary !== CANARY) return undefined;
    const { canary: _canary, ...pack } = json as Record<string, unknown>;
    return pack;
  } catch {
    return undefined;
  }
}

export function contentPackPlugin(options: ContentPackOptions = {}): Plugin {
  let root = process.cwd();
  let choice = options.pack;
  const log = options.log ?? ((line: string) => console.log(line));
  let storyCode: string | undefined; // decoded once per plugin instance, so the fallback logs once

  const standardCode = () => `export { STANDARD_PACK as default } from ${JSON.stringify(path.resolve(root, "src/content/standard.ts"))};`;

  function loadStory(): string {
    if (storyCode !== undefined) return storyCode;
    const file = path.resolve(root, expandHome(options.storyPath ?? process.env.BRAMBLEPOST_STORY_PACK ?? DEFAULT_STORY_PATH));
    const pack = readStoryPack(file);
    if (!pack) log("[content-pack] story pack not found or not valid, using standard");
    storyCode = pack ? `export default ${JSON.stringify(pack)};` : standardCode();
    return storyCode;
  }

  return {
    name: "bramblepost-content-pack",
    configResolved(config) {
      root = config.root;
      const underVitest = !!process.env.VITEST || config.mode === "test";
      if (choice === undefined && !underVitest) choice = loadEnv(config.mode, config.envDir || config.root, "VITE_").VITE_STORY_PACK;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      switch (choice) {
        case "stand-in":
          return `export { default } from ${JSON.stringify(path.resolve(root, "src/content/stand-in-pack.json"))};`;
        case "story":
          return loadStory();
        default:
          return standardCode();
      }
    },
  };
}
