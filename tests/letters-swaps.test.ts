// @vitest-environment jsdom
/** Door-reply swaps (#9): three slots hold a different letter by reply, in the same parcel slot. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { SPRING_SCENES } from "../src/door/scenes";
import { doorAfterRoute } from "../src/door/view";
import { DOOR_KEY, LETTERS_KEY } from "../src/save/keys";
import { ROUTES } from "../src/levels";
import { SPRING_LETTERS, SPRING_SLOTS, letterForParcel, letterForSlot, unreadForRoute, type Requirement } from "../src/letters";
import { isMet } from "../src/letters/rules";
import { withLetters } from "../src/letters/view";
import { mountApp } from "../src/ui/mount";
import type { GameApi } from "../src/ui/game";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const byId = (id: string) => SPRING_LETTERS.find((l) => l.id === id)!;
const routeIndex = (id: string) => ROUTES.findIndex((r) => r.id === id);

// [slot default, flag, [reply, letter id] for each branch, the letters that must already be read]
const CASES = [
  { slot: "supper-1", flag: "barnaby.pieBaker", branches: { secret: "supper-1", told: "supper-1b" }, before: [] as string[] },
  { slot: "fair-2", flag: "bea.pudding", branches: { gentleman: "fair-2", letter: "fair-2b" }, before: ["fair-1"] },
  { slot: "supper-5", flag: "clementine.sundayNews", branches: { keep: "supper-5", tell: "supper-5b" }, before: ["tunnel-1", "tunnel-2", "tunnel-3", "tunnel-4", "supper-1", "supper-2", "supper-3", "supper-4", "carrots-1", "carrots-2"] },
];

describe("swap data", () => {
  it("each swap slot's versions share one placement, house and thread, so par and parcels cannot change", () => {
    expect(SPRING_SLOTS.map((s) => s.letter)).toEqual(CASES.map((c) => c.slot));
    for (const c of CASES) {
      const slot = SPRING_SLOTS.find((s) => s.letter === c.slot)!;
      expect(slot.flag).toBe(c.flag);
      expect(slot.by).toEqual(c.branches);
      const [a, b] = Object.values(c.branches).map(byId);
      expect(b.placement, c.slot).toEqual(a.placement);
      expect(b.recipient).toBe(a.recipient);
      expect(b.thread).toBe(a.thread);
      expect(b.id).not.toBe(a.id);
      expect(b.body).not.toEqual(a.body);
    }
  });

  it("an inherited or unknown reply falls back to the default letter", () => {
    for (const c of CASES) {
      const slot = SPRING_SLOTS.find((s) => s.letter === c.slot)!;
      const def = letterForParcel(byId(c.slot).placement!.route, byId(c.slot).placement!.slot, {})!;
      expect(def.id).toBe(c.slot);
      for (const v of ["toString", "constructor", "__proto__", "hasOwnProperty", "zzz"]) {
        expect(letterForSlot(slot, { [c.flag]: v })).toBe(c.slot);
      }
      expect(letterForSlot({ letter: "d", flag: "toString", by: { x: "y" } }, {})).toBe("d");
      const pl = byId(c.slot).placement!;
      expect(letterForParcel(pl.route, pl.slot, { [c.flag]: "toString" })!.id).toBe(c.slot);
    }
  });

  it("every requirement names a real letter", () => {
    const ids = new Set(SPRING_LETTERS.map((l) => l.id));
    const names = (r: Requirement | undefined): string[] => (!r ? [] : r.kind === "read" ? [r.letter] : r.kind === "flag" ? [] : r.of.flatMap(names));
    for (const l of SPRING_LETTERS) for (const n of names(l.requires)) expect(ids, `${l.id} -> ${n}`).toContain(n);
  });
});

describe("every combination of the three replies", () => {
  const options = CASES.map((c) => [undefined, ...Object.keys(c.branches)]);
  const combos: Record<string, string>[] = [];
  for (const a of options[0]) for (const b of options[1]) for (const c of options[2]) {
    const f: Record<string, string> = {};
    [a, b, c].forEach((v, i) => v && (f[CASES[i].flag] = v));
    combos.push(f);
  }

  it("covers 2^3 answered combinations plus unset ones", () => {
    expect(combos).toHaveLength(27);
  });

  it("each plays through in route order: the chosen versions are all readable, threads never dead-end", () => {
    for (const flags of combos) {
      const read = new Set<string>();
      const chosen = new Set<string>();
      for (const route of ROUTES) {
        const queue = unreadForRoute(route.id, route.parcels.length, { read, flags });
        for (let slot = 0; slot < route.parcels.length; slot++) {
          const l = letterForParcel(route.id, slot, flags);
          if (l) chosen.add(l.id);
        }
        for (const l of queue) read.add(l.id);
      }
      // Each slot carries exactly one version, parcel slots are unchanged, and everything chosen was unlocked in order.
      expect([...read].sort(), JSON.stringify(flags)).toEqual([...chosen].sort());
      const placed = new Set([...chosen].map((id) => `${byId(id).placement!.route}#${byId(id).placement!.slot}`));
      expect(placed.size).toBe(chosen.size);
      expect(chosen.size).toBe(SPRING_LETTERS.length - CASES.length);
      // Nothing after a swap slot waits on a version that was not chosen.
      for (const id of chosen) expect(isMet(byId(id).requires, { read: chosen, flags }), `${id} under ${JSON.stringify(flags)}`).toBe(true);
    }
  });
});

describe("in the game", () => {
  let bp: GameApi;
  const door = () => document.getElementById("doorScene");
  const view = () => document.getElementById("letterView");

  beforeAll(async () => {
    window.scrollTo = () => {};
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    document.head.appendChild(style);
    const root = document.createElement("div");
    document.body.appendChild(root);
    bp = mountApp(root, ROUTES, { afterRoute: withLetters(doorAfterRoute(SPRING_SCENES, { typeMs: 0 }), { typeMs: 0 }) });
    await sleep(50);
  });
  afterEach(() => localStorage.clear());

  const waitIdle = async () => {
    for (let i = 0; i < 200 && bp.G && bp.G.busy; i++) await sleep(50);
  };
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
  const readIds = (): string[] => JSON.parse(localStorage.getItem(LETTERS_KEY) ?? '{"read":[]}').read;

  for (const c of CASES) {
    for (const [reply, id] of Object.entries(c.branches)) {
      it(`${c.slot} with ${c.flag}=${reply}: satchel shows ${id}, it opens and is marked read, par unchanged`, async () => {
        const letter = byId(id);
        const li = routeIndex(letter.placement!.route);
        const route = ROUTES[li];
        localStorage.setItem(DOOR_KEY, JSON.stringify({ flags: { [c.flag]: reply }, voices: false }));
        localStorage.setItem(LETTERS_KEY, JSON.stringify({ read: c.before }));
        const parcels = JSON.stringify(route.parcels);

        bp.openLevel(li);
        const cards = [...document.querySelectorAll("#plist li")];
        const env = cards.filter((x) => x.querySelector(".env"));
        expect(env).toHaveLength(1);
        expect(cards.indexOf(env[0]), "same parcel slot").toBe(bp.G!.order.indexOf(letter.placement!.slot));
        expect(env[0].textContent).toContain(letter.envelope);
        expect(env[0].textContent).toContain(`Letter from ${letter.sender}.`);
        expect(JSON.stringify(route.parcels)).toBe(parcels);

        await playAtPar(li);
        expect(bp.G!.moves).toBe(route.solution.moves.length);
        // Walk the door scene, then read every queued letter.
        for (let k = 0; k < 12 && door(); k++) {
          door()!.querySelector<HTMLButtonElement>(".door-choice:not([hidden])")?.click();
          door()?.querySelector<HTMLButtonElement>('[data-door="next"]')?.click();
        }
        for (let k = 0; k < 20 && view(); k++) {
          (view()!.querySelector('[data-letter="skip"]') as HTMLButtonElement).click();
          (view()!.querySelector('[data-letter="next"]') as HTMLButtonElement).click();
        }
        const other = Object.values(c.branches).find((x) => x !== id)!;
        expect(readIds()).toContain(id);
        expect(readIds()).not.toContain(other);
      }, 30000);
    }
  }
});
