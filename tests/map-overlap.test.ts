/**
 * #103: the Today callout, Pip and the star pills of finished nodes never overlap, on any village layout and in any
 * progress state (every open lane, with every earlier lane finished). Pure geometry; the rendered check in
 * tests/phone/contrast.spec.ts repeats it on the painted map.
 */
import { describe, expect, it } from "vitest";
import { NEIGHBOURHOODS, sceneryOf } from "../src/village/data";
import { calloutOffset, calloutRect, pillRect, pipRect, pipSpot, rectsHit } from "../src/village/pip";

describe("the callout, Pip and star pills stay apart", () => {
  for (const N of NEIGHBOURHOODS.filter((n) => n.slots.length)) {
    it(`${N.id}: every state`, () => {
      const start = sceneryOf(N).start;
      for (let open = 0; open < N.slots.length; open++) {
        const pills = N.slots.slice(0, open).map(pillRect);
        const pip = pipRect(pipSpot(N.slots, open, start, pills));
        const w = 24 + "Today · Route 15".length * 8; // the longest label
        const callout = calloutRect(N.slots[open], w, calloutOffset(N.slots[open], w, [pip, ...pills]));
        const where = `${N.id} open ${open}`;
        expect(pills.some((p) => rectsHit(pip, p)), `${where}: Pip over a star pill`).toBe(false);
        expect(pills.some((p) => rectsHit(callout, p)), `${where}: callout over a star pill`).toBe(false);
        expect(rectsHit(pip, callout), `${where}: Pip over the callout`).toBe(false);
      }
    });
  }
});
