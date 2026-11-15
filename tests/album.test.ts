// @vitest-environment jsdom
/** Village Album: slots, stamps, letters, and opening/closing from the title and the map. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Letter } from "../src/letters/types";
import { ROUTES } from "../src/levels";
import { setLetters } from "../src/letters";
import { markRead, loadLetters } from "../src/letters/save";
import { mountApp } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";

// setLetters rejects two letters in one slot, so the same-slot test feeds the album directly.
let forced: Letter[] | null = null;
vi.mock("../src/letters/registry", async (orig) => {
  const m = await orig<typeof import("../src/letters/registry")>();
  return { ...m, currentLetters: () => forced ?? m.currentLetters() };
});

const $ = (id: string) => document.getElementById(id)!;
const root = () => document.body.appendChild(Object.assign(document.createElement("div"), { id: "r" }));
const stamps = () => [...document.querySelectorAll<HTMLElement>("#albumView .astamp")];
const names = () => stamps().map((s) => s.getAttribute("aria-label"));
const esc = () => $("albumView").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

function seed(ids: string[], stars = 3) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries(ids.map((id) => [id, { stars, moves: 5 }])) }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window.scrollTo = () => {};
  vi.unstubAllGlobals();
  forced = null;
});

const mk = (id: string, recipient: Letter["recipient"], placement?: Letter["placement"]): Letter => ({
  id, sender: "Someone", recipient, thread: "t", envelope: `env ${id}`, body: ["Hi"], placement,
});

describe("village album", () => {
  it("an empty album shows every slot empty, with reserved '?' slots and no letters yet", () => {
    mountApp(root(), ROUTES, { skipTitle: true });
    $("mapAlbum").click();
    expect($("albumView").hidden).toBe(false);
    expect(stamps()).toHaveLength(15);
    expect(stamps().some((s) => s.classList.contains("done"))).toBe(false);
    expect(names().filter((n) => n === "Not yet stamped")).toHaveLength(15 - ROUTES.length);
    expect(names()[0]).toBe(`${ROUTES[0].name}, not yet stamped`);
    expect(document.querySelectorAll(".anone")).toHaveLength(4);
    expect($("albumBody").textContent).toContain("No letters yet");
    expect($("albumBody").textContent).toContain("Clementine");
  });

  it("shows seeded stamps with their stars", () => {
    seed([ROUTES[0].id], 2);
    mountApp(root(), ROUTES, { skipTitle: true });
    $("mapAlbum").click();
    expect(names()[0]).toBe(`${ROUTES[0].name}, 2 stars`);
    expect(stamps()[0].classList.contains("done")).toBe(true);
    expect(names()[1]).toBe(`${ROUTES[1].name}, not yet stamped`);
  });

  it("counts letter slots from the registry and fills a read letter under its neighbour", () => {
    const restore = setLetters([
      { id: "t1", sender: "Bea Thimblewick", recipient: "clementine", thread: "t", envelope: "Pressed violet", body: ["Hi"] },
      { id: "t2", sender: "Clementine", recipient: "clementine", thread: "t", envelope: "Second", body: ["Hi"] },
    ]);
    try {
      markRead(loadLetters(), "t1");
      mountApp(root(), ROUTES, { skipTitle: true });
      $("mapAlbum").click();
      const sec = document.querySelector<HTMLElement>("#aln-tea")!.closest("section")!;
      expect(sec.querySelectorAll("li")).toHaveLength(2);
      expect(sec.querySelector(".aletter.done")!.getAttribute("aria-label")).toBe("Letter read: Pressed violet");
      expect(sec.textContent).toContain("1 of 2");
      expect(document.querySelectorAll(".anone")).toHaveLength(3);
    } finally {
      restore();
    }
  });

  it("opens from the map; Escape and Back return focus to the Album button", () => {
    mountApp(root(), ROUTES, { skipTitle: true });
    $("mapAlbum").focus();
    $("mapAlbum").click();
    expect($("mapView").hidden).toBe(true);
    expect(document.activeElement).toBe($("albumTitle"));
    esc();
    expect($("albumView").hidden).toBe(true);
    expect($("mapView").hidden).toBe(false);
    expect(document.activeElement).toBe($("mapAlbum"));
    $("mapAlbum").click();
    $("albumBack").click();
    expect(document.activeElement).toBe($("mapAlbum"));
  });

  it("opens from the title and returns focus to its button", () => {
    seed([ROUTES[0].id]);
    mountApp(root(), ROUTES);
    expect($("titleView").hidden).toBe(false);
    expect($("titleAlbum").getAttribute("aria-disabled")).toBeNull();
    $("titleAlbum").click();
    expect($("titleView").hidden).toBe(true);
    expect($("albumView").hidden).toBe(false);
    esc();
    expect($("titleView").hidden).toBe(false);
    expect(document.activeElement).toBe($("titleAlbum"));
  });

  it("groups letters by recipient id for all four neighbours", () => {
    const restore = setLetters([mk("a", "clementine"), mk("b", "barnaby"), mk("c", "bea"), mk("d", "moles"), mk("e", "moles")]);
    try {
      mountApp(root(), ROUTES, { skipTitle: true });
      $("mapAlbum").click();
      const count = (id: string) => document.querySelector<HTMLElement>(`#aln-${id}`)!.closest("section")!.querySelectorAll("li").length;
      expect([count("tea"), count("acorn"), count("mush"), count("burrow")]).toEqual([1, 1, 1, 2]);
      expect(document.querySelectorAll(".anone")).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("counts letters sharing one (route, slot) as a single slot, and a read variant fills it", () => {
    forced = [mk("v1", "bea", { route: "r", slot: 0 }), mk("v2", "bea", { route: "r", slot: 0 }), mk("u", "bea")];
    markRead(loadLetters(), "v2");
    mountApp(root(), ROUTES, { skipTitle: true });
    $("mapAlbum").click();
    const sec = document.querySelector<HTMLElement>("#aln-mush")!.closest("section")!;
    expect(sec.querySelectorAll("li")).toHaveLength(2);
    expect(sec.textContent).toContain("1 of 2");
    expect(sec.querySelector(".aletter.done")!.getAttribute("aria-label")).toBe("Letter read: env v2");
  });

  it("Back from the title opener restores the title and its focus", () => {
    mountApp(root(), ROUTES);
    $("titleAlbum").click();
    $("albumBack").click();
    expect($("titleView").hidden).toBe(false);
    expect($("albumView").hidden).toBe(true);
    expect(document.activeElement).toBe($("titleAlbum"));
  });

  it.each([
    ["map", () => mountApp(root(), ROUTES, { skipTitle: true }), "mapAlbum"],
    ["title", () => mountApp(root(), ROUTES), "titleAlbum"],
  ])("Escape in the album does not reach document listeners (%s opener)", (_n, mount, btn) => {
    mount();
    $(btn).click();
    const seen = vi.fn();
    document.addEventListener("keydown", seen);
    try {
      esc();
      expect(seen).not.toHaveBeenCalled();
      expect($("albumView").hidden).toBe(true);
    } finally {
      document.removeEventListener("keydown", seen);
    }
  });
});
