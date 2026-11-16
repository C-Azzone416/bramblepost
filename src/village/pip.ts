/** Where Pip stands on the village map: beside the lane that leads to the open marker, never past it. */
import { MAP_W, POST_OFFICE, type Lane } from "./data";

type Pt = { x: number; y: number };

/** How far before the marker (along the incoming lane, in map units) Pip stands. */
export const PIP_BEFORE = 52;
/** How far to the side of the lane's centreline he stands, so he is beside the path and not on it. */
export const PIP_BESIDE = 40;
/** Pip's sprite on the map is drawn at (x, y) with this size; his feet are about here inside it. */
export const PIP_SIZE = { w: 74, h: 70, footX: 37, footY: 64 };

/** Point on the quadratic lane curve (the one the map draws) at parameter t. */
export function laneAt(from: Pt, via: readonly [number, number], to: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * from.x + 2 * u * t * via[0] + t * t * to.x, y: u * u * from.y + 2 * u * t * via[1] + t * t * to.y };
}

/** Nearest point on a lane curve, as a parameter and a distance. */
export function nearestOnLane(from: Pt, via: readonly [number, number], to: Pt, p: Pt): { t: number; dist: number } {
  let best = { t: 0, dist: Infinity };
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const q = laneAt(from, via, to, t);
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (dist < best.dist) best = { t, dist };
  }
  return best;
}

/** A rectangle on the map, as [x0, y0, x1, y1]. */
export type Rect = [number, number, number, number];
export const rectsHit = (a: Rect, b: Rect) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/** The dark pill under a finished node, which holds its stars: drawn at (x - 31, y + 24), 62 × 24. */
export const pillRect = (p: Pt): Rect => [p.x - 31, p.y + 24, p.x + 31, p.y + 48];
/** A node's marker (stamp, lock or number disc) with its rim. */
export const nodeRect = (p: Pt): Rect => [p.x - 30, p.y - 30, p.x + 30, p.y + 30];
/** Pip's sprite box for a spot returned by pipSpot. */
export const pipRect = (s: { x: number; y: number }): Rect => [s.x, s.y, s.x + PIP_SIZE.w, s.y + PIP_SIZE.h];

/**
 * Pip's top-left corner for the sprite, plus his feet position and the parameter on the incoming curve.
 * `lanes` are the slots in order; `openIndex` is the lane he is heading for. When the whole path is
 * done, pass the last lane: he rests on its approach rather than going beyond it.
 * `start` is where the first lane begins (the post office, or another village's gate).
 * A village with no open route yet (Hollowmere) passes index 0: Pip waits at the gate, on the
 * approach to its first, still-hedged lane, so he is never past a marker.
 * `avoid` are rectangles he must not cover (the star pills of finished nodes): if his usual spot overlaps one, he tries
 * the other side of the path and then stands a little farther back; with no overlap the usual spot is used.
 */
export function pipCandidates(lanes: readonly Lane[], openIndex: number, start: Pt = POST_OFFICE, avoid: readonly Rect[] = []): { first: { x: number; y: number; feet: Pt; t: number }; cands: { x: number; y: number; feet: Pt; t: number }[] } {
  const L = lanes[Math.max(0, Math.min(openIndex, lanes.length - 1))];
  const prev: Pt = openIndex > 0 ? lanes[Math.min(openIndex, lanes.length - 1) - 1] : start;
  const next = lanes[lanes.indexOf(L) + 1];
  const at = (before: number, flip: boolean, beside = PIP_BESIDE) => {
    // walk back along the curve until we are `before` units (by arc length) from the marker
    let t = 1;
    let arc = 0;
    let last = laneAt(prev, L.via, L, 1);
    while (t > 0 && arc < before) {
      t = Math.max(0, t - 0.005);
      const p = laneAt(prev, L.via, L, t);
      arc += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    }
    const c = laneAt(prev, L.via, L, t);
    const a = laneAt(prev, L.via, L, Math.max(0, t - 0.01));
    const b = laneAt(prev, L.via, L, Math.min(1, t + 0.01));
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    // stand on the side farther from the outgoing lane
    const side = (s: number): Pt => ({ x: c.x + n.x * beside * s, y: c.y + n.y * beside * s });
    const away = (p: Pt) => (next ? nearestOnLane(L, next.via, next, p).dist : 0);
    const best = away(side(1)) >= away(side(-1)) ? 1 : -1;
    const feet = side(flip ? -best : best);
    // keep the whole sprite on the map (the east bank runs close to the right edge)
    const x = Math.min(feet.x - PIP_SIZE.footX, MAP_W - PIP_SIZE.w - 6);
    return { x, y: feet.y - PIP_SIZE.footY, feet: { x: x + PIP_SIZE.footX, y: feet.y }, t };
  };
  const clear = (s: { x: number; y: number }) => !avoid.some((r) => rectsHit(pipRect(s), r));
  const all: ReturnType<typeof at>[] = [];
  for (const beside of [PIP_BESIDE, PIP_BESIDE + 30, PIP_BESIDE + 60]) for (const before of [PIP_BEFORE, PIP_BEFORE + 30, PIP_BEFORE + 60, PIP_BEFORE + 90]) for (const flip of [false, true]) all.push(at(before, flip, beside));
  const cands = all.filter(clear);
  return { first: cands[0] ?? all[0], cands: cands.length ? cands : [all[0]] };
}

/** Pip's spot (see pipCandidates): the first that keeps clear of `avoid`. */
export function pipSpot(lanes: readonly Lane[], openIndex: number, start: Pt = POST_OFFICE, avoid: readonly Rect[] = []): { x: number; y: number; feet: Pt; t: number } {
  return pipCandidates(lanes, openIndex, start, avoid).first;
}

/**
 * Where the Today callout sits relative to its marker: above (0, -62), unless that covers one of `blockers` (Pip, the star
 * pills) or leaves the map: then higher, or to either side. Returns the offset of the callout's centre.
 */
export function calloutOffset(marker: Pt, w: number, blockers: readonly Rect[]): [number, number] | null {
  const box = (dx: number, dy: number): Rect => [marker.x + dx - w / 2, marker.y + dy - 19, marker.x + dx + w / 2, marker.y + dy + 22];
  const spots: [number, number][] = [[0, -62], [0, -100], [-(w / 2 + 34), -62], [w / 2 + 34, -62], [-(w / 2 + 34), -100], [w / 2 + 34, -100], [0, -140], [-(w / 2 + 34), -140], [w / 2 + 34, -140]];
  return (
    spots.find(([x, y]) => {
      const r = box(x, y);
      return r[0] >= 0 && r[2] <= MAP_W && r[1] >= 0 && !blockers.some((b) => rectsHit(r, b));
    }) ?? null
  );
}

/**
 * Where Pip stands and where the Today callout goes, together: the first Pip spot that keeps clear of `avoid` and leaves the
 * callout a place that keeps clear of Pip and `avoid` too. Falls back to Pip's first clear spot and the callout's usual one.
 */
export function placeMarkers(
  lanes: readonly Lane[],
  openIndex: number,
  start: Pt,
  marker: Pt,
  calloutW: number,
  avoid: readonly Rect[],
): { pip: { x: number; y: number; feet: Pt; t: number }; callout: [number, number] } {
  const { first, cands } = pipCandidates(lanes, openIndex, start, avoid);
  for (const pip of cands) {
    const c = calloutOffset(marker, calloutW, [pipRect(pip), ...avoid]);
    if (c) return { pip, callout: c };
  }
  return { pip: first, callout: [0, -62] };
}
/** The callout's box (pill and tail) at an offset from its marker. */
export const calloutRect = (marker: Pt, w: number, [dx, dy]: [number, number]): Rect => [marker.x + dx - w / 2, marker.y + dy - 19, marker.x + dx + w / 2, marker.y + dy + 22];
