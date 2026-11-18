/**
 * Seasonal light (#65): the token table in styles.css keeps spring exactly as it was, every village has a season,
 * and text and icons stay readable. The pairs below are the real foreground/background combinations drawn on
 * season-dependent surfaces (draw order in src/village/map.ts: meadow, tint overlay, fog and name plates, then the
 * sun and vignette overlays over all of it, then the route nodes on top).
 *
 * That these colours are the ones drawn is checked on the rendered map in tests/map-look.test.ts.
 *
 * Rule: every pair meets WCAG AA (4.5 text, 3 icons and rings) in every season, with no exceptions (#95). Map pairs
 * are checked over the whole painted stack at every sampled position: meadow/scenery/fog base, tint, sun (true alpha
 * at that point, and a max-alpha case), then the vignette; plates, star pills and the selection ring sit on top.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOOK } from "../src/village/look";
import { MAP_H, MAP_W, NEIGHBOURHOODS, SEASONS, type Season } from "../src/village/data";

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
function sunAt(t: Record<string, string>, x: number, y: number, maxAlpha: boolean): [RGB, number] {
  const core = rgb(t["sun-core"]), edge = rgb(t["sun-edge"]), a0 = Number(t["sun-a"]);
  if (maxAlpha) return [core, a0];
  const d = Math.hypot(x - 200, y - 80) / 900;
  if (d < 0.5) {
    const k = d / 0.5;
    return [over(core, edge, k), a0 + (0.16 - a0) * k];
  }
  return [edge, 0.16 * Math.max(0, 1 - (d - 0.5) / 0.5)];
}
/** The vignette (objectBoundingBox radial, r 72%, from .62 to 1; #3d5a24 up to .4 alpha). */
function vigAlpha(x: number, y: number) {
  const d = Math.hypot(x / MAP_W - 0.5, y / MAP_H - 0.5) / 0.72;
  return 0.4 * Math.min(1, Math.max(0, (d - 0.62) / 0.38));
}

/** What can sit under an overlay or indicator: the meadow gradient stops, lane path, hedge, bushes, trees, water, fog, flowers. */
const GROUND: { c: string; tinted: boolean }[] = [
  ...["#b9d98a", "#9cc66e", "#7fae58", "#c6e19a", "#8dbb62"].map((c) => ({ c, tinted: true })), // painted before the tint overlay
  ...["#f1dfb4", "#c9a874"].map((c) => ({ c, tinted: false })), // lane paths: painted after it
  ...["#3f6b2b", "#4f7a35", "#5f8d3e", "#7fb257", "#8fc263", "#b5dc84", "#9fd8e4", "#5fa9c0", "#fbf6ea", "#fff4e0"].map((c) => ({ c, tinted: false })),
];

/** Every ground colour at (x, y) after tint, sun and vignette, as the map paints them. */
function backdrops(t: Record<string, string>, x: number, y: number, maxSun: boolean): RGB[] {
  const [sc, sa] = sunAt(t, x, y, maxSun);
  return GROUND.map(({ c, tinted }) => {
    let b = rgb(c);
    if (tinted) b = over(b, rgb(t.tint), Number(t["tint-a"]));
    b = over(b, sc, sa);
    return over(b, rgb("#3d5a24"), vigAlpha(x, y));
  });
}

interface Pair {
  id: string;
  kind: "text" | "icon";
  /** The worst contrast of this pair for a season's tokens. */
  ratio: (t: Record<string, string>) => number;
}

const worst = (xs: number[]) => Math.min(...xs);
const PLATE = rgb(LOOK.plateFill);
const PILL = rgb(LOOK.pillFill);
const ring = (a = 0): [number, number][] => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos((i / 8) * Math.PI * 2 + a) * 33, Math.sin((i / 8) * Math.PI * 2 + a) * 33]);
const slots = NEIGHBOURHOODS.flatMap((n) => n.slots.map((l) => ({ x: l.x, y: l.y })));

function mapPairs(): Pair[] {
  const out: Pair[] = [];
  for (const maxSun of [false, true]) {
    const tag = maxSun ? " · max sun" : "";
    // Name plates (drawn above the sun and vignette): the plate is .88 of dark over the ground; sample along the whole plate.
    for (const n of NEIGHBOURHOODS.slice(1)) {
      for (const [part, fg] of [["name", LOOK.plateName], ["note", LOOK.plateNote]] as const) {
        out.push({
          id: `plate ${part} · ${n.id}${tag}`,
          kind: "text",
          ratio: (t) =>
            worst(
              [-100, -75, -50, -25, 0, 25, 50, 75, 100].flatMap((dx) =>
                [-24, 0, 26].flatMap((dy) =>
                  backdrops(t, n.at.x + dx, n.at.y + 42 + dy, maxSun).map((b) => contrast(rgb(fg), over(b, PLATE, LOOK.plateOpacity))),
                ),
              ),
            ),
        });
      }
    }
    // The selected node's ring: navy dashes on a cream halo, so either one may carry it; and navy against the halo itself.
    out.push({
      id: `selection ring${tag}`,
      kind: "icon",
      ratio: (t) =>
        worst([
          contrast(rgb(LOOK.ringDash), rgb(LOOK.ringHalo)),
          ...slots.flatMap((p) => ring().flatMap(([dx, dy]) => backdrops(t, p.x + dx, p.y + dy, maxSun).map((b) => Math.max(contrast(rgb(LOOK.ringDash), b), contrast(rgb(LOOK.ringHalo), b))))),
        ]),
    });
    // Completed-node stars sit on a dark pill (.88) beneath the node; gold stars and the empty ones are the two icon colours.
    out.push({
      id: `node stars${tag}`,
      kind: "icon",
      ratio: (t) =>
        worst(
          slots.flatMap((p) =>
            [-31, -10, 10, 31].flatMap((dx) =>
              [24, 36, 48].flatMap((dy) =>
                backdrops(t, p.x + dx, p.y + dy, maxSun).flatMap((b) => [LOOK.starGold, LOOK.starOff, LOOK.starOffRim].map((star) => contrast(rgb(star), over(b, PILL, LOOK.pillOpacity)))),
              ),
            ),
          ),
        ),
    });
  }
  return out;
}

/** Colours that don't depend on the season: node icons sit on opaque fills above every overlay, and HUD chips and the board badges on their own fills. */
const staticPair = (id: string, kind: "text" | "icon", fg: string, bgs: string[]): Pair => ({
  id,
  kind,
  ratio: () => worst(bgs.map((b) => contrast(rgb(fg), rgb(b)))),
});

/** Text and the focus ring on the board stage, and under the finish overlay (rgba(223,232,210,.55)). */
function stagePairs(): Pair[] {
  const out: Pair[] = [];
  for (const [name, fg, kind] of [["ink", root("ink"), "text"], ["ink-soft", root("ink-soft"), "text"], ["focus ring", root("navy"), "icon"]] as const) {
    out.push({ id: `stage ${name}`, kind, ratio: (t) => worst(["sky-hi", "sky-lo"].map((k) => contrast(rgb(fg), rgb(t[k])))) });
    out.push({ id: `finish overlay ${name}`, kind, ratio: (t) => worst(["sky-hi", "sky-lo"].map((k) => contrast(rgb(fg), over(rgb(t[k]), rgb("#dfe8d2"), 0.55)))) });
  }
  return out;
}

export const PAIRS: Pair[] = [
  ...mapPairs(),
  staticPair("node number on postal red", "text", LOOK.numberText, [LOOK.nodeRed]),
  staticPair("today callout", "text", LOOK.calloutText, [LOOK.calloutBg]),
  staticPair("node check on stamp gold", "icon", LOOK.iconDark, [LOOK.stampLight, LOOK.stampDark]),
  staticPair("node lock on grey", "icon", LOOK.iconDark, [LOOK.nodeGrey]),
  staticPair("chip number on stamp gold", "text", root("ink"), [LOOK.stampLight, LOOK.stampDark]),
  staticPair("chip number on postal red", "text", "#fffaf0", [root("postal")]),
  staticPair("locked chip text on card", "text", root("ink-soft"), [root("card")]),
  staticPair("board badge number on cream", "text", "#2a2b1f", ["#fffaee"]),
  ...stagePairs(),
];

const need = (p: Pair) => (p.kind === "text" ? 4.5 : 3);
const spring = tokens("spring");

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

describe("contrast model (no exceptions)", () => {
  it.each(SEASONS)("%s: every pair meets AA", (s: Season) => {
    const t = tokens(s);
    for (const p of PAIRS) expect(p.ratio(t), `${p.id} (${s})`).toBeGreaterThanOrEqual(need(p));
  });

  it("prints the minimum ratio per season", () => {
    for (const s of SEASONS) {
      const t = tokens(s);
      const min = (ps: Pair[]) => worst(ps.map((p) => p.ratio(t))).toFixed(2);
      const dep = PAIRS.filter((p) => /^(plate|selection|node stars|stage|finish)/.test(p.id));
      console.log(`${s}: min text ${min(PAIRS.filter((p) => p.kind === "text"))}, min icon/ring ${min(PAIRS.filter((p) => p.kind === "icon"))}; season-dependent pairs only: text ${min(dep.filter((p) => p.kind === "text"))}, icon/ring ${min(dep.filter((p) => p.kind === "icon"))}`);
    }
  });
});
