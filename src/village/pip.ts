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
/** A circle on the map, as [x, y, radius]. */
export type Circle = [number, number, number];
/** Something to keep clear of: a rectangle or a circle. */
export type Shape = Rect | Circle;
/** Whether a rectangle overlaps a shape. */
export const hits = (r: Rect, s: Shape): boolean => {
  if (s.length === 4) return rectsHit(r, s);
  const dx = Math.max(r[0] - s[0], 0, s[0] - r[2]), dy = Math.max(r[1] - s[1], 0, s[1] - r[3]);
  return dx * dx + dy * dy < s[2] * s[2];
};
/** The dark pill under a finished node, which holds its stars: drawn at (x - 31, y + 24), 62 × 24. */
export const pillRect = (p: Pt): Rect => [p.x - 31, p.y + 24, p.x + 31, p.y + 48];
/** Whether a point is inside a shape. */
const inShape = (x: number, y: number, s: Shape): boolean => (s.length === 4 ? x > s[0] && x < s[2] && y > s[1] && y < s[3] : Math.hypot(x - s[0], y - s[1]) < s[2]);
/** Whether the callout as drawn (its pill, and its tail triangle sampled finely) overlaps a shape. */
export function calloutHits(sh: { pill: Rect; base: Pt; tip: Pt }, shape: Shape): boolean {
  if (hits(sh.pill, shape)) return true;
  const L = { x: sh.base.x - 7, y: sh.base.y }, R = { x: sh.base.x + 7, y: sh.base.y };
  for (let i = 0; i <= 16; i++) {
    for (let j = 0; j <= i; j++) {
      // barycentric lattice over the triangle (L, R, tip)
      const a = (16 - i) / 16, b = (i - j) / 16, c = j / 16;
      if (inShape(a * sh.tip.x + b * L.x + c * R.x, a * sh.tip.y + b * L.y + c * R.y, shape)) return true;
    }
  }
  return false;
}
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
export function pipCandidates(lanes: readonly Lane[], openIndex: number, start: Pt = POST_OFFICE, avoid: readonly Shape[] = []): { first: { x: number; y: number; feet: Pt; t: number }; cands: { x: number; y: number; feet: Pt; t: number }[] } {
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
  const clear = (s: { x: number; y: number }) => !avoid.some((r) => hits(pipRect(s), r));
  const all: ReturnType<typeof at>[] = [];
  for (const beside of [PIP_BESIDE, PIP_BESIDE + 30, PIP_BESIDE + 60, PIP_BESIDE + 90]) for (const before of [PIP_BEFORE, PIP_BEFORE + 30, PIP_BEFORE + 60, PIP_BEFORE + 90, PIP_BEFORE + 120, PIP_BEFORE + 150]) for (const flip of [false, true]) all.push(at(before, flip, beside));
  // if the lane's own approach has no room (a cramped corner, the map's edge), stand anywhere near it: rings of spots around his usual feet
  const usual = all[0];
  for (const r of [40, 70, 100, 130, 160, 200, 250, 300]) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const feet = { x: usual.feet.x + Math.cos(a) * r, y: usual.feet.y + Math.sin(a) * r };
      const x = Math.max(6, Math.min(feet.x - PIP_SIZE.footX, MAP_W - PIP_SIZE.w - 6)), y = Math.max(6, feet.y - PIP_SIZE.footY);
      all.push({ x, y, feet: { x: x + PIP_SIZE.footX, y: y + PIP_SIZE.footY }, t: usual.t });
    }
  }
  const cands = all.filter(clear);
  return { first: cands[0] ?? all[0], cands: cands.length ? cands : [all[0]] };
}

/** Pip's spot (see pipCandidates): the first that keeps clear of `avoid`. */
export function pipSpot(lanes: readonly Lane[], openIndex: number, start: Pt = POST_OFFICE, avoid: readonly Shape[] = []): { x: number; y: number; feet: Pt; t: number } {
  return pipCandidates(lanes, openIndex, start, avoid).first;
}

/**
 * Where the Today callout sits relative to its marker: above (0, -62), unless that covers one of `blockers` (Pip, the star
 * pills) or leaves the map: then higher, or to either side. Returns the offset of the callout's centre.
 */
export function calloutOffset(marker: Pt, w: number, blockers: readonly Shape[]): [number, number] | null {
  const sides = [0, -(w / 2 + 34), w / 2 + 34, -(w / 2 + 100), w / 2 + 100, -(w / 2 + 170), w / 2 + 170];
  // above the marker first (usual), then farther above, then below it (the tail then points up)
  const spots: [number, number][] = [-62, -100, -140, -180, 92, 130].flatMap((dy) => sides.map((dx): [number, number] => [dx, dy]));
  return (
    spots.find((o) => {
      const sh = calloutShape(marker, w, o); // the pill and the tail it really draws
      const r = sh.rect;
      return r[0] >= 0 && r[2] <= MAP_W && r[1] >= 0 && !blockers.some((b) => calloutHits(sh, b));
    }) ?? null
  );
}

/** How far from the marker's centre the tail's tip stops (the stamp's rim). */
export const TAIL_GAP = 40;

/**
 * The callout as drawn: the pill (34 tall, centred on the offset) and its tail, a triangle 14 wide at the pill's lower edge whose
 * tip sits TAIL_GAP from the marker's centre, on the line from the tail's base to the marker, so it points at the marker
 * whichever way the pill had to move. `rect` is the box around both. The renderer and the tests use this one function.
 */
export function calloutShape(marker: Pt, w: number, [dx, dy]: [number, number]): { cx: number; cy: number; pill: Rect; base: Pt; tip: Pt; rect: Rect } {
  const cx = marker.x + dx, cy = marker.y + dy;
  const pill: Rect = [cx - w / 2, cy - 19, cx + w / 2, cy + 15];
  const base: Pt = { x: cx + Math.max(-w / 2 + 16, Math.min(w / 2 - 16, -dx)), y: dy > 0 ? cy - 18 : cy + 14 }; // the tail leaves the edge nearer the marker
  const len = Math.hypot(base.x - marker.x, base.y - marker.y) || 1;
  const tip: Pt = { x: marker.x + ((base.x - marker.x) / len) * TAIL_GAP, y: marker.y + ((base.y - marker.y) / len) * TAIL_GAP };
  const xs = [base.x - 7, base.x + 7, tip.x], ys = [base.y, tip.y];
  const rect: Rect = [Math.min(pill[0], ...xs), Math.min(pill[1], ...ys), Math.max(pill[2], ...xs), Math.max(pill[3], ...ys)];
  return { cx, cy, pill, base, tip, rect };
}

/** A square around a marker: its stamp, ring and pulse (radius 38) or its tap circle, whichever reaches farther. */
export const markerRect = (p: Pt, r: number): Rect => [p.x - r, p.y - r, p.x + r, p.y + r];
/** The most a marker's tap circle can grow: half the distance to the nearest other marker (the map sizes it to the finger up to this). */
export const hitCap = (p: Pt, others: readonly Pt[]): number => Math.min(Infinity, ...others.filter((o) => o !== p && (o.x !== p.x || o.y !== p.y)).map((o) => Math.hypot(o.x - p.x, o.y - p.y) / 2));

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
  avoid: readonly Shape[],
  calloutAvoid: readonly Shape[] = avoid,
): { pip: { x: number; y: number; feet: Pt; t: number }; callout: [number, number] } {
  const { first, cands } = pipCandidates(lanes, openIndex, start, avoid);
  for (const pip of cands) {
    const c = calloutOffset(marker, calloutW, [pipRect(pip), ...calloutAvoid]);
    if (c) return { pip, callout: c };
  }
  return { pip: first, callout: [0, -62] };
}

/**
 * The whole layout of Pip and the Today callout for one village state, used by the renderer and by the tests.
 * `laneCount` lanes have routes (marker positions are `slots[0..laneCount)`); `done` are the finished lane indexes;
 * `target` is the lane Pip heads for (the open lane, else the last finished, else the first); `today` is the lane the callout
 * marks, or null. Pip and the callout keep clear of the finished nodes' star pills, every other node marker, and the target
 * marker with its ring, pulse and tap circle (at its largest: half the distance to the nearest marker, at most 70).
 */
export function layoutMarkers(
  slots: readonly Lane[],
  start: Pt,
  laneCount: number,
  done: ReadonlySet<number>,
  target: number,
  today: number | null,
  calloutW: number,
): { pip: { x: number; y: number; feet: Pt; t: number }; callout: [number, number] | null; avoid: Shape[]; hitR: number } {
  const lanes = slots.slice(0, laneCount);
  if (!slots.length) return { pip: { x: start.x + 40, y: start.y - 60, feet: start, t: 0 }, callout: null, avoid: [], hitR: 0 };
  const idx = Math.max(0, target);
  const active = slots[Math.min(idx, slots.length - 1)];
  const hitR = Math.max(38, Math.min(hitCap(active, lanes), 70));
  if (!laneCount) return { pip: pipSpot(slots, idx, start), callout: null, avoid: [], hitR: 0 }; // no routes yet: no markers to keep clear of
  const avoid: Shape[] = [
    ...[...done].filter((i) => lanes[i]).map((i) => pillRect(lanes[i])),
    ...lanes.filter((_, i) => i !== idx).map(nodeRect),
    [active.x, active.y, hitR], // the open marker with its ring, pulse and tap circle
  ];
  const m = placeMarkers(slots, idx, start, active, calloutW, avoid, avoid.slice(0, -1)); // the callout's tail points at the open marker, so only Pip keeps out of its tap circle
  return { pip: m.pip, callout: today === null ? null : m.callout, avoid, hitR };
}
