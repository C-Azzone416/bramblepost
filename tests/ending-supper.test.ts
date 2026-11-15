/** The Spring Supper (#58): each thread's payoff plays when its letters were read, and any mix of reads or flags is coherent. */
import { describe, expect, it } from "vitest";
import { ENDING_SCENES, resolveLines, type EndingLine, type EndingState } from "../src/door/ending";
import { SPRING_LETTERS } from "../src/letters";

const SCENE = ENDING_SCENES.find((e) => e.route === "lastround")!;
const ALL = SPRING_LETTERS.map((l) => l.id);
const play = (read: string[], flags: Record<string, string> = {}) => resolveLines(SCENE.lines, { read, flags });
const thread = (t: string) => SPRING_LETTERS.filter((l) => l.thread === t).map((l) => l.id);
const has = (lines: string[], bit: string) => lines.some((l) => l.includes(bit));

// A phrase unique to each thread's "letters read" line, and to its fallback.
const PAYOFF = {
  tunnel: { read: "a hatch under each", none: "two moles are being very quiet" },
  carrots: { read: "as promised", none: "the whole lane holds its breath" },
  supper: { read: "I wrote many letters", none: "I asked the whole lane" },
  fair: { read: "judge of the Hollowmere Fair pies", none: "worth all of Bea's trembling" },
} as const;

describe("Spring Supper data", () => {
  it("every line, in every branch, is under 140 characters", () => {
    const texts = (l: EndingLine) => (typeof l === "string" ? [l] : [l.say, l.otherwise ?? ""]);
    for (const t of SCENE.lines.flatMap(texts)) expect(t.length, t).toBeLessThan(140);
  });

  it("branches only name letters and flags that exist", () => {
    const flags = new Set(["barnaby.pieBaker", "bea.pudding", "clementine.sundayNews"]);
    for (const l of SCENE.lines) {
      if (typeof l === "string") continue;
      if ("read" in l.if) for (const id of l.if.read) expect(ALL, id).toContain(id);
      else expect(flags.has(l.if.flag), l.if.flag).toBe(true);
      expect(l.otherwise, "every branch has a fallback").toBeDefined();
    }
  });

  it("the Supper carries the confession (C4) and the thank-you sign-off for everyone", () => {
    const lines = play([]);
    expect(has(lines, "buys her own carrots")).toBe(true);
    expect(lines[lines.length - 2]).toContain("Thank you, Pip");
    expect(lines[lines.length - 1]).toContain("Clementine");
  });
});

describe("Spring Supper branching", () => {
  it("with every letter read, each thread's payoff line plays and no fallback does", () => {
    const lines = play(ALL);
    for (const p of Object.values(PAYOFF)) {
      expect(has(lines, p.read), p.read).toBe(true);
      expect(has(lines, p.none), p.none).toBe(false);
    }
  });

  it("with no letters read, the scene is whole: every thread has its fallback and nothing is dropped", () => {
    const lines = play([]);
    expect(lines.length).toBe(SCENE.lines.length);
    for (const p of Object.values(PAYOFF)) {
      expect(has(lines, p.none), p.none).toBe(true);
      expect(has(lines, p.read), p.read).toBe(false);
    }
    // the fallbacks name nothing a reader would not know
    expect(has(lines, "Rule 4")).toBe(false);
  });

  it.each(Object.keys(PAYOFF))("reading only the %s thread pays off that thread and no other", (t) => {
    const lines = play(thread(t));
    for (const [k, p] of Object.entries(PAYOFF)) {
      expect(has(lines, p.read), `${t} -> ${k}`).toBe(k === t);
      expect(has(lines, p.none), `${t} -> ${k} fallback`).toBe(k !== t);
    }
  });

  it("a partial read (one early letter from each thread) is coherent and keeps the scene's length", () => {
    const lines = play(["tunnel-1", "carrots-1", "supper-1", "fair-1"]);
    expect(lines.length).toBe(SCENE.lines.length);
    expect(has(lines, PAYOFF.carrots.read)).toBe(true); // carrots-1 is enough
    expect(has(lines, PAYOFF.tunnel.none)).toBe(true); // tunnel-1 alone is only a puddle
    expect(has(lines, PAYOFF.supper.none)).toBe(true);
    expect(has(lines, PAYOFF.fair.read)).toBe(true);
  });

  it("the three swap flags pick their line, and the default (no reply, or the other reply) picks the other", () => {
    const pairs = [
      ["barnaby.pieBaker", "told", "are Miss Thimblewick's", "whoever she is"],
      ["bea.pudding", "letter", "ate a letter this spring", "postmaster of it"],
      ["clementine.sundayNews", "tell", "had it from the rounds", "no idea, three times"],
    ] as const;
    for (const [flag, reply, yes, no] of pairs) {
      const withReply = play([], { [flag]: reply });
      expect(has(withReply, yes), `${flag}=${reply}`).toBe(true);
      expect(has(withReply, no)).toBe(false);
      for (const other of [{}, { [flag]: "something-else" }, { [flag]: "toString" }]) {
        const lines = play([], other);
        expect(has(lines, no), JSON.stringify(other)).toBe(true);
        expect(has(lines, yes)).toBe(false);
      }
    }
  });

  it("flags and letters are independent: every flag variant works with every letter state", () => {
    const st = (read: string[], flags: Record<string, string>): EndingState => ({ read, flags });
    for (const read of [[], ALL, ["fair-3"]])
      for (const flags of [{} as Record<string, string>, { "barnaby.pieBaker": "told", "bea.pudding": "letter", "clementine.sundayNews": "tell" }]) {
        const lines = resolveLines(SCENE.lines, st(read, flags));
        expect(lines.length).toBe(SCENE.lines.length);
        expect(new Set(lines).size).toBe(lines.length);
      }
  });
});
