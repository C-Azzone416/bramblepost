// @vitest-environment jsdom
/** Leaving, restarting or reopening a route mid-walk cancels the walk: stale timers must not throw or render (#70). */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

let bp: GameApi;
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
afterEach(() => vi.useRealTimers());

/** Play solution moves until a walk is under way (busy), then let it run a little. */
function startWalk(li = 0) {
  bp.openLevel(li);
  for (const m of ROUTES[li].solution.moves) {
    bp.tryMove(m);
    if (bp.G!.busy) break;
  }
  expect(bp.G!.busy).toBe(true);
  vi.advanceTimersByTime(300);
  expect(bp.G!.busy).toBe(true);
}
const click = (id: string) => (document.getElementById(id) as HTMLButtonElement).click();
const boardHtml = () => document.getElementById("board")!.innerHTML;

describe("walk cancelled with its game", () => {
  it("leaving mid-walk: draining every timer neither throws nor renders", () => {
    startWalk();
    click("toRoutes");
    expect(bp.G).toBeNull();
    const before = boardHtml();
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(bp.G).toBeNull();
    expect(boardHtml()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restart and undo mid-walk are refused while busy, and the walk finishes cleanly", () => {
    startWalk();
    const g = bp.G!;
    click("restartBtn");
    click("undoBtn");
    expect(bp.G).toBe(g);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(bp.G).toBe(g);
    expect(g.busy).toBe(false);
  });

  it("opening a route mid-walk (what restart does) drops the old walk: no stale delivery lands on the new game", () => {
    startWalk();
    const old = bp.G!;
    bp.openLevel(0);
    const fresh = bp.G!;
    expect(fresh).not.toBe(old);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(fresh.busy).toBe(false);
    expect(fresh.next).toBe(0);
    expect(fresh.moves).toBe(0);
  });

  it("leaving in the 230ms gap before the first walk starts does nothing either", () => {
    bp.openLevel(0);
    for (const m of ROUTES[0].solution.moves) {
      bp.tryMove(m);
      if (bp.G!.busy) break;
    }
    click("toRoutes");
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(bp.G).toBeNull();
  });

  it("an uninterrupted route still finishes at par with the stored solution", () => {
    bp.openLevel(0);
    for (const m of ROUTES[0].solution.moves) {
      bp.tryMove(m);
      for (let i = 0; i < 400 && bp.G!.busy; i++) vi.advanceTimersByTime(25);
      expect(bp.G!.busy).toBe(false);
    }
    vi.advanceTimersByTime(100);
    expect(bp.G!.phase).toBe("done");
    expect(bp.G!.moves).toBe(ROUTES[0].par);
  });
});
