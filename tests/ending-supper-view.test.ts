// @vitest-environment jsdom
/** The Spring Supper on screen (#58): withEnding resolves the lines from the saved letters and door flags at play time. */
import { describe, expect, it } from "vitest";
import { ENDING_SCENES } from "../src/door/ending";
import { withEnding } from "../src/door/endingView";
import { DOOR_KEY, LETTERS_KEY } from "../src/save/keys";
import { SPRING as ROUTES } from "../src/levels";

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

/** Plays the ending through (typeMs 0) and returns every line shown, in order. */
function shown(read: string[], flags: Record<string, string>): { lines: string[]; continued: boolean; title: string } {
  const lettersStore = fakeStore({ [LETTERS_KEY]: JSON.stringify({ read }) });
  const doorStore = fakeStore({ [DOOR_KEY]: JSON.stringify({ flags, voices: true }) });
  let continued = false;
  withEnding((_r, c) => c(), ENDING_SCENES, { typeMs: 0, store: fakeStore(), lettersStore, doorStore })(
    { route: ROUTES[ROUTES.length - 1] } as never,
    () => (continued = true),
  );
  const title = document.getElementById("letterTitle")!.textContent!;
  const lines: string[] = [];
  const next = () => document.querySelector<HTMLButtonElement>('[data-letter="next"]')!;
  for (let i = 0; i < 40 && document.getElementById("letterView"); i++) {
    const text = document.getElementById("letterText")!;
    for (const p of Array.from(text.children)) if (p.textContent && !lines.includes(p.textContent)) lines.push(p.textContent);
    next().click();
  }
  return { lines, continued, title };
}

describe("Spring Supper view", () => {
  it("plays the resolved scene for a player who read everything, then continues", () => {
    const r = shown(["tunnel-4", "carrots-3", "supper-5", "fair-3"], { "barnaby.pieBaker": "told" });
    expect(r.title).toBe("Barnaby's Spring Supper");
    expect(r.continued).toBe(true);
    const all = r.lines.join("\n");
    expect(all).toContain("a hatch under each");
    expect(all).toContain("I wrote many letters");
    expect(all).toContain("are Miss Thimblewick's");
    expect(all).toContain("Spring is done");
  });

  it("plays a whole scene for a player who read nothing and replied to nothing", () => {
    const r = shown([], {});
    expect(r.continued).toBe(true);
    const all = r.lines.join("\n");
    expect(all).toContain("two moles are being very quiet");
    expect(all).toContain("I asked the whole lane");
    expect(all).toContain("whoever she is");
    expect(all).toContain("Thank you, Pip");
    expect(all).not.toContain("a hatch under each");
  });
});
