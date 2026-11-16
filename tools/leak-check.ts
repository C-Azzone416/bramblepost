/**
 * Leak check: nothing from the encoded story pack may reach git or a built dist.
 *
 *   tsx tools/leak-check.ts [dist-dir ...]     (default: dist)
 *
 * It prints counts, file names and pass/fail only. Never story text: no diffs, no snippets, no error messages
 * from decoding, no files written. The pack is decoded in memory and dropped.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { STANDARD_PACK } from "../src/content/standard.ts";
import standIn from "../src/content/stand-in-pack.json" with { type: "json" };
import { CANARY, DEFAULT_STORY_PATH } from "../vite-plugins/content-pack.ts";

export const MIN_LENGTH = 24;

/** Decodes an encoded pack (base64, gunzip, JSON). Undefined if it is not a valid pack. Never throws or echoes text. */
export function decodePack(text: string): unknown {
  try {
    const json: unknown = JSON.parse(zlib.gunzipSync(Buffer.from(text, "base64")).toString("utf8"));
    return typeof json === "object" && json !== null && (json as { canary?: unknown }).canary === CANARY ? json : undefined;
  } catch {
    return undefined;
  }
}

/** Every string value in a JSON-like tree. */
export function allStrings(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") into.add(value);
  else if (value !== null && typeof value === "object") for (const v of Object.values(value)) allStrings(v, into);
  return into;
}

/** Text of at least MIN_LENGTH characters in `pack` that none of the `known` packs contain. */
export function storyStrings(pack: unknown, known: unknown[]): string[] {
  const seen = new Set<string>();
  for (const k of known) allStrings(k, seen);
  return [...allStrings(pack)].filter((s) => s.length >= MIN_LENGTH && s !== CANARY && !seen.has(s));
}

/** The ways a string can appear in built output: raw, and escaped as inside a JS string literal. */
const spellings = (s: string): Buffer[] => {
  const json = JSON.stringify(s).slice(1, -1);
  const single = json.replace(/\\"/g, '"').replace(/'/g, "\\'");
  return [...new Set([s, json, single])].map((x) => Buffer.from(x, "utf8"));
};

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full;
  }
}

/** Scans every file under `dir` for the canary and the strings: which files hit (names only) and how many strings were found. */
export function scanDir(dir: string, strings: string[]): { files: string[]; found: number } {
  const needles = [CANARY, ...strings].map((s) => spellings(s));
  const files: string[] = [];
  const found = new Set<number>();
  for (const file of walk(dir)) {
    const data = fs.readFileSync(file);
    let hit = false;
    needles.forEach((variants, i) => {
      if (variants.some((v) => data.includes(v))) {
        found.add(i);
        hit = true;
      }
    });
    if (hit) files.push(path.relative(dir, file));
  }
  return { files: files.sort(), found: found.size };
}

/** Tracked files that are named like the story files (other than `allowed`) or contain the canary. */
export function checkTracked(files: string[], read: (file: string) => Buffer | undefined, allowed = DEFAULT_STORY_PATH) {
  const badNames = files.filter((f) => /^(storyline|story-pack)/i.test(path.basename(f)) && f !== allowed);
  const canary = Buffer.from(CANARY);
  const withCanary = files.filter((f) => read(f)?.includes(canary));
  return { badNames, withCanary };
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\0").filter(Boolean);
}

function readTracked(file: string): Buffer | undefined {
  try {
    return fs.readFileSync(file);
  } catch {
    return undefined; // deleted in the working tree, or not a regular file
  }
}

function main(dists: string[]): boolean {
  let ok = true;
  const files = trackedFiles();
  const tracked = checkTracked(files, readTracked);
  console.log(`tracked files: ${files.length} checked, ${tracked.badNames.length} misnamed, ${tracked.withCanary.length} with the marker`);
  for (const f of [...tracked.badNames, ...tracked.withCanary]) console.log(`  ${f}`);
  if (tracked.badNames.length || tracked.withCanary.length) ok = false;
  if (!files.includes(DEFAULT_STORY_PATH)) {
    console.log(`the pack is not tracked at ${DEFAULT_STORY_PATH}`);
    ok = false;
  }

  const pack = decodePack(fs.existsSync(DEFAULT_STORY_PATH) ? fs.readFileSync(DEFAULT_STORY_PATH, "utf8") : "");
  if (!pack) {
    console.log("the pack could not be decoded");
    return false;
  }
  const strings = storyStrings(pack, [STANDARD_PACK, standIn]);
  for (const dist of dists) {
    if (!fs.existsSync(dist)) {
      console.log(`${dist}: not found`);
      ok = false;
      continue;
    }
    const { files: hits, found } = scanDir(dist, strings);
    console.log(`${dist}: ${strings.length} story strings checked, ${found} found, in ${hits.length} files`);
    for (const f of hits) console.log(`  ${f}`);
    if (hits.length) ok = false;
  }
  return ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let ok = false;
  try {
    ok = main(process.argv.length > 2 ? process.argv.slice(2) : ["dist"]);
  } catch {
    console.log("leak check could not run"); // never print the error: it could quote the pack
  }
  console.log(ok ? "leak check: pass" : "leak check: FAIL");
  process.exit(ok ? 0 : 1);
}
