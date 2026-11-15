// @vitest-environment jsdom
/**
 * Plays the real page in jsdom: every route at par, the finish card, cold pie, running out of tea,
 * undo/restart, satchel rules and saved stars. Uses real timers so Pip's walk runs as in the browser.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { allMoves, apply, deliverChain, parse, solveOrder, teapot, type Move } from "../src/engine";
import { ROUTES, type Route } from "../src/levels";
import { SAVE_KEY } from "../src/ui/save";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
let bp: GameApi;
const G = () => bp.G!;

async function waitIdle() {
  for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await sleep(50);
}
async function play(m: Move) {
  bp.tryMove(m);
  await waitIdle();
}
/** Pour cups without delivering anything until `n` moves (or the pot runs dry). */
async function wasteTo(n: number) {
  while (G().moves < n && G().phase !== "dry") {
    const s = G();
    const ms = allMoves(s.P, s.v).filter((m) => !deliverChain(s.P, apply(s.P, s.v, m), s.order, s.next).length);
    if (!ms.length) break;
    await play(ms[0]);
  }
}
/** Solve from the current board with pie timers ignored. */
function solveFromHere(L: Route, order: number[], maxDepth: number) {
  const P = { ...G().P, init: G().v.slice(), level: { ...L, parcels: L.parcels.map((p) => ({ ...p, limit: undefined })) } };
  for (let d = 1; d <= maxDepth; d++) {
    const r = solveOrder(P, order, d, 3e6);
    if (r.par != null) return r;
  }
  return null;
}
const doneText = () => $("done").textContent ?? "";
const starsLabel = () => document.querySelector("#done .big")?.getAttribute("aria-label");

beforeAll(async () => {
  localStorage.clear();
  window.scrollTo = () => {}; // not implemented in jsdom
  const style = document.createElement("style");
  // Vitest stubs out CSS imports, so read the stylesheet straight from disk.
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const errors: unknown[] = [];
  window.addEventListener("error", (e) => errors.push(e.error));
  bp = mountApp(root, ROUTES);
  await sleep(50);
  expect(errors).toEqual([]);
});

describe("route list", () => {
  it("shows thirteen route cards", () => {
    expect(document.querySelectorAll("#routeList .rcard")).toHaveLength(13);
  });
});

describe("every route at par", () => {
  ROUTES.forEach((L, li) => {
    it(`${L.name}: 3 stars, finish card on top, Next route works`, async () => {
      bp.openLevel(li);
      expect($("gameView").hidden).toBe(false);
      expect(document.querySelectorAll("#plist li")).toHaveLength(L.parcels.length);
      expect(document.querySelectorAll("#board .hdl").length).toBeGreaterThan(0);

      // sort the satchel with the nudge buttons
      const target = L.solution.order;
      for (let pass = 0; pass < 6; pass++)
        for (let i = 0; i < target.length - 1; i++)
          if (target.indexOf(G().order[i]) > target.indexOf(G().order[i + 1]))
            (document.querySelector(`[data-down="${i}"]`) as HTMLButtonElement).click();
      expect(G().order).toEqual(target);

      for (const m of L.solution.moves) await play(m);
      await sleep(300);
      expect(G().phase).toBe("done");
      expect(G().moves).toBe(L.par);
      expect($("done").hidden).toBe(false);
      expect($("done").innerHTML).toMatch(/3 of 3/);

      // delivered satchel cards stay in the satchel, not as a blurred overlay
      const cards = [...document.querySelectorAll<HTMLElement>("#plist li")];
      for (const c of cards) expect(getComputedStyle(c).position).not.toBe("absolute");
      expect(+getComputedStyle($("done")).zIndex).toBeGreaterThan(+getComputedStyle($("toast")).zIndex);
      expect($("toast").classList.contains("show")).toBe(false);

      const next = document.querySelector<HTMLButtonElement>('#done [data-act="next"]');
      const routes = document.querySelector('#done [data-act="routes"]');
      if (li < ROUTES.length - 1) {
        next!.click();
        expect(G().li).toBe(li + 1);
        expect(G().phase).toBe("sort");
        expect($("done").hidden).toBe(true);
      } else {
        expect(next).toBeNull();
        expect(routes).not.toBeNull();
      }
    });
  });

  it("saves 3 stars for every route", () => {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(Object.keys(saved.best)).toHaveLength(13);
    expect(Object.values(saved.best).every((b) => (b as { stars: number }).stars === 3)).toBe(true);
  });
});

describe("Clover Bend rules", () => {
  const L = ROUTES[1];

  it("first move locks the order; undo back to sorting", async () => {
    bp.openLevel(1);
    expect(G().order).toEqual([0, 1]); // pie first by default
    await play({ t: "r", i: 0, d: 1 });
    expect(G().moves).toBe(1);
    expect(G().phase).toBe("play");
    expect(document.querySelector("[data-up]")).toBeNull();
    bp.undo();
    expect(G().moves).toBe(0);
    expect(G().phase).toBe("sort");
  });

  it("a late pie arrives cold and caps the stars", async () => {
    for (let k = 0; k < 2; k++) await play({ t: "r", i: 0, d: 1 });
    const r = solveFromHere(L, [0, 1], 6)!;
    for (const m of r.line!) await play(m);
    await sleep(300);
    expect(G().phase).toBe("done");
    expect(doneText()).toMatch(/pie arrived cold/);
    expect(starsLabel()).toMatch(/[12] of 3/);
  });

  it("no card while one cup is left, and a last-cup warning", async () => {
    bp.openLevel(1);
    await wasteTo(teapot(L.par) - 1);
    expect(G().phase).toBe("play");
    expect($("done").hidden).toBe(true);
    expect($("bannerText").textContent).toMatch(/Last cup/);
  });

  it("an empty pot shows the gentle out-of-tea card", async () => {
    const pot = teapot(L.par);
    await wasteTo(pot);
    await sleep(100);
    expect(G().phase).toBe("dry");
    expect(G().moves).toBe(pot);
    expect($("done").hidden).toBe(false);
    expect(doneText()).toMatch(/Pip ran out of tea!/);
    expect(doneText()).toMatch(/he will start/);
    expect(doneText()).not.toMatch(/fail|lose|loser/i);
    const restart = document.querySelector('#done [data-act="replay"]')!;
    expect(restart.textContent).toBe("Restart route");
    expect(document.querySelector("#done .btn.red")!.getAttribute("data-act")).toBe("replay");
    expect($("toast").classList.contains("show")).toBe(false);
  });

  it("moves are blocked on an empty pot, and Undo steps back one cup", async () => {
    const pot = teapot(L.par);
    await play({ t: "r", i: 0, d: 1 });
    expect(G().moves).toBe(pot);
    (document.querySelector('#done [data-act="undo"]') as HTMLButtonElement).click();
    expect(G().phase).toBe("play");
    expect(G().moves).toBe(pot - 1);
    expect($("done").hidden).toBe(true);
  });

  it("finishing on the very last cup still completes the route", async () => {
    bp.openLevel(1);
    (document.querySelector('[data-down="0"]') as HTMLButtonElement).click();
    expect(G().order).toEqual([1, 0]);
    await wasteTo(teapot(L.par) - 2);
    const r = solveFromHere(L, [1, 0], 2);
    expect(r, "a 2-move finish from the wasted board").not.toBeNull();
    for (const m of r!.line!) await play(m);
    await sleep(200);
    expect(G().phase).toBe("done");
    expect(starsLabel()).toMatch(/[12] of 3/);
  });

  it("Restart route on the tea card resets the round", async () => {
    bp.openLevel(1);
    await wasteTo(teapot(L.par));
    (document.querySelector('#done [data-act="replay"]') as HTMLButtonElement).click();
    expect(G().moves).toBe(0);
    expect(G().phase).toBe("sort");
    expect($("done").hidden).toBe(true);
  });

  it("nothing is saved for a round that ran dry", () => {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(saved.best.clover).toEqual({ stars: 3, moves: 2 });
  });
});

describe("satchel and board rules", () => {
  it("the cat must ride last, and moves wait for a legal order", () => {
    bp.openLevel(3);
    (document.querySelector('[data-down="1"]') as HTMLButtonElement).click();
    expect($("rulemsg").textContent).toMatch(/cat/i);
    bp.tryMove({ t: "r", i: 1, d: 1 });
    expect(G().moves).toBe(0);
  });

  it("rooted tiles say they never move", () => {
    bp.openLevel(3);
    bp.tryMove({ t: "r", i: parse(ROUTES[3]).bld.P, d: 1 });
    expect($("toast").textContent).toMatch(/never move/);
  });

  it("the signed letter shows a latched gate", () => {
    bp.openLevel(4);
    expect($("plist").textContent).toMatch(/latched/i);
  });

  it("leaving a route goes back to the village map", () => {
    $("toRoutes").click();
    expect($("gameView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect($("routesView").hidden).toBe(true);
  });
});
