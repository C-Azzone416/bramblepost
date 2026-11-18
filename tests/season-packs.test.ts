import { expect, it } from "vitest";
import { checkPack, checkStructure } from "../src/content/check";
import { STANDARD_PACK } from "../src/content/standard";
import { routeLabel } from "../src/ui/game";
import { NEIGHBOURHOODS } from "../src/village/data";
import { storyStrings } from "../tools/leak-check";

it("checks spring-only and multi-season packs", () => {
  const { seasons, ...spring } = STANDARD_PACK;
  expect(checkPack(spring)).toEqual([]);
  expect(checkPack(STANDARD_PACK)).toEqual([]);
  const scene = { ...spring.scenes[0], flag: "future-flag", route: "missing" };
  expect(checkStructure({ ...spring, seasons: { summer: { scenes: [scene], letters: [], slots: [] } } })).toContain("scene-route:future-flag");
  expect(seasons?.summer?.placeholder?.scene).toContain("Placeholder");
});

it("finds later-season strings in leak checking", () => {
  expect(storyStrings({ seasons: { winter: { scenes: [{ speaker: "Synthetic Winter Label" }] } } }, [])).toContain("Synthetic Winter Label");
});

it("labels routes by their position within their village", () => {
  expect(routeLabel(NEIGHBOURHOODS[0].routes[2], 2)).toBe("Spring · Route 3");
  const village = { ...NEIGHBOURHOODS[1], routes: ["one", "two", "three"] };
  expect(routeLabel("three", 7, [village])).toBe("Summer · Route 3");
  expect(routeLabel("unknown", 4, [village])).toBe("Route 5");
});

 it("checks later-season scenes and letters against existing route rules", () => {
  const scene = { ...STANDARD_PACK.scenes[0], flag: "future-flag", route: "fake-route" };
  const letter = { ...STANDARD_PACK.letters[0], id: "future-letter", placement: { route: "fake-route", slot: 0 } };
  const pack = { ...STANDARD_PACK, seasons: { summer: { scenes: [scene], letters: [letter], slots: [] } } };
  const errors = checkStructure(pack);
  expect(errors).toContain("scene-route:future-flag");
  expect(errors).toContain("placement:future-letter");
});

it("validates full season data and rejects invalid additions", () => {
  const base = { scenes: [], letters: [], slots: [], village: "hollowmere", intro: ["intro"], houses: ["house"], routes: Array.from({ length: 10 }, (_, i) => ({ id: `future-${i}`, parcels: ["parcel:house"] })), ending: { route: "future-9", kicker: [{ say: "kicker" }], title: [{ say: "title" }], envelope: [{ say: "envelope" }], lines: ["ending"] } };
  const check = (summer: typeof base) => checkStructure({ ...STANDARD_PACK, seasons: { summer } });
  expect(check(base)).toEqual([]);
  expect(check({ ...base, intro: Array(6).fill("x") })).toContain("intro-count:summer");
  expect(check({ ...base, intro: ["x".repeat(140)] })).toContain("intro-length:summer");
  expect(check({ ...base, houses: [] })).toContain("route-house:summer:future-0");
  expect(check({ ...base, routes: base.routes.map((r, i) => i === 9 ? { ...r, parcels: ["letter:house"] } : r) })).toContain("route-10-letter:summer");
  expect(check({ ...base, ending: { ...base.ending, lines: ["x".repeat(140)] } })).toContain("long-lines:1");
});

it("walks season intro, ending and placeholder strings", () => {
  const strings = ["Synthetic intro line", "Synthetic ending line", "Synthetic placeholder scene"];
  expect(storyStrings({ seasons: { summer: { intro: [strings[0]], ending: { lines: [strings[1]] }, placeholder: { scene: strings[2] } } } }, [])).toEqual(expect.arrayContaining(strings));
});

it("accepts a tucked letter on a plain parcel but rejects an untucked letter", () => {
  const letter = { ...STANDARD_PACK.letters[0], id: "future-note", recipient: "clementine" as const,
    placement: { route: "future-0", slot: 0, tucked: true } };
  const summer = { scenes: [], slots: [], letters: [letter], houses: ["clementine"],
    routes: Array.from({ length: 10 }, (_, i) => ({ id: `future-${i}`, parcels: ["parcel:clementine" as const] })) };
  expect(checkStructure({ ...STANDARD_PACK, seasons: { summer } })).toEqual([]);
  letter.placement.tucked = false;
  expect(checkStructure({ ...STANDARD_PACK, seasons: { summer } })).toContain("untucked-kind:future-note");
});
