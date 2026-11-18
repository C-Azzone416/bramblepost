import { describe, expect, it } from "vitest";
import { loadDoorSave, setFlag } from "../src/door/save";
import { resolveLines as doorLines } from "../src/door/story";
import { resolveText } from "../src/door/ending";
import { isMet, letterForSlot } from "../src/letters/rules";
import { STANDARD_PACK } from "../src/content/standard";

describe("year-wide door flags", () => {
  it("carries earlier replies into later letters, slots, scenes and endings", () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    setFlag(loadDoorSave(store), "spring.reply", "yes", store);
    setFlag(loadDoorSave(store), "summer.reply", "no", store);
    const flags = loadDoorSave(store).flags;
    expect(flags).toEqual({ "spring.reply": "yes", "summer.reply": "no" });
    const req = { kind: "flag" as const, key: "spring.reply", value: "yes" };
    expect(isMet(req, { read: [], flags })).toBe(true);
    expect(letterForSlot({ letter: "default", flag: "spring.reply", by: { yes: "branch" } }, flags)).toBe("branch");
    expect(letterForSlot({ letter: "default", cases: [{ if: req, letter: "branch" }] }, flags)).toBe("branch");
    const scene = { ...STANDARD_PACK.scenes[0], lines: [[{ if: { flag: "spring.reply", is: "yes" }, say: "branch" }, { say: "default" }]] };
    expect(doorLines(scene, { coldPie: false, flags })).toEqual(["branch"]);
    expect(resolveText([{ when: req, say: "branch" }, { say: "default" }], { read: [], flags })).toBe("branch");
  });
});
