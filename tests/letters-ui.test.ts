// @vitest-environment jsdom
/** Carry and read letters (jsdom): a dummy letter rides route 1; the satchel shows its envelope and the letter is read after the door scene. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPRING_SCENES } from "../src/door/scenes";
import { doorAfterRoute } from "../src/door/view";
import { LETTERS_KEY } from "../src/save/keys";
import { ROUTES } from "../src/levels";
import { SPRING_LETTERS, setLetters, type Letter } from "../src/letters";
import { withLetters } from "../src/letters/view";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
const door = () => document.getElementById("doorScene");
const view = () => document.getElementById("letterView");
const lbtn = (k: string) => view()!.querySelector<HTMLButtonElement>(`[data-letter="${k}"]`)!;
const readIds = (): string[] => JSON.parse(localStorage.getItem(LETTERS_KEY) ?? '{"read":[]}').read;
let bp: GameApi;

const dummy: Letter = {
  id: "test-1",
  sender: "Test Sender",
  recipient: "Test Recipient",
  thread: "test",
  envelope: "Smells of lavender",
  body: ["First line.", "Second line."],
  placement: { route: ROUTES[0].id, slot: 0 },
};
let restore = () => {};

async function waitIdle() {
  for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await sleep(50);
}
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
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  restore = setLetters([dummy]);
  const root = document.createElement("div");
  document.body.appendChild(root);
  bp = mountApp(root, ROUTES, { afterRoute: withLetters(doorAfterRoute(SPRING_SCENES, { typeMs: 0 }), { typeMs: 0 }) });
  await sleep(50);
});
afterAll(() => restore());

describe("letters", () => {
  it("ships with no letters", () => {
    expect(SPRING_LETTERS).toEqual([]);
  });

  it("the satchel shows the envelope on the carrying parcel only", () => {
    bp.openLevel(0);
    const cards = [...document.querySelectorAll("#plist li")];
    const withEnv = cards.filter((c) => c.querySelector(".env"));
    expect(withEnv).toHaveLength(1);
    expect(withEnv[0].textContent).toMatch(/Letter from Test Sender/);
    expect(withEnv[0].textContent).toMatch(/Smells of lavender/);
  });

  it("opens after the door scene, types out, and closes with focus back", async () => {
    await playAtPar(0);
    expect(door()).not.toBeNull();
    expect(view()).toBeNull();
    // Walk the door scene to its end.
    const dnext = () => door()!.querySelector<HTMLButtonElement>('[data-door="next"]')!;
    dnext().click();
    dnext().click();
    door()!.querySelector<HTMLButtonElement>(".door-choice")!.click();
    dnext().click();
    dnext().click();
    expect(door()).toBeNull();
    expect(view()).not.toBeNull();
    expect($("done").hidden).toBe(true);
    expect(view()!.getAttribute("role")).toBe("dialog");
    expect(view()!.getAttribute("aria-modal")).toBe("true");
    expect($("letterTitle").textContent).toBe("From Test Sender to Test Recipient");
    expect($("letterText").textContent).toBe("First line.");
    await sleep(60);
    expect(document.activeElement).toBe(lbtn("next"));
    expect($("toRoutes").closest("[inert]")).not.toBeNull();
    expect(readIds()).toEqual([]);
  });

  it("Tab stays inside and keys don't reach the board", () => {
    const tab = (shift = false) =>
      (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true }));
    const seen: Element[] = [];
    for (let k = 0; k < 4; k++) {
      tab();
      seen.push(document.activeElement!);
    }
    expect(seen.every((e) => view()!.contains(e))).toBe(true);
    const moves = bp.G!.moves;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(bp.G!.moves).toBe(moves);
    ($("toRoutes") as HTMLButtonElement).focus();
    expect(view()!.contains(document.activeElement)).toBe(true);
  });

  it("Next shows the next line; Escape shows the rest, then closes and marks it read", async () => {
    lbtn("next").click();
    expect($("letterText").textContent).toBe("First line.Second line.");
    expect(lbtn("next").textContent).toBe("Continue");
    expect(readIds()).toEqual([]);
    view()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(view()).toBeNull();
    expect(readIds()).toEqual(["test-1"]);
    expect($("done").hidden).toBe(false);
    expect($("toRoutes").closest("[inert]")).toBeNull();
  });

  it("a read letter is not shown again, in the satchel or after the route", async () => {
    bp.openLevel(0);
    expect(document.querySelector("#plist .env")).toBeNull();
    await playAtPar(0);
    const dnext = () => door()?.querySelector<HTMLButtonElement>('[data-door="next"]');
    for (let k = 0; k < 6 && door(); k++) {
      door()!.querySelector<HTMLButtonElement>(".door-choice:not([hidden])")?.click();
      dnext()?.click();
    }
    expect(view()).toBeNull();
    expect($("done").hidden).toBe(false);
  });
});

describe("reading with the keyboard only", () => {
  it("Continue closes the letter and returns focus", async () => {
    localStorage.removeItem(LETTERS_KEY);
    await sleep(400); // let the finish card settle its own focus
    const holder = document.createElement("button");
    document.body.appendChild(holder);
    holder.focus();
    const { showLetter } = await import("../src/letters/view");
    let done = 0;
    showLetter({ letter: dummy, typeMs: 0, onDone: () => done++ });
    expect(view()).not.toBeNull();
    lbtn("skip").click();
    expect(lbtn("skip").hidden).toBe(true);
    lbtn("next").click();
    expect(view()).toBeNull();
    expect(done).toBe(1);
    await sleep(60);
    expect(document.activeElement).toBe(holder);
    expect(readIds()).toEqual(["test-1"]);
  });
});
