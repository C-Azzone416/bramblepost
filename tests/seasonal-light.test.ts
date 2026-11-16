/**
 * Seasonal light (#65): the token table in styles.css keeps spring exactly as it was, every village has a season,
 * and text and icons stay readable. The pairs below are the real foreground/background combinations drawn on
 * season-dependent surfaces (draw order in src/village/map.ts: meadow, tint overlay, fog and name plates, then the
 * sun and vignette overlays over all of it, then the route nodes on top).
 *
 * Rules: (1) every pair meets WCAG AA in every season, except those listed in KNOWN_BELOW_AA (already below AA in
 * spring before this change; the fix is #95); (2) on the KNOWN_BELOW_AA pairs no season is worse than spring.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NEIGHBOURHOODS, SEASONS, type Season } from "../src/village/data";

const css = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

function tokens(season: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-season="${season}"\\]\\{([^}]*)\\}`))?.[1];
  expect(block, `${season} token block`).toBeTruthy();
  return Object.fromEntries([...block!.matchAll(/--([\w-]+):([^;]+)/g)].map((m) => [m[1], m[2]]));
}
const root = (name: string) => css.match(new RegExp(`--${name}:(#[0-9a-f]{6})`))![1];

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const lum = (c: RGB) => {
  const v = c.map((u) => u / 255).map((u) => (u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (base: RGB, top: RGB, a: number): RGB => base.map((v, i) => v * (1 - a) + top[i] * a) as RGB;

/** The map's sun gradient (cx 200, cy 80, r 900; stops at 0, .5, 1): colour and alpha at a point. */
function sunAt(t: Record<string, string>, x: number, y: number, maxAlpha = false): [RGB, number] {
  const core = rgb(t["sun-core"]), edge = rgb(t["sun-edge"]), a0 = Number(t["sun-a"]);
  if (maxAlpha) return [core, a0];
  const d = Math.hypot(x - 200, y - 80) / 900;
  if (d < 0.5) {
    const k = d / 0.5;
    return [over(core, edge, k), a0 + (0.16 - a0) * k];
  }
  return [edge, 0.16 * Math.max(0, 1 - (d - 0.5) / 0.5)];
}

interface Pair {
  id: string;
  kind: "text" | "icon";
  /** Worst case over these backgrounds, given the season's tokens. */
  ratio: (t: Record<string, string>) => number;
}

const PLATE = rgb("#2a2b1f"), FOG = rgb("#fbf6ea"), MEADOW_LIGHT = rgb("#b9d98a");

/** A locked village's name plate (opacity .88) on fog or the lightest meadow, under the sun overlay at the plate's position or at max alpha. */
function platePairs(): Pair[] {
  const out: Pair[] = [];
  for (const n of NEIGHBOURHOODS.slice(1)) {
    for (const [part, fg] of [["name", "#fffaf0"], ["note", root("honey")]] as const) {
      for (const worst of [false, true]) {
        out.push({
          id: `plate ${part} · ${n.id}${worst ? " · max sun" : ""}`,
          kind: "text",
          ratio: (t) => {
            const [sc, sa] = sunAt(t, n.at.x, n.at.y + 42, worst);
            const meadow = over(MEADOW_LIGHT, rgb(t.tint), Number(t["tint-a"]));
            return Math.min(
              ...[FOG, meadow].map((back) => contrast(over(rgb(fg), sc, sa), over(over(back, PLATE, 0.88), sc, sa))),
            );
          },
        });
      }
    }
  }
  return out;
}

/** Route nodes are drawn above the sun, on opaque fills, so only their own colours matter (and not the season's). */
const staticPair = (id: string, kind: "text" | "icon", fg: string, bgs: string[]): Pair => ({
  id,
  kind,
  ratio: () => Math.min(...bgs.map((b) => contrast(rgb(fg), rgb(b)))),
});

/** Text and the focus ring on the board stage, and under the finish overlay (rgba(223,232,210,.55)). */
function stagePairs(): Pair[] {
  const out: Pair[] = [];
  for (const [name, fg, kind] of [["ink", root("ink"), "text"], ["ink-soft", root("ink-soft"), "text"], ["focus ring", root("navy"), "icon"]] as const) {
    out.push({
      id: `stage ${name}`,
      kind,
      ratio: (t) => Math.min(...["sky-hi", "sky-lo"].map((k) => contrast(rgb(fg), rgb(t[k])))),
    });
    out.push({
      id: `finish overlay ${name}`,
      kind,
      ratio: (t) => Math.min(...["sky-hi", "sky-lo"].map((k) => contrast(rgb(fg), over(rgb(t[k]), rgb("#dfe8d2"), 0.55)))),
    });
  }
  return out;
}

export const PAIRS: Pair[] = [
  ...platePairs(),
  staticPair("node number on postal red", "text", "#fffaf0", ["#c4452e"]),
  staticPair("node check on stamp gold", "icon", "#fffaf0", ["#ffe6a3", "#d58f26"]),
  staticPair("node lock on grey", "icon", "#fffaf0", ["#b8b29a"]),
  ...stagePairs(),
];

/** Already below AA in spring before #65. Fixed in #95, then delete the entries here. */
const KNOWN_BELOW_AA = new Set<string>([
  "plate name · hollowmere", "plate name · hollowmere · max sun",
  "plate name · conker", "plate name · conker · max sun",
  "plate name · snowberry · max sun",
  "plate note · hollowmere", "plate note · hollowmere · max sun",
  "plate note · conker", "plate note · conker · max sun",
  "plate note · snowberry", "plate note · snowberry · max sun",
  "node check on stamp gold",
  "node lock on grey",
]);

const need = (p: Pair) => (p.kind === "text" ? 4.5 : 3);
const spring = tokens("spring");
const EPS = 0.005;

describe("seasonal light tokens", () => {
  it("spring is exactly the original look", () => {
    expect(spring).toEqual({
      "sky-hi": "#eef3e3", "sky-lo": "#dfe8d2", tint: "#dfe8d2", "tint-a": "0",
      shadow: "#2b2410", "shadow-a": ".3", "sun-core": "#fff1c2", "sun-edge": "#ffd98a", "sun-a": ".7",
    });
    expect(css).toContain("var(--sky-hi) 0%,var(--sky-lo) 60%"); // the stage gradient is the old #eef3e3 → #dfe8d2
  });

  it("every season defines the same tokens, and every village has a known season", () => {
    for (const s of SEASONS) expect(Object.keys(tokens(s)).sort()).toEqual(Object.keys(spring).sort());
    for (const h of NEIGHBOURHOODS) expect(SEASONS).toContain(h.season);
    expect(NEIGHBOURHOODS.find((h) => h.id === "hollowmere")!.season).toBe("summer");
  });
});

describe("contrast on season-dependent surfaces", () => {
  it("the known-below-AA list matches spring today (remove entries once #95 fixes them)", () => {
    const below = PAIRS.filter((p) => p.ratio(spring) < need(p)).map((p) => p.id);
    expect(new Set(below)).toEqual(KNOWN_BELOW_AA);
  });

  it.each(SEASONS)("%s: every pair outside the known list meets AA, and known-below-AA pairs are no worse than spring", (s: Season) => {
    const t = tokens(s);
    for (const p of PAIRS) {
      const r = p.ratio(t);
      if (!KNOWN_BELOW_AA.has(p.id)) expect(r, `${p.id} (${s})`).toBeGreaterThanOrEqual(need(p));
      // Where spring is already below AA, a season must not make it worse. (Pairs that clear AA only need to keep clearing it.)
      if (KNOWN_BELOW_AA.has(p.id)) expect(r + EPS, `${p.id} (${s}) vs spring`).toBeGreaterThanOrEqual(p.ratio(spring));
    }
  });

  it("prints the minimum ratio per season (season-dependent pairs only; node pairs never change)", () => {
    const dep = PAIRS.filter((p) => !p.id.startsWith("node"));
    for (const s of SEASONS) {
      const t = tokens(s);
      const min = (ps: Pair[]) => Math.min(...ps.map((p) => p.ratio(t))).toFixed(2);
      console.log(`${s}: min ${min(dep)} over all season-dependent pairs, ${min(dep.filter((p) => !KNOWN_BELOW_AA.has(p.id)))} excluding known-below-AA (#95) pairs, ${min(dep.filter((p) => KNOWN_BELOW_AA.has(p.id)))} on the known pairs`);
    }
  });
});
