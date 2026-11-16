/**
 * #103: the Today callout, Pip and the finished nodes' star pills stay apart, and the callout's tail points at its marker.
 * Pure geometry from the same functions the renderer uses (layoutMarkers, calloutShape, pillRect, nodeCircle), over
 * every village layout and these progress states: each open lane with all earlier lanes finished, 60 scattered completion
 * sets per village (a saved finish can be on any route, so lanes can be finished out of order and several can be open), every
 * lane finished (no callout), and a village with no routes (Hollowmere: Pip waits at the gate). The rendered check in
 * tests/phone/contrast.spec.ts repeats the overlap check on the painted map.
 *
 * Selection: Pip and the callout do not move with the selected lane, so they keep clear of every node's ring (out to RING_OUTER).
 * Where a cramped spot leaves Pip no clear place, layoutMarkers falls back to his usual spot; the states below all have room.
 */
import { describe, expect, it } from "vitest";
import { MAP_H, MAP_W, NEIGHBOURHOODS, sceneryOf, type Neighbourhood } from "../src/village/data";
import { calloutHits, calloutShape, hitCap, hits, layoutMarkers, nodeCircle, pillRect, pipRect, rectsHit, RING_OUTER, TAIL_GAP } from "../src/village/pip";
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
        const others = lanes.filter((_, i) => i !== target).map(nodeCircle); // each out to its selection ring
        const active: [number, number, number] | null = N.routes.length ? [lanes[target].x, lanes[target].y, L.hitR] : null; // the open marker, ring, pulse and tap circle
        expect(pip[0], `${where}: Pip past the left edge`).toBeGreaterThanOrEqual(0);
        expect(pip[1], `${where}: Pip past the top edge`).toBeGreaterThanOrEqual(0);
        expect(pip[2], `${where}: Pip past the right edge`).toBeLessThanOrEqual(MAP_W);
        expect(pip[3], `${where}: Pip past the bottom edge`).toBeLessThanOrEqual(MAP_H);
        expect(pills.some((p) => rectsHit(pip, p)), `${where}: Pip over a star pill`).toBe(false);
        expect(others.some((o) => hits(pip, o)), `${where}: Pip over a node marker or its selection ring`).toBe(false);
        // whichever node the player selects, its ring (out to RING_OUTER) stays clear of Pip, the callout and its tail
        for (let sel = 0; sel < lanes.length; sel++) {
          const ring: [number, number, number] = [lanes[sel].x, lanes[sel].y, RING_OUTER];
          expect(hits(pip, ring), `${where}: Pip over the selection ring of lane ${sel}`).toBe(false);
          if (open >= 0 && L.callout && sel !== open) expect(calloutHits(calloutShape(lanes[open], W, L.callout), ring), `${where}: callout over the selection ring of lane ${sel}`).toBe(false);
        }
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

  it("Pip stays on the map on short lanes and next to neighbouring lanes, at every edge and corner", () => {
    const via = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number] => [(a.x + b.x) / 2 + 20, (a.y + b.y) / 2 - 20];
    const spots = [[40, 40], [MAP_W - 40, 40], [40, MAP_H - 40], [MAP_W - 40, MAP_H - 40], [MAP_W / 2, MAP_H - 30], [MAP_W / 2, 30], [30, MAP_H / 2], [MAP_W - 30, MAP_H / 2]];
    for (const [x, y] of spots) {
      for (const gap of [40, 70, 130]) {
        // a start, then a lane `gap` away (short when small), then a neighbouring lane `gap` further along the edge
        const start = { x: x < MAP_W / 2 ? x + gap : x - gap, y };
        const a = { x, y, via: [0, 0] as [number, number] };
        a.via = via(start, a);
        const b = { x, y: y < MAP_H / 2 ? y + gap : y - gap, via: [0, 0] as [number, number] };
        b.via = via(a, b);
        for (const target of [0, 1]) {
          const L = layoutMarkers([a, b], start, 2, new Set(), target, target, W);
          const r = pipRect(L.pip);
          const where = `marker (${x},${y}) gap ${gap} lane ${target}`;
          expect(r[0], `${where}: left`).toBeGreaterThanOrEqual(0);
          expect(r[1], `${where}: top`).toBeGreaterThanOrEqual(0);
          expect(r[2], `${where}: right`).toBeLessThanOrEqual(MAP_W);
          expect(r[3], `${where}: bottom`).toBeLessThanOrEqual(MAP_H);
          expect(hits(r, nodeCircle([a, b][1 - target])) && gap >= 70, `${where}: Pip over the neighbouring lane's node`).toBe(false);
        }
      }
    }
  });

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
