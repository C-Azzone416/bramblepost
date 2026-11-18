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
