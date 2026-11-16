/** Swap slots with several versions (4b): `cases` resolve first, then `by`, then `letter`. Counts and ids only. */
import { describe, expect, it } from "vitest";
import standInJson from "../src/content/stand-in-pack.json";
import type { ContentPack } from "../src/content/types";
import { letterForParcel, letterForSlot, type LetterSlot, type Requirement } from "../src/letters";
import { assertUniquePlacements } from "../src/letters/registry";

const pack = standInJson as unknown as ContentPack;
const ids = new Set(pack.letters.map((l) => l.id));
const replies = new Map(pack.scenes.map((s) => [s.flag, new Set(s.choices.map((c) => c.id))] as const));
const versions = (s: LetterSlot) => [s.letter, ...Object.values(s.by ?? {}), ...(s.cases ?? []).map((c) => c.letter)];
const leaves = (r: Requirement): Requirement[] => (r.kind === "all" || r.kind === "any" ? r.of.flatMap(leaves) : [r]);
const caseSlots = pack.slots.filter((s) => s.cases?.length);

describe("stand-in pack: slots with cases", () => {
  it("has slots that use cases", () => {
    expect(caseSlots.length).toBeGreaterThan(0);
  });

  it("every version of a slot is a real letter, and all of them share the slot's placement", () => {
    const bad = pack.slots.filter((s) => {
      const placed = versions(s).map((id) => pack.letters.find((l) => l.id === id)?.placement);
      return placed.some((p) => !p || p.route !== placed[0]!.route || p.slot !== placed[0]!.slot);
    });
    expect(bad.map((s) => s.letter)).toEqual([]);
    expect(() => assertUniquePlacements(pack.letters, pack.slots)).not.toThrow();
  });

  it("every cases condition points at a real letter, door flag and reply value", () => {
    const bad = caseSlots.filter((s) =>
      s.cases!.some((c) =>
        leaves(c.if).some((r) => (r.kind === "read" ? !ids.has(r.letter) : r.kind === "flag" ? !replies.get(r.key)?.has(r.value) : false)),
      ),
    );
    expect(bad.map((s) => s.letter)).toEqual([]);
  });
});

describe("letterForSlot order", () => {
  const flag = (key: string, value: string): Requirement => ({ kind: "flag", key, value });
  const slot: LetterSlot = {
    letter: "dflt",
    flag: "f",
    by: { a: "byA", b: "byB" },
    cases: [
      { if: flag("g", "x"), letter: "caseX" },
      { if: { kind: "read", letter: "r1" }, letter: "caseR" },
    ],
  };

  it("the first matching case wins, before `by`", () => {
    expect(letterForSlot(slot, { f: "a", g: "x" })).toBe("caseX");
    expect(letterForSlot(slot, { f: "a", g: "x" }, ["r1"])).toBe("caseX");
    expect(letterForSlot(slot, { f: "a" }, ["r1"])).toBe("caseR");
    expect(letterForSlot(slot, { f: "a" }, new Set(["r1"]))).toBe("caseR");
  });

  it("with no case matching it falls back to `by`, then `letter`", () => {
    expect(letterForSlot(slot, { f: "b", g: "y" })).toBe("byB");
    expect(letterForSlot(slot, { f: "zzz" })).toBe("dflt");
    expect(letterForSlot(slot, {})).toBe("dflt");
    expect(letterForSlot({ letter: "dflt", cases: [] }, { f: "a" })).toBe("dflt");
  });

  it("a slot without cases resolves as before", () => {
    expect(letterForSlot({ letter: "dflt", flag: "f", by: { a: "byA" } }, { f: "a" })).toBe("byA");
  });

  it("the parcel lookup uses cases, the door flags and letters read", () => {
    const mk = (id: string) => ({ id, sender: "s", recipient: "bea" as const, thread: "t", envelope: "e", body: ["b"], placement: { route: "r", slot: 0 } });
    const list = ["dflt", "byA", "caseX", "caseR"].map(mk);
    const pick = (flags: Record<string, string>, read: string[]) => letterForParcel("r", 0, flags, list, [slot], read)?.id;
    expect(pick({}, [])).toBe("dflt");
    expect(pick({ f: "a" }, [])).toBe("byA");
    expect(pick({ f: "a", g: "x" }, [])).toBe("caseX");
    expect(pick({}, ["r1"])).toBe("caseR");
    expect(() => assertUniquePlacements(list, [slot])).not.toThrow();
    expect(() => assertUniquePlacements(list, [{ letter: "dflt", by: { a: "byA" } }])).toThrow();
  });
});
