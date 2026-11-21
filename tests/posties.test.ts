// @vitest-environment jsdom
/** #142: each later village has a resident postie (look + neutral label); spring has none; residents never host door scenes. */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_SCENES } from "../src/content/active";
import { PORTRAIT_SYMBOLS } from "../src/door/view";
import { FIGURE_SYMBOL } from "../src/ui/neighbours";
import { NEIGHBOURS } from "../src/ui/cast";
import { NEIGHBOURHOODS } from "../src/village/data";
import { playIntro, VILLAGE_INTROS } from "../src/village/intro";
import { showLetter } from "../src/letters/view";
import { POSTIES, postieOf } from "../src/village/posties";

const SHEET = readFileSync("src/ui/sprites.svg", "utf8");
const LABELS: Record<string, string> = { hollowmere: "Hollowmere's postie", conker: "Conker Corner's postie", snowberry: "Snowberry End's postie" };

describe("registry", () => {
  it("covers exactly the later villages, never Thistledown", () => {
    expect(Object.keys(POSTIES).sort()).toEqual(NEIGHBOURHOODS.filter((n) => n.season !== "spring").map((n) => n.id).sort());
    expect(postieOf("thistledown")).toBeUndefined();
  });
  it("sprite ids exist in sprites.svg at the right frame sizes", () => {
    for (const [id, p] of Object.entries(POSTIES)) {
      expect(SHEET, `${id} map sprite`).toContain(`<symbol id="${p.sprite}" viewBox="0 0 30 46">`);
      expect(SHEET, `${id} portrait`).toContain(`<symbol id="${p.portrait}" viewBox="0 0 420 520">`);
    }
  });
  it("labels are the neutral ones", () => {
    for (const [id, p] of Object.entries(POSTIES)) expect(p.label).toBe(LABELS[id]);
  });
  it("residents never host door scenes", () => {
    const art = new Set(Object.values(POSTIES).flatMap((p) => [p.sprite, p.portrait]));
    const hosts = new Set([...Object.values(PORTRAIT_SYMBOLS), ...Object.values(FIGURE_SYMBOL)]);
    for (const a of art) expect(hosts.has(a), a).toBe(false);
    expect(Object.keys(NEIGHBOURS).filter((k) => /postie/i.test(k))).toEqual([]);
    for (const s of Object.values(ACTIVE_SCENES).flat()) expect(art.has(PORTRAIT_SYMBOLS[s.host] ?? "")).toBe(false);
  });
});

describe("welcome intro", () => {
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = () => {};
    document.body.innerHTML = "";
  });
  it("shows the right portrait with the neutral label per later village", async () => {
    for (const id of Object.keys(POSTIES)) {
      const done = playIntro(id, { typeMs: 0, intros: VILLAGE_INTROS });
      const svg = document.querySelector("#letterView svg.letter-portrait")!;
      expect(svg.getAttribute("data-portrait"), id).toBe(POSTIES[id].portrait);
      expect(svg.getAttribute("aria-label")).toBe(LABELS[id]);
      expect(svg.getAttribute("role")).toBe("img");
      (document.querySelector('[data-letter="skip"]') as HTMLElement).click();
      (document.querySelector('[data-letter="next"]') as HTMLElement).click();
      await done;
    }
  });
  it("shows none for spring", async () => {
    const done = playIntro("thistledown", { typeMs: 0, intros: VILLAGE_INTROS });
    expect(document.querySelector("#letterView")).not.toBeNull();
    expect(document.querySelector("#letterView .letter-portrait")).toBeNull();
    (document.querySelector('[data-letter="skip"]') as HTMLElement).click();
    (document.querySelector('[data-letter="next"]') as HTMLElement).click();
    await done;
  });
});

describe("letter portrait is idempotent", () => {
  const letter = (id: string) => ({ id, sender: "x", recipient: "bea" as const, thread: "t", envelope: "", body: ["a"] });
  const count = () => document.querySelectorAll(".letter-portrait").length;
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });
  it("a letter without a portrait leaves none after one with", () => {
    const a = showLetter({ letter: letter("a"), portrait: { symbol: "postieDuck", label: "l" }, onDone() {}, store: null, typeMs: 0 });
    expect(count()).toBe(1);
    a.cancel();
    const b = showLetter({ letter: letter("b"), onDone() {}, store: null, typeMs: 0 });
    expect(count()).toBe(0);
    b.cancel();
  });
  it("two with portraits, one after the other, leave exactly one", () => {
    const a = showLetter({ letter: letter("a"), portrait: { symbol: "postieDuck", label: "l" }, onDone() {}, store: null, typeMs: 0 });
    a.cancel();
    const b = showLetter({ letter: letter("b"), portrait: { symbol: "postieRobin", label: "l" }, onDone() {}, store: null, typeMs: 0 });
    expect(count()).toBe(1);
    expect(document.querySelector(".letter-portrait")!.getAttribute("data-portrait")).toBe("postieRobin");
    b.cancel();
  });
});
