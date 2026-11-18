/**
 * Structural checks for a content pack. Pure functions: a pack in, a list of problems out.
 * A problem is a code and ids only ("recipient:sp-03"), never pack text, so the output is safe to print for any pack.
 */
import { ROUTES } from "../levels";
import { isMet } from "../letters/rules";
import { letterForSlot } from "../letters/rules";
import type { Letter, LetterSlot, Requirement } from "../letters/types";
import { NEIGHBOURS } from "../ui/cast";
import { NEIGHBOURHOODS } from "../village/data";
import type { ContentPack, Said } from "./types";

export const MAX_LINE = 140;
export const MAX_LABEL = 32;
/** Bound memory by live states, rather than by the number of door replies. */
export const MAX_SWEEP_STATES = 2 ** 16;

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
  const seasons = (["summer", "autumn", "winter"] as const).flatMap((s) => pack.seasons?.[s] ? [pack.seasons[s]!] : []);
  return {
    ...pack,
    scenes: [...pack.scenes, ...seasons.flatMap((s) => s.scenes)],
    letters: [...pack.letters, ...seasons.flatMap((s) => s.letters)],
    slots: [...pack.slots, ...seasons.flatMap((s) => s.slots)],
  };
}

/** Everything except the playthrough sweep. */
export function checkStructure(pack: ContentPack): string[] {
  const original = pack;
  const out: string[] = [];
  const gameSeasons = new Map(NEIGHBOURHOODS.flatMap((n) => n.routes.map((id) => [id, n.season] as const)));
  const routeIds = new Set<string>();
  for (const [season, content] of Object.entries(pack.seasons ?? {})) {
    if (content.intro && content.intro.length > 5) out.push(`intro-count:${season}`);
    if (content.intro?.some((line) => line.length >= MAX_LINE)) out.push(`intro-length:${season}`);
    const routes = content.routes ?? [];
    if (routes.length && routes.length !== 10) out.push(`route-count:${season}`);
    const gameIds = ROUTES.filter((r) => gameSeasons.get(r.id) === season).map((r) => r.id);
    if (routes.length && gameIds.length && (
      routes.length !== gameIds.length || routes.some((r, i) => r.id !== gameIds[i])
    )) out.push(`route-order:${season}`);
    for (const route of routes) {
      if (routeIds.has(route.id) || (gameSeasons.has(route.id) && gameSeasons.get(route.id) !== season)) out.push(`dup-route:${route.id}`);
      routeIds.add(route.id);
    }
    for (const route of routes) {
      for (const parcel of route.parcels) {
        const house = parcel.slice(parcel.indexOf(":") + 1);
        if (!content.houses?.includes(house)) out.push(`route-house:${season}:${route.id}`);
      }
    }
    if (routes.length === 10 && (
      routes[9].parcels.some((p) => p.startsWith("letter:") || p.startsWith("signed:")) ||
      content.letters.some((l) => l.placement?.route === routes[9].id)
    )) out.push(`route-10-letter:${season}`);
    for (const letter of content.letters) {
      if (!routes.some((r) => r.id === letter.placement?.route)) out.push(`season-route:${letter.id}`);
    }
    for (const slot of content.slots) {
      for (const id of versionIds(slot)) {
        const letter = content.letters.find((l) => l.id === id);
        if (!letter || !routes.some((r) => r.id === letter.placement?.route)) out.push(`season-slot-route:${slot.letter}`);
      }
    }
  }
  const laterRoutes = (["summer", "autumn", "winter"] as const).flatMap((s) => original.seasons?.[s]?.routes ?? []);
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
    const recipient = later ? code?.split(":").slice(1).join(":") : NEIGHBOURS[route.houses[parcel.to]]?.id;
    if (recipient !== l.recipient) out.push(`recipient:${l.id}`);
    if (!p.tucked && parcel.kind !== "letter" && parcel.kind !== "signed") out.push(`untucked-kind:${l.id}`);
    const key = `${p.route}#${p.slot}`;
    at.set(key, [...(at.get(key) ?? []), l.id]);
  }
  // Letters share a placement only as versions of one swap slot, and each swap slot's versions all share one.
  for (const [key, ids] of at) {
    if (ids.some((id) => swapOf.get(id) !== swapOf.get(ids[0]) || (ids.length > 1 && !swapOf.get(ids[0])))) {
      out.push(`shared-placement:${key}`);
    }
  }
  for (const s of pack.slots) {
    const keys = new Set(versionIds(s).map((id) => {
      const placement = pack.letters.find((l) => l.id === id)?.placement;
      return letters.has(id) ? `${placement?.route}#${placement?.slot}` : "missing";
    }));
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
  const endings = [pack.ending, ...Object.values(original.seasons ?? {}).flatMap((s) => s.ending ? [s.ending] : [])];
  for (const currentEnding of endings) {
    const ending = [
      currentEnding.kicker, currentEnding.title, currentEnding.envelope,
      ...currentEnding.lines.filter((l): l is Said[] => typeof l !== "string"),
    ];
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
  for (const ending of endings) {
    const texts = [...ending.kicker, ...ending.title, ...ending.envelope, ...saids(ending.lines)];
    for (const v of texts) tooLong(v.say, MAX_LINE);
  }
  if (long) out.push(`long-lines:${long}`);
  let labels = 0;
  for (const s of pack.scenes) {
    for (const t of [...s.choices.map((c) => c.label), s.stamp.name, s.speaker]) if (t.length > MAX_LABEL) labels++;
  }
  if (labels) out.push(`long-labels:${labels}`);
  return out;
}

export interface Sweep {
  /** Door-reply combinations played (0 when skipped for having too many distinct states). */
  combos: number;
  /** Letter slots that carry a letter on the routes: the number every playthrough should read. */
  expected: number;
  /** Combinations that read a different number of letters, or left a letter locked. */
  failures: number;
  problems: string[];
}

/**
 * Counts every combination of door replies with a forward sweep, merging states with identical future inputs and totals.
 * Routes go in order; a route's door reply is set before its queue is built (as in the game),
 * and the queue sees only the letters read on earlier routes. Each slot holds the version those replies and reads pick;
 * the letter is read when its requirements hold, otherwise it is "locked". Every playthrough should read exactly one letter per slot, so the
 * expected count is derived from the placements: the number of distinct (route, slot) pairs.
 */
export function sweepPlaythroughs(pack: ContentPack): Sweep {
  const endings = [pack.ending, ...Object.values(pack.seasons ?? {}).flatMap((s) => s.ending ? [s.ending] : [])];
  pack = allSeasons(pack);
  const byId = new Map(pack.letters.map((l) => [l.id, l]));
  const slotOf = new Map<string, LetterSlot>();
  for (const s of pack.slots) for (const id of versionIds(s)) slotOf.set(id, s);
  // Per route: its parcels' slots in order, each with the default letter that stands for the slot.
  const plan = ROUTES.map((r) => {
    const items: { slot?: LetterSlot; only?: Letter }[] = [];
    const seen = new Set<number>();
    for (const l of pack.letters.filter((x) => x.placement?.route === r.id).sort((a, b) => a.placement!.slot - b.placement!.slot)) {
      const key = l.placement!.slot;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = slotOf.get(l.id);
      items.push(s ? { slot: s } : { only: l });
    }
    return { scene: pack.scenes.find((s) => s.route === r.id), items };
  });
  const expected = plan.reduce((n, p) => n + p.items.length, 0);
  const combos = 2 ** plan.filter((p) => p.scene).length;

  // Last uses include every possible version, not just the version a particular state picks.
  // Include presentation predicates too: spring replies/reads can still be used by summer endings.
  const flagUse = new Map<string, number>();
  const readUse = new Map<string, number>();
  const use = (map: Map<string, number>, key: string, ri: number) => map.set(key, Math.max(map.get(key) ?? -1, ri));
  const requireAt = (req: Requirement | undefined, ri: number) => {
    for (const leaf of leaves(req)) {
      if (leaf.kind === "flag") use(flagUse, leaf.key, ri);
      if (leaf.kind === "read") use(readUse, leaf.letter, ri);
    }
  };
  plan.forEach((p, ri) => {
    for (const item of p.items) {
      if (item.slot) {
        if (item.slot.flag) use(flagUse, item.slot.flag, ri);
        for (const c of item.slot.cases ?? []) requireAt(c.if, ri);
      }
      for (const id of item.slot ? versionIds(item.slot) : [item.only!.id]) {
        requireAt(item.only ? item.only.requires : byId.get(id)?.requires, ri);
        // Retain membership until its last possible insertion as well, so the total remains
        // the size of a set even for malformed packs that select an id more than once.
        use(readUse, id, ri);
      }
    }
    for (const line of p.scene?.lines ?? []) if (typeof line !== "string") {
      for (const v of line) if (v.if?.flag) use(flagUse, v.if.flag, ri);
    }
  });
  for (const ending of endings) {
    const ri = routeIndex(ending.route);
    // Endings see this route's newly read letters. Unknown routes conservatively retain
    // their dependencies through the end of the sweep.
    const at = (ri < 0 ? plan.length : ri) + 0.5;
    for (const v of [...ending.kicker, ...ending.title, ...ending.envelope, ...saids(ending.lines)]) requireAt(v.when, at);
  }

  interface State {
    flags: Record<string, string>;
    read: Set<string>;
    readCount: number;
    locked: number;
    weight: number;
    /** Three smallest masks represented by this state (for the existing diagnostics). */
    samples: number[];
  }
  let states: State[] = [{ flags: {}, read: new Set(), readCount: 0, locked: 0, weight: 1, samples: [0] }];
  let bit = 0;
  for (const [ri, p] of plan.entries()) {
    const next = new Map<string, State>();
    for (const state of states) for (let choice = 0; choice < (p.scene ? 2 : 1); choice++) {
      const flags = p.scene ? { ...state.flags, [p.scene.flag]: p.scene.choices[choice].id } : state.flags;
      const read = new Set(state.read);
      let readCount = state.readCount;
      let locked = state.locked;
      // Queue construction sees the read set BEFORE this route, just as in the game.
      for (const item of p.items) {
        const l = item.only ?? byId.get(letterForSlot(item.slot!, flags, state.read));
        if (l && isMet(l.requires, { read: state.read, flags })) {
          if (!read.has(l.id)) readCount++;
          read.add(l.id);
        } else locked++;
      }
      const keptFlags = Object.entries(flags).filter(([key]) => (flagUse.get(key) ?? -1) > ri).sort(([a], [b]) => a.localeCompare(b));
      const keptRead = [...read].filter((id) => (readUse.get(id) ?? -1) > ri).sort();
      const key = JSON.stringify([keptFlags, keptRead, readCount, locked]);
      const samples = state.samples.map((mask) => mask + choice * 2 ** bit);
      const existing = next.get(key);
      if (existing) {
        existing.weight += state.weight;
        existing.samples = [...existing.samples, ...samples].sort((a, b) => a - b).slice(0, 3);
      } else {
        next.set(key, { flags: Object.fromEntries(keptFlags), read: new Set(keptRead), readCount, locked, weight: state.weight, samples });
        if (next.size > MAX_SWEEP_STATES) return { combos: 0, expected, failures: 0, problems: ["sweep-skipped:states"] };
      }
    }
    states = [...next.values()];
    if (p.scene) bit++;
  }
  const failed = states.filter((s) => s.locked || s.readCount !== expected);
  const failures = failed.reduce((n, s) => n + s.weight, 0);
  const bad = failed.flatMap((s) => s.samples).sort((a, b) => a - b).slice(0, 3);
  const problems = failures ? [`playthrough:${failures}-of-${combos}`, ...bad.map((m) => `playthrough-sample:${m}`)] : [];
  return { combos, expected, failures, problems };
}

/** Every check. */
export const checkPack = (pack: ContentPack): string[] => [...checkStructure(pack), ...sweepPlaythroughs(pack).problems];
