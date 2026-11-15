/**
 * Which lanes are stamped, open or locked. Pure functions with no DOM, so tests and tools can use them.
 *
 * Rules:
 * - A lane is stamped (done) once its route has a saved finish (any stars).
 * - The first lane of an open season is open; each later lane opens when the one before is stamped.
 * - Spring is always open. A later season opens when every lane of the season before is stamped,
 *   and shows as "soon" if it has no routes yet.
 */
import { NEIGHBOURHOODS, type Neighbourhood, type Season } from "./data";

export type LaneState = "done" | "open" | "locked";
export type SeasonState = "open" | "soon" | "locked";

export interface Best {
  stars: number;
  moves: number;
}

export interface LaneProgress {
  id: string;
  /** 1-based number within its season. */
  n: number;
  state: LaneState;
  /** Best stars, 0 if not finished. */
  stars: number;
  moves?: number;
}

export interface NeighbourhoodProgress {
  id: string;
  name: string;
  season: Season;
  state: SeasonState;
  lanes: LaneProgress[];
  stamps: number;
  stars: number;
}

export interface VillageProgress {
  hoods: NeighbourhoodProgress[];
  /** The lane Pip should head for next: the first open lane, or null when everything is stamped. */
  today: string | null;
  stamps: number;
  lanes: number;
  stars: number;
  maxStars: number;
}

export function villageProgress(best: Record<string, Best | undefined>, hoods: Omit<Neighbourhood, "slots">[] = NEIGHBOURHOODS): VillageProgress {
  let prevComplete = true;
  let today: string | null = null;
  let stamps = 0;
  let stars = 0;
  let lanes = 0;
  const out: NeighbourhoodProgress[] = hoods.map((h) => {
    const unlocked = prevComplete;
    const state: SeasonState = !unlocked ? "locked" : h.routes.length ? "open" : "soon";
    let prevDone = true;
    let hStamps = 0;
    let hStars = 0;
    const ls: LaneProgress[] = h.routes.map((id, k) => {
      const b = best[id];
      const done = !!b && b.stars > 0;
      const laneState: LaneState = done ? "done" : state === "open" && prevDone ? "open" : "locked";
      prevDone = done;
      if (done) {
        hStamps++;
        hStars += b!.stars;
      }
      if (laneState === "open" && today == null) today = id;
      return { id, n: k + 1, state: laneState, stars: done ? b!.stars : 0, moves: done ? b!.moves : undefined };
    });
    prevComplete = unlocked && h.routes.length > 0 && hStamps === h.routes.length;
    stamps += hStamps;
    stars += hStars;
    lanes += h.routes.length;
    return { id: h.id, name: h.name, season: h.season, state, lanes: ls, stamps: hStamps, stars: hStars };
  });
  return { hoods: out, today, stamps, lanes, stars, maxStars: lanes * 3 };
}

/** Every lane in map order, with its neighbourhood. */
export function allLanes(p: VillageProgress): (LaneProgress & { hood: NeighbourhoodProgress })[] {
  return p.hoods.flatMap((h) => h.lanes.map((l) => ({ ...l, hood: h })));
}

/** Lanes stamped in `p` that are not in `seen`: the stamps to show arriving. */
export function newStamps(p: VillageProgress, seen: readonly string[]): string[] {
  return allLanes(p)
    .filter((l) => l.state === "done" && !seen.includes(l.id))
    .map((l) => l.id);
}
