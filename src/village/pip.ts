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

/**
 * Pip's top-left corner for the sprite, plus his feet position and the parameter on the incoming curve.
 * `lanes` are the slots in order; `openIndex` is the lane he is heading for. When the whole path is
 * done, pass the last lane: he rests on its approach rather than going beyond it.
 */
export function pipSpot(lanes: readonly Lane[], openIndex: number): { x: number; y: number; feet: Pt; t: number } {
  const L = lanes[Math.max(0, Math.min(openIndex, lanes.length - 1))];
  const prev: Pt = openIndex > 0 ? lanes[Math.min(openIndex, lanes.length - 1) - 1] : POST_OFFICE;
  const next = lanes[lanes.indexOf(L) + 1];
  // walk back along the curve until we are PIP_BEFORE units (by arc length) from the marker
  let t = 1;
  let arc = 0;
  let last = laneAt(prev, L.via, L, 1);
  while (t > 0 && arc < PIP_BEFORE) {
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
  const side = (s: number): Pt => ({ x: c.x + n.x * PIP_BESIDE * s, y: c.y + n.y * PIP_BESIDE * s });
  const away = (p: Pt) => (next ? nearestOnLane(L, next.via, next, p).dist : 0);
  const feet = away(side(1)) >= away(side(-1)) ? side(1) : side(-1);
  // keep the whole sprite on the map (the east bank runs close to the right edge)
  const x = Math.min(feet.x - PIP_SIZE.footX, MAP_W - PIP_SIZE.w - 6);
  return { x, y: feet.y - PIP_SIZE.footY, feet: { x: x + PIP_SIZE.footX, y: feet.y }, t };
}
