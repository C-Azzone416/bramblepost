/** Door scene data and the reply/stamp save, with no DOM. */
import { describe, expect, it } from "vitest";
import { SPRING as ROUTES } from "../src/levels";
import { SPRING_SCENES } from "../src/door/scenes";
import { DOOR_KEY, loadDoorSave, setFlag, setVoices, type Store } from "../src/door/save";
import { resolveLines, sceneFor, type DoorScene } from "../src/door/story";

function fakeStore(init?: string): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (init !== undefined) data.set(DOOR_KEY, init);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const allText = (s: DoorScene) => [
  ...s.lines.flatMap((l) => (typeof l === "string" ? [l] : l.map((v) => v.say))),
  ...s.choices.flatMap((c) => [c.label, c.reply]),
];

describe("spring scenes", () => {
  it("every route has exactly one scene, and every scene has a route", () => {
    for (const L of ROUTES) expect(SPRING_SCENES.filter((s) => s.route === L.id), L.id).toHaveLength(1);
    for (const s of SPRING_SCENES) expect(ROUTES.some((L) => L.id === s.route), s.route).toBe(true);
  });

  it("the host lives on that route", () => {
    for (const s of SPRING_SCENES) {
      const L = ROUTES.find((r) => r.id === s.route)!;
      expect(Object.values(L.houses), s.route).toContain(s.host);
    }
  });

  it("two replies with different ids, and a flag of their own", () => {
    for (const s of SPRING_SCENES) {
      expect(s.choices).toHaveLength(2);
      expect(s.choices[0].id).not.toBe(s.choices[1].id);
    }
    const flags = SPRING_SCENES.map((s) => s.flag);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it("lines are short enough for a phone, and nothing is empty", () => {
    for (const s of SPRING_SCENES) {
      expect(s.lines.length).toBeGreaterThan(0);
      for (const t of allText(s)) {
        expect(t.trim().length, t).toBeGreaterThan(0);
        expect(t.length, t).toBeLessThanOrEqual(140);
      }
      for (const c of s.choices) expect(c.label.length, c.label).toBeLessThanOrEqual(32);
    }
  });

  it("every set of variants ends with a default", () => {
    for (const s of SPRING_SCENES)
      for (const l of s.lines) if (typeof l !== "string") expect(l[l.length - 1].if, s.route).toBeUndefined();
  });

  it("variants only read flags that some scene sets, with values it can set", () => {
    const known = new Map(SPRING_SCENES.map((s) => [s.flag, s.choices.map((c) => c.id)]));
    for (const s of SPRING_SCENES)
      for (const l of s.lines)
        if (typeof l !== "string")
          for (const v of l)
            if (v.if?.flag) {
              expect(known.has(v.if.flag), v.if.flag).toBe(true);
              if (v.if.is !== "unset") expect(known.get(v.if.flag), v.if.flag).toContain(v.if.is);
            }
  });

  it("each stamp is different", () => {
    const names = SPRING_SCENES.map((s) => s.stamp.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(SPRING_SCENES.map((s) => s.stamp.motif)).size).toBe(names.length);
  });

  it("Pip is he", () => {
    for (const s of SPRING_SCENES) for (const t of allText(s)) expect(t, t).not.toMatch(/Pip,? (she|they)\b/i);
  });
});

describe("picking lines", () => {
  const millpond = sceneFor(SPRING_SCENES, "millpond")!;
  const hollow = sceneFor(SPRING_SCENES, "hollow")!;

  it("a cold pie changes Barnaby's first line", () => {
    expect(resolveLines(millpond, { coldPie: false, flags: {} })[0]).toMatch(/Still warm/);
    expect(resolveLines(millpond, { coldPie: true, flags: {} })[0]).toMatch(/cold/);
  });

  it("Sunday tea remembers earlier replies", () => {
    const none = resolveLines(hollow, { coldPie: false, flags: {} });
    expect(none[1]).toMatch(/very shy/);
    expect(none[2]).toMatch(/Nobody will tell me/);
    const told = resolveLines(hollow, { coldPie: false, flags: { "clementine.sisterNote": "read", "barnaby.pieBaker": "told" } });
    expect(told[1]).toMatch(/wrote back/);
    expect(told[2]).toMatch(/good waistcoat/);
    const later = resolveLines(hollow, { coldPie: true, flags: { "clementine.sisterNote": "later", "barnaby.pieBaker": "secret" } });
    expect(later[0]).toMatch(/custard/);
    expect(later[1]).toMatch(/out of principle/);
    expect(later[2]).toMatch(/leaving pies/);
  });

  it("the same number of lines whatever happened", () => {
    for (const s of SPRING_SCENES) {
      const a = resolveLines(s, { coldPie: false, flags: {} });
      const b = resolveLines(s, { coldPie: true, flags: { "clementine.sisterNote": "read" } });
      expect(a).toHaveLength(s.lines.length);
      expect(b).toHaveLength(s.lines.length);
    }
  });
});

describe("door save", () => {
  it("starts empty with voices on", () => {
    expect(loadDoorSave(fakeStore())).toEqual({ flags: {}, voices: true });
    expect(loadDoorSave(null)).toEqual({ flags: {}, voices: true });
  });

  it("keeps replies and the voice setting under its own key", () => {
    const st = fakeStore();
    const s = loadDoorSave(st);
    setFlag(s, "clementine.sisterNote", "read", st);
    setVoices(s, false, st);
    expect([...st.data.keys()]).toEqual([DOOR_KEY]);
    expect(loadDoorSave(st)).toEqual({ flags: { "clementine.sisterNote": "read" }, voices: false });
  });

  it("ignores stamps kept by an older build (the village map owns stamps now)", () => {
    const old = fakeStore('{"flags":{"bea.pudding":"letter"},"stamps":{"primrose":true},"voices":true}');
    expect(loadDoorSave(old)).toEqual({ flags: { "bea.pudding": "letter" }, voices: true });
  });

  it("a later reply replaces the earlier one", () => {
    const st = fakeStore();
    const s = loadDoorSave(st);
    setFlag(s, "bea.pudding", "gentleman", st);
    setFlag(s, "bea.pudding", "letter", st);
    expect(loadDoorSave(st).flags["bea.pudding"]).toBe("letter");
  });

  it("shrugs off damaged saves", () => {
    for (const bad of ["not json", "[]", "null", '{"flags":[1],"stamps":"x"}', '{"flags":{"a":3,"b":"ok"}}'])
      expect(() => loadDoorSave(fakeStore(bad))).not.toThrow();
    expect(loadDoorSave(fakeStore('{"flags":{"a":3,"b":"ok"}}')).flags).toEqual({ b: "ok" });
    const throwing: Store = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const s = loadDoorSave(throwing);
    expect(() => setFlag(s, "x", "y", throwing)).not.toThrow();
  });
});
