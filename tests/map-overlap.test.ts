/**
 * #103: the Today callout, Pip and the finished nodes' star pills stay apart, and the callout's tail points at its marker.
 * Pure geometry from the same functions the renderer uses (layoutMarkers, calloutShape, pillRect, nodeRect, markerRect), over
 * every village layout and these progress states: each open lane with all earlier lanes finished, 60 scattered completion
 * sets per village (a saved finish can be on any route, so lanes can be finished out of order and several can be open), every
 * lane finished (no callout), and a village with no routes (Hollowmere: Pip waits at the gate). The rendered check in
 * tests/phone/contrast.spec.ts repeats the overlap check on the painted map.
 *
 * Not modelled: which lane the player has selected (the ring moves to it; Pip and the callout do not).
 */
import { describe, expect, it } from "vitest";
import { NEIGHBOURHOODS, sceneryOf, type Neighbourhood } from "../src/village/data";
import { calloutHits, calloutShape, hitCap, hits, layoutMarkers, nodeRect, pillRect, pipRect, rectsHit, TAIL_GAP } from "../src/village/pip";
import { villageProgress } from "../src/village/progress";

const W = 24 + "Today · Route 15".length * 8; // the longest label

/** A state: which lane indexes are finished. */
function states(N: Neighbourhood): { name: string; done: number[] }[] {
  const n = N.routes.length;
  const out: { name: string; done: number[] }[] = [];
  for (let open = 0; open < n; open++) out.push({ name: `open ${open}`, done: Array.from({ length: open }, (_, i) => i) });
  out.push({ name: "all complete", done: Array.from({ length: n }, (_, i) => i) });
  let seed = 7 + n;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let k = 0; k < 60; k++) out.push({ name: `scattered ${k}`, done: Array.from({ length: n }, (_, i) => i).filter(() => rnd() < 0.4) });
  return out;
}

/** The layout for a finished set, the way the map works it out (real progress rules; Pip heads for the open lane, else the last finished). */
function layoutFor(N: Neighbourhood, done: number[]) {
  const best = Object.fromEntries(done.map((i) => [N.routes[i], { stars: 2, moves: 9 }]));
  const lanes = villageProgress(best).hoods.find((h) => h.id === N.id)!.lanes;
  const open = lanes.findIndex((l) => l.state === "open");
  const finished = lanes.flatMap((l, i) => (l.state === "done" ? [i] : []));
  const target = open >= 0 ? open : finished.length ? finished[finished.length - 1] : 0;
  const L = layoutMarkers(N.slots, sceneryOf(N).start, N.routes.length, new Set(finished), target, open >= 0 ? open : null, W);
  return { L, finished, target, open, lanes };
}

describe("the callout, Pip and star pills stay apart", () => {
  for (const N of NEIGHBOURHOODS.filter((n) => n.slots.length)) {
    it(`${N.id}: every state`, () => {
      for (const { name, done } of states(N)) {
        const { L, finished, target, open } = layoutFor(N, done);
        const where = `${N.id} ${name}`;
        const lanes = N.slots.slice(0, N.routes.length);
        const pip = pipRect(L.pip);
        const pills = finished.map((i) => pillRect(lanes[i]));
        const others = lanes.filter((_, i) => i !== target).map(nodeRect);
        const active: [number, number, number] | null = N.routes.length ? [lanes[target].x, lanes[target].y, L.hitR] : null; // the open marker, ring, pulse and tap circle
        expect(pills.some((p) => rectsHit(pip, p)), `${where}: Pip over a star pill`).toBe(false);
        expect(others.some((o) => rectsHit(pip, o)), `${where}: Pip over a node marker`).toBe(false);
        if (active) expect(hits(pip, active), `${where}: Pip over the open marker or its tap circle`).toBe(false);
        if (open >= 0 && L.callout) {
          const marker = lanes[open];
          const sh = calloutShape(marker, W, L.callout);
          expect(pills.some((p) => calloutHits(sh, p)), `${where}: callout or its tail over a star pill`).toBe(false);
          expect(others.some((o) => calloutHits(sh, o)), `${where}: callout or its tail over another node marker`).toBe(false);
          expect(calloutHits(sh, pip), `${where}: Pip over the callout or its tail`).toBe(false);
          // the tail points at the marker: its tip is on the marker's rim (TAIL_GAP from the centre), and the tail's direction
          // (base to tip) lines up with the direction to the marker's centre
          expect(Math.hypot(sh.tip.x - marker.x, sh.tip.y - marker.y), `${where}: tail tip at the rim`).toBeCloseTo(TAIL_GAP, 3);
          const a = Math.atan2(sh.tip.y - sh.base.y, sh.tip.x - sh.base.x), b = Math.atan2(marker.y - sh.base.y, marker.x - sh.base.x);
          expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))), `${where}: tail points at the marker`).toBeLessThan(0.02);
        } else {
          expect(L.callout, `${where}: no callout without an open lane`).toBeNull();
        }
      }
    });
  }

  it("a village with no routes (Hollowmere): Pip waits at the gate, no callout", () => {
    const N = NEIGHBOURHOODS.find((n) => n.slots.length && !n.routes.length)!;
    const { L } = layoutFor(N, []);
    expect(L.callout).toBeNull();
    expect(L.pip.x).toBeGreaterThanOrEqual(0);
  });

  it("the tap circle at its largest (hitCap) is what Pip keeps clear of", () => {
    const N = NEIGHBOURHOODS.find((n) => n.id === "thistledown")!;
    const lanes = N.slots.slice(0, N.routes.length);
    const { L } = layoutFor(N, [0, 1, 2]);
    expect(L.hitR).toBe(Math.max(38, Math.min(hitCap(lanes[3], lanes), 70)));
  });
});
