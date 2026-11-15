// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  availableLetters,
  isAvailable,
  letterForSlot,
  loadLetters,
  markRead,
  type Letter,
  type LetterSlot,
  type LetterState,
} from "../src/letters";
import { ALL_KEYS, LETTERS_KEY, memoryAdapter, resetProgress, setAdapter, type StorageAdapter } from "../src/save";
import { loadDoorSave, setFlag } from "../src/door/save";

// Dummy fixtures, not real content.
const mk = (id: string, requires?: Letter["requires"]): Letter => ({
  id, sender: "S", recipient: "bea", thread: "t", envelope: `env ${id}`, body: [`body ${id}`], requires,
});
const A = mk("A");
const B = mk("B", { kind: "read", letter: "A" });
const C = mk("C", { kind: "any", of: [{ kind: "flag", key: "x.reply", value: "read" }, { kind: "flag", key: "x.reply", value: "later" }] });
const D = mk("D", { kind: "all", of: [{ kind: "read", letter: "B" }, { kind: "any", of: [{ kind: "read", letter: "C" }, { kind: "flag", key: "y", value: "1" }] }] });
const ALL = [A, B, C, D];
const st = (read: string[], flags: Record<string, string> = {}): LetterState => ({ read, flags });

describe("unlock rules", () => {
  it("no requirement is available; a read requirement waits for the letter", () => {
    expect(isAvailable(A, st([]))).toBe(true);
    expect(isAvailable(B, st([]))).toBe(false);
    expect(isAvailable(B, st(["A"]))).toBe(true);
    expect(isAvailable(B, { read: new Set(["A"]), flags: {} })).toBe(true);
  });

  it("any-of accepts either version of a reply, and nothing else", () => {
    expect(isAvailable(C, st([]))).toBe(false);
    expect(isAvailable(C, st([], { "x.reply": "read" }))).toBe(true);
    expect(isAvailable(C, st([], { "x.reply": "later" }))).toBe(true);
    expect(isAvailable(C, st([], { "x.reply": "other" }))).toBe(false);
    expect(isAvailable(C, st([], { toString: "read" }))).toBe(false);
  });

  it("all-of composes with any-of", () => {
    expect(isAvailable(D, st(["B"]))).toBe(false);
    expect(isAvailable(D, st(["C"]))).toBe(false);
    expect(isAvailable(D, st(["B", "C"]))).toBe(true);
    expect(isAvailable(D, st(["B"], { y: "1" }))).toBe(true);
    expect(isAvailable(D, st(["B"], { y: "2" }))).toBe(false);
  });

  it("availableLetters skips letters already read, keeping order", () => {
    expect(availableLetters(ALL, st([])).map((l) => l.id)).toEqual(["A"]);
    expect(availableLetters(ALL, st(["A"], { "x.reply": "later" })).map((l) => l.id)).toEqual(["B", "C"]);
  });
});

describe("slot swap", () => {
  const slot: LetterSlot = { letter: "C1read", flag: "clem.note", by: { read: "C1read", later: "C1later" } };
  it("picks the letter named by the reply flag", () => {
    expect(letterForSlot(slot, { "clem.note": "later" })).toBe("C1later");
    expect(letterForSlot(slot, { "clem.note": "read" })).toBe("C1read");
  });
  it("falls back to the default for no or unknown reply", () => {
    expect(letterForSlot(slot, {})).toBe("C1read");
    expect(letterForSlot(slot, { "clem.note": "zzz" })).toBe("C1read");
    expect(letterForSlot(slot, { "clem.note": "toString" })).toBe("C1read");
    expect(letterForSlot({ letter: "Z" }, { a: "b" })).toBe("Z");
  });
});

const blocked: StorageAdapter = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

describe("letters save", () => {
  let a: ReturnType<typeof memoryAdapter>;
  beforeEach(() => { a = memoryAdapter(); setAdapter(a); });

  it("round trips read ids through the save module, once each", () => {
    const s = loadLetters();
    expect(s.read).toEqual([]);
    markRead(s, "A");
    markRead(s, "B");
    markRead(s, "A");
    expect(JSON.parse(a.getItem(LETTERS_KEY)!)).toEqual({ read: ["A", "B"] });
    expect(loadLetters().read).toEqual(["A", "B"]);
  });

  it("feeds unlock rules with door flags", () => {
    setFlag(loadDoorSave(), "x.reply", "later");
    markRead(loadLetters(), "A");
    const state = { read: loadLetters().read, flags: loadDoorSave().flags };
    expect(availableLetters(ALL, state).map((l) => l.id)).toEqual(["B", "C"]);
  });

  it("ignores garbage", () => {
    for (const raw of ["nope", "[]", '{"read":"A"}', "null"]) {
      a.setItem(LETTERS_KEY, raw);
      expect(loadLetters().read).toEqual([]);
    }
    a.setItem(LETTERS_KEY, '{"read":["A",3,"A","B"]}');
    expect(loadLetters().read).toEqual(["A", "B"]);
  });

  it("never throws when storage is blocked", () => {
    setAdapter(blocked);
    const s = loadLetters();
    expect(s.read).toEqual([]);
    expect(() => markRead(s, "A")).not.toThrow();
    expect(s.read).toEqual(["A"]);
  });

  it("takes a store passed in by a test", () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    markRead(loadLetters(store), "A", store);
    expect(loadLetters(store).read).toEqual(["A"]);
    expect(a.getItem(LETTERS_KEY)).toBeNull();
  });

  it("resetProgress clears the key", () => {
    expect(ALL_KEYS).toContain(LETTERS_KEY);
    markRead(loadLetters(), "A");
    expect(a.getItem(LETTERS_KEY)).not.toBeNull();
    expect(resetProgress()).toBe(true);
    expect(a.getItem(LETTERS_KEY)).toBeNull();
    expect(a.data.size).toBe(0);
    expect(loadLetters().read).toEqual([]);
  });
});
