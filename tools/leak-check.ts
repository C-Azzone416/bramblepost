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

/** Strings of at least this many characters are matched anywhere in the text; shorter ones need word boundaries. */
export const LONG = 24;
/** Display strings shorter than LONG are checked from this length. */
export const MIN_TEXT = 12;
/** Names and labels (found structurally, by the field they sit under) are checked from this length. */
export const MIN_LABEL = 6;
/** Fields whose strings are names or labels. A string under any of these keys (at any depth) counts as one. */
export const LABEL_KEYS = new Set(["speaker", "sender", "label", "name", "title", "kicker", "envelope"]);

/**
 * Known limits: text that is split, reworded or re-encoded beyond the escapes and entities handled by `normalise`
 * can slip through, and so can strings shorter than MIN_TEXT (or MIN_LABEL for names and labels).
 */

/** Decodes an encoded pack (base64, gunzip, JSON). Undefined if it is not a valid pack. Never throws or echoes text. */
export function decodePack(text: string): unknown {
  try {
    const json: unknown = JSON.parse(zlib.gunzipSync(Buffer.from(text, "base64")).toString("utf8"));
    return typeof json === "object" && json !== null && (json as { canary?: unknown }).canary === CANARY ? json : undefined;
  } catch {
    return undefined;
  }
}

/** Every string value in a JSON-like tree, mapped to whether it sits under a name or label field. */
export function allStrings(value: unknown, into = new Map<string, boolean>(), label = false): Map<string, boolean> {
  if (typeof value === "string") into.set(value, (into.get(value) ?? false) || label);
  else if (value !== null && typeof value === "object")
    for (const [k, v] of Object.entries(value)) allStrings(v, into, label || LABEL_KEYS.has(k));
  return into;
}

/**
 * Candidate text in `pack` that no known pack has: not equal to a known string, and not inside ONE known string with
 * non-letters (or an edge) on both sides. Each known value is tested separately. Display strings, names and labels.
 */
export function storyStrings(pack: unknown, known: unknown[]): string[] {
  const seen = new Map<string, boolean>();
  for (const k of known) allStrings(k, seen);
  const knownText = [...seen.keys()];
  return [...allStrings(pack)]
    .filter(([s, label]) => s !== CANARY && s.length >= (label ? MIN_LABEL : MIN_TEXT) && !seen.has(s) && !knownText.some((k) => containsWord(k, s)))
    .map(([s]) => s);
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const SIMPLE: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
const fromCode = (n: number, fallback: string) => (n <= 0x10ffff ? String.fromCodePoint(n) : fallback);

/** Decodes JS string escapes (\uXXXX, \u{...}, \xXX, \n, \t, \\, \', \", \/ ...); a backslash before a line break is dropped with it. */
export function normaliseJs(text: string): string {
  return text.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|[\n\r\u2028\u2029])|([\s\S]))/g, (m, brace, u, x, lineBreak, other) =>
    brace ? fromCode(parseInt(brace, 16), m) : u || x ? String.fromCharCode(parseInt(u || x, 16)) : lineBreak !== undefined ? "" : (SIMPLE[other] ?? other),
  );
}

/** Decodes HTML entities (&#NNN; &#xHH; &amp; ...). */
export function normaliseHtml(text: string): string {
  return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (m, dec, hex, name) =>
    dec ? fromCode(parseInt(dec, 10), m) : hex ? fromCode(parseInt(hex, 16), m) : (NAMED[name] ?? m),
  );
}

/** JS escapes, then HTML entities. */
export const normalise = (text: string): string => normaliseHtml(normaliseJs(text));

const WORD = /[\p{L}\p{N}_]/u;

/** Whether `needle` occurs in `text` with a non-letter (or the edge) on both sides. */
export function containsWord(text: string, needle: string): boolean {
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
    const before = text.slice(Math.max(0, i - 2), i).match(/[\s\S]$/u)?.[0] ?? "";
    const after = text.slice(i + needle.length, i + needle.length + 2).match(/^[\s\S]/u)?.[0] ?? "";
    if (!WORD.test(before) && !WORD.test(after)) return true;
  }
  return false;
}

/** Whether `needle` occurs in `text`: anywhere for long strings, as a whole word for shorter ones. */
const includes = (text: string, needle: string): boolean => (needle.length >= LONG ? text.includes(needle) : containsWord(text, needle));

const MARKER = Buffer.from(CANARY);

/**
 * Scans named buffers for the marker (raw bytes, and in the normalised texts) and the strings (as raw text, JS-normalised text, and JS+HTML-normalised
 * text): file names and how many distinct needles were found.
 */
export function scan(entries: Iterable<[string, Buffer]>, strings: string[]): { files: string[]; found: number } {
  const files: string[] = [];
  const found = new Set<number>();
  for (const [name, data] of entries) {
    const raw = data.toString("utf8");
    const js = normaliseJs(raw);
    const texts = [raw, js, normaliseHtml(js)];
    let hit = false;
    if (data.includes(MARKER) || texts.slice(1).some((t) => t.includes(CANARY))) {
      found.add(-1); // the marker: raw bytes, or after unescaping
      hit = true;
    }
    strings.forEach((n, i) => {
      if (texts.some((t) => includes(t, n))) {
        found.add(i);
        hit = true;
      }
    });
    if (hit) files.push(name);
  }
  return { files: files.sort(), found: found.size };
}

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full;
  }
}

/** Scans every file under `dir`. File names are relative to it. */
export function scanDir(dir: string, strings: string[]) {
  function* entries(): Generator<[string, Buffer]> {
    for (const file of walk(dir)) yield [path.relative(dir, file), fs.readFileSync(file)];
  }
  return scan(entries(), strings);
}

/**
 * Tracked files: names that look like story files (any tracked `*.b64` or `story-pack*` / `storyline*` other than
 * `allowed`); the marker in the raw bytes of every tracked file but `allowed` (binary included); and the strings in the
 * tracked text files (those without NUL bytes).
 */
export function checkTracked(files: string[], read: (file: string) => Buffer | undefined, strings: string[], allowed = DEFAULT_STORY_PATH) {
  const badNames = files.filter((f) => f !== allowed && /(^(storyline|story-pack)|\.b64$)/i.test(path.basename(f)));
  const others = files.filter((f) => f !== allowed);
  const withMarker = others.filter((f) => read(f)?.includes(MARKER));
  function* entries(): Generator<[string, Buffer]> {
    for (const f of others) {
      const data = read(f);
      if (data && !data.subarray(0, 8192).includes(0)) yield [f, data];
    }
  }
  return { badNames, withMarker, ...scan(entries(), strings) };
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

function report(label: string, strings: number, r: { files: string[]; found: number }): boolean {
  console.log(`${label}: ${strings} story strings checked, ${r.found} found, in ${r.files.length} files`);
  for (const f of r.files) console.log(`  ${f}`);
  return r.files.length === 0;
}

function main(dists: string[]): boolean {
  const pack = decodePack(fs.existsSync(DEFAULT_STORY_PATH) ? fs.readFileSync(DEFAULT_STORY_PATH, "utf8") : "");
  if (!pack) {
    console.log("the pack could not be decoded");
    return false;
  }
  const strings = storyStrings(pack, [STANDARD_PACK, standIn]);
  const files = trackedFiles();
  let ok = true;
  if (!files.includes(DEFAULT_STORY_PATH)) {
    console.log(`the pack is not tracked at ${DEFAULT_STORY_PATH}`);
    ok = false;
  }
  const tracked = checkTracked(files, readTracked, strings);
  console.log(`tracked files: ${files.length} checked, ${tracked.badNames.length} misnamed, ${tracked.withMarker.length} with the marker`);
  for (const f of [...tracked.badNames, ...tracked.withMarker]) console.log(`  ${f}`);
  if (tracked.badNames.length || tracked.withMarker.length) ok = false;
  if (!report("tracked text", strings.length, tracked)) ok = false;
  for (const dist of dists) {
    if (!fs.existsSync(dist)) {
      console.log(`${dist}: not found`);
      ok = false;
    } else if (!report(dist, strings.length, scanDir(dist, strings))) ok = false;
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
