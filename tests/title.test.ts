// @vitest-environment jsdom
/** Title screen: new players go to the map, returning players see the title and Continue opens the map. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { continueLabel } from "../src/ui/title";
import { NEIGHBOURHOODS } from "../src/village/data";
import { villageProgress } from "../src/village/progress";

const root = () => document.body.appendChild(Object.assign(document.createElement("div"), { id: "r" }));
const $ = (id: string) => document.getElementById(id)!;
const visible = (id: string) => !$(id).hidden;
/** The focused element is on screen: inside the map and not under a hidden ancestor. */
const focusedAndVisible = (inside: string) => {
  const el = document.activeElement as HTMLElement;
  return !!el && !!$(inside).contains(el) && !el.closest("[hidden]");
};

function seed(ids: string[]) {
  const best: Record<string, unknown> = {};
  for (const id of ids) best[id] = { stars: 3, moves: 5 };
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best }));
}

const seedBest = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { stars: 3, moves: 5 }]));

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

  it("after Continue, focus moves to the next lane on the map, not into a hidden title", () => {
    seed([ROUTES[0].id, ROUTES[1].id]);
    mountApp(root(), ROUTES);
    $("titleContinue").click();
    expect(focusedAndVisible("mapView")).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#mapLanes [data-lane="' + ROUTES[2].id + '"]'));
  });

  it("a new player landing on the map gets focus there too", () => {
    mountApp(root(), ROUTES);
    expect(focusedAndVisible("mapView")).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#mapLanes [data-lane="' + ROUTES[0].id + '"]'));
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

  it("Album is disabled until wired; Settings is wired by the app", () => {
    seed([ROUTES[0].id]);
    const album = vi.fn();
    mountApp(root(), ROUTES, { onAlbum: album });
    expect($("titleSettings").hasAttribute("aria-disabled")).toBe(false);
    expect($("titleAlbum").textContent).not.toContain("Coming soon");
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

  it("label: 0 stamped reads Day 1", () => {
    expect(continueLabel(villageProgress({}))).toBe("Spring · Day 1");
  });

  it("label: 1 stamped reads Day 2", () => {
    expect(continueLabel(villageProgress(seedBest([ROUTES[0].id])))).toBe("Spring · Day 2");
  });

  it("label: every existing route stamped, but Thistledown has reserved slots, reads More lanes soon", () => {
    const p = villageProgress(seedBest(ROUTES.map((r) => r.id)));
    expect(p.today).toBeNull();
    expect(continueLabel(p)).toBe("Spring · More lanes soon");
  });

  it("label: all 15 slots routed and stamped reads All lanes stamped", () => {
    const slots = NEIGHBOURHOODS[0].slots.length;
    expect(slots).toBe(15);
    const fifteen = Array.from({ length: slots }, (_, i) => `r${i + 1}`);
    const hoods = NEIGHBOURHOODS.map((h) => (h.id === "thistledown" ? { ...h, routes: fifteen } : h));
    const p = villageProgress(seedBest(fifteen), hoods);
    expect(p.today).toBeNull();
    expect(continueLabel(p, hoods)).toBe("Spring · All lanes stamped");
  });
});
