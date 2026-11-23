import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ROUTES, SPRING } from "../src/levels";
import { SPRING_SCENES } from "../src/door/scenes";
import { GENERIC_MOTIF, SPRING_MOTIFS, motifArt, stampSvg } from "../src/door/stamp";
import { LATER_MOTIFS } from "../src/door/stampMotifs";
import type { SpringMotif, Stamp } from "../src/door/story";

const stamp = (motif: string): Stamp => ({ name: "x", value: 3, motif: motif as Stamp["motif"], sky: "#d7eaf2" });
const later = ROUTES.filter((r) => !SPRING.includes(r));

describe("stamp motifs", () => {
  it("every route has a renderable motif: spring by name, later by route id", () => {
    expect(later).toHaveLength(30);
    for (const r of later) expect(LATER_MOTIFS[r.id], r.id).toBeTruthy();
    for (const sc of SPRING_SCENES) expect(SPRING_MOTIFS[sc.stamp.motif as SpringMotif], sc.route).toBeTruthy();
    expect(Object.keys(LATER_MOTIFS).sort()).toEqual(later.map((r) => r.id).sort());
  });
  it("later motifs are distinct within a village and never the generic stamp", () => {
    for (const season of ["summer", "autumn", "winter"]) {
      const art = Object.entries(LATER_MOTIFS).filter(([k]) => k.startsWith(season + "-")).map(([, v]) => v);
      expect(new Set(art).size).toBe(10);
      expect(art).not.toContain(GENERIC_MOTIF);
    }
  });
  it("an unknown motif with a later route id renders that route's motif", () => {
    expect(motifArt("nonsense", "autumn-4")).toBe(LATER_MOTIFS["autumn-4"]);
    expect(stampSvg(stamp("nonsense"), undefined, "winter-7")).toContain(LATER_MOTIFS["winter-7"]);
  });
  it("an unknown motif and an unknown route render the generic stamp", () => {
    expect(motifArt("nonsense", "spring-1")).toBe(GENERIC_MOTIF);
    expect(motifArt("nonsense")).toBe(GENERIC_MOTIF);
    expect(motifArt("toString", "constructor")).toBe(GENERIC_MOTIF);
    expect(stampSvg(stamp("nonsense"), undefined, "nope")).toContain(GENERIC_MOTIF);
  });
  it("no output contains undefined", () => {
    for (const k of [...Object.keys(SPRING_MOTIFS), ...Object.keys(LATER_MOTIFS), "nonsense"]) {
      expect(stampSvg(stamp(k), undefined, "bogus")).not.toMatch(/undefined|NaN/);
    }
  });
  it("spring stamps are unchanged by a route id and use their own motif", () => {
    for (const sc of SPRING_SCENES) {
      const plain = stampSvg(sc.stamp);
      expect(stampSvg(sc.stamp, undefined, sc.route)).toBe(plain);
      expect(plain).toContain(SPRING_MOTIFS[sc.stamp.motif as SpringMotif]);
    }
  });
  it("spring stamp markup is byte-identical to before the later motifs landed", () => {
    const all = SPRING_SCENES.map((sc) => stampSvg(sc.stamp)).join("\n");
    expect(createHash("sha256").update(all).digest("hex")).toBe("410b4461f6bed1ef872669cc3395c886931527bfc918ffd5d17f0a19d61112be");
  });
});
