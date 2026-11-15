// @vitest-environment jsdom
/**
 * The door scene in the real page (jsdom): it plays after a whole route, before the Route complete card,
 * saves the reply, collects the stamp, and Continue brings back the card with Next route.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { DOOR_KEY } from "../src/door/save";
import { SAVE_KEY } from "../src/ui/save";
import { SPRING_SCENES } from "../src/door/scenes";
import { doorAfterRoute, showDoorScene } from "../src/door/view";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
const door = () => document.getElementById("doorScene");
const btn = (sel: string) => door()!.querySelector<HTMLButtonElement>(sel)!;
const nextBtn = () => btn('[data-door="next"]');
const line = () => $("doorLine").textContent ?? "";
const saved = () => JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}");
let bp: GameApi;

async function waitIdle() {
  for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await sleep(50);
}
/** Sort the satchel to the stored solution and play it. */
async function playAtPar(li: number) {
  const L = ROUTES[li];
  bp.openLevel(li);
  const target = L.solution.order;
  for (let pass = 0; pass < 6; pass++)
    for (let i = 0; i < target.length - 1; i++)
      if (target.indexOf(bp.G!.order[i]) > target.indexOf(bp.G!.order[i + 1]))
        (document.querySelector(`[data-down="${i}"]`) as HTMLButtonElement).click();
  for (const m of L.solution.moves) {
    bp.tryMove(m);
    await waitIdle();
  }
  await sleep(300);
}

beforeAll(async () => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent =
    readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8") + readFileSync(resolve(process.cwd(), "src/door/door.css"), "utf8");
  document.head.appendChild(style);
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES, { afterRoute: doorAfterRoute(SPRING_SCENES, { typeMs: 0 }) });
  await sleep(50);
});

describe("after Primrose Lane", () => {
  it("the scene plays first and the Route complete card waits", async () => {
    await playAtPar(0);
    expect(bp.G!.phase).toBe("done");
    expect(door()).not.toBeNull();
    expect($("done").hidden).toBe(true);
    expect(getComputedStyle(door()!).position).toBe("fixed");
    expect(door()!.getAttribute("role")).toBe("dialog");
    expect($("doorSpeaker").textContent).toBe("Clementine Fernsby");
    expect(document.getElementById("clem")).not.toBeNull();
  });

  it("shows the stars and the new stamp", () => {
    const d = door()!;
    expect(d.querySelector(".door-stars")!.getAttribute("aria-label")).toBe("3 of 3 stars");
    expect(d.textContent).toMatch(/Stamp collected/);
    expect(d.textContent).toMatch(/Primrose/);
    expect(d.textContent).toMatch(/1 of 10/);
    // The stamp is the village map's: a saved finish for this route.
    expect(Object.keys(JSON.parse(localStorage.getItem(SAVE_KEY)!).best)).toEqual(["primrose"]);
  });

  it("lines step on, then two replies", () => {
    expect(line()).toMatch(/Seeds from my sister/);
    expect(d().querySelector(".door-choices")!.hasAttribute("hidden")).toBe(true);
    nextBtn().click();
    expect(line()).toMatch(/read it to me/);
    nextBtn().click();
    const choices = [...door()!.querySelectorAll<HTMLButtonElement>(".door-choice")];
    expect(choices.map((c) => c.textContent)).toEqual(["Read it aloud", "Save it for later"]);
    expect(nextBtn().hidden).toBe(true);
  });

  it("Tab and Shift+Tab stay on the scene's visible buttons, and the page behind is inert", async () => {
    await sleep(60); // let the scene's own focus move settle
    const tab = (shift = false) =>
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true }),
      );
    const visible = [...door()!.querySelectorAll<HTMLButtonElement>(".door-choice")];
    expect(visible).toHaveLength(2);
    visible[0].focus();
    const seen: Element[] = [];
    for (let k = 0; k < 7; k++) {
      tab();
      seen.push(document.activeElement!);
    }
    expect(seen).toEqual([visible[1], visible[0], visible[1], visible[0], visible[1], visible[0], visible[1]]);
    tab(true);
    expect(document.activeElement).toBe(visible[0]);
    tab(true);
    expect(document.activeElement).toBe(visible[1]);
    // Skip and Next are hidden while choosing, so Tab never lands on them.
    expect(seen).not.toContain(btn('[data-door="skip"]'));
    expect(seen).not.toContain(nextBtn());
    // Everything outside the scene is inert, the Routes button included.
    expect($("toRoutes").closest("[inert]")).not.toBeNull();
    expect(door()!.closest("[inert]")).toBeNull();
  });

  it("the Routes button behind the scene can't be pressed", () => {
    const routes = $("toRoutes") as HTMLButtonElement;
    // Even if focus got there, Tab brings it straight back into the scene...
    routes.focus();
    expect(door()!.contains(document.activeElement)).toBe(true);
    // ...and Enter or a click on it does nothing.
    routes.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    routes.click();
    expect(bp.G).not.toBeNull();
    expect(bp.G!.phase).toBe("done");
    expect($("gameView").hidden).toBe(false);
    expect(door()).not.toBeNull();
  });

  it("board keys don't reach the game behind the scene", () => {
    const moves = bp.G!.moves;
    nextBtn().dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(bp.G!.moves).toBe(moves);
    expect(bp.G!.phase).toBe("done");
  });

  it("a reply is saved and answered", () => {
    btn('[data-choice="read"]').click();
    expect(saved().flags).toEqual({ "clementine.sisterNote": "read" });
    expect(line()).toMatch(/Plant them deeper/);
    nextBtn().click();
    expect(nextBtn().textContent).toBe("Continue");
  });

  it("Continue shows the Route complete card, and Next route still works", () => {
    nextBtn().click();
    expect(door()).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
    expect($("done").hidden).toBe(false);
    expect($("done").innerHTML).toMatch(/3 of 3/);
    document.querySelector<HTMLButtonElement>('#done [data-act="next"]')!.click();
    expect(bp.G!.li).toBe(1);
    expect(bp.G!.phase).toBe("sort");
  });
});

describe("replaying a route", () => {
  it("the stamp is already in the album and the last reply is marked", async () => {
    await playAtPar(0);
    const d = door()!;
    expect(d.textContent).toMatch(/Stamp in your album/);
    expect(d.textContent).toMatch(/1 of 10/);
    btn('[data-door="skip"]').click();
    expect(btn('[data-choice="read"]').textContent).toMatch(/Last time/);
    btn('[data-choice="later"]').click();
    expect(saved().flags["clementine.sisterNote"]).toBe("later");
    btn('[data-door="skip"]').click();
    nextBtn().click();
    expect(door()).toBeNull();
    expect($("done").hidden).toBe(false);
  });
});

describe("other routes", () => {
  it("every route at par plays its own neighbour, and the last one ends on All routes", async () => {
    for (let li = 1; li < ROUTES.length; li++) {
      await playAtPar(li);
      const scene = SPRING_SCENES.find((s) => s.route === ROUTES[li].id)!;
      expect(door(), ROUTES[li].id).not.toBeNull();
      expect($("doorSpeaker").textContent).toBe(scene.speaker);
      btn('[data-door="skip"]').click();
      btn(`[data-choice="${scene.choices[1].id}"]`).click();
      btn('[data-door="skip"]').click();
      nextBtn().click();
      expect($("done").hidden).toBe(false);
    }
    expect(document.querySelector('#done [data-act="next"]')).toBeNull();
    // the last card's All routes goes back to the village map
    document.querySelector<HTMLButtonElement>('#done [data-act="routes"]')!.click();
    expect($("mapView").hidden).toBe(false);
    expect($("mapStamps").textContent).toBe("10");
    expect(door()).toBeNull();
    expect(saved().stamps).toBeUndefined();
    expect(Object.keys(saved().flags)).toHaveLength(10);
  });

  it("Sunday tea remembers Primrose and Clover Bend", () => {
    // From the loop above: sisterNote "later", pieBaker "secret".
    expect(saved().flags["clementine.sisterNote"]).toBe("later");
    expect(saved().flags["barnaby.pieBaker"]).toBe("secret");
  });
});

describe("the scene on its own", () => {
  const clover = SPRING_SCENES.find((s) => s.route === "clover")!;
  const result = { route: ROUTES[1], index: 1, stars: 2, moves: 4, coldPie: true, firstFinish: false };

  it("a cold pie changes the first line, and Escape skips to the replies", () => {
    let went = 0;
    const h = showDoorScene({ scene: clover, result, onContinue: () => went++, store: null, typeMs: 0 });
    expect(line()).toMatch(/Gone a touch cold/);
    expect(h.el.querySelector(".door-stars")!.getAttribute("aria-label")).toBe("2 of 3 stars");
    h.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(h.el.querySelectorAll(".door-choice")).toHaveLength(2);
    h.choose("told");
    h.skip();
    h.next();
    expect(went).toBe(1);
    expect(door()).toBeNull();
  });

  it("lines type out, and the first tap finishes the line", async () => {
    const h = showDoorScene({ scene: clover, result, onContinue: () => {}, store: null, typeMs: 5 });
    await sleep(20);
    expect(line().length).toBeGreaterThan(0);
    expect(line().length).toBeLessThan(40);
    h.next();
    expect(line()).toMatch(/Who on earth sends/);
    h.next(); // on to line 2, which starts typing
    expect(line()).not.toMatch(/No name on the label/);
    h.next();
    expect(line()).toMatch(/No name on the label/);
    h.close();
    expect(door()).toBeNull();
  });

  it("has no voice button now: the voices switch lives in Settings", () => {
    const h = showDoorScene({ scene: clover, result, onContinue: () => {}, typeMs: 0 });
    expect(h.el.querySelector('[data-door="voice"]')).toBeNull();
    h.close();
  });

  it("closing leaves anything that was already inert as it was", () => {
    const already = document.createElement("div");
    already.setAttribute("inert", "");
    document.body.appendChild(already);
    const h = showDoorScene({ scene: clover, result, onContinue: () => {}, store: null, typeMs: 0 });
    h.close();
    expect(already.hasAttribute("inert")).toBe(true);
    expect(document.querySelectorAll("[inert]")).toHaveLength(1);
    already.remove();
  });

  it("a route with no scene goes straight to the card", () => {
    let went = 0;
    doorAfterRoute([])(result, () => went++);
    expect(went).toBe(1);
    expect(door()).toBeNull();
  });
});

function d() {
  return door()!;
}
