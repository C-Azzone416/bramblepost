/**
 * Converting today's ending data (EndingScene, door/ending.ts) into the pack's shape (PackEnding, with lists of
 * versions). The game plays a PackEnding directly (resolveText/resolveLines in door/ending.ts); this is only how the
 * standard pack gets its ending from the shipped data.
 */
import type { EndingCond, EndingScene } from "../door/ending";
import type { Requirement } from "../letters/types";
import type { PackEnding, Said } from "./types";

const one = (say: string): Said[] => [{ say }];

const condToRequirement = (c: EndingCond): Requirement =>
  "read" in c
    ? c.read.length === 1
      ? { kind: "read", letter: c.read[0] }
      : { kind: "any", of: c.read.map((letter) => ({ kind: "read", letter })) }
    : { kind: "flag", key: c.flag, value: c.is };

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
