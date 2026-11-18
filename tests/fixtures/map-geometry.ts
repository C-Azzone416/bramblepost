/**
 * Geometry for the village-map layout tests (#127 to #129): points along the lanes as the map draws them, and distances from
 * them to boxes, points, lines and outlines, so each test can say "nothing sits on a lane".
 */
import type { Lane } from "../../src/village/data";

/** Half the lane's drawn width (32). */
export const HALF = 16;

/** Points along each lane (previous stop or start to its stop, quadratic through `via`), as the map draws them; `only` picks lane n (1 to 10). */
export function laneSamples(start: { x: number; y: number }, slots: Lane[], only?: number): [number, number][] {
  const out: [number, number][] = [];
  let prev = start;
  slots.forEach((L, i) => {
    if (only === undefined || only === i + 1)
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const u = 1 - t;
        out.push([u * u * prev.x + 2 * u * t * L.via[0] + t * t * L.x, u * u * prev.y + 2 * u * t * L.via[1] + t * t * L.y]);
      }
    prev = L;
  });
  return out;
}

export const distBox = (samples: [number, number][], x0: number, y0: number, x1: number, y1: number) =>
  Math.min(...samples.map(([x, y]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))));
export const distPoint = (samples: [number, number][], x: number, y: number) => Math.min(...samples.map(([sx, sy]) => Math.hypot(sx - x, sy - y)));

/** Distance from a point to a polyline. */
export function distLine(pts: [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}

/** Whether a point is inside a closed outline. */
export function inside(outline: [number, number][], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Distance from a point to a closed outline (0 inside it). */
export function distOutline(outline: [number, number][], x: number, y: number): number {
  return inside(outline, x, y) ? 0 : distLine([...outline, outline[0]], x, y);
}
