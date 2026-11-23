/**
 * Rendered-pixel contrast proof (#99, #106; `npm run phone-pass`, WebKit and Chromium, standard pack only, runs in CI).
 *
 * Method. Every text, icon and ring in a view is found in the DOM (nothing is on an allow-list except sprites that are
 * illustrations, see ART). The page is rendered several times: V as painted; H with every target hidden; and B and W with
 * the targets painted solid black and solid white. From B and W each pixel's coverage by a target is exact and independent
 * of how its colour compares with the background: a = (W - B) / 255 (divided by the element's effective opacity, so a
 * dimmed element is measured as painted). The painted region is every pixel with a >= 0.1; edge pixels (covered clearly less than a
 * neighbour within 2px) are not measured, every other pixel is, as painted (V) against the background beside and under it (H).
 *
 * Text: every pixel of the painted region that is not a partly covered edge pixel is measured as painted, against the ground beside and
 * under it, at 4.5:1, with no allowance. Icons (WCAG 1.4.11): the boundary band of the painted region against the ground just outside it,
 * 3:1, no allowance; the interior is not measured. A target that is missing, clipped, zero-size or has too few painted pixels fails.
 *
 * Ring (a dashed two-tone indicator, by the PM's ruling): the expected dash pattern comes from one more render (R) with the dashes forced
 * black, against the dashes-hidden render D, not from the render under test. Each of 120 angular bins that has a dash there (two or more
 * pixels, edge pixels excluded by the text rule) is measured on those same pixels as rendered (the open node's pulse tints them): its dash
 * against its halo, 3:1, and the better of dash and halo against the ground beside it, 3:1. A missing or faint segment fails directly; there
 * is no global threshold and no gap tolerance. The proofs at the end of this file damage one dash and require the check to fail.
 *
 * Expected set. Counts come from the game state the spec seeds and from the page's own lists (the season list, the
 * satchel), never from the elements under test; the map HUD is checked against the state's text. Views: the actual
 * Thistledown map (spring; summer, autumn and winter by setting `data-season` on the root, because their villages have no
 * routes yet, so only their lighting is emulated), the actual Hollowmere map (summer), and a board. Output is ids and
 * ratios only; no files.
 *
 * CI is the only authority. The strict comparison with KNOWN_FINDINGS (an unlisted failure fails; a listed entry that passes fails as
 * stale) runs only on Linux (`process.platform === "linux"`, the ubuntu-latest runner); a local macOS run prints the same table of rows
 * and still fails measurement failures, but does not fail on the known/stale comparison.
 */
import { expect, test, type Page } from "@playwright/test";
import { apply, deliverChain, defaultOrder, parse, SUN } from "../../src/engine";
import { SPRING } from "../../src/levels/spring";
import { AUTUMN } from "../../src/levels/autumn";
import { SUMMER } from "../../src/levels/summer";
import { WINTER } from "../../src/levels/winter";

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
type Kind = "text" | "icon" | "ring";
const NEED = { text: 4.5, icon: 3, ring: 3 };
/**
 * The honest baseline of what this check finds in the existing UI today (not regressions, not caused by the check): each entry names one
 * element (by view and name; generic text carries its own text), the seasons it falls below AA in, and the issue that tracks it: "#113"
 * (the contrast fix) or "new" (found by the stricter measurement in #114, to be filed). Listing is the only exception. Anything not listed
 * that falls below AA fails; a measurement failure (missing, unmeasurable, expected-set mismatch) is never excused; and in CI an entry
 * whose element passes in a listed season fails ("remove it from KNOWN_FINDINGS"), so the list cannot go stale at that granularity.
 * The list is the baseline for the Linux CI runner (ubuntu-latest), which is the only authority: text renders a little differently on
 * macOS, so the known/stale comparison is made only when `process.platform === "linux"`. Elsewhere (a local macOS run) the same table of
 * rows is printed and the measurement failures still fail, but the comparison with this list does not.
 */
interface Known { view: string; name: string; seasons: "all" | readonly string[]; issue: "#113" | "new"; note: string }
const KNOWN_FINDINGS: Record<string, Known[]> = {
  "iphone-landscape": [
    { view: "thistledown", name: "text:span.vtag in vpanel \"New: footbridge\"", seasons: "all", issue: "new", note: "lane-panel tag, shown once the open lane is footbridge (#121); fix in #140" },
    { view: "board", name: "board-check", seasons: "all", issue: "new", note: "white check on gold" },
    { view: "board", name: "board-lock", seasons: "all", issue: "new", note: "lock on tile" },
    { view: "board", name: "text:li in keys \"Swipe along a row or column,\"", seasons: "all", issue: "new", note: "help text (landscape)" },
    { view: "thistledown", name: "node-number", seasons: "all", issue: "new", note: "blurred by the drop shadow" },
    { view: "thistledown", name: "star-gold", seasons: "all", issue: "new", note: "rim on dark pill" },
    { view: "hollowmere", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "hollowmere", name: "text:span.vtag in vpanel \"New: sunflower\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "conker", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "snowberry", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "conker", name: "text:span.vtag in vpanel \"New: gust\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "snowberry", name: "text:span.vtag in vpanel \"New: ice\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
  ],
  "iphone-portrait": [
    { view: "thistledown", name: "text:span.vtag in vpanel \"New: footbridge\"", seasons: "all", issue: "new", note: "lane-panel tag, shown once the open lane is footbridge (#121); fix in #140" },
    { view: "board", name: "board-check", seasons: "all", issue: "new", note: "white check on gold" },
    { view: "board", name: "board-lock", seasons: "all", issue: "new", note: "lock on tile" },
    { view: "thistledown", name: "callout", seasons: "all", issue: "new", note: "callout text on red (borderline)" },
    { view: "thistledown", name: "node-number", seasons: "all", issue: "new", note: "blurred by the drop shadow" },
    { view: "thistledown", name: "star-gold", seasons: "all", issue: "new", note: "rim on dark pill" },
    { view: "hollowmere", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "hollowmere", name: "callout", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; callout text on red (borderline); fix in #140 (map half)" },
    { view: "hollowmere", name: "text:span.vtag in vpanel \"New: sunflower\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "conker", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "snowberry", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "conker", name: "text:span.vtag in vpanel \"New: gust\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "snowberry", name: "text:span.vtag in vpanel \"New: ice\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
  ],
  "pixel-landscape": [
    { view: "thistledown", name: "text:span.vtag in vpanel \"New: footbridge\"", seasons: "all", issue: "new", note: "lane-panel tag, shown once the open lane is footbridge (#121); fix in #140" },
    { view: "board", name: "board-check", seasons: "all", issue: "new", note: "white check on gold" },
    { view: "board", name: "board-lock", seasons: "all", issue: "new", note: "lock on tile" },
    { view: "board", name: "text:li in keys \"Keyboard: arrows move, R tur\"", seasons: "all", issue: "new", note: "help text (landscape)" },
    { view: "board", name: "text:li in keys \"Tap a tile to turn it. Turn \"", seasons: "all", issue: "new", note: "help text (landscape)" },
    { view: "thistledown", name: "node-number", seasons: "all", issue: "new", note: "blurred by the drop shadow" },
    { view: "thistledown", name: "star-gold", seasons: "all", issue: "new", note: "rim on dark pill" },
    { view: "hollowmere", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "hollowmere", name: "text:span.vtag in vpanel \"New: sunflower\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "thistledown", name: "node-lock", seasons: "all", issue: "new", note: "shared lock style; two locks of the full-canvas spring layout (#175) sit where the lock is below 3:1 in this project only; fix in #140 (map half)" },
    { view: "hollowmere", name: "node-lock", seasons: "all", issue: "new", note: "shared lock style on the Hollowmere map; below 3:1 in this project only; fix in #140 (map half)" },
    { view: "conker", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "snowberry", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "conker", name: "text:span.vtag in vpanel \"New: gust\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "snowberry", name: "text:span.vtag in vpanel \"New: ice\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "conker", name: "node-lock", seasons: "all", issue: "new", note: "shared lock style on the Conker Corner map; below 3:1 in this project only; fix in #140 (map half)" },
    { view: "snowberry", name: "node-lock", seasons: "all", issue: "new", note: "shared lock style on the Snowberry End map; below 3:1 in this project only; fix in #140 (map half)" },
  ],
  "pixel-portrait": [
    { view: "thistledown", name: "text:span.vtag in vpanel \"New: footbridge\"", seasons: "all", issue: "new", note: "lane-panel tag, shown once the open lane is footbridge (#121); fix in #140" },
    { view: "board", name: "board-check", seasons: "all", issue: "new", note: "white check on gold" },
    { view: "board", name: "board-lock", seasons: "all", issue: "new", note: "lock on tile" },
    { view: "thistledown", name: "node-number", seasons: "all", issue: "new", note: "blurred by the drop shadow" },
    { view: "thistledown", name: "star-gold", seasons: "all", issue: "new", note: "rim on dark pill" },
    { view: "hollowmere", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "hollowmere", name: "text:span.vtag in vpanel \"New: sunflower\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "conker", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "snowberry", name: "node-number", seasons: "all", issue: "new", note: "same shared map style as Thistledown's; blurred by the drop shadow; fix in #140 (map half)" },
    { view: "conker", name: "text:span.vtag in vpanel \"New: gust\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
    { view: "snowberry", name: "text:span.vtag in vpanel \"New: ice\"", seasons: "all", issue: "new", note: "same shared lane-panel tag style as Thistledown's footbridge tag; fix in #140 (map half)" },
  ],
};
const MIN_PIXELS = 8;
/** Sprites that are illustrations (Pip, houses, the post office, the neighbours, the ambient props, the parcel pictures that sit beside their text label), not icons: everything else `use`d is an icon. */
const ART = /^#(pip|mush|acorn|rbPO|po[A-Z]\w*|\w*House|nb\w+|amb\w+|oak|icoLetter|icoSeed|icoPie|icoCat|icoKey)/;

interface Target { id: string; name: string; kind: Kind; paint: "color" | "fill" | "stroke" | "use"; box: [number, number, number, number]; opacity: number; shown: boolean; over: string[]; clipped: boolean; text?: string; ring?: { cx: number; cy: number; scale: number } }
interface Row { season: string; view: string; name: string; id: string; kind: Kind; ratio: number; why?: string; note?: string; over?: string[] }

/** Page side: tag every target in a view (data-ctid / -ctpaint / -ctgrp) and describe it. */
async function discover(page: Page, view: string): Promise<Target[]> {
  return page.evaluate(
    async ({ view, ART }) => {
      const art = new RegExp(ART.slice(1, ART.lastIndexOf("/")), "i");
      const css = (e: Element, p: string) => getComputedStyle(e).getPropertyValue(p);
      const off = [window.scrollX, window.scrollY];
      const out: Target[] = [];
      const exempt: string[] = [];
      const count = new Map<string, number>();
      const effOpacity = (e: Element) => {
        let o = 1;
        for (let p: Element | null = e; p; p = p.parentElement) o *= parseFloat(css(p, "opacity") || "1");
        return o * parseFloat(css(e, "fill-opacity") || "1");
      };
      const painted = (e: Element) => {
        for (let p: Element | null = e; p; p = p.parentElement) if (css(p, "display") === "none" || css(p, "visibility") === "hidden") return false;
        return e.getClientRects().length > 0 || e instanceof SVGElement;
      };
      /** The part of a rect that is not clipped away by an ancestor, or null if none of it is painted (text cut off by a container is measured where it shows). */
      const visible = (e: Element, r: DOMRect): DOMRect | null => {
        let l = r.left, t = r.top, rt = r.right, bt = r.bottom;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const st = getComputedStyle(p);
          if (st.overflowX === "visible" && st.overflowY === "visible") continue;
          const q = p.getBoundingClientRect();
          l = Math.max(l, q.left); t = Math.max(t, q.top); rt = Math.min(rt, q.right); bt = Math.min(bt, q.bottom);
        }
        return rt - l >= 1 && bt - t >= 1 ? new DOMRect(l, t, rt - l, bt - t) : null;
      };
      const textBox = (e: Element): DOMRect => {
        if (!(e instanceof HTMLElement)) return e.getBoundingClientRect();
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const n of e.childNodes) {
          if (n.nodeType !== 3 || !n.textContent?.trim()) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) (l = Math.min(l, q.left)), (t = Math.min(t, q.top)), (r = Math.max(r, q.right)), (b = Math.max(b, q.bottom));
        }
        return new DOMRect(l, t, r - l, b - t);
      };
      const callout = document.querySelector<SVGGElement>(".vtoday");
      // A moved pill and its angled tail leave empty space inside the group's union box. Render the children on transparent
      // ground at device resolution, then intersect targets with ANY painted pixel (including antialiasing), not that box.
      // As with the previous geometry check, decorative filters are excluded. Pip keeps its conservative full sprite bounds.
      const calloutMask = await (async () => {
        if (!callout || !painted(callout) || effOpacity(callout) === 0) return null;
        const q = callout.getBoundingClientRect(), matrix = callout.getScreenCTM();
        if (!matrix || !q.width || !q.height) throw new Error("callout paint geometry is unmeasurable");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(q.width * devicePixelRatio); canvas.height = Math.ceil(q.height * devicePixelRatio);
        svg.setAttribute("width", String(canvas.width)); svg.setAttribute("height", String(canvas.height));
        svg.setAttribute("viewBox", `${q.x} ${q.y} ${q.width} ${q.height}`);
        svg.setAttribute("preserveAspectRatio", "none");
        for (const defs of callout.ownerSVGElement!.querySelectorAll("defs")) svg.append(defs.cloneNode(true));
        const clone = callout.cloneNode(true) as SVGGElement;
        const originals = [callout, ...callout.querySelectorAll("*")];
        const copies = [clone, ...clone.querySelectorAll("*")];
        originals.forEach((el, i) => {
          for (const prop of ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "opacity", "display", "visibility", "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor"]) {
            (copies[i] as SVGElement).style.setProperty(prop, css(el, prop));
          }
          (copies[i] as SVGElement).style.setProperty("filter", "none");
        });
        clone.setAttribute("transform", `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
        svg.append(clone);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) throw new Error("callout paint mask is empty");
          return { q, width: canvas.width, height: canvas.height, pixels };
        } finally { URL.revokeObjectURL(url); }
      })();
      const covered = (r: DOMRect, e: Element) => {
        const hit = (o: Element | null) => {
          if (!o || o === e || o.contains(e) || e.contains(o)) return false;
          const q = o.getBoundingClientRect();
          return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
        };
        const calloutHit = () => {
          if (!calloutMask || !hit(callout)) return false;
          const { q, width, height, pixels } = calloutMask;
          const x0 = Math.max(0, Math.floor((r.left - q.left) * width / q.width));
          const x1 = Math.min(width, Math.ceil((r.right - q.left) * width / q.width));
          const y0 = Math.max(0, Math.floor((r.top - q.top) * height / q.height));
          const y1 = Math.min(height, Math.ceil((r.bottom - q.top) * height / q.height));
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (pixels[(y * width + x) * 4 + 3] > 0) return true;
          return false;
        };
        return [calloutHit() ? "callout" : "", hit(document.querySelector("#mapPip")) ? "pip" : ""].filter(Boolean);
      };
      /** Inactive controls are exempt from contrast (WCAG 1.4.3); they are counted, not measured. */
      const inactive = (e: Element) => !!e.closest("[disabled], [aria-disabled='true']");
      const add = (name: string, kind: Kind, paint: Target["paint"], e: Element, grp = "A", rect?: DOMRect, extra: Partial<Target> = {}) => {
        if (inactive(e)) { exempt.push(name); return; }
        if (effOpacity(e) < 0.05) return; // not painted (a hidden toast, an element faded out): nothing to see, nothing to judge
        const k = count.get(name) ?? 0;
        count.set(name, k + 1);
        const id = `${name}#${k}`;
        const full = rect ?? (paint === "color" || paint === "fill" ? textBox(e) : e.getBoundingClientRect());
        const vis = visible(e, full);
        const r = vis ?? full;
        e.setAttribute("data-ctid", id);
        e.setAttribute("data-ctpaint", paint);
        e.setAttribute("data-ctgrp", grp);
        out.push({ id, name, kind, paint, box: [r.left + off[0], r.top + off[1], r.width, r.height], opacity: effOpacity(e), shown: vis !== null, clipped: !!vis && (vis.width < full.width - 1 || vis.height < full.height - 1), over: kind === "ring" ? [] : covered(r, e), text: paint === "use" ? undefined : e.textContent?.trim(), ...extra });
      };
      const roles: [string, string][] = [
        [".vplateName", "plate-name"], [".vplateNote", "plate-note"], [".vnum", "node-number"], [".vcallout", "callout"],
        ["#mapLanes .vchipNum", "chip-number"], ["#mapLanes .vchipName", "chip-name"],
        ["#mapSeason", "hud-season"], ["#mapTitle", "hud-title"], ["#mapStamps", "hud-stamps"], ["#mapStampsOf", "hud-stamps-of"], ["#mapStars", "hud-stars"], ["#mapStarsOf", "hud-stars-of"],
        ["#board text", "board-badge-number"],
      ];
      const roleOf = (e: Element) => roles.find(([sel]) => e.matches(sel))?.[1];
      const rootSel = view === "board" ? "#gameView" : "#mapView";
      const root = document.querySelector(rootSel)!;
      // 1. every painted text: any element with text of its own
      for (const e of root.querySelectorAll("*")) {
        if (!painted(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) continue;
        if (["script", "style", "title", "desc"].includes(e.tagName.toLowerCase())) continue; // not painted
        const svg = e instanceof SVGElement;
        const cls = (e.getAttribute("class") ?? "").split(" ")[0];
        const where = (e.parentElement?.getAttribute("class") ?? e.parentElement?.tagName ?? "").split(" ")[0];
        add(roleOf(e) ?? `text:${svg ? "svg-" : ""}${e.tagName.toLowerCase()}${cls ? "." + cls : ""} in ${where} "${(e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28)}"`, "text", svg ? "fill" : "color", e);
      }
      // 2. every icon (a use of a sprite that is not art), by what it is and where
      const ctx = (e: Element) => { for (let p = e.parentElement; p; p = p.parentElement) { if (p.tagName.toLowerCase() === "svg" && !p.getAttribute("class") && !p.id) continue; const c = (p.getAttribute("class") ?? "").split(" ")[0]; if (c || p.id) return c || "#" + p.id; } return "page"; };
      for (const e of root.querySelectorAll("use")) {
        const href = e.getAttribute("href") ?? "";
        if (!painted(e) || art.test(href) || e.closest("#mapPip")) continue;
        // named by what the icon is (its role), not by the exact sprite, so a variant of a sprite (a rimmed star, the HUD check) is still that icon
        const sym = href.slice(1);
        const role = /^rbStar(Rim)?$/.test(sym) ? "star" : /^rbStarOff(Rim)?$/.test(sym) ? "star-off" : /^icoCheck(Hud|Rim)?$/.test(sym) ? "check" : sym;
        const name = e.closest(".vcount") ? (role === "check" ? "hud-icon-stamp" : "hud-icon-star")
          : e.closest(".vstars") ? (role === "star" ? "star-gold" : "star-empty")
          : e.closest(".vchipNum") ? "chip-lock"
          : e.closest("#board") && role === "icoLock" ? "board-lock"
          : e.closest("#board") && role === "check" ? "board-check"
          : e.closest(".vchip") ? `lane-chip-${role}`
          : e.closest("#mapPanel") ? `lane-panel-${role}`
          : `icon:${role} in ${ctx(e)}`;
        add(name, "icon", "use", e);
      }
      // 3. the map's own shapes and the ring
      if (view !== "board") {
        const S = "#villageSvg ";
        const q = (sel: string) => [...root.querySelectorAll(S + sel)].filter(painted); // an element that is not painted at all (display none) is not there
        for (const e of q('.vnode.done path[d^="M-9 0"]')) add("node-check", "icon", "stroke", e);
        for (const e of q(".vnode.locked rect")) add("node-lock", "icon", "fill", e);
        for (const e of q(".vnode.locked path")) add("node-lock", "icon", "stroke", e);
        for (const e of q(".vring")) {
          const c = e.querySelectorAll("circle");
          const cr = c[0].getBoundingClientRect();
          const sc = (document.querySelector("#villageSvg") as Element).getBoundingClientRect().width / 1000;
          const half = 40 * sc;
          const box = new DOMRect(cr.left + cr.width / 2 - half, cr.top + cr.height / 2 - half, 2 * half, 2 * half);
          add("ring", "ring", "stroke", c[0], "A", box, { ring: { cx: cr.left + off[0] + cr.width / 2, cy: cr.top + off[1] + cr.height / 2, scale: sc } });
          c[1].setAttribute("data-ctid", "ring-dash");
          c[1].setAttribute("data-ctpaint", "stroke");
          c[1].setAttribute("data-ctgrp", "B");
        }
      }
      return out;
    },
    { view, ART: String(ART) },
  );
}

const CTCSS = (() => {
  const set = (mode: string, grp: string, c: string) =>
    `html[data-ct="${mode}"] [data-ctgrp="${grp}"][data-ctpaint="color"]{color:${c}!important}` +
    `html[data-ct="${mode}"] [data-ctgrp="${grp}"][data-ctpaint="fill"]{fill:${c}!important}` +
    `html[data-ct="${mode}"] [data-ctgrp="${grp}"][data-ctpaint="stroke"]{stroke:${c}!important}`;
  return (
    'html[data-ct="H"] [data-ctid][data-ctpaint="color"]{color:transparent!important}html[data-ct="H"] [data-ctid][data-ctpaint="fill"]{fill:transparent!important}' +
    'html[data-ct="H"] [data-ctid][data-ctpaint="stroke"]{stroke:transparent!important}html[data-ct="H"] [data-ctid][data-ctpaint="use"]{visibility:hidden!important}' +
    set("BA", "A", "#000") + set("WA", "A", "#fff") +
    'html[data-ct="D"] [data-ctgrp="B"][data-ctpaint="stroke"]{stroke:transparent!important}' + // D: only the ring's dashes hidden
    'html[data-ct="R"] [data-ctgrp="B"][data-ctpaint="stroke"]{stroke:#000!important}' // R: only the ring's dashes forced to solid black (the expected dash pattern)
  );
})();

/** Render the page in a mode: V as painted, H targets hidden, BA/WA targets black/white, D only the ring's dashes hidden, R only the ring's dashes forced black. */
async function render(page: Page, mode: "V" | "H" | "BA" | "WA" | "D" | "R") {
  await page.evaluate((mode) => {
    document.documentElement.dataset.ct = mode;
    // sprites cannot be recoloured by CSS: `use` icons point at a solid-colour clone of their symbol while black or white
    const colour = mode.startsWith("B") ? "#000" : mode.startsWith("W") ? "#fff" : null;
    const grp = mode.endsWith("A") ? "A" : null;
    for (const u of document.querySelectorAll<SVGUseElement>("use[data-ctid]")) {
      const orig = u.getAttribute("data-ctorig") ?? u.getAttribute("href")!;
      u.setAttribute("data-ctorig", orig);
      if (!colour || u.getAttribute("data-ctgrp") !== grp) { u.setAttribute("href", orig); continue; }
      const cid = `ct-${colour.slice(1)}-${orig.slice(1)}`;
      if (!document.getElementById(cid)) {
        const src = document.querySelector(orig)!;
        const clone = src.cloneNode(true) as Element;
        clone.id = cid;
        for (const el of [clone, ...clone.querySelectorAll("*")]) {
          const tag = el.tagName.toLowerCase();
          if (["path", "rect", "circle", "ellipse", "polygon", "line", "polyline", "text"].includes(tag)) {
            if (el.getAttribute("fill") !== "none") el.setAttribute("fill", colour);
            if (el.hasAttribute("stroke") && el.getAttribute("stroke") !== "none") el.setAttribute("stroke", colour);
          } else {
            // a group's own fill or stroke is inherited by its shapes, so it is recoloured too (the sunflower's outline is a group stroke)
            if (el.hasAttribute("fill") && el.getAttribute("fill") !== "none") el.setAttribute("fill", colour);
            if (el.hasAttribute("stroke") && el.getAttribute("stroke") !== "none") el.setAttribute("stroke", colour);
          }
        }
        let host: Element | null = document.getElementById("ct-defs");
        if (!host) {
          host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          host.id = "ct-defs";
          host.setAttribute("width", "0");
          host.setAttribute("height", "0");
          host.setAttribute("style", "position:absolute");
          document.body.appendChild(host);
        }
        host.appendChild(clone);
      }
      u.setAttribute("href", `#${cid}`);
    }
  }, mode);
}

type Result = { ratio: number; why?: string; note?: string };

/** Mutation proofs for the ring: damage ONE dash (the first) in the V render only. "faint" leaves it at 12% opacity, "gone" makes it fully transparent. */
type RingMutation = "faint" | "gone";
function ringMutation(mode: RingMutation | "undo") {
  for (const c of document.querySelectorAll("[data-ctmut]")) c.remove();
  for (const c of document.querySelectorAll("[data-ctorigdash]")) { c.setAttribute("stroke-dasharray", c.getAttribute("data-ctorigdash")!); c.removeAttribute("data-ctorigdash"); }
  if (mode === "undo") return;
  for (const g of document.querySelectorAll(".vring")) {
    const dash = g.querySelectorAll("circle")[1];
    const [a, b] = dash.getAttribute("stroke-dasharray")!.split(/[ ,]+/).map(Number);
    const circ = 2 * Math.PI * Number(dash.getAttribute("r"));
    dash.setAttribute("data-ctorigdash", dash.getAttribute("stroke-dasharray")!);
    // every dash but the first, as an explicit list (the first dash has length 0)
    dash.setAttribute("stroke-dasharray", ["0", String(a + b), ...Array.from({ length: Math.ceil(circ / (a + b)) }, () => `${a} ${b}`)].join(" "));
    // the first dash alone, damaged: a copy of the dash circle (not a target) dashed once
    const one = dash.cloneNode() as Element;
    for (const k of ["data-ctid", "data-ctpaint", "data-ctgrp", "data-ctorigdash"]) one.removeAttribute(k);
    one.setAttribute("data-ctmut", "1");
    one.setAttribute("stroke-dasharray", `${a} ${circ}`);
    one.setAttribute("stroke-opacity", mode === "faint" ? "0.12" : "0");
    dash.after(one);
  }
}

/** Analyse every target of a view from the six renders; returns a result per target id. */
async function analyse(page: Page, view: string, wanted: Set<string>, mutate?: RingMutation): Promise<Record<string, Result>> {
  // Capture at a viewport as tall as the page, then take every box and every render in that one layout (a full-page capture re-lays the page
  // out, which can move a scroll strip's content away from boxes measured in the phone's own viewport).
  const orig = page.viewportSize()!;
  let h = orig.height;
  for (let i = 0; i < 4; i++) {
    await page.setViewportSize({ width: orig.width, height: h });
    await page.waitForTimeout(150);
    const sh = await page.evaluate(() => document.documentElement.scrollHeight);
    if (sh <= h) break;
    h = sh;
  }
  await untag(page);
  const targets = (await discover(page, view)).filter((t) => wanted.has(t.id) && t.shown && t.name !== "ring-dash"); // boxes taken now, at the scroll position every render below uses
  const tag = await page.addStyleTag({ content: CTCSS });
  const png: Record<string, string> = {};
  const dbg = async (m: string) => { if (process.env.CT_DBG) console.error(m, await page.evaluate(() => (document.querySelector("#plist") as HTMLElement | null)?.scrollLeft)); };
  await dbg("start");
  // every render must be taken at the scroll positions the targets were measured at: remember them, and put them back before each
  await page.evaluate(() => { (window as unknown as { __ct: [Element, number, number][] }).__ct = [...document.querySelectorAll("*")].filter((e) => e.scrollLeft || e.scrollTop).map((e) => [e, e.scrollLeft, e.scrollTop]); });
  for (const m of ["V", "H", "BA", "WA", "D", "R"] as const) {
    await render(page, m);
    if (m === "V" && mutate) await page.evaluate(ringMutation, mutate as RingMutation | "undo"); // a proof that the check fails: only the V render is damaged, the reference renders are not
    await page.evaluate(() => { for (const [e, l, t] of (window as unknown as { __ct: [Element, number, number][] }).__ct) { e.scrollLeft = l; e.scrollTop = t; } });
    await dbg("before " + m);
    png[m] = (await page.screenshot({ animations: "disabled" })).toString("base64");
    if (m === "V" && mutate) await page.evaluate(ringMutation, "undo" as RingMutation | "undo");
  }
  await dbg("end");
  if (process.env.CT_V && targets.some((t) => t.name === "text:b in tx" && t.id.endsWith("#2"))) (await import("node:fs")).writeFileSync(process.env.CT_V, Buffer.from(png.V, "base64"));
  await page.evaluate(() => {
    delete document.documentElement.dataset.ct;
    for (const u of document.querySelectorAll("use[data-ctorig]")) u.setAttribute("href", u.getAttribute("data-ctorig")!);
  });
  await tag.evaluate((e) => (e as Element).remove());
  await page.setViewportSize(orig);
  return page.evaluate(
    async ({ png, targets, MIN_PIXELS }) => {
      const dec = async (b64: string) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        return { d: g.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
      };
      const I: Record<string, { d: Uint8ClampedArray; w: number; h: number }> = {};
      for (const k of Object.keys(png)) I[k] = await dec(png[k]);
      const { w: IW, h: IH } = I.V;
      const scale = IW / document.documentElement.scrollWidth;
      const lin = (u: number) => ((u /= 255) <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
      const L = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = (name: string, x: number, y: number) => { const o = (y * IW + x) * 4, d = I[name].d; return [d[o], d[o + 1], d[o + 2]]; };
      /** Coverage by a group's paint at a pixel, from its black and white renders, and the unblended colour. */
      const cover = (grp: "A" | "B", x: number, y: number, op = 1) => {
        const b = px("B" + grp, x, y), w = px("W" + grp, x, y);
        const a = Math.min(1, Math.max(0, (w[0] - b[0] + (w[1] - b[1]) + (w[2] - b[2])) / (3 * 255 * op)));
        const v = px("V", x, y);
        // f: the element's own colour here: the pixel itself where coverage is full, else unblended from the black render (v = b + a f)
        return { a, v, f: a >= 0.98 ? v : v.map((c, i) => Math.max(0, Math.min(255, (c - b[i]) / (a * op)))) };
      };
      /** Worst contrast of a colour's luminance against the hidden render within 1px of a pixel. */
      const against = (l: number, x: number, y: number) => {
        let worst = Infinity;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= IW || ny >= IH) continue;
          worst = Math.min(worst, ratio(l, L(px("H", nx, ny))));
        }
        return worst;
      };
      const out: Record<string, { ratio: number; why?: string; note?: string }> = {};
      for (const t of targets as Target[]) {
        const fail = (why: string) => (out[t.id] = { ratio: 0, why });
        if (t.box[2] < 1 || t.box[3] < 1) { fail("zero-size"); continue; }
        if (!t.shown) { fail("clipped or hidden"); continue; }
        const x0 = Math.max(0, Math.floor(t.box[0] * scale) - 2), y0 = Math.max(0, Math.floor(t.box[1] * scale) - 2);
        const x1 = Math.min(IW, Math.ceil((t.box[0] + t.box[2]) * scale) + 2), y1 = Math.min(IH, Math.ceil((t.box[1] + t.box[3]) * scale) + 2);
        if (!t.ring) {
          // The painted region is every pixel the target covers at all (coverage >= 0.1: a dimmed or partly faded target still covers it).
          // Edge pixels are blends with the background by geometry, not by the target's colour: a pixel is an edge pixel when a pixel next
          // to it (within 2px) is covered clearly more (its coverage is under 90% of the local best). Every other pixel of the region is
          // measured, as painted (V), against the background beside and under it (H); none is skipped for being faint and none may fail.
          // A faded stretch of a glyph is faint all over, so it is not an edge and is measured.
          const W = x1 - x0, Hh = y1 - y0;
          const cov = new Float32Array(W * Hh);
          let region = 0;
          for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const a = cover("A", x0 + x, y0 + y, t.opacity).a; cov[y * W + x] = a; if (a >= 0.1) region++; }
          if (t.clipped && region < MIN_PIXELS) { out[t.id] = { ratio: 1e9, note: "clipped away, nothing painted" }; continue; } // cut off by its container: not visible, so no contrast to judge
          if (region < MIN_PIXELS) { fail(`painted by ${region} pixels (under ${MIN_PIXELS})`); continue; }
          const isEdge = (x: number, y: number) => { // an anti-aliased edge pixel: covered clearly less than a pixel next to it
            const a = cov[y * W + x];
            let local = a;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < Hh) local = Math.max(local, cov[ny * W + nx]); }
            return a < 0.97 * local;
          };
          const rs: number[] = [];
          if (t.kind === "text") {
            // text: every pixel of the region that is not an edge pixel, against the background beside and under it, none allowed to fail
            for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
              if (cov[y * W + x] < 0.1 || isEdge(x, y)) continue;
              rs.push(against(L(px("V", x0 + x, y0 + y)), x0 + x, y0 + y));
            }
          } else {
            // icons (WCAG 1.4.11, non-text contrast: the graphic against its adjacent colours): the outer boundary of the painted region, a
            // band 2px wide inside its edge, every pixel of it against the ground just outside the region (within 4px). The interior (a gold
            // fill inside a dark rim) is not measured against the ground. A faded stretch of the edge is faint all over, so it is not an
            // anti-aliased edge and is measured; a gap in a rim leaves the fill's own edge as the boundary, which is measured too.
            const outside = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= Hh || cov[y * W + x] < 0.1;
            for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
              if (cov[y * W + x] < 0.1 || isEdge(x, y)) continue;
              let near = false;
              for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (outside(x + dx, y + dy)) { near = true; break; }
              if (!near) continue; // interior
              const l = L(px("V", x0 + x, y0 + y));
              let g = Infinity;
              for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (outside(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < Hh) g = Math.min(g, ratio(l, L(px("H", x0 + x + dx, y0 + y + dy))));
              if (g !== Infinity) rs.push(g);
            }
          }
          if (rs.length < MIN_PIXELS) { fail(`only ${rs.length} measurable pixels in a region of ${region}`); continue; }
          out[t.id] = { ratio: Math.min(...rs) };
          continue;
        }
        // The ring. The expected dash pattern does not come from the render under test: the ring is rendered once more (R) with its dashes
        // forced to solid black, and each pixel's coverage by a dash is how much darker R is than D (dashes hidden). A pixel is part of a
        // dash when it is covered at all (0.1 or more) and is not a partly covered edge pixel (the text check's local rule: covered clearly
        // less than a neighbour within 2px). A bin (120 of 3 degrees) is an expected dash bin when it has at least 2 such pixels. Then, on
        // the real render, every expected dash bin is measured on those same pixels, as rendered (V for the dash, D for the halo; the open
        // node's pulse tints both): its dash against its halo, 3:1; and the better of its dash and its halo against the ground beside it
        // (H), 3:1. A missing or faint segment has no colour of its own against the halo, so it fails; there is no global threshold and no
        // gap tolerance.
        const rg = t.ring;
        const BINS = 120, T = 60; // T: a colour difference (sum of the channels) that counts as halo
        const sum = (n: string, x: number, y: number) => { const c = px(n, x, y); return c[0] + c[1] + c[2]; };
        const W = x1 - x0, Hh = y1 - y0;
        const binOf = (x: number, y: number) => {
          const r = Math.hypot(x / scale - rg.cx, y / scale - rg.cy) / rg.scale;
          return r < 28 || r > 38 ? -1 : Math.min(BINS - 1, Math.floor(((Math.atan2(y / scale - rg.cy, x / scale - rg.cx) + Math.PI) / (2 * Math.PI)) * BINS));
        };
        const rc = new Float32Array(W * Hh); // coverage by a dash, from R against D
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
          if (binOf(x0 + x, y0 + y) < 0) continue;
          const d = sum("D", x0 + x, y0 + y);
          rc[y * W + x] = d >= 30 ? Math.min(1, Math.max(0, (d - sum("R", x0 + x, y0 + y)) / d)) : 0;
        }
        const isEdge = (x: number, y: number) => {
          let local = rc[y * W + x];
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < Hh) local = Math.max(local, rc[ny * W + nx]); }
          return rc[y * W + x] < 0.97 * local;
        };
        type P = { x: number; y: number };
        const dash: P[][] = Array.from({ length: BINS }, () => []), halo: P[][] = Array.from({ length: BINS }, () => []);
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
          const bin = binOf(x0 + x, y0 + y);
          if (bin < 0) continue;
          if (rc[y * W + x] >= 0.1) { if (!isEdge(x, y)) dash[bin].push({ x: x0 + x, y: y0 + y }); }
          else if (Math.abs(px("D", x0 + x, y0 + y)[0] - px("H", x0 + x, y0 + y)[0]) + Math.abs(px("D", x0 + x, y0 + y)[1] - px("H", x0 + x, y0 + y)[1]) + Math.abs(px("D", x0 + x, y0 + y)[2] - px("H", x0 + x, y0 + y)[2]) >= T) halo[bin].push({ x: x0 + x, y: y0 + y });
        }
        const isD = dash.map((b) => b.length >= 2);
        const nExpected = isD.filter(Boolean).length;
        const nH = halo.reduce((n, b) => n + b.length, 0);
        if (nExpected < 16 || nH < MIN_PIXELS) { fail(`the ring's expected dash pattern was not found (${nExpected} dash bins, ${nH} halo pixels)`); continue; }
        const med = (cs: number[][]) => [0, 1, 2].map((i) => cs.map((c) => c[i]).sort((p, q) => p - q)[cs.length >> 1]);
        let worst = Infinity;
        for (let k = 0; k < BINS; k++) {
          if (!isD[k]) continue;
          const dl = L(med(dash[k].map((p) => px("V", p.x, p.y))));
          const hSrc = halo[k].length ? halo[k] : dash[k]; // a bin whose halo is all under dashes: the halo is what D shows there
          const hl = L(med(hSrc.map((p) => px("D", p.x, p.y))));
          const i = ratio(dl, hl);
          const gd = Math.min(...dash[k].map((p) => against(dl, p.x, p.y)));
          const gh = Math.min(...hSrc.map((p) => against(hl, p.x, p.y)));
          worst = Math.min(worst, i, Math.max(gd, gh));
        }
        out[t.id] = { ratio: worst };
      }
      return out;
    },
    { png, targets, MIN_PIXELS },
  );
}

const untag = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-ctid]").forEach((e) => ["data-ctid", "data-ctpaint", "data-ctgrp"].forEach((a) => e.removeAttribute(a))));

/** Measure every target of a view, scrolling clipped ones into view; one row per target. */
async function measureView(page: Page, view: string, season: string): Promise<Row[]> {
  const rows = new Map<string, Row>();
  let targets = await discover(page, view);
  for (let round = 0; round < 60; round++) {
    const todo = targets.filter((t) => !rows.has(t.id) && t.shown && t.name !== "ring-dash");
    if (todo.length) {
      const res = await analyse(page, view, new Set(todo.map((t) => t.id)));
      for (const t of todo.filter((t) => res[t.id])) rows.set(t.id, { season, view, name: t.name, id: t.id, kind: t.kind, ratio: res[t.id].ratio, why: res[t.id].why, note: res[t.id].note, over: t.over });
    }
    const left = targets.find((t) => !rows.has(t.id));
    if (!left) break;
    await page.evaluate((id) => {
      // bring it into view: scroll every clipping ancestor (a sideways strip of chips or satchel items) just far enough
      const e = [...document.querySelectorAll("[data-ctid]")].find((x) => x.getAttribute("data-ctid") === id); // (ids carry quotes: not a selector)
      for (let p = e?.parentElement; p && e; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.overflowX === "visible" && st.overflowY === "visible") continue;
        (p as HTMLElement).style.scrollSnapType = "none"; // so a snap point cannot undo the scroll
        (p as HTMLElement).style.scrollBehavior = "auto"; // and it lands at once: every render below is taken at the same scroll position
        const r = e.getBoundingClientRect(), q = p.getBoundingClientRect();
        // centre it in the container (strips fade out at their edges), when it is clipped
        if (r.left < q.left || r.right > q.right) p.scrollLeft += r.left + r.width / 2 - (q.left + q.width / 2);
        if (r.top < q.top || r.bottom > q.bottom) p.scrollTop += r.top + r.height / 2 - (q.top + q.height / 2);
      }
    }, left.id);
    await page.waitForTimeout(400); // let the scroll settle and repaint before anything is measured
    await untag(page);
    targets = await discover(page, view);
    if (!targets.some((t) => !rows.has(t.id) && t.shown)) break;
  }
  // what is still out of reach is cut off by a container that cannot scroll it into view: not painted, so no contrast to judge (listed)
  for (const t of targets) if (!rows.has(t.id)) rows.set(t.id, { season, view, name: t.name, id: t.id, kind: t.kind, ratio: 1e9, note: "cut off by its container, never in view" });
  await untag(page);
  return [...rows.values()];
}

const setSeason = (page: Page, s: string) =>
  page.evaluate(async (s) => {
    document.querySelector(".wrap")!.parentElement!.dataset.season = s;
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, s);

async function newGameToMap(page: Page) {
  await page.goto("/");
  await expect(page.locator("html"), "the served build is the standard pack").toHaveAttribute("data-pack", "standard");
  await page.evaluate(() => localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true })));
  await page.reload();
  await page.locator("#titleNew").tap();
  await page.locator("#letterView").waitFor();
  await page.locator('#letterView [data-letter="skip"]').tap();
  await page.locator('#letterView [data-letter="next"]').tap();
  await page.locator("#letterView").waitFor({ state: "detached" });
  return page.locator("#mapLanes .vchip").evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.lane!));
}

/**
 * A board state that shows both a lock and a check, worked out from the route data and the engine, not from the page: the last spring
 * route with its satchel in the solution order; after the solution's first delivery the signed letter's gate is still latched, so the
 * board has a check on the delivered house and a lock on the signed letter's. `moves` are played up to that point.
 */
const lockedSigned = (L: (typeof SPRING)[number], order: readonly number[], delivered: number) => {
  const got = new Set(order.slice(0, delivered));
  return L.parcels.filter((p, k) => p.kind === "signed" && !got.has(k) && ![...got].some((g) => L.parcels[g].to === p.key)).length; // a signed letter waits for its key holder's post
};
function boardPlan() {
  const L = SPRING.find((r) => r.id === "lastround")!;
  const P = parse(L);
  const order = L.solution.order;
  const start = defaultOrder(L);
  let v = P.init.slice();
  let delivered = 0;
  const moves: typeof L.solution.moves = [];
  for (const m of L.solution.moves) {
    v = apply(P, v, m);
    moves.push(m);
    delivered += deliverChain(P, v, order, delivered).length;
    if (delivered > 0 && lockedSigned(L, order, delivered) > 0) break;
  }
  const locks = lockedSigned(L, order, delivered);
  return { L, P, start, order, moves, checks: delivered, locks, badges: L.parcels.length - delivered };
}

/** Play moves with the keyboard (arrows move the cursor, R and Q turn, Shift+arrow slides): the cursor starts on the post office, and the first arrow moves it. */
async function playMoves(page: Page, plan: ReturnType<typeof boardPlan>) {
  const w = plan.P.w, h = plan.P.h;
  let cx = plan.P.bld.P % w, cy = Math.floor(plan.P.bld.P / w);
  const key = async (k: string) => { await page.keyboard.press(k); await page.waitForTimeout(60); };
  await page.locator("#board").focus();
  await key("ArrowUp"); // the first arrow selects the post office, then moves up
  cy = Math.max(0, cy - 1);
  const go = async (tx: number, ty: number) => {
    while (cx < tx) { await key("ArrowRight"); cx++; }
    while (cx > tx) { await key("ArrowLeft"); cx--; }
    while (cy < ty) { await key("ArrowDown"); cy++; }
    while (cy > ty) { await key("ArrowUp"); cy--; }
  };
  for (const m of plan.moves) {
    if (m.t === "r") { await go(m.i % w, Math.floor(m.i / w)); await key(m.d > 0 ? "r" : "q"); }
    else if (m.t === "row") { await go(cx, m.y); await key(m.d > 0 ? "Shift+ArrowRight" : "Shift+ArrowLeft"); }
    else { await go(m.x, cy); await key(m.d > 0 ? "Shift+ArrowDown" : "Shift+ArrowUp"); }
    await page.waitForTimeout(300);
  }
  void h;
  await page.waitForTimeout(3000); // the walk to the first house
}

/** What a board must show: a number badge per undelivered parcel, a check per delivered, a lock per latched signed letter. */
type BoardCounts = { badges: number; checks: number; locks: number };
type State = { lanes: number; done: number; stars: number };
const HUD: Record<string, string> = { "hud-season": "mapSeason", "hud-title": "mapTitle", "hud-stamps": "mapStamps", "hud-stamps-of": "mapStampsOf", "hud-stars": "mapStars", "hud-stars-of": "mapStarsOf" };

/** What a view must contain, from the seeded state and the page's own lists (never from the targets): counts per role, and HUD text. */
async function expectedSet(page: Page, view: string, state: State | null, plan: BoardCounts | null): Promise<{ counts: Record<string, number>; texts: Record<string, string> }> {
  const lists = await page.evaluate((HUD) => ({
    hudShown: Object.fromEntries(Object.entries(HUD).map(([k, id]) => [k, !!document.getElementById(id) && getComputedStyle(document.getElementById(id)!).display !== "none"])),
    seasons: document.querySelectorAll("#mapSeasons li").length,
    current: [...document.querySelectorAll("#mapSeasons li")].findIndex((li) => li.querySelector("b")?.textContent === document.getElementById("mapTitle")?.textContent),
  }), HUD);
  if (view === "board") {
    if (!plan) throw new Error("the board needs its plan");
    // from the route data and the engine: a number badge for each parcel still to deliver, a check for each delivered, a lock for each latched signed letter
    return { counts: { "board-badge-number": plan.badges, "board-check": plan.checks, "board-lock": plan.locks }, texts: {} };
  }
  const ahead = lists.seasons - 1 - lists.current; // villages after the one shown, from the page's own season list
  const counts: Record<string, number> = { "plate-name": ahead, "plate-note": ahead, "hud-season": 1, "hud-title": 1 };
  const texts: Record<string, string> =
    view === "hollowmere" ? { "hud-season": "Summer", "hud-title": "Hollowmere" } : view === "conker" ? { "hud-season": "Autumn", "hud-title": "Conker Corner" } : view === "snowberry" ? { "hud-season": "Winter", "hud-title": "Snowberry End" } : { "hud-season": "Spring", "hud-title": "Thistledown" };
  if (view === "thistledown" && state) {
    const open = 1, locked = state.lanes - state.done - open;
    Object.assign(counts, {
      "node-number": open, callout: 1, "node-check": state.done, ring: 1, "node-lock": locked * 2,
      "chip-number": state.done + open, "chip-name": state.lanes, "chip-lock": locked,
      "hud-stamps": 1, "hud-stamps-of": +lists.hudShown["hud-stamps-of"], "hud-stars": 1, "hud-stars-of": +lists.hudShown["hud-stars-of"], "hud-icon-stamp": 1, "hud-icon-star": 1, // the "/ N" texts are hidden on narrow screens (styles decide, not the targets)
      "star-gold": state.stars, "star-empty": state.done * 3 - state.stars,
    });
    Object.assign(texts, { "hud-stamps": String(state.done), "hud-stamps-of": `/ ${state.lanes} stamps`, "hud-stars": String(state.stars), "hud-stars-of": `/ ${state.lanes * 3} stars` });
  }
  return { counts, texts };
}

async function checkView(page: Page, view: string, season: string, state: State | null, plan: BoardCounts | null, all: Row[], over: Set<string>) {
  const rows = await measureView(page, view, season);
  const { counts, texts } = await expectedSet(page, view, state, plan);
  const bad = (name: string, why: string) => all.push({ season, view, name, id: `${name}:expected`, kind: "text", ratio: 0, why });
  for (const [name, n] of Object.entries(counts)) {
    const have = rows.filter((r) => r.name === name && !r.note).length; // a target cut off by its container does not count as present
    if (have !== n) bad(name, `found ${have}, expected ${n}`);
  }
  for (const [name, text] of Object.entries(texts)) {
    const have = await page.evaluate((id) => document.getElementById(id)?.textContent?.trim(), HUD[name]);
    if (have !== text) bad(name, `text "${have}", expected "${text}"`);
  }
  for (const r of rows) {
    all.push(r);
    if (r.over?.length) over.add(`${view} ${r.id.replace(/#\d+$/, "")} covered by ${r.over.join("+")}`);
  }
}

test("rendered callout coverage: empty space passes, painted pill and tail overlaps fail", async ({ page }) => {
  // The production autumn route-1 layout has a lock in the group's empty union-box corner. Seed only prior-route progress.
  await page.addInitScript((ids) => {
    localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: Object.fromEntries(ids.map((id) => [id, { stars: 2, moves: 99 }])) }));
    localStorage.setItem("bramblepost-ending-v1", JSON.stringify({ seen: true }));
    localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown", "hollowmere", "conker"] }));
    localStorage.setItem("bramblepost-current-village-v1", JSON.stringify({ id: "conker", visited: ["thistledown", "hollowmere", "conker"] }));
    localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true }));
  }, [...SPRING, ...SUMMER].map((r) => r.id));
  await page.goto("/");
  await expect(page.locator("html"), "the served build is the standard pack").toHaveAttribute("data-pack", "standard");
  await page.locator("#titleContinue").tap();
  await expect(page.locator("#mapTitle")).toHaveText("Conker Corner");
  await page.locator("#villageSvg").scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);

  const targets = await discover(page, "conker");
  const emptyCorner = await page.evaluate(() => {
    const q = document.querySelector(".vtoday")!.getBoundingClientRect();
    return [...document.querySelectorAll(".vnode.locked rect, .vnode.locked path")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
    }).map((e) => e.getAttribute("data-ctid")!);
  });
  expect(emptyCorner, "the original whole-group detector would flag both parts of a lock").toHaveLength(2);
  expect(targets.filter((t) => t.over.includes("callout")), "no actual map target touches callout paint").toEqual([]);
  const id = emptyCorner.find((id) => targets.find((t) => t.id === id)?.paint === "fill")!;

  // Move that same real lock under each part of the callout, and into the empty corner of the tail's own bounding box.
  // These mutations exercise discover() itself, including its raster mask, with the production DOM and device transform.
  for (const location of ["tail-empty", "pill", "tail", "pip"] as const) {
    const original = await page.evaluate(({ id, location }) => {
      const e = [...document.querySelectorAll<SVGGraphicsElement>("[data-ctid]")].find((e) => e.getAttribute("data-ctid") === id)!;
      const node = e.closest<SVGGElement>(".vnode")!;
      const original = node.getAttribute("transform")!;
      const callout = document.querySelector<SVGGElement>(".vtoday")!;
      const pill = callout.querySelector("rect")!, tail = callout.querySelector("path")!;
      const box = tail.getBBox();
      let point: DOMPoint;
      if (location === "pill") point = new DOMPoint(pill.x.baseVal.value + pill.width.baseVal.value / 2, pill.y.baseVal.value + pill.height.baseVal.value / 2);
      else if (location === "tail-empty") point = new DOMPoint(box.x + box.width * 0.12, box.y + box.height * 0.12);
      else {
        const p = tail.getAttribute("d")!.match(/-?\d*\.?\d+/g)!.map(Number);
        if (p.length !== 6) throw new Error("expected a triangular callout tail");
        point = new DOMPoint((p[0] + p[2] + p[4]) / 3, (p[1] + p[3] + p[5]) / 3);
        if (!tail.isPointInFill(point)) throw new Error("injection point must be inside painted tail");
      }
      point = point.matrixTransform(callout.getScreenCTM()!);
      if (location === "pip") {
        const q = document.querySelector("#mapPip")!.getBoundingClientRect();
        point = new DOMPoint(q.left + q.width / 2, q.top + q.height / 2);
      }
      const r = e.getBoundingClientRect(), inverse = (node.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!.inverse();
      const to = point.matrixTransform(inverse), from = new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(inverse);
      const m = node.transform.baseVal.consolidate()!.matrix;
      node.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e + to.x - from.x} ${m.f + to.y - from.y})`);
      return original;
    }, { id, location });
    const moved = (await discover(page, "conker")).find((t) => t.id === id)!;
    if (location === "tail-empty") expect(moved.over, "empty tail-box space must also pass").toEqual([]);
    else expect(moved.over, `a real ${location} overlap must fail the existing coverage assertion`).toContain(location === "pip" ? "pip" : "callout");
    await page.evaluate(({ id, original }) => {
      [...document.querySelectorAll("[data-ctid]")].find((e) => e.getAttribute("data-ctid") === id)!.closest(".vnode")!.setAttribute("transform", original);
    }, { id, original });
  }
});

test("rendered contrast: the maps and a board, in every season", async ({ page }, info) => {
  const seasonsOf = (k: Known) => (k.seasons === "all" ? (k.view === "hollowmere" ? ["summer"] : k.view === "conker" ? ["autumn"] : k.view === "snowberry" ? ["winter"] : [...SEASONS]) : k.seasons);
  const strict = process.platform === "linux"; // CI is the authority: the known/stale comparison is enforced only on the CI runner's platform
  const listed = new Set((KNOWN_FINDINGS[info.project.name] ?? []).flatMap((k) => seasonsOf(k).map((s) => `${k.view}|${s}|${k.name}`)));
  const keyOf = (r: Row) => `${r.view}|${r.season}|${r.name}`;
  test.setTimeout(600_000);
  const all: Row[] = [];
  const overlaps = new Set<string>();

  // Thistledown: two finished lanes (3 stars, 1 star), one open, the rest locked
  const ids = await newGameToMap(page);
  const state: State = { lanes: ids.length, done: 2, stars: 4 };
  await page.evaluate(
    (i) => {
      localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: { [i[0]]: { stars: 3, moves: 1 }, [i[1]]: { stars: 1, moves: 99 } } }));
      localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown", "hollowmere"] }));
    },
    ids,
  );
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator("#villageSvg .vnode.done").first().waitFor();
  expect(await page.evaluate(() => document.querySelector(".wrap")!.parentElement!.dataset.season)).toBe("spring");
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "thistledown", s, state, null, all, overlaps);
  }
  // The board: Hollow Lane (the fifth route, open once the first four are finished) with its satchel in the solution order, played to the
  // first delivery, so a check and a lock are both on the board
  const plan = boardPlan();
  expect([plan.checks > 0, plan.locks > 0], "a board state that shows both a check and a lock").toEqual([true, true]);
  const idx = ids.indexOf(plan.L.id);
  await page.evaluate((i) => localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: Object.fromEntries(i.map((id) => [id, { stars: 3, moves: 1 }])) })), ids.slice(0, idx)); // every route before it finished
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator(`#mapLanes .vchip[data-lane="${plan.L.id}"]`).tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  // the satchel into the solution order, with the "move earlier" arrows (bubble each wanted parcel up to its place)
  const cur = [...plan.start];
  for (let want = 0; want < plan.order.length; want++) {
    for (let pos = cur.indexOf(plan.order[want]); pos > want; pos--) {
      await page.locator(`#plist [data-up="${pos}"]`).tap();
      [cur[pos - 1], cur[pos]] = [cur[pos], cur[pos - 1]];
    }
  }
  await playMoves(page, plan);
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "board", s, null, plan, all, overlaps);
  }

  // Hollowmere: the actual summer map (every route finished and the ending seen, so the way in is open)
  await page.evaluate(
    (i) => {
      localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: Object.fromEntries(i.map((id) => [id, { stars: 2, moves: 99 }])) }));
      localStorage.setItem("bramblepost-ending-v1", JSON.stringify({ seen: true }));
    },
    ids,
  );
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator("#mapEnter").tap({ timeout: 8000 });
  await expect(page.locator("#mapTitle")).toHaveText("Hollowmere");
  expect(await page.evaluate(() => document.querySelector(".wrap")!.parentElement!.dataset.season)).toBe("summer");
  await page.evaluate(() => document.fonts.ready);
  await checkView(page, "hollowmere", "summer", null, null, all, overlaps);

  // A summer board (Hollowmere's first route, at its start, no moves played): it has a sunflower tile, measured as an icon (3:1) like
  // every other `use`d sprite that is not an illustration.
  const summer = SUMMER[0];
  expect(parse(summer).init.some((t) => t & SUN), "the summer route has a sunflower on its board").toBe(true);
  await page.locator(`#mapLanes .vchip[data-lane="${summer.id}"]`).tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  await expect(page.locator("#board .sun").first(), "the sunflower is on the board").toBeVisible();
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "board", s, null, { badges: summer.parcels.length, checks: 0, locks: 0 }, all, overlaps);
  }

  // Conker Corner: the actual autumn map with its ten real lanes (every spring and summer route finished and the ending seen, so the way in is open)
  await page.evaluate(
    (i) => {
      localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: Object.fromEntries(i.map((id) => [id, { stars: 2, moves: 99 }])) }));
      localStorage.setItem("bramblepost-ending-v1", JSON.stringify({ seen: true }));
      localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown", "hollowmere", "conker"] })); // no first-visit intro to dismiss
    },
    [...ids, ...SUMMER.map((r) => r.id)],
  );
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator("#mapEnter").tap({ timeout: 8000 }); // Continue reopens Hollowmere, whose gate to Conker Corner is now open
  await expect(page.locator("#mapTitle")).toHaveText("Conker Corner");
  expect(await page.evaluate(() => document.querySelector(".wrap")!.parentElement!.dataset.season)).toBe("autumn");
  await expect(page.locator("#mapLanes .vchip")).toHaveCount(AUTUMN.length);
  await page.evaluate(() => document.fonts.ready);
  await checkView(page, "conker", "autumn", null, null, all, overlaps);

  // An autumn board (Conker Corner's first route, at its start, no moves played), in every season
  const autumn = AUTUMN[0];
  await page.locator(`#mapLanes .vchip[data-lane="${autumn.id}"]`).tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "board", s, null, { badges: autumn.parcels.length, checks: 0, locks: 0 }, all, overlaps);
  }

  // Snowberry End: the actual winter map with its ten real lanes (every earlier route finished, so the way in from Conker Corner is open)
  await page.evaluate(
    (i) => {
      localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best: Object.fromEntries(i.map((id) => [id, { stars: 2, moves: 99 }])) }));
      localStorage.setItem("bramblepost-ending-v1", JSON.stringify({ seen: true }));
      localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown", "hollowmere", "conker", "snowberry"] })); // no first-visit intro to dismiss
    },
    [...ids, ...SUMMER.map((r) => r.id), ...AUTUMN.map((r) => r.id)],
  );
  await page.reload();
  await page.locator("#titleContinue").tap();
  await expect(page.locator("#mapTitle")).toHaveText("Conker Corner"); // Continue reopens the village last shown, whose gate to Snowberry End is now open
  await page.locator("#mapEnter").tap({ timeout: 8000 });
  await expect(page.locator("#mapTitle")).toHaveText("Snowberry End");
  expect(await page.evaluate(() => document.querySelector(".wrap")!.parentElement!.dataset.season)).toBe("winter");
  await expect(page.locator("#mapLanes .vchip")).toHaveCount(WINTER.length);
  await page.evaluate(() => document.fonts.ready);
  await checkView(page, "snowberry", "winter", null, null, all, overlaps);

  // A winter board (Snowberry End's first route, at its start, no moves played), in every season
  const winter = WINTER[0];
  await page.locator(`#mapLanes .vchip[data-lane="${winter.id}"]`).tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "board", s, null, { badges: winter.parcels.length, checks: 0, locks: 0 }, all, overlaps);
  }

  // report: ids and ratios only
  const low = (r: Row) => r.ratio < NEED[r.kind];
  const known = (r: Row) => !r.why && low(r) && listed.has(keyOf(r));
  const fails = all.filter((r) => (r.why || (strict && low(r))) && !known(r)); // off Linux a low ratio is printed, not failed
  const stillFailing = new Set(all.filter(known).map(keyOf));
  const nowPassing = [...listed].filter((k) => !stillFailing.has(k)); // listed for this element and season but no longer below AA (or no longer found)
  if (process.env.CT_JSON || process.env.CI) console.log("CTJSON " + JSON.stringify({ project: info.project.name, rows: all.filter((r) => !r.why && !r.note && low(r)).map((r) => ({ season: r.season, view: r.view, name: r.name, ratio: Math.round(r.ratio * 1000) / 1000 })) }));
  const byType = new Map<string, number[]>();
  for (const r of all) {
    if (r.why || r.note || known(r)) continue;
    const key = `${r.view} ${r.name} (${r.kind})`;
    const m = byType.get(key) ?? SEASONS.map(() => Infinity);
    const k = SEASONS.indexOf(r.season as (typeof SEASONS)[number]);
    m[k] = Math.min(m[k], r.ratio);
    byType.set(key, m);
  }
  const lines = [`[${info.project.name}] lowest pixel of every element, by element type, ${SEASONS.join(" / ")}:`];
  for (const [k, m] of byType) lines.push(`  ${k}: ${m.map((x) => (x === Infinity ? "-" : x.toFixed(2))).join(" / ")}`);
  const clippedAway = [...new Set(all.filter((r) => r.note).map((r) => `${r.view} ${r.id.replace(/#\d+$/, "")}`))];
  if (clippedAway.length) lines.push("NOT PAINTED (cut off by their container, so no contrast to judge):", ...clippedAway.map((c) => `  ${c}`));
  if (overlaps.size) lines.push("OVERLAPS (#103):", ...[...overlaps].map((o) => `  ${o}`));
  if (stillFailing.size) lines.push(`KNOWN FINDINGS (${stillFailing.size} element-seasons below AA, listed in KNOWN_FINDINGS)`);
  if (nowPassing.length) lines.push("LISTED BUT NOW PASSING OR GONE (remove from KNOWN_FINDINGS):", ...nowPassing.map((k) => `  ${k}`));
  lines.push(fails.length ? "FAILURES:" : "all targets measured and at or above AA", ...fails.map((r) => `  ${r.season} ${r.view} ${r.id} ${r.why ?? r.ratio.toFixed(3)}`));
  console.log(lines.join("\n"));
  // The list is the Linux CI runner's baseline (text renders a little differently elsewhere): the strict comparison, an unlisted failure
  // or a stale entry, is made only there. Elsewhere the table is printed and only measurement failures fail.
  if (strict) expect(nowPassing, "listed in KNOWN_FINDINGS but no longer below AA: remove them from the list").toEqual([]);
  expect([...overlaps], "map elements covered by the Today callout or Pip (#103)").toEqual([]);
  expect(fails.map((r) => `${r.season} ${r.view} ${r.id} ${r.why ?? r.ratio.toFixed(3)}`), "targets below AA or unmeasurable (ids and ratios)").toEqual([]);
});

/**
 * Mutation proofs for the ring (#106): the real map, its selected ring, measured as is (it passes), then with ONE dash of the V render
 * damaged. The reference renders (expected dash pattern, halo, ground) are untouched, so each damaged segment is still expected and must be
 * seen. Both must fail: a dash left at 12% opacity (low contrast against its halo) and a dash made fully transparent.
 */
test("rendered contrast: one damaged ring dash fails", async ({ page }) => {
  test.setTimeout(240_000);
  await newGameToMap(page);
  const ringRatio = async (mutate?: RingMutation) => {
    const targets = (await discover(page, "thistledown")).filter((t) => t.kind === "ring" && t.name === "ring");
    expect(targets.length, "the map has a selected ring").toBeGreaterThan(0);
    const res = (await analyse(page, "thistledown", new Set(targets.map((t) => t.id)), mutate))[targets[0].id];
    await untag(page);
    return res;
  };
  const clean = await ringRatio();
  expect(clean.why, "the undamaged ring is measured").toBeUndefined();
  console.log(`ring, undamaged: ${clean.ratio.toFixed(2)}`);
  for (const m of ["faint", "gone"] as const) {
    const r = await ringRatio(m);
    console.log(`ring, one dash ${m}: ${r.why ?? r.ratio.toFixed(2)}`);
    expect(r.why !== undefined || r.ratio < NEED.ring, `a ring with one ${m} dash must fail (ratio ${r.ratio})`).toBe(true);
  }
});
