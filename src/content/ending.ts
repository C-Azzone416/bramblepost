/**
 * Converting between the game's ending shape (EndingScene, door/ending.ts) and the pack's (PackEnding, with
 * lists of versions). Only the shapes EndingScene can say are resolved exactly; a list the game can't express yet
 * resolves to its last (unconditional) entry, until the ending-variant work lands.
 */
import type { EndingCond, EndingLine, EndingScene } from "../door/ending";
import type { Requirement } from "../letters/types";
import type { PackEnding, Said } from "./types";

const one = (say: string): Said[] => [{ say }];

const condToRequirement = (c: EndingCond): Requirement =>
  "read" in c
    ? c.read.length === 1
      ? { kind: "read", letter: c.read[0] }
      : { kind: "any", of: c.read.map((letter) => ({ kind: "read", letter })) }
    : { kind: "flag", key: c.flag, value: c.is };

/** A requirement as an EndingCond, when it has one of the shapes EndingCond can say. */
function requirementToCond(r: Requirement): EndingCond | undefined {
  if (r.kind === "flag") return { flag: r.key, is: r.value };
  if (r.kind === "read") return { read: [r.letter] };
  if (r.kind === "any" && r.of.length > 0 && r.of.every((x) => x.kind === "read")) return { read: r.of.map((x) => (x as { letter: string }).letter) };
  return undefined;
}

/** Today's ending scene as a pack ending: plain strings become single-entry lists, branches become two-entry lists. */
export function endingToPack(scene: EndingScene): PackEnding {
  return {
    route: scene.route,
    kicker: one(scene.kicker),
    title: one(scene.title),
    envelope: one(scene.envelope),
    lines: scene.lines.map((l): string | Said[] => {
      if (typeof l === "string") return l;
      const hit: Said = { when: condToRequirement(l.if), say: l.say };
      return l.otherwise === undefined ? [hit] : [hit, { say: l.otherwise }];
    }),
  };
}

const lastSay = (list: Said[]): string => list[list.length - 1].say;

/** The ending scene the game plays for a pack ending. */
export function packToEndingScene(e: PackEnding): EndingScene {
  return {
    route: e.route,
    kicker: lastSay(e.kicker),
    title: lastSay(e.title),
    envelope: lastSay(e.envelope),
    lines: e.lines.map((l): EndingLine => {
      if (typeof l === "string") return l;
      const [first, second] = l;
      const cond = first.when ? requirementToCond(first.when) : undefined;
      if (cond && l.length === 1) return { say: first.say, if: cond };
      if (cond && l.length === 2 && !second.when) return { say: first.say, if: cond, otherwise: second.say };
      return lastSay(l);
    }),
  };
}
