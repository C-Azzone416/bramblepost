/**
 * Structural checks for a content pack. Pure functions: a pack in, a list of problems out.
 * A problem is a code and ids only ("recipient:sp-03"), never pack text, so the output is safe to print for any pack.
 */
import { ROUTES } from "../levels";
import { isMet } from "../letters/rules";
import { letterForSlot } from "../letters/rules";
import type { Letter, LetterSlot, Requirement } from "../letters/types";
import { NEIGHBOURS } from "../ui/cast";
import type { ContentPack, Said } from "./types";

export const MAX_LINE = 140;
export const MAX_LABEL = 32;
/** Above this many door replies the playthrough sweep is skipped (2^N combinations). */
export const MAX_SWEEP_FLAGS = 16;

const routeIndex = (id: string) => ROUTES.findIndex((r) => r.id === id);
const parcelOf = (l: Letter) => ROUTES[routeIndex(l.placement?.route ?? "")]?.parcels[l.placement?.slot ?? -1];
const versionIds = (s: LetterSlot): string[] => [s.letter, ...Object.values(s.by ?? {}), ...(s.cases ?? []).map((c) => c.letter)];
const leaves = (r: Requirement | undefined): Requirement[] => (!r ? [] : r.kind === "all" || r.kind === "any" ? r.of.flatMap(leaves) : [r]);
const saids = (list: (string | Said[])[]): Said[] => list.flatMap((l) => (typeof l === "string" ? [{ say: l }] : l));

/** Letter ids, flags and reply values the pack defines. */
function vocabulary(pack: ContentPack, index = routeIndex) {
  return {
    letters: new Set(pack.letters.map((l) => l.id)),
    replies: new Map(pack.scenes.map((s) => [s.flag, new Set(s.choices.map((c) => c.id))] as const)),
    flagRoute: new Map(pack.scenes.map((s) => [s.flag, index(s.route)] as const)),
  };
}

function allSeasons(pack: ContentPack): ContentPack {
  const seasons = Object.values(pack.seasons ?? {});
  return { ...pack, scenes: [...pack.scenes, ...seasons.flatMap((s) => s.scenes)], letters: [...pack.letters, ...seasons.flatMap((s) => s.letters)], slots: [...pack.slots, ...seasons.flatMap((s) => s.slots)] };
}

/** Everything except the playthrough sweep. */
export function checkStructure(pack: ContentPack): string[] {
  const original = pack;
  const out: string[] = [];
  for (const [season, content] of Object.entries(pack.seasons ?? {})) {
    if (content.intro && content.intro.length > 5) out.push(`intro-count:${season}`);
    if (content.intro?.some((line) => line.length >= MAX_LINE)) out.push(`intro-length:${season}`);
    const routes = content.routes ?? [];
    for (const route of routes) for (const parcel of route.parcels) {
      const house = parcel.slice(parcel.indexOf(":") + 1);
      if (!content.houses?.includes(house)) out.push(`route-house:${season}:${route.id}`);
    }
    if (routes.length === 10 && (routes[9].parcels.some((p) => p.startsWith("letter:") || p.startsWith("signed:")) || content.letters.some((l) => l.placement?.route === routes[9].id))) out.push(`route-10-letter:${season}`);
    for (const letter of content.letters) if (!routes.some((r) => r.id === letter.placement?.route)) out.push(`season-route:${letter.id}`);
    for (const slot of content.slots) for (const id of versionIds(slot)) {
      const letter = content.letters.find((l) => l.id === id);
      if (!letter || !routes.some((r) => r.id === letter.placement?.route)) out.push(`season-slot-route:${slot.letter}`);
    }
  }
  const laterRoutes = Object.values(original.seasons ?? {}).flatMap((s) => s.routes ?? []);
  const indexOfRoute = (id: string) => {
    const i = routeIndex(id);
    const later = laterRoutes.findIndex((r) => r.id === id);
    return i >= 0 ? i : later < 0 ? -1 : ROUTES.length + later;
  };
  pack = allSeasons(pack);
  const { letters, replies, flagRoute } = vocabulary(pack, indexOfRoute);
  const seen = new Set<string>();
  for (const l of pack.letters) {
    if (seen.has(l.id)) out.push(`dup-letter:${l.id}`);
    seen.add(l.id);
  }
  const flags = new Set<string>();
  for (const s of pack.scenes) {
    if (flags.has(s.flag)) out.push(`dup-flag:${s.flag}`);
    flags.add(s.flag);
    if (indexOfRoute(s.route) < 0) out.push(`scene-route:${s.flag}`);
  }

  // Placements, recipients and the tucked rule.
  const swapOf = new Map<string, LetterSlot>();
  for (const s of pack.slots) for (const id of versionIds(s)) swapOf.set(id, s);
  const at = new Map<string, string[]>();
  for (const l of pack.letters) {
    const p = l.placement;
    const later = laterRoutes.find((r) => r.id === p?.route);
    const code = later?.parcels[p?.slot ?? -1];
    const parcel = later ? (code ? { kind: code.split(":")[0], to: 0 } : undefined) : parcelOf(l);
    if (!p || !parcel) {
      out.push(`placement:${l.id}`);
      continue;
    }
    const route = ROUTES[indexOfRoute(p.route)];
    if ((later ? code?.split(":").slice(1).join(":") : NEIGHBOURS[route.houses[parcel.to]]?.id) !== l.recipient) out.push(`recipient:${l.id}`);
    if (!p.tucked && parcel.kind !== "letter" && parcel.kind !== "signed") out.push(`untucked-kind:${l.id}`);
    const key = `${p.route}#${p.slot}`;
    at.set(key, [...(at.get(key) ?? []), l.id]);
  }
  // Letters share a placement only as versions of one swap slot, and each swap slot's versions all share one.
  for (const [key, ids] of at) {
    if (ids.some((id) => swapOf.get(id) !== swapOf.get(ids[0]) || (ids.length > 1 && !swapOf.get(ids[0])))) out.push(`shared-placement:${key}`);
  }
  for (const s of pack.slots) {
    const keys = new Set(versionIds(s).map((id) => (letters.has(id) ? `${pack.letters.find((l) => l.id === id)!.placement?.route}#${pack.letters.find((l) => l.id === id)!.placement?.slot}` : "missing")));
    if (keys.size !== 1 || keys.has("missing")) out.push(`slot-versions:${s.letter}`);
    if (s.flag && !replies.has(s.flag)) out.push(`slot-flag:${s.letter}`);
    for (const v of Object.keys(s.by ?? {})) if (s.flag && !replies.get(s.flag)?.has(v)) out.push(`slot-by:${s.letter}`);
  }

  // Requirements point at real letters and real flag values; a flag only reaches routes after its scene.
  const checkReq = (r: Requirement | undefined, where: string, route: number | undefined) => {
    for (const x of leaves(r)) {
      if (x.kind === "read" && !letters.has(x.letter)) out.push(`req-letter:${where}`);
      if (x.kind === "flag") {
        if (!replies.get(x.key)?.has(x.value)) out.push(`req-flag:${where}`);
        else if (route !== undefined && (flagRoute.get(x.key) ?? 99) >= route) out.push(`flag-order:${where}`);
      }
    }
  };
  for (const l of pack.letters) checkReq(l.requires, l.id, l.placement ? indexOfRoute(l.placement.route) : undefined);
  for (const s of pack.slots) {
    const route = pack.letters.find((l) => l.id === s.letter)?.placement?.route;
    const ri = route === undefined ? undefined : indexOfRoute(route);
    for (const c of s.cases ?? []) checkReq(c.if, `${s.letter}:cases`, ri);
    if (s.flag && ri !== undefined && (flagRoute.get(s.flag) ?? 99) >= ri) out.push(`flag-order:${s.letter}`);
  }
  for (const s of pack.scenes)
    for (const line of s.lines)
      if (typeof line !== "string")
        for (const v of line) {
          if (!v.if?.flag) continue;
          if (v.if.is !== "unset" && !replies.get(v.if.flag)?.has(v.if.is ?? "")) out.push(`door-cond:${s.flag}`);
          else if ((flagRoute.get(v.if.flag) ?? 99) >= indexOfRoute(s.route)) out.push(`flag-order:${s.flag}`);
        }
  for (const currentEnding of [pack.ending, ...Object.values(original.seasons ?? {}).flatMap((s) => s.ending ? [s.ending] : [])]) {
  const ending = [currentEnding.kicker, currentEnding.title, currentEnding.envelope, ...currentEnding.lines.filter((l): l is Said[] => typeof l !== "string")];
  ending.forEach((list, i) => {
    list.forEach((v, j) => {
      checkReq(v.when, `ending:${i}`, undefined);
      if (j === list.length - 1 && v.when) out.push(`ending-last-when:${i}`);
    });
  });

  }

  // Lengths. Messages carry counts only.
  let long = 0;
  const tooLong = (t: string, max: number) => {
    if (t.length >= max) long++;
  };
  for (const l of pack.letters) for (const t of [l.sender, l.envelope, ...l.body]) tooLong(t, MAX_LINE);
  for (const s of pack.scenes) {
    for (const line of s.lines) for (const v of typeof line === "string" ? [{ say: line }] : line) tooLong(v.say, MAX_LINE);
    for (const c of s.choices) tooLong(c.reply, MAX_LINE);
  }
  for (const v of [...pack.ending.kicker, ...pack.ending.title, ...pack.ending.envelope, ...saids(pack.ending.lines)]) tooLong(v.say, MAX_LINE);
  for (const s of Object.values(original.seasons ?? {})) if (s.ending) for (const v of [...s.ending.kicker, ...s.ending.title, ...s.ending.envelope, ...saids(s.ending.lines)]) tooLong(v.say, MAX_LINE);
  if (long) out.push(`long-lines:${long}`);
  let labels = 0;
  for (const s of pack.scenes) {
    for (const t of [...s.choices.map((c) => c.label), s.stamp.name, s.speaker]) if (t.length > MAX_LABEL) labels++;
  }
  if (labels) out.push(`long-labels:${labels}`);
  return out;
}

export interface Sweep {
  /** Door-reply combinations played (0 when skipped for having too many replies). */
  combos: number;
  /** Letter slots that carry a letter on the routes: the number every playthrough should read. */
  expected: number;
  /** Combinations that read a different number of letters, or left a letter locked. */
  failures: number;
  problems: string[];
}

/**
 * Plays every combination of door replies. Routes go in order; a route's door reply is set before its queue is built (as in the game),
 * and the queue sees only the letters read on earlier routes. Each slot holds the version those replies and reads pick;
 * the letter is read when its requirements hold, otherwise it is "locked". Every playthrough should read exactly one letter per slot, so the
 * expected count is derived from the placements: the number of distinct (route, slot) pairs, 24 for the story shape.
 */
export function sweepPlaythroughs(pack: ContentPack): Sweep {
  pack = allSeasons(pack);
  const scenes = ROUTES.map((r) => pack.scenes.find((s) => s.route === r.id));
  const flagged = scenes.filter((s): s is NonNullable<typeof s> => !!s);
  if (flagged.length > MAX_SWEEP_FLAGS) return { combos: 0, expected: 0, failures: 0, problems: [`sweep-skipped:${flagged.length}`] };
  const byId = new Map(pack.letters.map((l) => [l.id, l]));
  const slotOf = new Map<string, LetterSlot>();
  for (const s of pack.slots) for (const id of versionIds(s)) slotOf.set(id, s);
  // Per route: its parcels' slots in order, each with the default letter that stands for the slot.
  const plan = ROUTES.map((r, ri) => {
    const items: { slot?: LetterSlot; only?: Letter }[] = [];
    const seen = new Set<string>();
    for (const l of pack.letters.filter((x) => x.placement?.route === r.id).sort((a, b) => a.placement!.slot - b.placement!.slot)) {
      const key = `${l.placement!.slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = slotOf.get(l.id);
      items.push(s ? { slot: s } : { only: l });
    }
    return { ri, scene: scenes[ri], items };
  });
  const expected = plan.reduce((n, p) => n + p.items.length, 0);
  const combos = 2 ** flagged.length;
  let failures = 0;
  const bad: number[] = [];
  for (let mask = 0; mask < combos; mask++) {
    const flags: Record<string, string> = {};
    const read = new Set<string>();
    let locked = 0;
    let k = 0;
    for (const p of plan) {
      if (p.scene) flags[p.scene.flag] = p.scene.choices[(mask >> k++) & 1].id;
      // The game builds a route's whole queue from what was read BEFORE the route (unreadForRoute), so versions and
      // requirements see this snapshot; the route's letters join `read` only afterwards.
      const before: ReadonlySet<string> = new Set(read);
      const queue: string[] = [];
      for (const it of p.items) {
        const l = it.only ?? byId.get(letterForSlot(it.slot!, flags, before));
        if (l && isMet(l.requires, { read: before, flags })) queue.push(l.id);
        else locked++;
      }
      for (const id of queue) read.add(id);
    }
    if (locked || read.size !== expected) {
      failures++;
      if (bad.length < 3) bad.push(mask);
    }
  }
  const problems = failures ? [`playthrough:${failures}-of-${combos}`, ...bad.map((m) => `playthrough-sample:${m}`)] : [];
  return { combos, expected, failures, problems };
}

/** Every check. */
export const checkPack = (pack: ContentPack): string[] => [...checkStructure(pack), ...sweepPlaythroughs(pack).problems];
