// @vitest-environment jsdom
/**
 * The colours the contrast model checks (src/village/look.ts, tests/seasonal-light.test.ts) are the colours the map
 * actually renders: this mounts the app in jsdom, reads attributes off the drawn elements (and computed CSS fills for
 * the text that village.css colours), and compares them with LOOK. Autumn and winter have no enterable village yet
 * (no routes), so the rendered villages are Thistledown (spring) and Hollowmere (summer); none of these colours depend on the season.
 * Hollowmere's own scenery (#127) adds the mere's water colours from the picked mockup's README.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../src/levels";
import { ENDING_KEY } from "../src/save";
import { mountApp } from "../src/ui/mount";
import { SAVE_KEY } from "../src/ui/save";
import { NEIGHBOURHOODS, reservedSlots } from "../src/village/data";
import { LOOK } from "../src/village/look";

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const all = <T extends Element = SVGElement>(sel: string) => [...document.querySelectorAll<T>(`#villageSvg ${sel}`)];
const fill = (e: Element) => getComputedStyle(e).fill;
let root: HTMLElement;

function mount(openAll = false) {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);
  return mountApp(root, ROUTES, { skipTitle: true, openAll });
}

/** Show a later village's map the way the preview tools do (every village open); with no routes there, it is the map of their lane slots. */
async function showVillage(id: string) {
  const app = mount(true);
  for (let hop = 0; hop < 4 && app.map.village !== id; hop++) {
    const before = app.map.village;
    document.getElementById("mapEnter")!.click();
    for (let i = 0; i < 100 && app.map.village === before; i++) await new Promise((r) => setTimeout(r, 10));
  }
  expect(app.map.village).toBe(id);
  return app;
}
const LANE_COLOURS = ["#f1dfb4", "#c9a874", "#efe4c8"];

beforeAll(() => {
  window.scrollTo = () => {};
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8") + readFileSync(resolve(process.cwd(), "src/village/village.css"), "utf8");
  document.head.appendChild(style);
});
beforeEach(() => localStorage.clear());

function expectPlates() {
  const plates = all("g.vhood rect");
  expect(plates.length).toBeGreaterThan(0);
  for (const r of plates) {
    expect(r.getAttribute("fill")).toBe(LOOK.plateFill);
    expect(Number(r.getAttribute("opacity"))).toBe(LOOK.plateOpacity);
  }
  expect(all(".vplateName").length).toBe(plates.length);
  for (const t of all(".vplateName")) expect(fill(t)).toBe(rgb(LOOK.plateName));
  for (const t of all(".vplateNote")) expect(fill(t)).toBe(rgb(LOOK.plateNote));
}

describe("Thistledown (spring), with a done, an open and locked lanes", () => {
  it("draws the plates, ring, star pills, node icons and callout with the colours the contrast model uses", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: { [ROUTES[0].id]: { stars: 3, moves: ROUTES[0].par }, [ROUTES[1].id]: { stars: 1, moves: ROUTES[1].par + 3 } } }));
    mount();
    expect(root.dataset.season).toBe("spring");
    expectPlates();

    // the plates are painted after the sun and vignette overlays
    const kids = [...document.querySelectorAll("#villageSvg > *")];
    const vig = kids.findIndex((k) => k.getAttribute("fill") === "url(#vVig)");
    expect(vig).toBeGreaterThan(0);
    for (const h of all("g.vhood")) expect(kids.indexOf(h)).toBeGreaterThan(vig);

    // selected node's ring: a halo, then dashes
    const ring = all(".vring circle");
    expect(ring).toHaveLength(2);
    expect(ring[0].getAttribute("stroke")).toBe(LOOK.ringHalo);
    expect(ring[0].getAttribute("stroke-dasharray")).toBeNull();
    expect(ring[1].getAttribute("stroke")).toBe(LOOK.ringDash);
    expect(ring[1].getAttribute("stroke-dasharray")).toBeTruthy();
    expect(ring[0].getAttribute("stroke")).not.toBe(ring[1].getAttribute("stroke"));

    // completed-node star pills and the stamp
    const pills = all(".vstars rect");
    expect(pills).toHaveLength(2);
    for (const p of pills) {
      expect(p.getAttribute("fill")).toBe(LOOK.pillFill);
      expect(Number(p.getAttribute("opacity"))).toBe(LOOK.pillOpacity);
    }
    expect(all("#vStamp stop").map((s) => s.getAttribute("stop-color"))).toEqual([LOOK.stampLight, LOOK.stampDark]);
    const checks = all('.vnode.done path[d^="M-9 0"]');
    expect(checks).toHaveLength(2);
    for (const c of checks) expect(c.getAttribute("stroke")).toBe(LOOK.iconDark);

    // an open node and its number
    const open = all(".vnode.open circle[r='24']");
    expect(open).toHaveLength(1);
    expect(open[0].getAttribute("fill")).toBe(LOOK.nodeRed);
    for (const t of all(".vnum")) expect(fill(t)).toBe(rgb(LOOK.numberText));

    // locked nodes: grey with a dark padlock
    const locked = all(".vnode.locked");
    expect(locked.length).toBeGreaterThan(0);
    for (const n of locked) {
      expect(n.querySelector("circle[r='21']")!.getAttribute("fill")).toBe(LOOK.nodeGrey);
      expect(n.querySelector("rect")!.getAttribute("fill")).toBe(LOOK.iconDark);
      expect(n.querySelector("path")!.getAttribute("stroke")).toBe(LOOK.iconDark);
    }

    // the Today callout
    const callout = all(".vtoday rect");
    expect(callout).toHaveLength(1);
    expect(callout[0].getAttribute("fill")).toBe(LOOK.calloutBg);
    expect(all(".vtoday path")[0].getAttribute("fill")).toBe(LOOK.calloutBg);
    expect(fill(all(".vcallout")[0])).toBe(rgb(LOOK.calloutText));
  });

  it("the HUD chips use the ink and ink-soft text the model checks", () => {
    mount();
    const sheet = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
    const rule = (sel: string) => sheet.find((r) => r.selectorText === sel)!;
    expect(rule(".vchip.done .vchipNum").style.getPropertyValue("color")).toBe("var(--ink)");
    expect(rule(".vchip.locked").style.getPropertyValue("color")).toBe("var(--ink-soft)");
    expect(rule(".vchip.done .vchipNum").style.getPropertyValue("background")).toContain(rgb(LOOK.stampLight));
    expect(rule(".vchip.done .vchipNum").style.getPropertyValue("background")).toContain(rgb(LOOK.stampDark));
  });
});

describe("Hollowmere (summer)", () => {
  it("draws the same plates in the summer map", async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best: Object.fromEntries(ROUTES.filter((r) => NEIGHBOURHOODS[0].routes.includes(r.id)).map((r) => [r.id, { stars: 2, moves: r.par + 1 }])) }));
    localStorage.setItem(ENDING_KEY, JSON.stringify({ seen: true }));
    const app = mount();
    document.getElementById("mapEnter")!.click();
    for (let i = 0; i < 50 && app.map.village !== "hollowmere"; i++) await new Promise((r) => setTimeout(r, 10));
    expect(app.map.village).toBe("hollowmere");
    expect(root.dataset.season).toBe("summer");
    expectPlates();
    expect(reservedSlots(NEIGHBOURHOODS[1])).toHaveLength(0);
    // the mere uses the README's water colours (and a sand shore), as a separate gradient from the stream's; the stream's is untouched
    expect(all("#vMere stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#9fe0e8", "#4aa0bc"]);
    expect(all("#vWater stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#9fd8e4", "#5fa9c0"]);
    const mere = all(".vmere > ellipse");
    expect(mere[0].getAttribute("fill")).toBe("#f0dca0");
    expect(mere[2].getAttribute("fill")).toBe("url(#vMere)");
    // no lane colour on the water, and no dotted bushes among the props: nothing in the mere is drawn in the lane's sand, edge or dots
    for (const e of all(".vmere *")) for (const c of ["#f1dfb4", "#c9a874", "#efe4c8"]) expect([e.getAttribute("fill"), e.getAttribute("stroke")]).not.toContain(c);
  });
});

describe("Conker Corner (autumn) and Snowberry End (winter): the picked mockups (#128, #129)", () => {
  it("Conker's brook uses the README's water colours as its own gradient; nothing in it is drawn in a lane colour", async () => {
    await showVillage("conker");
    expect(root.dataset.season).toBe("autumn");
    expect(all("#vBrook stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#d4ece8", "#8fc3c4"]);
    expect(all("#vWater stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#9fd8e4", "#5fa9c0"]); // the stream's is untouched
    expect(all("#vMere stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#9fe0e8", "#4aa0bc"]);
    for (const e of all(".vbrook *")) for (const c of LANE_COLOURS) expect([e.getAttribute("fill"), e.getAttribute("stroke")]).not.toContain(c);
    expect(reservedSlots(NEIGHBOURHOODS[2])).toEqual([]); // every slot has its autumn route
    expect(all("circle[stroke-dasharray]:not(.vring *)")).toHaveLength(0); // no dotted bushes (the open lane's selection ring is dashed)
  });

  it("Snowberry's lake uses the README's ice colours; planks only on lanes 3 and 4; no lane colour on the ice, no fog plate ahead", async () => {
    await showVillage("snowberry");
    expect(root.dataset.season).toBe("winter");
    expect(all("#vLake stop").map((st) => st.getAttribute("stop-color"))).toEqual(["#d8eef6", "#9ec8dc"]);
    for (const e of all(".vlake > path, .vlake > ellipse")) for (const c of LANE_COLOURS) expect([e.getAttribute("fill"), e.getAttribute("stroke")]).not.toContain(c);
    expect([...new Set(all(".vplanks").map((g) => g.getAttribute("data-lane-n")))].sort()).toEqual(["3", "4"]);
    expect(all(".vslide")).toHaveLength(1);
    expect(all(".vfog")).toHaveLength(0); // Snowberry End is the last village
    expect(all(".vhood")).toHaveLength(0);
    expect(document.getElementById("mapEnter")!.hidden).toBe(true);
  });
});
