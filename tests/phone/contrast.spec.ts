/**
 * Rendered-pixel contrast (#99, `npm run phone-pass`): for each season, render the village map and a board, hide every
 * text, icon and ring element (so only what is BEHIND it is painted), screenshot, and take the worst contrast between
 * the element's own colour and the background pixels in its box. Text needs 4.5:1; icons and rings 3:1.
 * This is the authoritative contrast check; tests/seasonal-light.test.ts is a fast analytic estimate.
 *
 * Standard pack only. Autumn and winter have no enterable village yet, so those seasons are shown by setting
 * `data-season` on the app root over the rendered Thistledown map (the tokens are CSS variables, so the paint is live).
 * Output is element ids and ratios only.
 */
import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
type Kind = "text" | "icon";
interface Result { id: string; kind: Kind; ratio: number; dbg?: string; over?: string[] }

/** Runs in the page: hides the targets, screenshots (via `shot`), reads the pixels, returns ratios. */
async function measure(page: Page, view: "map" | "board", season: string, pass: "main" | "stars" = "main"): Promise<Result[]> {
  await page.evaluate(async (s) => {
    document.querySelector(".wrap")!.parentElement!.dataset.season = s;
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, season);
  // 1. find the targets and their colours, then hide them
  const targets = await page.evaluate(({ v, pass }: { v: string; pass: string }) => {
    const out: { id: string; kind: Kind; box: [number, number, number, number]; fg: string[]; ring?: [number, number, number]; over?: string[] }[] = [];
    const css = (e: Element, p: string) => getComputedStyle(e).getPropertyValue(p);
    const off = [window.scrollX, window.scrollY];
    const box = (e: Element): [number, number, number, number] => {
      let r = e.getBoundingClientRect();
      if (e instanceof HTMLElement && !e.querySelector("svg")) {
        // HTML text: the glyph line box, not the (possibly round) element around it
        const rg = document.createRange();
        rg.selectNodeContents(e);
        r = rg.getBoundingClientRect();
      }
      return [r.left + off[0], r.top + off[1], r.width, r.height];
    };
    const sym = (id: string, sel: string, attr: string) => [...document.querySelectorAll(`#${id} ${sel}`)].map((e) => e.getAttribute(attr) ?? "");
    const stops = (id: string) => [...document.querySelectorAll(`#${id} stop`)].map((e) => e.getAttribute("stop-color") ?? "");
    let n = 0;
    /** Fully inside every clipping ancestor (the lane strip scrolls sideways: chips out of view aren't painted). */
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      for (let p = e.parentElement; p; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.overflowX === "visible" && st.overflowY === "visible") continue;
        const q = p.getBoundingClientRect();
        if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) return false;
      }
      return true;
    };
    /** Other map layers drawn above this element (the Today callout, Pip): geometric overlap, reported as a warning. */
    const covered = (e: Element) => {
      const r = e.getBoundingClientRect();
      const hit = (o: Element | null) => {
        if (!o || o === e || o.contains(e) || e.contains(o)) return false;
        const q = o.getBoundingClientRect();
        return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
      };
      return [hit(document.querySelector(".vtoday")) ? "callout" : "", hit(document.querySelector("#mapPip")) ? "pip" : ""].filter(Boolean);
    };
    const add = (kind: Kind, name: string, e: Element, fg: string[], hide: "paint" | "visibility" = "paint") => {
      const b = box(e);
      if (b[2] < 1 || b[3] < 1 || !shown(e)) return;
      e.setAttribute("data-ct", hide);
      out.push({ id: `${name}#${n++}`, kind, box: b, fg, over: covered(e) });
    };
    const text = (e: Element, p = "fill") => [css(e, p)];
    const all = (sel: string) => [...document.querySelectorAll(sel)];
    if (v === "map") {
      if (pass === "main") for (const e of all("#villageSvg .vplateName")) add("text", "plate-name", e, text(e));
      if (pass === "main") for (const e of all("#villageSvg .vplateNote")) add("text", "plate-note", e, text(e));
      if (pass === "main") for (const e of all("#villageSvg .vnum")) add("text", "node-number", e, text(e));
      if (pass === "main") for (const e of all("#villageSvg .vcallout")) add("text", "callout", e, text(e));
      if (pass === "main") for (const e of all('#villageSvg .vnode.done path[d^="M-9 0"]')) add("icon", "node-check", e, text(e, "stroke"));
      if (pass === "main") for (const e of all("#villageSvg .vnode.locked rect")) add("icon", "node-lock", e, text(e));
      if (pass === "main") for (const e of all("#villageSvg .vnode.locked path")) add("icon", "node-lock", e, text(e, "stroke"));
      // stars: the sprite's own colours (gold stops, empty fill and rim), against the pill behind
      const gold = stops("gold"), off1 = sym("rbStarOff", "path", "fill"), off2 = sym("rbStarOff", "path", "stroke");
      if (pass === "stars") for (const e of all("#villageSvg .vstars use")) {
        const href = e.getAttribute("href");
        add("icon", href === "#rbStar" ? "star-gold" : "star-empty", e, href === "#rbStar" ? gold : [...off1, ...off2], "visibility");
      }
      if (pass === "main") for (const e of all("#villageSvg .vring")) {
        const c = e.querySelectorAll("circle");
        const r = e.getBoundingClientRect();
        const cx = r.left + off[0] + r.width / 2, cy = r.top + off[1] + r.height / 2;
        const sc = r.width / 74; // the ring is r 33 + 4 stroke each side, 74 wide in map units
        e.setAttribute("data-ct", "visibility");
        out.push({ id: `ring#${n++}`, kind: "icon", over: covered(e), box: box(e), fg: [css(c[0], "stroke"), css(c[1], "stroke")], ring: [cx, cy, sc] });
      }
      if (pass === "main") for (const e of all("#mapLanes .vchipNum")) if (!e.querySelector("svg")) add("text", "chip-number", e, [css(e, "color")]);
      if (pass === "main") for (const e of all("#mapLanes .vchipName")) add("text", "chip-name", e, [css(e, "color")]);
      if (pass === "main") for (const e of all("#mapLanes .vchipNum svg")) add("icon", "chip-lock", e, sym("icoLock", "rect", "fill"), "visibility");
    } else if (pass === "main") {
      for (const e of all("#board text")) add("text", "board-badge-number", e, text(e));
      for (const e of all('#board use[href="#icoLock"]')) add("icon", "board-lock", e, sym("icoLock", "rect", "fill"), "visibility");
    }
    return out;
  }, { v: view, pass });
  expect(targets.length, `${view} ${season}: found targets`).toBeGreaterThan(0);

  const tag = await page.addStyleTag({
    content: `#mapPip${pass === "stars" ? ",.vtoday" : ""}{visibility:hidden!important}` + '[data-ct="paint"]{color:transparent!important;fill:transparent!important;stroke:transparent!important;text-shadow:none!important}[data-ct="visibility"]{visibility:hidden!important}',
  });
  const png = (await page.screenshot({ fullPage: true, animations: "disabled" })).toString("base64");
  if (process.env.CONTRAST_DEBUG) writeFileSync(`test-results/phone-pass/contrast-${view}-${season}.png`, Buffer.from(png, "base64"));
  const results = await page.evaluate(
    async ({ b64, targets }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const scale = img.width / document.documentElement.scrollWidth;
      const lum = (r: number, g2: number, b: number) => {
        const f = (u: number) => ((u /= 255) <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g2) + 0.0722 * f(b);
      };
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const parse = (s: string): number | null => {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) ?? null;
        if (m) return lum(+m[1], +m[2], +m[3]);
        const h = s.match(/^#([0-9a-f]{6})$/i);
        return h ? lum(parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)) : null;
      };
      return targets.map((t) => {
        const fgs = t.fg.map(parse).filter((x): x is number => x !== null);
        const [bx, by, bw, bh] = t.box;
        const x0 = Math.ceil(bx * scale) + 1, y0 = Math.ceil(by * scale) + 1;
        const x1 = Math.floor((bx + bw) * scale) - 1, y1 = Math.floor((by + bh) * scale) - 1;
        if (!fgs.length || x1 <= x0 || y1 <= y0) return { id: t.id, kind: t.kind, ratio: -1, over: t.over };
        const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const w = x1 - x0;
        let worst = Infinity, wp = "";
        for (let i = 0; i < data.length; i += 4) {
          if (t.ring) {
            const px = x0 + ((i / 4) % w), py = y0 + Math.floor(i / 4 / w);
            const d = Math.hypot(px / scale - t.ring[0], py / scale - t.ring[1]) / t.ring[2]; // in map units
            if (d < 29 || d > 37) continue;
          }
          const L = lum(data[i], data[i + 1], data[i + 2]);
          // a ring is two-tone: either colour may carry it; every other element must clear it in its own colour(s)
          const r = t.ring ? Math.max(...fgs.map((f) => ratio(f, L))) : Math.min(...fgs.map((f) => ratio(f, L)));
          if (r < worst) { worst = r; wp = `${data[i]},${data[i + 1]},${data[i + 2]}`; }
        }
        return { id: t.id, kind: t.kind, ratio: Math.round(worst * 100) / 100, over: t.over, dbg: `worstpx ${wp} ${t.fg.join("|")} box ${t.box.map((n) => Math.round(n)).join(",")}` };
      });
    },
    { b64: png, targets },
  );
  // restore the page for the next season
  await page.evaluate(() => {
    document.querySelectorAll("[data-ct]").forEach((e) => e.removeAttribute("data-ct"));
  });
  await tag.evaluate((e) => (e as Element).remove());
  return results;
}

async function openMap(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true })));
  await page.reload();
  await page.locator("#titleNew").tap();
  await page.locator("#letterView").waitFor();
  await page.locator('#letterView [data-letter="skip"]').tap();
  await page.locator('#letterView [data-letter="next"]').tap();
  await page.locator("#letterView").waitFor({ state: "detached" });
  // two finished lanes (3 stars and 1 star) so the stamp, check and stars are drawn; the next lane stays open
  const ids = await page.locator("#mapLanes .vchip").evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.lane!));
  await page.evaluate((i) => localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: { [i[0]]: { stars: 3, moves: 1 }, [i[1]]: { stars: 1, moves: 99 } } })), ids);
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator("#villageSvg .vnode.done").first().waitFor();
}

test("rendered contrast: the map and a board, in every season", async ({ page }, info) => {
  await openMap(page);
  const rows: { season: string; view: string; res: Result[] }[] = [];
  for (const s of SEASONS) rows.push({ season: s, view: "map", res: [...(await measure(page, "map", s)), ...(await measure(page, "map", s, "stars"))] });
  await page.locator("#mapStart").tap();
  await page.locator('#board [data-cell]').first().waitFor();
  for (const s of SEASONS) rows.push({ season: s, view: "board", res: await measure(page, "board", s) });

  const fails: string[] = [];
  const byType = new Map<string, number[]>(); // "view type" -> min per season
  for (const [si, { season, view, res }] of rows.entries()) {
    for (const r of res) {
      const type = `${view} ${r.id.replace(/#\d+$/, "")} (${r.kind})`;
      const m = byType.get(type) ?? [Infinity, Infinity, Infinity, Infinity];
      const k = SEASONS.indexOf(season as (typeof SEASONS)[number]);
      m[k] = Math.min(m[k], r.ratio);
      byType.set(type, m);
      if (r.ratio < (r.kind === "text" ? 4.5 : 3)) fails.push(`${season} ${view} ${r.id} ${r.ratio}${process.env.CONTRAST_DEBUG ? " " + r.dbg : ""}`);
    }
    void si;
  }
  const mins = [`min ratio per element type, ${SEASONS.join(" / ")}:`, ...[...byType].map(([t, m]) => `  ${t}: ${m.map((x) => (x === Infinity ? "-" : x.toFixed(2))).join(" / ")}`)];
  // Layout overlaps (another layer drawn over the element) are warnings: reported by id, never a reason to loosen a threshold.
  const overlaps = [...new Set(rows.filter((r) => r.season === "spring").flatMap(({ view, res }) => res.filter((r) => r.over?.length).map((r) => `${view} ${r.id} covered by ${r.over!.join("+")}`)))];
  console.log(`[${info.project.name}] contrast\n` + mins.join("\n") + (overlaps.length ? `\nOVERLAPS (warnings):\n${overlaps.join("\n")}` : "") + (fails.length ? `\nBELOW AA:\n${fails.join("\n")}` : "\nall at or above AA"));
  expect(fails, "elements below AA (ids and ratios)").toEqual([]);
});
