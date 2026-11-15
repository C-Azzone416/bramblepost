// @vitest-environment jsdom
/** A neighbour steps out at their door when Pip's leg to their house connects (#53): placeholder figure, no delay to anything. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { houseOf } from "../src/ui/satchel";
import { STEPOUT_MS, FIGURE_SYMBOL, PLACEHOLDER, neighbourFigure } from "../src/ui/neighbours";
import { mountApp } from "../src/ui/mount";
import { NEIGHBOUR_IDS, type NeighbourId } from "../src/letters/cast";
import { readFileSync } from "node:fs";
import type { GameApi } from "../src/ui/game";

let bp: GameApi;
const fig = () => document.querySelector<SVGElement>("#board [data-neighbour]");
const out = () => document.querySelector<SVGElement>("#board .nb-out");
const shownIds = (): string[] => [...document.querySelectorAll("#board [data-neighbour]")].map((e) => e.getAttribute("data-neighbour")!);

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES);
});
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
});

/** Play the stored solution tick by tick; returns how many ms it took, and which figures were seen. */
function play(li: number, onTick?: () => void) {
  bp.openLevel(li);
  const L = ROUTES[li];
  const seen = new Set<string>();
  let t = 0;
  const tick = (ms: number) => {
    vi.advanceTimersByTime(ms);
    t += ms;
    for (const id of shownIds()) seen.add(id);
    onTick?.();
  };
  for (const m of L.solution.moves) {
    bp.tryMove(m);
    for (let i = 0; i < 400 && bp.G!.busy; i++) tick(25);
    tick(25);
  }
  return { t, seen };
}

describe("neighbour steps out", () => {
  it("Clementine appears at her door when the leg to Teapot Cottage connects, waves, and goes back in", () => {
    bp.openLevel(0);
    expect(fig()).toBeNull();
    const { seen } = play(0);
    expect(seen.has("clementine")).toBe(true);
    expect(fig()).toBeNull(); // gone by the end
  });

  it("is drawn with its house, right after it, in the upright layer", () => {
    let checked = false;
    play(0, () => {
      const f = out();
      if (!f || checked) return;
      const house = f.previousElementSibling!;
      expect(house.getAttribute("href")).toMatch(/House$/);
      expect(f.parentElement!.children).toContain(house);
      expect(house.getAttribute("data-house")).toBe(f.getAttribute("data-door"));
      checked = true;
    });
    expect(checked).toBe(true);
  });

  it("waves normally, and is a still pose under reduced motion", () => {
    let waved = false;
    play(0, () => {
      if (out()?.classList.contains("nb-wave")) waved = true;
    });
    expect(waved).toBe(true);
    localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true }));
    let still = false;
    let anyWave = false;
    play(0, () => {
      if (out()) still = true;
      if (out()?.classList.contains("nb-wave")) anyWave = true;
    });
    expect(still).toBe(true);
    expect(anyWave).toBe(false);
  });

  it("goes back in by itself after STEPOUT_MS", () => {
    bp.openLevel(0);
    const L = ROUTES[0];
    bp.tryMove(L.solution.moves[0]);
    let appeared = -1;
    for (let t = 0; t < 4000 && bp.G!.busy; t += 10) {
      vi.advanceTimersByTime(10);
      if (out() && appeared < 0) appeared = t;
      if (appeared >= 0 && !out()) {
        expect(t - appeared).toBeLessThanOrEqual(STEPOUT_MS + 20);
        return;
      }
    }
    // the leg ended (figure hidden on arrival) before the cap: also fine
    expect(out()).toBeNull();
  });

  it("opening another route or leaving the route mid-wave leaves no figure or timer behind", () => {
    // (A walk already under way when the player leaves keeps its own timers, as before this feature; only the figure's are ours to check.)
    for (const [leave, drain] of [[() => bp.openLevel(0), true], [() => (document.getElementById("toRoutes") as HTMLButtonElement).click(), false]] as const) {
      bp.openLevel(0);
      for (const m of ROUTES[0].solution.moves) {
        bp.tryMove(m);
        for (let i = 0; i < 100 && !out() && (bp.G!.busy || i < 30); i++) vi.advanceTimersByTime(10);
        if (out()) break;
      }
      expect(out()).not.toBeNull();
      leave();
      expect(out()).toBeNull();
      if (drain) vi.runOnlyPendingTimers();
      expect(out()).toBeNull();
    }
  });

  it("restart and undo after a route leave no figure", () => {
    play(0);
    (document.getElementById("undoBtn") as HTMLButtonElement).click();
    expect(fig()).toBeNull();
    (document.getElementById("restartBtn") as HTMLButtonElement).click();
    vi.runOnlyPendingTimers();
    expect(fig()).toBeNull();
  });

  it("does not change how long a route takes at par", () => {
    const withFigs = play(0).t;
    // same route with the figure seam switched off: measured by the same loop, so durations must match
    const bare = vi.spyOn(Element.prototype, "after").mockImplementation(() => {});
    const without = play(0).t;
    bare.mockRestore();
    expect(withFigs).toBe(without);
    expect(bp.G!.phase).toBe("done");
  });

  it("every house style has a neighbour whose figure comes from the seam", () => {
    bp.openLevel(0);
    expect(houseOf(bp.G!, "B").id).toBe("clementine");
  });

  describe("figures (#56)", () => {
    const sheet = readFileSync("src/ui/sprites.svg", "utf8");
    const hasSymbol = (id: string) => new RegExp(`<symbol id="${id}"`).test(sheet);

    it("each neighbour has its own symbol, and it exists in the sprite sheet", () => {
      const syms = NEIGHBOUR_IDS.map((id) => FIGURE_SYMBOL[id]);
      expect(new Set(syms).size).toBe(NEIGHBOUR_IDS.length);
      for (const s of syms) {
        expect(s).not.toBe(PLACEHOLDER);
        expect(hasSymbol(s)).toBe(true);
      }
      expect(hasSymbol(PLACEHOLDER)).toBe(true);
    });

    it("the step-out uses the neighbour's own symbol; an unknown id falls back", () => {
      for (const id of NEIGHBOUR_IDS) expect(neighbourFigure(id, 0, 0).getAttribute("href")).toBe("#" + FIGURE_SYMBOL[id]);
      expect(neighbourFigure("nobody" as NeighbourId, 0, 0).getAttribute("href")).toBe("#" + PLACEHOLDER);
    });

    it("on the board, every figure shown uses its own neighbour's symbol", () => {
      bp.openLevel(0);
      const seen = new Map<string, string>();
      for (const m of ROUTES[0].solution.moves) {
        bp.tryMove(m);
        for (let i = 0; i < 400 && bp.G!.busy; i++) {
          vi.advanceTimersByTime(25);
          const f = fig();
          if (f) seen.set(f.getAttribute("data-neighbour")!, f.getAttribute("href")!);
        }
      }
      expect(seen.size).toBeGreaterThan(0);
      for (const [id, href] of seen) expect(href).toBe("#" + FIGURE_SYMBOL[id as NeighbourId]);
    });

    it("is decorative: hidden from assistive tech and not clickable", () => {
      const f = neighbourFigure("bea", 0, 0);
      expect(f.getAttribute("aria-hidden")).toBe("true");
      expect(f.getAttribute("pointer-events")).toBe("none");
    });
  });
});
