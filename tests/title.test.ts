// @vitest-environment jsdom
/** Title screen: new players go to the map, returning players see the title and Continue opens the map. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { continueLabel } from "../src/ui/title";
import { villageProgress } from "../src/village/progress";

const root = () => document.body.appendChild(Object.assign(document.createElement("div"), { id: "r" }));
const $ = (id: string) => document.getElementById(id)!;
const visible = (id: string) => !$(id).hidden;

function seed(ids: string[]) {
  const best: Record<string, unknown> = {};
  for (const id of ids) best[id] = { stars: 3, moves: 5 };
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window.scrollTo = () => {};
  vi.unstubAllGlobals();
});

describe("title screen", () => {
  it("a new player goes straight to the map", () => {
    mountApp(root(), ROUTES);
    expect(visible("mapView")).toBe(true);
    expect(visible("titleView")).toBe(false);
  });

  it("a returning player sees the title; Continue opens the map with the day label", () => {
    seed([ROUTES[0].id, ROUTES[1].id]);
    mountApp(root(), ROUTES);
    expect(visible("titleView")).toBe(true);
    expect(visible("mapView")).toBe(false);
    expect($("titleDay").textContent).toBe("Spring · Day 3");
    $("titleContinue").click();
    expect(visible("mapView")).toBe(true);
    expect(visible("titleView")).toBe(false);
  });

  it("skipTitle goes to the map", () => {
    seed([ROUTES[0].id]);
    mountApp(root(), ROUTES, { skipTitle: true });
    expect(visible("mapView")).toBe(true);
  });

  it("keyboard: Continue has focus, arrows move, Enter-style click activates", () => {
    seed([ROUTES[0].id]);
    mountApp(root(), ROUTES);
    expect(document.activeElement).toBe($("titleContinue"));
    $("titleContinue").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe($("titleAlbum"));
    $("titleAlbum").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe($("titleContinue"));
  });

  it("Album and Settings are disabled until wired", () => {
    seed([ROUTES[0].id]);
    const album = vi.fn();
    mountApp(root(), ROUTES, { onAlbum: album });
    expect($("titleSettings").getAttribute("aria-disabled")).toBe("true");
    expect($("titleSettings").textContent).toContain("Coming soon");
    expect($("titleAlbum").hasAttribute("aria-disabled")).toBe(false);
    $("titleAlbum").click();
    expect(album).toHaveBeenCalled();
  });

  it("letters drift unless reduced motion is on", () => {
    seed([ROUTES[0].id]);
    mountApp(root(), ROUTES);
    expect(document.querySelector(".tsky")!.classList.contains("drift")).toBe(true);
    document.body.innerHTML = "";
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    window.matchMedia = (q: string) => ({ matches: q.includes("reduce") }) as MediaQueryList;
    mountApp(root(), ROUTES);
    expect(document.querySelector(".tsky")!.classList.contains("drift")).toBe(false);
  });

  it("label: next lane number, or all stamped", () => {
    expect(continueLabel(villageProgress({}))).toBe("Spring · Day 1");
    const all = Object.fromEntries(ROUTES.map((r) => [r.id, { stars: 3, moves: 1 }]));
    expect(continueLabel(villageProgress(all))).toMatch(/^Spring · /);
  });
});
