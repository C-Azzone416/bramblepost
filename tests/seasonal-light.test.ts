/**
 * Seasonal light (#65): the token table in styles.css keeps spring exactly as it was, every village has a season,
 * and text and focus rings stay readable (WCAG AA) on every season's sky colours.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NEIGHBOURHOODS, SEASONS } from "../src/village/data";

const css = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

function tokens(season: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-season="${season}"\\]\\{([^}]*)\\}`))?.[1];
  expect(block, `${season} token block`).toBeTruthy();
  return Object.fromEntries([...block!.matchAll(/--([\w-]+):([^;]+)/g)].map((m) => [m[1], m[2]]));
}
const root = (name: string) => css.match(new RegExp(`--${name}:(#[0-9a-f]{6})`))![1];

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** A tint laid over a colour, as the map overlay does. */
const over = (base: string, tint: string, a: number) => {
  const mix = (i: number) => Math.round(parseInt(base.slice(i, i + 2), 16) * (1 - a) + parseInt(tint.slice(i, i + 2), 16) * a).toString(16).padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
};

describe("seasonal light tokens", () => {
  it("spring is exactly the original look", () => {
    expect(tokens("spring")).toEqual({
      "sky-hi": "#eef3e3", "sky-lo": "#dfe8d2", tint: "#dfe8d2", "tint-a": "0",
      shadow: "#2b2410", "shadow-a": ".3", "sun-core": "#fff1c2", "sun-edge": "#ffd98a", "sun-a": ".7",
    });
    expect(css).toContain("var(--sky-hi) 0%,var(--sky-lo) 60%"); // the stage gradient is the old #eef3e3 → #dfe8d2
  });

  it("every season defines the same tokens, and every village has a known season", () => {
    for (const s of SEASONS) expect(Object.keys(tokens(s)).sort()).toEqual(Object.keys(tokens("spring")).sort());
    for (const h of NEIGHBOURHOODS) expect(SEASONS).toContain(h.season);
    expect(NEIGHBOURHOODS.find((h) => h.id === "hollowmere")!.season).toBe("summer");
  });

  it.each(SEASONS)("%s: ink, soft ink and the focus ring clear AA on the sky and tinted map", (s) => {
    const t = tokens(s);
    const ink = root("ink"), soft = root("ink-soft"), navy = root("navy");
    for (const bg of [t["sky-hi"], t["sky-lo"], over(t["sky-lo"], t.tint, Number(t["tint-a"]))]) {
      expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(soft, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(navy, bg)).toBeGreaterThanOrEqual(3); // focus ring: non-text contrast
    }
  });
});
