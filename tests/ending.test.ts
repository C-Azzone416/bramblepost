// @vitest-environment jsdom
/** The closing scene (#57, #58): the final route plays the door scene then Barnaby's Spring Supper, once; cancelling cleans up. Branching is in ending-supper.test.ts. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ENDING_SCENES } from "../src/door/ending";
import { endingSeen } from "../src/door/endingSave";
import { withEnding } from "../src/door/endingView";
import { SPRING_SCENES } from "../src/door/scenes";
import { doorAfterRoute } from "../src/door/view";
import { withLetters } from "../src/letters/view";
import { ROUTES } from "../src/levels";
import { lettersForRoute, SPRING_LETTERS } from "../src/letters";
import { DATA_KEYS, ENDING_KEY, resetProgress } from "../src/save";
import { SAVE_KEY } from "../src/ui/save";
import { mountApp, type App } from "../src/ui/mount";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (id: string) => document.getElementById(id)!;
const door = () => document.getElementById("doorScene");
const view = () => document.getElementById("letterView");
const LAST = ROUTES.length - 1;
let app: App;

async function waitIdle() {
  for (let i = 0; i < 200 && app.G && app.G.busy; i++) await sleep(50);
}
async function playAtPar(li: number) {
  const L = ROUTES[li];
  app.openLevel(li);
  const target = L.solution.order;
  for (let pass = 0; pass < 6; pass++)
    for (let i = 0; i < target.length - 1; i++)
      if (target.indexOf(app.G!.order[i]) > target.indexOf(app.G!.order[i + 1]))
        (document.querySelector(`[data-down="${i}"]`) as HTMLButtonElement).click();
  for (const m of L.solution.moves) {
    app.tryMove(m);
    await waitIdle();
  }
  await sleep(300);
}
function walkDoor() {
  const next = () => door()!.querySelector<HTMLButtonElement>('[data-door="next"]')!;
  for (let k = 0; k < 6 && !door()!.querySelector(".door-choice"); k++) next().click();
  door()!.querySelector<HTMLButtonElement>(".door-choice")!.click();
  next().click();
  next().click();
}
const ENDING_TITLE = "Barnaby's Spring Supper";
/**
 * Reads every letter dialog that opens, to the end, and returns the titles shown (any letter, not just the
 * ending). The hand-off from the door scene is asynchronous, so this waits until no dialog has appeared for a
 * short quiet spell before it gives up.
 */
async function walkLetters(): Promise<string[]> {
  const next = () => view()!.querySelector<HTMLButtonElement>('[data-letter="next"]')!;
  const titles: string[] = [];
  let quiet = 0;
  for (let t = 0; t < 200 && quiet < 6; t++) {
    if (!view()) {
      quiet++;
      await sleep(25);
      continue;
    }
    quiet = 0;
    const title = $("letterTitle").textContent ?? "";
    if (titles[titles.length - 1] !== title) titles.push(title);
    next().click();
  }
  return titles;
}
const noneOpen = () => {
  expect(door()).toBeNull();
  expect(view()).toBeNull();
  expect(document.querySelectorAll("[inert]")).toHaveLength(0);
  expect(document.body.classList.contains("letter-open")).toBe(false);
};

beforeAll(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  document.head.appendChild(style);
  const best: Record<string, { stars: number; moves: number }> = {};
  ROUTES.slice(0, LAST).forEach((r) => (best[r.id] = { stars: 3, moves: r.par }));
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
  const root = document.createElement("div");
  document.body.appendChild(root);
  const hook = withEnding(withLetters(doorAfterRoute(SPRING_SCENES, { typeMs: 0 }), { typeMs: 0 }), ENDING_SCENES, { typeMs: 0 });
  app = mountApp(root, ROUTES, { skipTitle: true, afterRoute: hook });
});

describe("ending", () => {
  it("the scene is the Spring Supper, keyed to the last route, with a sign-off naming all four", () => {
    const s = ENDING_SCENES.find((e) => e.route === "lastround")!;
    expect(ROUTES[LAST].id).toBe("lastround");
    expect(s.title).toBe(ENDING_TITLE);
    expect(s.lines.length).toBeGreaterThanOrEqual(10);
    expect(s.lines.length).toBeLessThanOrEqual(16);
    const last = s.lines[s.lines.length - 1] as string;
    for (const n of ["Clementine", "Old Barnaby", "Bea Thimblewick", "Mole Bros."]) expect(last).toContain(n);
    expect(ENDING_KEY in {} || DATA_KEYS).toContain(ENDING_KEY);
  });

  it("cancelling mid-ending (leaving the route) cleans up and does not mark it seen", async () => {
    await playAtPar(LAST);
    expect(door()).not.toBeNull();
    walkDoor();
    expect(view()).not.toBeNull();
    expect($("letterTitle").textContent).toBe(ENDING_TITLE);
    expect($("done").hidden).toBe(true);
    app.restart();
    noneOpen();
    expect(endingSeen()).toBe(false);
  });

  it("cancelling mid-ending never calls the stale continue, even if the inner scene resolves late", () => {
    let release: () => void = () => {};
    const inner = (_r: unknown, c: () => void) => {
      release = c;
    };
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    let continued = 0;
    const cancel = withEnding(inner as never, ENDING_SCENES, { typeMs: 0, store: fake as never })(
      { route: ROUTES[LAST] } as never,
      () => continued++,
    ) as () => void;
    cancel();
    release();
    noneOpen();
    expect(continued).toBe(0);
    expect(store.size).toBe(0);
  });

  it("plays the door scene then the ending, once, then the card (with the real spring letters registered)", async () => {
    // Composition with real content: the registry is the shipped one, and the final route carries no letter of its own.
    expect(SPRING_LETTERS.length).toBeGreaterThan(0);
    expect(lettersForRoute(ROUTES[LAST].id)).toHaveLength(0);
    await playAtPar(LAST);
    expect(door()).not.toBeNull();
    expect(view()).toBeNull();
    walkDoor();
    expect(await walkLetters()).toEqual([ENDING_TITLE]);
    noneOpen();
    expect(endingSeen()).toBe(true);
    expect($("done").hidden).toBe(false);
  });

  it("a second finish plays the door scene but not the ending", async () => {
    await playAtPar(LAST);
    expect(door()).not.toBeNull();
    walkDoor();
    expect(await walkLetters()).not.toContain(ENDING_TITLE);
    noneOpen();
    expect($("done").hidden).toBe(false);
  });

  it("the map shows the whole path complete with the Hollowmere note", () => {
    $("toRoutes").click();
    expect(app.map.visible).toBe(true);
    expect(document.querySelectorAll("#villageSvg .vnode.done")).toHaveLength(ROUTES.length);
    expect($("mapStamps").textContent).toBe(String(ROUTES.length));
    expect($("mapView").classList.contains("vcomplete")).toBe(true);
    expect($("mapNews").textContent).toBe("Spring is done. Hollowmere next.");
    expect($("villageSvg").getAttribute("aria-label")).toBe(
      `Map of Thistledown. ${ROUTES.length} of ${ROUTES.length} lanes stamped. The whole path is complete. Spring is done. Hollowmere next.`,
    );
    // the way into Hollowmere is a real button now (#60), not a note
    expect(document.querySelector("#villageSvg .vnextnote")).toBeNull();
    expect($("mapEnter").hidden).toBe(false);
    expect($("mapEnter").textContent).toBe("Go to Hollowmere");
  });

  it("replaying another route doesn't replay the ending", async () => {
    await playAtPar(0);
    walkDoor();
    // Any letter that rides route 0 may open here; the ending's dialog must not.
    expect(await walkLetters()).not.toContain(ENDING_TITLE);
    noneOpen();
  });

  it("reset clears the flag and the map goes back to unfinished", () => {
    expect(endingSeen()).toBe(true);
    resetProgress();
    expect(endingSeen()).toBe(false);
    app.map.show();
    expect($("mapView").classList.contains("vcomplete")).toBe(false);
  });
});
