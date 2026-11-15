// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { allMoves, apply, deliverChain, teapot, LOW_TEA_WARNING, type Move } from "../src/engine";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";
import * as sound from "../src/ui/sound";

vi.mock("../src/ui/sound", () => ({
  armSound: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  ding: vi.fn(),
  kettle: vi.fn(),
  pluck: vi.fn(),
}));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let bp: GameApi;
const G = () => bp.G!;
async function play(m: Move) {
  bp.tryMove(m);
  for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await sleep(50);
}

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES);
});
beforeEach(() => vi.clearAllMocks());

describe("sound hooks", () => {
  it("each delivery plucks once, and finishing dings once", async () => {
    const L = ROUTES[0];
    bp.openLevel(0);
    for (const m of L.solution.moves.slice(0, -1)) await play(m);
    await sleep(100);
    expect(sound.ding).not.toHaveBeenCalled();
    await play(L.solution.moves[L.solution.moves.length - 1]);
    await sleep(300);
    expect(G().phase).toBe("done");
    expect(sound.pluck).toHaveBeenCalledTimes(L.parcels.length);
    expect(sound.ding).toHaveBeenCalledTimes(1);
    expect(sound.kettle).not.toHaveBeenCalled();
  });

  it("the kettle sounds once when the tea runs low", async () => {
    bp.openLevel(1);
    const L = ROUTES[1];
    const target = teapot(L.par) - LOW_TEA_WARNING;
    while (G().moves < target) {
      const s = G();
      const ms = allMoves(s.P, s.v).filter((m) => !deliverChain(s.P, apply(s.P, s.v, m), s.order, s.next).length);
      await play(ms[0]);
    }
    await sleep(100);
    expect(G().moves).toBe(target);
    expect(sound.kettle).toHaveBeenCalledTimes(1);
    expect(sound.ding).not.toHaveBeenCalled();
  });
});
