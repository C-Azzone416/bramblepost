// @vitest-environment jsdom
/** Title screen: everyone sees it. First-time players get New Game (primary); returning players get Continue and a confirmed New Game. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "../src/levels";
import { mountApp } from "../src/ui/mount";
import { ALL_KEYS, DOOR_KEY, VERSION_KEY, getAdapter, memoryAdapter, setAdapter } from "../src/save";
import { SAVE_KEY } from "../src/ui/save";
import { isMuted, setMuted } from "../src/ui/sound";
import { loadMuted } from "../src/ui/soundPref";
import { loadReduceMotion, saveReduceMotion } from "../src/ui/motion";
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
  // #59 replaces #17's "a new player goes straight to the map": first-time players now see the title.
  it("a first-time player sees the title with New Game primary and no Continue", () => {
    mountApp(root(), ROUTES);
    expect(visible("titleView")).toBe(true);
    expect(visible("mapView")).toBe(false);
    expect($("titleContinue").hidden).toBe(true);
    expect($("titleNew").hidden).toBe(false);
    expect($("titleNew").classList.contains("ghost")).toBe(false);
    expect($("titleAlbum").classList.contains("ghost")).toBe(true);
    expect(document.activeElement).toBe($("titleNew"));
  });

  it("New Game opens the map for a first-time player, with no confirm", () => {
    mountApp(root(), ROUTES);
    $("titleNew").click();
    expect(visible("titleView")).toBe(false);
    expect(visible("mapView")).toBe(true);
    expect(focusedAndVisible("mapView")).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#mapLanes [data-lane="' + ROUTES[0].id + '"]'));
  });

  it("a first-time player's New Game resets nothing: mute and reduced motion stay on", () => {
    setMuted(true);
    saveReduceMotion(true);
    mountApp(root(), ROUTES);
    $("titleNew").click();
    expect(visible("mapView")).toBe(true);
    expect(isMuted()).toBe(true);
    expect(loadMuted()).toBe(true);
    expect(loadReduceMotion()).toBe(true);
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
    setMuted(false);
    saveReduceMotion(false);
    document.documentElement.classList.remove("reduce-motion");
  });

  it("a returning player sees Continue (primary) and New Game (secondary)", () => {
    seed([ROUTES[0].id]);
    mountApp(root(), ROUTES);
    expect($("titleContinue").hidden).toBe(false);
    expect($("titleNew").hidden).toBe(false);
    expect($("titleNew").classList.contains("ghost")).toBe(true);
    expect($("titleContinue").classList.contains("ghost")).toBe(false);
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
    expect(document.activeElement).toBe($("titleNew"));
    $("titleNew").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe($("titleAlbum"));
    $("titleAlbum").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe($("titleNew"));
    $("titleNew").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
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
    const routed = ROUTES.slice(0, -1).map((r) => r.id);
    const hoods = NEIGHBOURHOODS.map((h) => (h.id === "thistledown" ? { ...h, routes: routed } : h));
    const p = villageProgress(seedBest(routed), hoods);
    expect(p.today).toBeNull();
    expect(continueLabel(p)).toBe("Spring · More lanes soon");
  });

  it("label: all village slots routed and stamped reads All lanes stamped", () => {
    const slots = NEIGHBOURHOODS[0].slots.length;
    const routed = Array.from({ length: slots }, (_, i) => `r${i + 1}`);
    const hoods = NEIGHBOURHOODS.map((h) => (h.id === "thistledown" ? { ...h, routes: routed } : h));
    const p = villageProgress(seedBest(routed), hoods);
    expect(p.today).toBeNull();
    expect(continueLabel(p, hoods)).toBe("Spring · All lanes stamped");
  });
});

describe("New Game for a returning player", () => {
  const orig = getAdapter();
  afterEach(() => setAdapter(orig));
  const esc = () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  const fill = () => {
    seed([ROUTES[0].id, ROUTES[1].id]);
    for (const k of ALL_KEYS) if (localStorage.getItem(k) === null) localStorage.setItem(k, "{}");
  };

  it("asks first: focus moves into the confirm, nothing is wiped until Yes", () => {
    fill();
    mountApp(root(), ROUTES);
    $("titleNew").click();
    expect($("titleConfirm").hidden).toBe(false);
    expect($("titleNew").hidden).toBe(true);
    expect(document.activeElement).toBe($("titleNewNo"));
    expect(visible("titleView")).toBe(true);
    for (const k of ALL_KEYS) expect(localStorage.getItem(k)).not.toBeNull();
  });

  it("Keep playing closes the confirm and returns focus to New Game", () => {
    fill();
    mountApp(root(), ROUTES);
    $("titleNew").click();
    $("titleNewNo").click();
    expect($("titleConfirm").hidden).toBe(true);
    expect(document.activeElement).toBe($("titleNew"));
    for (const k of ALL_KEYS) expect(localStorage.getItem(k)).not.toBeNull();
  });

  it("Escape cancels the confirm and returns focus to New Game", () => {
    fill();
    mountApp(root(), ROUTES);
    $("titleNew").click();
    esc();
    expect($("titleConfirm").hidden).toBe(true);
    expect(visible("titleView")).toBe(true);
    expect(document.activeElement).toBe($("titleNew"));
    for (const k of ALL_KEYS) expect(localStorage.getItem(k)).not.toBeNull();
  });

  it("Yes, start over clears every key and lands on a fresh map", () => {
    fill();
    mountApp(root(), ROUTES);
    $("titleNew").click();
    $("titleNewYes").click();
    // The fresh map re-stamps the version marker (as in settings.test.ts); every other key is gone.
    for (const k of ALL_KEYS.filter((k) => k !== VERSION_KEY)) expect(localStorage.getItem(k)).toBeNull();
    expect(visible("titleView")).toBe(false);
    expect(visible("mapView")).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#mapLanes [data-lane="' + ROUTES[0].id + '"]'));
    expect(document.querySelectorAll("#mapLanes .done, #mapLanes [data-state=done]").length).toBe(0);
  });

  it("a partial failure keeps the title up and says so", () => {
    const mem = memoryAdapter();
    setAdapter(mem);
    mem.setItem("bramblepost-playtest-v1", JSON.stringify({ best: { [ROUTES[0].id]: { stars: 3, moves: 5 } } }));
    const removeItem = mem.removeItem.bind(mem);
    mem.removeItem = (k: string) => {
      if (k === DOOR_KEY) throw new Error("nope");
      removeItem(k);
    };
    mem.setItem(DOOR_KEY, "{}");
    document.body.innerHTML = "";
    mountApp(root(), ROUTES);
    $("titleNew").click();
    $("titleNewYes").click();
    expect($("titleMsg").textContent).toContain("didn't clear");
    expect(visible("titleView")).toBe(true);
    expect($("titleConfirm").hidden).toBe(true);
    expect(document.activeElement).toBe($("titleNew"));
  });

  /** Storage where removing one key throws; the rest clear normally. */
  const flaky = (bad: string, bests: string[]) => {
    const mem = memoryAdapter();
    setAdapter(mem);
    mem.setItem(SAVE_KEY, JSON.stringify({ best: seedBest(bests) }));
    if (bad !== SAVE_KEY) mem.setItem(bad, "{}");
    const removeItem = mem.removeItem.bind(mem);
    mem.removeItem = (k: string) => {
      if (k === bad) throw new Error("nope");
      removeItem(k);
    };
    return mem;
  };
  const storedBest = () => Object.keys(JSON.parse(getAdapter().getItem(SAVE_KEY) ?? '{"best":{}}').best).sort();

  it("a partial failure that deleted the bests drops the returning state and cached bests", async () => {
    const mem = flaky(DOOR_KEY, [ROUTES[0].id, ROUTES[1].id]);
    const bp = mountApp(root(), ROUTES);
    $("titleNew").click();
    $("titleNewYes").click();
    expect(mem.getItem(SAVE_KEY)).toBeNull();
    expect(bp.title.returning).toBe(false);
    expect($("titleContinue").hidden).toBe(true);
    expect($("titleMsg").textContent).toContain("didn't clear");
    // Finishing a route must not write the old cached bests back.
    const L = ROUTES[2];
    bp.openLevel(2);
    for (let pass = 0; pass < 6; pass++)
      for (let i = 0; i < L.solution.order.length - 1; i++)
        if (L.solution.order.indexOf(bp.G!.order[i]) > L.solution.order.indexOf(bp.G!.order[i + 1]))
          (document.querySelector(`[data-down="${i}"]`) as HTMLButtonElement).click();
    for (const m of L.solution.moves) {
      bp.tryMove(m);
      for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(storedBest()).toEqual([L.id]);
  });

  it("a partial failure that kept the bests leaves the title returning, in step with storage", () => {
    flaky(SAVE_KEY, [ROUTES[0].id]);
    const bp = mountApp(root(), ROUTES);
    $("titleNew").click();
    $("titleNewYes").click();
    expect(storedBest()).toEqual([ROUTES[0].id]);
    expect(bp.title.returning).toBe(true);
    expect($("titleContinue").hidden).toBe(false);
    expect($("titleDay").textContent).toBe(continueLabel(villageProgress(seedBest([ROUTES[0].id]))));
    expect(visible("titleView")).toBe(true);
  });
});
