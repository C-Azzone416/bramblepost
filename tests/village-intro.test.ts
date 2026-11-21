// @vitest-environment jsdom
/** The welcome intro (#61): plays once per village on first entry, cleans up when cancelled, and reset clears it for the active pack only. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_PACK } from "../src/content/active";
import { ROUTES } from "../src/levels";
import { DATA_KEYS, ENDING_KEY, INTRO_KEY, keysFor, memoryAdapter, resetProgress } from "../src/save";
import { mountApp, type App } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { NEIGHBOURHOODS } from "../src/village/data";
import { VILLAGE_INTROS, introsForPack, introsSeen, villageIntro } from "../src/village/intro";

const $ = (id: string) => document.getElementById(id)!;
const view = () => document.getElementById("letterView");
let app: App;

function mount() {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  document.body.appendChild(root);
  app = mountApp(root, ROUTES, { skipTitle: true, onEnterVillage: villageIntro({ typeMs: 0 }) });
}
const enter = () => $("mapEnter").click();
const key = (k: string, el: Element | Document = document) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = () => {};
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries(ROUTES.map((r) => [r.id, { stars: 2, moves: r.par + 1 }])) }));
  localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
  document.body.className = "";
});

describe("intro copy", () => {
  it("every village has 3 to 5 lines, each under 140 characters, and the ids are real villages", () => {
    const ids = new Set(NEIGHBOURHOODS.map((n) => n.id));
    expect(Object.keys(VILLAGE_INTROS).filter((id) => !ids.has(id))).toEqual([]);
    const bad = Object.entries(VILLAGE_INTROS).filter(([, l]) => l.length < 3 || l.length > 5 || l.some((x) => x.length >= 140 || !x.trim()));
    expect(bad.map(([id]) => id)).toEqual([]);
    expect(VILLAGE_INTROS.hollowmere).toBeDefined();
  });
});

describe("playing the intro", () => {
  it("plays on the first entry, holds the map, and the map shows after it is read", async () => {
    mount();
    enter();
    await Promise.resolve();
    expect(view()).not.toBeNull();
    expect(view()!.getAttribute("role")).toBe("dialog");
    expect($("mapTitle").textContent).toBe("Thistledown");
    key("Escape"); // shows the rest
    key("Escape"); // closes
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
    expect(app.map.village).toBe("hollowmere");
    expect(introsSeen()).toEqual(["hollowmere"]);
  });

  it("does not play again once it has been seen", async () => {
    mount();
    enter();
    await Promise.resolve();
    key("Escape");
    key("Escape");
    await new Promise((r) => setTimeout(r, 10));
    $("mapBack").click();
    enter();
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
    expect(app.map.village).toBe("hollowmere");
  });

  it("does not play when the village was already visited before the flag existed", async () => {
    localStorage.setItem(DATA_KEYS.find((k) => k.includes("current-village"))!, JSON.stringify({ current: "thistledown", visited: ["thistledown", "hollowmere"] }));
    mount();
    enter();
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
  });
});

describe("cleaning up", () => {
  it("leaving the map closes the intro, leaves no dialog, inert page or listeners, and it is not marked seen", async () => {
    mount();
    enter();
    await Promise.resolve();
    expect(view()).not.toBeNull();
    expect(document.body.classList.contains("letter-open")).toBe(true);
    app.map.hide(); // the player leaves the map: the entry is dropped

    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
    expect(document.body.classList.contains("letter-open")).toBe(false);
    expect(document.querySelectorAll("[inert]").length).toBe(0);
    expect(introsSeen()).toEqual([]);
    key("Escape"); // a stray Escape reaches nothing
    expect(view()).toBeNull();
  });
});

describe("reset", () => {
  it("clears the flag for the active pack only", () => {
    const a = memoryAdapter();
    const std = keysFor("standard");
    const other = keysFor("stand-in");
    expect(std.DATA_KEYS).toContain(std.INTRO_KEY);
    expect(INTRO_KEY).toBe(std.INTRO_KEY);
    a.setItem(std.INTRO_KEY, "x");
    a.setItem(other.INTRO_KEY, "x");
    expect(resetProgress(a, other)).toBe(true);
    expect(a.getItem(other.INTRO_KEY)).toBeNull();
    expect(a.getItem(std.INTRO_KEY)).toBe("x");
    expect(other.INTRO_KEY).not.toBe(std.INTRO_KEY);
  });
});

describe("the first village's welcome", () => {
  const title = () => document.getElementById("titleNew")!;
  const mountWithTitle = () => {
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    app = mountApp(root, ROUTES, { onEnterVillage: villageIntro({ typeMs: 0 }) });
  };
  const readThrough = async () => {
    key("Escape");
    key("Escape");
    await new Promise((r) => setTimeout(r, 10));
  };

  it("New Game for a first-time player plays it once, then shows the map", async () => {
    localStorage.clear();
    mountWithTitle();
    title().click();
    await new Promise((r) => setTimeout(r, 0));
    expect(view()).not.toBeNull();
    expect(app.map.visible).toBe(false);
    await readThrough();
    expect(view()).toBeNull();
    expect(app.map.visible).toBe(true);
    expect(introsSeen()).toEqual(["thistledown"]);
    mountWithTitle(); // the same save, a second New Game: already seen
    title().click();
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
    expect(app.map.visible).toBe(true);
  });

  it("continuing an existing save does not play it", async () => {
    mountWithTitle();
    document.getElementById("titleContinue")!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).toBeNull();
    expect(app.map.visible).toBe(true);
    expect(introsSeen()).toEqual([]);
  });

  it("a confirmed New Game on an existing save wipes the flag and plays it again", async () => {
    localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown"] }));
    mountWithTitle();
    title().click();
    $("titleNewYes").click();
    await new Promise((r) => setTimeout(r, 10));
    expect(view()).not.toBeNull();
    await readThrough();
    expect(app.map.visible).toBe(true);
    expect(introsSeen()).toEqual(["thistledown"]);
  });
});

describe("focus and the entry's lifetime", () => {
  it("a completed entry ends with focus on the new village title, not the old control", async () => {
    vi.useFakeTimers();
    try {
      mount();
      $("mapEnter").focus();
      enter();
      await vi.advanceTimersByTimeAsync(5);
      key("Escape");
      key("Escape");
      await vi.advanceTimersByTimeAsync(200);
      expect(app.map.village).toBe("hollowmere");
      expect(document.activeElement).toBe($("mapTitle"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("a cancelled entry puts focus back on the entry control", async () => {
    vi.useFakeTimers();
    try {
      mount();
      $("mapEnter").focus();
      enter();
      await vi.advanceTimersByTimeAsync(5);
      app.map.reload(); // the entry is dropped while the map stays up (a reset)
      await vi.advanceTimersByTimeAsync(200);
      expect(view()).toBeNull();
      expect(app.map.village).toBe("thistledown");
      expect(document.activeElement).toBe($("mapEnter"));
    } finally {
      vi.useRealTimers();
    }
  });

  const capture = () => {
    const seen: { signal?: AbortSignal; release: () => void } = { release: () => {} };
    const hook = (_id: string, _first: boolean, signal?: AbortSignal) => {
      seen.signal = signal;
      return new Promise<void>((r) => (seen.release = r));
    };
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    app = mountApp(root, ROUTES, { skipTitle: true, onEnterVillage: hook });
    return seen;
  };

  it("a finished entry's signal is not aborted by a later Back, hide or reset", async () => {
    const seen = capture();
    enter();
    seen.release();
    await vi.waitFor(() => expect(app.map.village).toBe("hollowmere"));
    $("mapBack").click();
    app.map.hide();
    app.map.reload();
    expect(seen.signal!.aborted).toBe(false);
  });

  it("an entry that is left before it settles has its signal aborted", () => {
    const seen = capture();
    enter();
    expect(seen.signal!.aborted).toBe(false);
    app.map.hide();
    expect(seen.signal!.aborted).toBe(true);
  });
});

 it("resolves pack welcomes per season and preserves spring and missing or empty fallbacks", () => {
  const springOnly = { ...ACTIVE_PACK, seasons: undefined };
  expect(introsForPack(springOnly).thistledown).toEqual(VILLAGE_INTROS.thistledown);
  expect(introsForPack(springOnly).hollowmere).toEqual(VILLAGE_INTROS.hollowmere);
  const summer = { scenes: [], letters: [], slots: [], intro: ["Synthetic summer welcome"] };
  const pack = { ...springOnly, seasons: { summer } };
  expect(introsForPack(pack).hollowmere).toEqual(summer.intro);
  expect(introsForPack({ ...pack, seasons: { summer: { ...summer, intro: [] } } }).hollowmere).toEqual(VILLAGE_INTROS.hollowmere);
 });

 it("plays the resolved summer welcome and records it under the existing key", async () => {
  const pack = { ...ACTIVE_PACK, seasons: { summer: { scenes: [], letters: [], slots: [], intro: ["Synthetic summer welcome"] } } };
  const entry = villageIntro({ intros: introsForPack(pack), typeMs: 0 });
  const done = entry("hollowmere", true, new AbortController().signal);
  expect(view()?.textContent).toContain("Synthetic summer welcome");
  key("Escape");
  await done;
  expect(JSON.parse(localStorage.getItem(INTRO_KEY)!)).toEqual({ seen: ["hollowmere"] });
 });
