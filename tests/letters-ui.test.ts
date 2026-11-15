// @vitest-environment jsdom
/** Carry and read letters (jsdom): a dummy letter rides route 1; the satchel shows its envelope and the letter is read after the door scene. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SPRING_SCENES } from "../src/door/scenes";
import { doorAfterRoute } from "../src/door/view";
import { LETTERS_KEY } from "../src/save/keys";
import { ROUTES } from "../src/levels";
import { SPRING_LETTERS, setLetters, unreadForRoute, type Letter } from "../src/letters";
import { showLetter, withLetters } from "../src/letters/view";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
const door = () => document.getElementById("doorScene");
const view = () => document.getElementById("letterView");
const lbtn = (k: string) => view()!.querySelector<HTMLButtonElement>(`[data-letter="${k}"]`)!;
const readIds = (): string[] => JSON.parse(localStorage.getItem(LETTERS_KEY) ?? '{"read":[]}').read;
let bp: GameApi;

async function waitFor(cond: () => boolean, ms = 2000) {
  for (let t = 0; t < ms && !cond(); t += 10) await sleep(10);
  expect(cond()).toBe(true);
}

const dummy: Letter = {
  id: "test-1",
  sender: "Test Sender",
  recipient: "bea",
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
    expect($("letterTitle").textContent).toBe("From Test Sender to Bea Thimblewick");
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
    await waitFor(() => !!document.activeElement?.closest("#done")); // the finish card has settled its own focus
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

describe("review fixes", () => {
  const state = { read: [] as string[], flags: {} };
  const R = ROUTES[0];

  it("an invalid slot is ignored, and a valid one still rides", () => {
    const n = R.parcels.length;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mk = (id: string, slot: number): Letter => ({ ...dummy, id, placement: { route: R.id, slot } });
    for (const bad of [-1, n, 99, 1.5, NaN]) expect(unreadForRoute(R.id, n, state, [mk("x", bad)])).toEqual([]);
    expect(unreadForRoute(R.id, n, state, [mk("bad", 99), mk("ok", n - 1)]).map((l) => l.id)).toEqual(["ok"]);
    warn.mockRestore();
    // And end to end: the hook just continues.
    const restoreBad = setLetters([mk("bad", 99)]);
    let continued = 0;
    withLetters((_r, c) => c(), { typeMs: 0 })({ route: R, index: 0, stars: 3, moves: 1, coldPie: false, firstFinish: false }, () => continued++);
    restoreBad();
    expect(continued).toBe(1);
    expect(view()).toBeNull();
  });

  it("two letters in one (route, slot) throw at registration", () => {
    expect(() => setLetters([dummy, { ...dummy, id: "other" }])).toThrow(/slot 0/);
    expect(() => setLetters([dummy, { ...dummy, placement: { route: R.id, slot: 1 } }])).toThrow(/Duplicate letter id/);
  });

  it("the queue and the satchel use the same lookup", () => {
    expect(unreadForRoute(R.id, R.parcels.length, state, [dummy])).toEqual([dummy]);
  });

  it("leaving mid-letter cleans up, and replaying works", async () => {
    localStorage.removeItem(LETTERS_KEY);
    const walkDoor = async () => {
      for (let k = 0; k < 8 && door(); k++) {
        door()!.querySelector<HTMLButtonElement>(".door-choice:not([hidden])")?.click();
        door()?.querySelector<HTMLButtonElement>('[data-door="next"]')?.click();
      }
    };
    await playAtPar(0);
    await walkDoor();
    expect(view()).not.toBeNull();
    bp.openLevel(0); // leave via the game API
    expect(view()).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.body.classList.contains("letter-open")).toBe(false);
    expect(readIds()).toEqual([]);
    await waitFor(() => document.activeElement === $("board") || document.activeElement === document.body);
    // Replay: the same letter comes again, and finishing the queue shows the card.
    await playAtPar(0);
    await walkDoor();
    expect(view()).not.toBeNull();
    expect($("letterText").textContent).toBe("First line.");
    lbtn("skip").click();
    lbtn("next").click();
    expect(view()).toBeNull();
    expect(readIds()).toEqual(["test-1"]);
    expect($("done").hidden).toBe(false);
  });

  it("leaving during the door scene closes it too, and a stale continue does nothing", async () => {
    localStorage.removeItem(LETTERS_KEY);
    await playAtPar(0);
    expect(door()).not.toBeNull();
    bp.openLevel(0);
    expect(door()).toBeNull();
    expect(view()).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("when typing finishes by itself, Continue shows and Escape closes", async () => {
    localStorage.removeItem(LETTERS_KEY);
    let done = 0;
    const h = showLetter({ letter: { ...dummy, body: ["Hi."] }, typeMs: 1, onDone: () => done++ });
    expect(lbtn("next").textContent).toBe("Next");
    await waitFor(() => lbtn("next").textContent === "Continue");
    expect(lbtn("skip").hidden).toBe(true);
    await waitFor(() => document.activeElement === lbtn("next"));
    h.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(view()).toBeNull();
    expect(done).toBe(1);
  });

  it("closing one letter and opening the next at once keeps focus in the new dialog", () => {
    vi.useFakeTimers();
    try {
      const holder = document.createElement("button");
      document.body.appendChild(holder);
      holder.focus();
      const a = showLetter({ letter: dummy, typeMs: 0, onDone: () => {}, store: null });
      a.cancel();
      const b = showLetter({ letter: { ...dummy, id: "test-2" }, typeMs: 0, onDone: () => {}, store: null });
      vi.advanceTimersByTime(200);
      expect(b.el.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(lbtn("next"));
      b.cancel();
      holder.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
