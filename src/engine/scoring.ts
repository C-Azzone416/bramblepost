/** Tea and stars. The teapot is a hard limit: when it's empty the round ends. */

/** The spring teapot holds par + 4 cups. */
export const TEAPOT_MARGIN = 4;
/** Two stars for finishing within par + 2. */
export const TWO_STAR_MARGIN = 2;
/** Banner warnings when this many cups (or fewer) are left. */
export const LOW_TEA_WARNING = 2;

export function teapot(par: number): number {
  return par + TEAPOT_MARGIN;
}

/**
 * 3 stars: par or better and no cold pie.
 * 2 stars: within par + 2 (a cold pie caps the route here).
 * 1 star:  finished before the pot ran dry.
 */
export function starsFor(moves: number, par: number, coldPie: boolean): 1 | 2 | 3 {
  if (moves <= par && !coldPie) return 3;
  if (moves <= par + TWO_STAR_MARGIN) return 2;
  return 1;
}

/** True when the pot is empty and post is still in the satchel. */
export function outOfTea(moves: number, par: number, delivered: number, total: number): boolean {
  return delivered < total && moves >= teapot(par);
}
