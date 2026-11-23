// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { endingsForPack } from "../src/content/active";
import { STANDARD_PACK } from "../src/content/standard";
import { withEnding } from "../src/door/endingView";
import { endingSeen, markEndingSeen } from "../src/door/endingSave";
import { LETTERS_KEY } from "../src/save/keys";
import { ROUTES } from "../src/levels";
import { NEIGHBOURHOODS } from "../src/village/data";

const store = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
};
const routes = Array.from({ length: 10 }, (_, i) => ({ id: `summer-${i}`, parcels: [] }));
const pack = () => {
  const p = structuredClone(STANDARD_PACK);
  p.seasons!.summer!.routes = routes;
  p.seasons!.summer!.ending = {
    route: "ignored", kicker: [{ say: "Kicker" }], title: [{ say: "Summer finale" }], envelope: [{ say: "Envelope" }],
    lines: [[
      { when: { kind: "read", letter: "first" }, say: "First match" },
      { when: { kind: "read", letter: "second" }, say: "Second match" },
      { say: "Fallback" },
    ], "Last line"],
  };
  return p;
};
const finishDialog = () => {
  const lines: string[] = [];
  for (let i = 0; i < 10 && document.getElementById("letterView"); i++) {
    document.querySelectorAll("#letterText p").forEach((p) => { if (p.textContent && !lines.includes(p.textContent)) lines.push(p.textContent); });
    document.querySelector<HTMLButtonElement>('[data-letter="next"]')!.click();
  }
  return lines;
};
afterEach(() => { document.body.innerHTML = ""; });

describe("defensive finale saves", () => {
  it.each(["{oops", "null", "5", "[]", "\"x\"", JSON.stringify({ routes: "nope" })])("overwrites invalid stored value %s", (bad) => {
    const save = store({ "bramblepost-ending-v1": bad });
    markEndingSeen(save);
    expect(endingSeen(save)).toBe(true);
    const later = store({ "bramblepost-ending-v1": bad });
    markEndingSeen(later, "summer-9");
    expect(endingSeen(later, "summer-9")).toBe(true);
  });
  it("preserves spring legacy seen when adding a later route", () => {
    const save = store({ "bramblepost-ending-v1": JSON.stringify({ seen: true }) });
    markEndingSeen(save, "summer-9");
    expect(endingSeen(save)).toBe(true);
    expect(endingSeen(save, "summer-9")).toBe(true);
  });
});

describe("season finales", () => {
  it("keeps spring-only packs unchanged and ignores a season without an ending", () => {
    const p = structuredClone(STANDARD_PACK);
    delete p.seasons;
    expect(endingsForPack(p)).toEqual([p.ending]);
    p.ending.route = "outdated";
    expect(endingsForPack(p)[0].route).toBe(NEIGHBOURHOODS.find((h) => h.season === "spring")!.routes.at(-1));
    const later = pack();
    delete later.seasons!.summer!.ending;
    expect(endingsForPack(later)).toEqual([later.ending]);
  });

  it("keeps spring on its own last route when the overall list gains a later route", () => {
    const springLast = NEIGHBOURHOODS.find((h) => h.season === "spring")!.routes.at(-1)!;
    ROUTES.push({ ...ROUTES[0], id: "future-summer" });
    try {
      const p = pack();
      p.ending = { route: "outdated", kicker: [{ say: "Kicker" }], title: [{ say: "Spring finale" }], envelope: [{ say: "Envelope" }], lines: ["Spring line"] };
      const scenes = endingsForPack(p).reverse(); // spring's identity must not depend on list order
      expect(scenes.find((scene) => scene.title === p.ending.title)?.route).toBe(springLast);
      const save = store();
      let continued = 0;
      const hook = withEnding((_r, done) => done(), scenes, { store: save, typeMs: 0 });
      hook({ route: { id: "future-summer" } } as never, () => continued++);
      expect(continued).toBe(1);
      expect(document.getElementById("letterView")).toBeNull();
      hook({ route: { id: springLast } } as never, () => continued++);
      expect(document.getElementById("letterTitle")!.textContent).toBe("Spring finale");
      finishDialog();
      expect(endingSeen(save)).toBe(true);
      expect(endingSeen(save, springLast)).toBe(false);
      expect(continued).toBe(2);
    } finally {
      ROUTES.pop();
    }
  });

  it("plays on the last later route, saves separately, and ordinary replay does not repeat it", () => {
    const scenes = endingsForPack(pack());
    expect(scenes[1].route).toBe("summer-9");
    const save = store();
    let continued = 0;
    const hook = withEnding((_r, done) => done(), scenes, { store: save, typeMs: 0 });
    hook({ route: { id: "summer-8" } } as never, () => continued++);
    expect(continued).toBe(1);
    hook({ route: { id: "summer-9" } } as never, () => continued++);
    expect(document.getElementById("letterTitle")!.textContent).toBe("Summer finale");
    expect(endingSeen(save, "summer-9")).toBe(false);
    finishDialog();
    expect(continued).toBe(2);
    expect(endingSeen(save, "summer-9")).toBe(true);
    expect(endingSeen(save)).toBe(false);
    hook({ route: { id: "summer-9" } } as never, () => continued++);
    expect(continued).toBe(3);
    expect(document.getElementById("letterView")).toBeNull();
  });

  it("allows the last route to play the finale again if it was left unfinished", () => {
    const save = store();
    const hook = withEnding((_r, done) => done(), endingsForPack(pack()), { store: save, typeMs: 0 });
    const result = { route: { id: "summer-9" } } as never;
    const cancel = hook(result, () => {}) as () => void;
    expect(document.getElementById("letterView")).not.toBeNull();
    cancel();
    expect(endingSeen(save, "summer-9")).toBe(false);
    hook(result, () => {});
    expect(document.getElementById("letterView")).not.toBeNull();
    finishDialog();
    expect(endingSeen(save, "summer-9")).toBe(true);
  });

  it.each([
    [["first", "second"], "First match"],
    [["second"], "Second match"],
    [[], "Fallback"],
  ])("renders the first matching version or fallback for %j", (read, expected) => {
    const scenes = endingsForPack(pack());
    let continued = false;
    withEnding((_r, done) => done(), scenes, { store: store(), lettersStore: store({ [LETTERS_KEY]: JSON.stringify({ read }) }), typeMs: 0 })(
      { route: { id: "summer-9" } } as never, () => { continued = true; },
    );
    expect(finishDialog()).toEqual([expected, "Last line"]);
    expect(continued).toBe(true);
  });
});
