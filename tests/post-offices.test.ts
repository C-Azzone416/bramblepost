// @vitest-environment jsdom
/** #141: each later village has its own post office sprite, on its map and on its route boards; spring keeps the stump. */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";
import { NEIGHBOURHOODS, postOfficeSpriteOf, sceneryOf } from "../src/village/data";

const SHEET = readFileSync("src/ui/sprites.svg", "utf8");
const EXPECTED: Record<string, string> = { thistledown: "rbPO", hollowmere: "poHollowmere", conker: "poConker", snowberry: "poSnowberry" };

describe("post office sprites", () => {
  it("each village resolves its own sprite id, and the sprite exists in sprites.svg", () => {
    expect(NEIGHBOURHOODS.map((n) => n.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const n of NEIGHBOURHOODS) {
      const id = postOfficeSpriteOf(n);
      expect(id, n.id).toBe(EXPECTED[n.id]);
      expect(SHEET.includes(`<symbol id="${id}"`), `${id} in sprites.svg`).toBe(true);
    }
  });

  it("spring is unchanged: the stump, no postOfficeSprite set, no postOfficeAt", () => {
    const sc = sceneryOf(NEIGHBOURHOODS[0]);
    expect(NEIGHBOURHOODS[0].id).toBe("thistledown");
    expect(sc.postOfficeSprite).toBeUndefined();
    expect(sc.postOfficeAt).toBeUndefined();
    expect(postOfficeSpriteOf(undefined)).toBe("rbPO");
  });

  it("each later village's sprite is a 100 × 105 symbol, like the stump's map box", () => {
    for (const id of ["poHollowmere", "poConker", "poSnowberry"]) expect(SHEET).toMatch(new RegExp(`<symbol id="${id}" viewBox="0 0 100 105">`));
  });
});

describe("post office tile on the route board", () => {
  let bp: GameApi;
  beforeAll(() => {
    localStorage.clear();
    window.scrollTo = () => {};
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const root = document.createElement("div");
    document.body.appendChild(root);
    bp = mountApp(root, ROUTES) as unknown as GameApi;
  });

  it("a route of each village draws that village's post office on its board", () => {
    for (const n of NEIGHBOURHOODS) {
      for (const id of [n.routes[0], n.routes[n.routes.length - 1]]) {
        const i = ROUTES.findIndex((r) => r.id === id);
        expect(i, id).toBeGreaterThanOrEqual(0);
        bp.openLevel(i);
        const uses = [...document.querySelectorAll("#board use")].map((u) => u.getAttribute("href"));
        expect(uses, id).toContain("#" + EXPECTED[n.id]);
        for (const other of Object.values(EXPECTED)) if (other !== EXPECTED[n.id]) expect(uses, `${id} has no ${other}`).not.toContain("#" + other);
      }
    }
  });
});
