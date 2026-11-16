/**
 * ADVISORY (not authoritative; see #106; not in CI until #104): this check can still miss or mis-measure some targets.
 * The vitest model in tests/seasonal-light.test.ts is what runs in CI.
 *
 * Rendered-pixel contrast (#99, `npm run phone-pass`, WebKit and Chromium; not in CI yet). For each view and season it
 * takes two renders of the page: V, as painted, and H, with every target element hidden. A target's painted pixels are
 * the pixels of V that are close to its own colour and differ from H; each is measured against the background beneath
 * it and around it in H (anti-aliased edge pixels, which are blends, are not painted pixels). Text needs 4.5:1; icons
 * and rings 3:1. A target that is missing, zero-size, clipped, translucent or has no painted pixels is a failure.
 *
 * Views: the actual Thistledown map (spring; summer, autumn and winter by setting `data-season` on the root, because
 * their villages have no routes to enter yet, so only the lighting is emulated), the actual Hollowmere map (summer),
 * and a board. Standard pack only (checked on the served page). Output is element ids and ratios only; no files.
 */
import { expect, test, type Page } from "@playwright/test";

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
type Kind = "text" | "icon" | "info";
const NEED: Record<Kind, number> = { text: 4.5, icon: 3, info: 0 };

interface Target {
  id: string;
  name: string;
  kind: Kind;
  /** Painted colours of the element: [r, g, b, alpha]. `segment` colours are the stops of one gradient. */
  fg: [number, number, number, number][];
  segment: boolean;
  box: [number, number, number, number];
  opacity: number;
  shown: boolean;
  over: string[];
  /** Ring only: the ring's centre and scale, and its two colours. */
  ring?: { cx: number; cy: number; scale: number; dash: [number, number, number, number]; halo: [number, number, number, number] };
}
interface Row { season: string; view: string; name: string; id: string; kind: Kind; ratio: number; why?: string; over?: string[] }

/** Page-side: find the targets of a view (tagging each with data-ctid), described by selectors and how to read their colour. */
async function discover(page: Page, view: string, pass: string): Promise<Target[]> {
  return page.evaluate(
    ({ view, pass }) => {
      const out: Target[] = [];
      const css = (e: Element, p: string) => getComputedStyle(e).getPropertyValue(p);
      const rgba = (s: string): [number, number, number, number] => {
        const m = s.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
        const h = s.match(/^#([0-9a-f]{6})$/i);
        return h ? [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16), 1] : [0, 0, 0, 0];
      };
      const sym = (id: string, sel: string, attr: string) => [...document.querySelectorAll(`#${id} ${sel}`)].map((e) => rgba(e.getAttribute(attr) ?? ""));
      const stops = (id: string) => [...document.querySelectorAll(`#${id} stop`)].map((e) => rgba(e.getAttribute("stop-color") ?? ""));
      const off = [window.scrollX, window.scrollY];
      const all = (sel: string) => [...document.querySelectorAll(sel)];
      const effOpacity = (e: Element) => {
        let o = 1;
        for (let p: Element | null = e; p; p = p.parentElement) o *= parseFloat(css(p, "opacity") || "1");
        return o * parseFloat(css(e, "fill-opacity") || "1");
      };
      /** Fully inside every clipping (scrolling) ancestor and the viewport, so it is really painted. */
      const shown = (e: Element) => {
        const r = e.getBoundingClientRect();
        for (let p = e.parentElement; p; p = p.parentElement) {
          const st = getComputedStyle(p);
          if (st.overflowX === "visible" && st.overflowY === "visible") continue;
          const q = p.getBoundingClientRect();
          if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) return false;
        }
        const visible = css(e, "visibility") !== "hidden" && css(e, "display") !== "none";
        return visible;
      };
      const boxOf = (e: Element): [number, number, number, number] => {
        let r = e.getBoundingClientRect();
        if (e instanceof HTMLElement && !e.querySelector("svg")) {
          const rg = document.createRange();
          rg.selectNodeContents(e);
          r = rg.getBoundingClientRect(); // HTML text: the glyph line box, not a round element around it
        }
        return [r.left + off[0], r.top + off[1], r.width, r.height];
      };
      const covered = (e: Element) => {
        const r = e.getBoundingClientRect();
        const hit = (o: Element | null) => {
          if (!o || o === e || o.contains(e) || e.contains(o)) return false;
          const q = o.getBoundingClientRect();
          return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
        };
        return [hit(document.querySelector(".vtoday")) ? "callout" : "", hit(document.querySelector("#mapPip")) ? "pip" : ""].filter(Boolean);
      };
      /** The open node's pulse circle is drawn over its ring: the ring is painted as its colour blended with the pulse. */
      const underPulse = (ring: Element, c: [number, number, number, number]): [number, number, number, number] => {
        const pulse = ring.parentElement?.querySelector(".vpulse");
        if (!pulse) return c;
        const f = rgba(css(pulse, "fill")), a = parseFloat(css(pulse, "opacity") || "1") * f[3];
        return [c[0] * (1 - a) + f[0] * a, c[1] * (1 - a) + f[1] * a, c[2] * (1 - a) + f[2] * a, 1];
      };
      let n = 0;
      const add = (kind: Kind, name: string, e: Element, fg: [number, number, number, number][], segment = false) => {
        const id = `${name}#${n++}`;
        e.setAttribute("data-ctid", id);
        if (e.tagName === "use" || e.tagName === "svg") e.setAttribute("data-cthide", "");
        out.push({ id, name, kind, fg, segment, box: boxOf(e), opacity: effOpacity(e), shown: shown(e), over: covered(e) });
      };
      const fill = (e: Element) => [rgba(css(e, "fill"))];
      const stroke = (e: Element) => [rgba(css(e, "stroke"))];
      const colour = (e: Element) => [rgba(css(e, "color"))];

      if (view === "thistledown" || view === "hollowmere") {
        const S = "#villageSvg ";
        if (pass === "main") {
          for (const e of all(S + ".vplateName")) add("text", "plate-name", e, fill(e));
          for (const e of all(S + ".vplateNote")) add("text", "plate-note", e, fill(e));
          for (const e of all(S + ".vnum")) add("text", "node-number", e, fill(e));
          for (const e of all(S + ".vcallout")) add("text", "callout", e, fill(e));
          for (const e of all(S + '.vnode.done path[d^="M-9 0"]')) add("icon", "node-check", e, stroke(e));
          for (const e of all(S + ".vnode.locked rect")) add("icon", "node-lock", e, fill(e));
          for (const e of all(S + ".vnode.locked path")) add("icon", "node-lock", e, stroke(e));
          for (const e of all("#mapLanes .vchipNum")) if (!e.querySelector("svg")) add("text", "chip-number", e, colour(e));
          for (const e of all("#mapLanes .vchipName")) add("text", "chip-name", e, colour(e));
          for (const e of all("#mapLanes .vchipNum svg")) add("icon", "chip-lock", e, sym("icoLock", "rect", "fill"));
        } else {
          // stars and the ring, measured without the callout and Pip drawn over them (the overlap is reported as a warning)
          for (const e of all(S + ".vring")) {
            const c = e.querySelectorAll("circle");
            const cr = c[0].getBoundingClientRect(); // geometry only (no stroke): its centre is the ring's centre
            const sc = (document.querySelector("#villageSvg") as Element).getBoundingClientRect().width / 1000; // CSS px per map unit
            const cx = cr.left + off[0] + cr.width / 2, cy = cr.top + off[1] + cr.height / 2;
            const half = 40 * sc;
            const id = `ring#${n++}`;
            e.setAttribute("data-ctid", id);
            e.setAttribute("data-cthide", "");
            out.push({
              id, name: "ring", kind: "icon", fg: [], segment: false, box: [cx - half, cy - half, 2 * half, 2 * half], opacity: effOpacity(e), shown: shown(e), over: covered(e),
              ring: { cx, cy, scale: sc, halo: underPulse(e, rgba(css(c[0], "stroke"))), dash: underPulse(e, rgba(css(c[1], "stroke"))) },
            });
          }
          const gold = stops("gold"), empty = [...sym("rbStarOff", "path", "fill"), ...sym("rbStarOff", "path", "stroke")];
          for (const e of all(S + ".vstars use")) {
            const gold1 = e.getAttribute("href") === "#rbStar";
            add("icon", gold1 ? "star-gold" : "star-empty", e, gold1 ? gold : empty, gold1);
          }
        }
      } else if (pass === "main") {
        for (const e of all("#board text")) add("text", "board-badge-number", e, fill(e));
        for (const e of all('#board use[href="#icoLock"]')) add("icon", "board-lock", e, sym("icoLock", "rect", "fill"));
        for (const e of all('#board use[href="#icoCheck"]')) add("icon", "board-check", e, [...sym("icoCheck", "path", "stroke")]);
      }
      return out;
    },
    { view, pass },
  );
}

/** Page-side: V and H as PNGs, then the pixel analysis of the given targets. */
async function analyse(page: Page, targets: Target[], hideOverlays: boolean): Promise<Map<string, { ratio: number; why?: string }>> {
  const style = await page.addStyleTag({ content: `#mapPip${hideOverlays ? ",.vtoday" : ""}{visibility:hidden!important}` });
  const shot = async () => (await page.screenshot({ fullPage: true, animations: "disabled" })).toString("base64");
  const V = await shot();
  const hide = await page.addStyleTag({
    content: "[data-ctid]{color:transparent!important;fill:transparent!important;stroke:transparent!important;text-shadow:none!important}[data-cthide]{visibility:hidden!important}",
  });
  const H = await shot();
  await hide.evaluate((e) => (e as Element).remove());
  await style.evaluate((e) => (e as Element).remove());
  const res = await page.evaluate(
    async ({ V, H, targets }) => {
      const dec = async (b64: string) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        return { g, w: img.width, h: img.height };
      };
      const [v, h] = [await dec(V), await dec(H)];
      const scale = v.w / document.documentElement.scrollWidth;
      const lin = (u: number) => ((u /= 255) <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
      const L = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // A pixel belongs to a glyph or sprite when it is at least half covered by one of its colours: it lies on the line from
      // the background beneath it (H) to that colour, at coverage >= MINCOV. Lighter edge blends are not painted pixels.
      // Contrast is then that colour against the background (not the blended pixel), so anti-aliasing can't skew it.
      const MINCOV = 0.5, RESID = 36;
      const covering = (p: number[], b: number[], fg: number[][], segment: boolean, minCov = MINCOV): number[] | null => {
        const cands = segment && fg.length >= 2 ? [0, 0.25, 0.5, 0.75, 1].map((t) => fg[0].map((_, k) => fg[0][k] + (fg[fg.length - 1][k] - fg[0][k]) * t)) : fg;
        let best: number[] | null = null, bestResid = Infinity;
        for (const f of cands) {
          const d = [f[0] - b[0], f[1] - b[1], f[2] - b[2]];
          const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
          if (dd < 400) continue; // colour too close to the background to tell apart
          const a = ((p[0] - b[0]) * d[0] + (p[1] - b[1]) * d[1] + (p[2] - b[2]) * d[2]) / dd;
          if (a < minCov || a > 1.2) continue;
          const resid = dist(p, [b[0] + a * d[0], b[1] + a * d[1], b[2] + a * d[2]]);
          if (resid <= RESID && resid < bestResid) (best = f), (bestResid = resid);
        }
        return best;
      };
      const out: Record<string, { ratio: number; why?: string }> = {};
      for (const t of targets) {
        const fail = (why: string) => (out[t.id] = { ratio: 0, why });
        if (t.box[2] < 1 || t.box[3] < 1) { fail("zero-size"); continue; }
        if (!t.shown) { fail("clipped or hidden"); continue; }
        if (t.opacity < 0.99) { fail("translucent"); continue; }
        if (!t.ring && t.fg.some((f) => f[3] < 0.99)) { fail("translucent colour"); continue; }
        const x0 = Math.max(0, Math.ceil(t.box[0] * scale) + 1), y0 = Math.max(0, Math.ceil(t.box[1] * scale) + 1);
        const x1 = Math.min(v.w, Math.floor((t.box[0] + t.box[2]) * scale) - 1), y1 = Math.min(v.h, Math.floor((t.box[1] + t.box[3]) * scale) - 1);
        if (x1 <= x0 || y1 <= y0) { fail("zero-size"); continue; }
        const w = x1 - x0, hh = y1 - y0;
        const vd = v.g.getImageData(x0, y0, w, hh).data, hd = h.g.getImageData(x0, y0, w, hh).data;
        const at = (d: Uint8ClampedArray, x: number, y: number) => [d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2]];
        const R = 2; // adjacent background: the hidden render within 2 device pixels of a painted pixel
        /** Worst contrast of the painted pixels (those within TOL of `fg`) against the background beneath and around them. */
        const measure = (fg: number[][], segment: boolean, keep: (x: number, y: number) => boolean) => {
          let worst = Infinity, count = 0;
          for (let y = 0; y < hh; y++) {
            for (let x = 0; x < w; x++) {
              if (!keep(x, y)) continue;
              const p = at(vd, x, y), b = at(hd, x, y);
              const f = covering(p, b, fg, segment);
              if (!f) continue;
              count++;
              const lp = L(f[0], f[1], f[2]);
              for (let dy = -R; dy <= R; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || ny < 0 || nx >= w || ny >= hh) continue;
                  const q = at(hd, nx, ny);
                  worst = Math.min(worst, ratio(lp, L(q[0], q[1], q[2])));
                }
              }
            }
          }
          return { worst, count };
        };
        if (t.ring) {
          // Two-tone rule. (i) the dashes against the halo they sit on; (ii) at every position round the ring, at least one of
          // the colours painted there (dash and/or halo; a gap has only the halo) against the ground next to it.
          const rg = t.ring;
          const rad = (x: number, y: number) => Math.hypot((x0 + x) / scale - rg.cx, (y0 + y) / scale - rg.cy) / rg.scale;
          const ang = (x: number, y: number) => Math.atan2((y0 + y) / scale - rg.cy, (x0 + x) / scale - rg.cx);
          const BINS = 120;
          const groundD = new Array(BINS).fill(Infinity), groundH = new Array(BINS).fill(Infinity), maskD = new Array(BINS).fill(false);
          const dashL = L(rg.dash[0], rg.dash[1], rg.dash[2]), haloL = L(rg.halo[0], rg.halo[1], rg.halo[2]);
          let nDash = 0, nHalo = 0, haloWorst = Infinity;
          for (let y = 0; y < hh; y++) {
            for (let x = 0; x < w; x++) {
              const r = rad(x, y);
              if (r < 28 || r > 38) continue;
              const pv = at(vd, x, y), bg = at(hd, x, y);
              // classified by the painted colour alone (the ring is hidden in H, so a dash on ground of its own colour would be
              // invisible to a V-minus-H difference); contrast is then taken against H
              const isDash = dist(pv, rg.dash) <= 40, isHalo = !isDash && dist(pv, rg.halo) <= 40;
              void bg;
              const bin = Math.min(BINS - 1, Math.floor(((ang(x, y) + Math.PI) / (2 * Math.PI)) * BINS));
              // the dash mask: on the line from the halo colour to the dash colour and at least half way along it, so anti-aliased
              // edges are not shaved and ground that merely looks dark is not mistaken for dash
              const dd = [rg.dash[0] - rg.halo[0], rg.dash[1] - rg.halo[1], rg.dash[2] - rg.halo[2]];
              const tt = ((pv[0] - rg.halo[0]) * dd[0] + (pv[1] - rg.halo[1]) * dd[1] + (pv[2] - rg.halo[2]) * dd[2]) / (dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2]);
              if (tt >= 0.5 && tt <= 1.2 && dist(pv, [rg.halo[0] + tt * dd[0], rg.halo[1] + tt * dd[1], rg.halo[2] + tt * dd[2]]) <= 36) maskD[bin] = true;
              if (!isDash && !isHalo) continue;
              let g = Infinity;
              for (let dy = -R; dy <= R; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || ny < 0 || nx >= w || ny >= hh) continue;
                  const q = at(hd, nx, ny);
                  g = Math.min(g, ratio(isDash ? dashL : haloL, L(q[0], q[1], q[2])));
                }
              }
              if (isDash) { nDash++; groundD[bin] = Math.min(groundD[bin], g); } else { nHalo++; groundH[bin] = Math.min(groundH[bin], g); haloWorst = Math.min(haloWorst, g); }
            }
          }
          if (nDash < 3 || nHalo < 3) { fail("no painted ring pixels"); continue; }
          // (ii) is judged where a dash is painted: there the best of the dash and the halo under it must clear 3:1 against the ground.
          // Gaps read as gaps, so they are not judged; instead the dashes must cover at least half the circumference and no gap may
          // be longer than the dash next to it (both from the rendered dash mask, to a tolerance of one bin), so this can't be gamed.
          const dashBin: boolean[] = maskD;
          let iiDash = Infinity, iiGap = Infinity;
          for (let k = 0; k < BINS; k++) {
            const best = Math.max(groundD[k] === Infinity ? 0 : groundD[k], groundH[k] === Infinity ? 0 : groundH[k]);
            if (groundD[k] !== Infinity) iiDash = Math.min(iiDash, best);
            else if (!dashBin[k] && groundH[k] !== Infinity) iiGap = Math.min(iiGap, best);
          }
          const coverage = dashBin.filter(Boolean).length / BINS;
          // circular runs of dash / gap bins
          const start = dashBin.findIndex((d, k) => d && !dashBin[(k + BINS - 1) % BINS]); // the first bin of some dash
          const runs: { dash: boolean; len: number }[] = [];
          if (start >= 0) {
            for (let n = 0; n < BINS; n++) {
              const d = dashBin[(start + n) % BINS];
              if (runs.length && runs[runs.length - 1].dash === d) runs[runs.length - 1].len++;
              else runs.push({ dash: d, len: 1 });
            }
          }
          let gapRel = 0; // longest gap divided by the shorter of its two neighbouring dashes
          runs.forEach((r, k) => {
            if (r.dash) return;
            const prev = runs[(k + runs.length - 1) % runs.length], next = runs[(k + 1) % runs.length];
            gapRel = Math.max(gapRel, r.len / Math.max(1, Math.min(prev.len, next.len)));
          });
          const TOLBIN = 1;
          const gapBad = runs.some((r, k) => !r.dash && r.len > Math.min(runs[(k + runs.length - 1) % runs.length].len, runs[(k + 1) % runs.length].len) + TOLBIN);
          const i = ratio(haloL, dashL);
          if (coverage < 0.5) { fail(`dashes cover ${Math.round(coverage * 100)}% of the ring (bins ${dashBin.filter(Boolean).length}/${BINS}, dash px ${nDash}, halo px ${nHalo})`); continue; }
          if (start < 0 || gapBad) { fail(`a gap is longer than its adjacent dash (runs ${runs.map((r) => (r.dash ? "D" : "g") + r.len).join(" ")}; coverage ${Math.round(coverage * 100)}%)`); continue; }
          out[t.id] = { ratio: Math.min(i, iiDash) };
          out[t.id + ":dash"] = { ratio: i };
          out[t.id + ":ground"] = { ratio: iiDash };
          out[t.id + ":gaps"] = { ratio: iiGap === Infinity ? 0 : iiGap };
          out[t.id + ":halo"] = { ratio: haloWorst };
          out[t.id + ":coverage"] = { ratio: coverage };
          out[t.id + ":gaprel"] = { ratio: gapRel };
          continue;
        }
        const m = measure(t.fg as number[][], t.segment, () => true);
        if (m.count < 3) { fail("no painted pixels"); continue; }
        out[t.id] = { ratio: m.worst };
      }
      return out;
    },
    { V, H, targets },
  );
  return new Map(Object.entries(res));
}

/** Measure every target of a view and pass, scrolling clipped ones into view; returns one row per target. */
async function measureView(page: Page, view: string, season: string): Promise<{ rows: Row[]; targets: Target[] }> {
  const rows: Row[] = [];
  const allTargets: Target[] = [];
  for (const pass of ["main", "stars"]) {
    let targets = await discover(page, view, pass);
    const done = new Set<string>();
    for (let round = 0; round < 12 && done.size < targets.length; round++) {
      const todo = targets.filter((t) => !done.has(t.id) && t.shown);
      if (!todo.length) {
        // everything left is clipped: scroll the first into view and look again
        const first = targets.find((t) => !done.has(t.id))!;
        await page.evaluate((id) => document.querySelector(`[data-ctid="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" }), first.id);
        const again = await discover(page, view, pass);
        targets = again;
        if (!again.some((t) => !done.has(t.id) && t.shown)) break;
        continue;
      }
      const res = await analyse(page, todo, pass === "stars");
      for (const t of todo) {
        done.add(t.id);
        const r = res.get(t.id)!;
        rows.push({ season, view, name: t.name, id: t.id, kind: t.kind, ratio: r.ratio, why: r.why, over: t.over });
        if (t.ring) {
          const g = (k: string) => res.get(`${t.id}:${k}`)?.ratio ?? 0;
          rows.push({ season, view, name: "ring-dash-vs-halo", id: `${t.id}:dash`, kind: "icon", ratio: g("dash") });
          rows.push({ season, view, name: "ring-dash-positions-vs-ground", id: `${t.id}:ground`, kind: "icon", ratio: g("ground") });
          // info only: dashes cover this fraction of the ring; the longest gap / its shorter neighbouring dash; gaps and halo vs ground
          // (the halo separates the dashes on dark ground; in a dashed indicator the gaps read as gaps, so they are not judged)
          rows.push({ season, view, name: "ring-dash-coverage (info, fraction)", id: `${t.id}:coverage`, kind: "info", ratio: g("coverage") });
          rows.push({ season, view, name: "ring-longest-gap-over-dash (info)", id: `${t.id}:gaprel`, kind: "info", ratio: g("gaprel") });
          rows.push({ season, view, name: "ring-gap-positions-vs-ground (info)", id: `${t.id}:gaps`, kind: "info", ratio: g("gaps") });
          rows.push({ season, view, name: "ring-halo-vs-ground (info)", id: `${t.id}:halo`, kind: "info", ratio: g("halo") });
        }
      }
      allTargets.push(...todo);
      // re-discover (scrolling may have changed what is shown); ids restart, so keep only unmeasured ones by position
      if (done.size < targets.length) {
        const first = targets.find((t) => !done.has(t.id))!;
        await page.evaluate((id) => document.querySelector(`[data-ctid="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" }), first.id);
        targets = await discover(page, view, pass);
        done.clear();
        for (const t of targets) if (rows.some((r) => r.id === t.id)) done.add(t.id);
      }
    }
    for (const t of targets) {
      if (!rows.some((r) => r.id === t.id)) rows.push({ season, view, name: t.name, id: t.id, kind: t.kind, ratio: 0, why: "clipped or hidden (never measured)" });
    }
    await page.evaluate(() => document.querySelectorAll("[data-ctid]").forEach((e) => (e.removeAttribute("data-ctid"), e.removeAttribute("data-cthide"))));
  }
  return { rows, targets: allTargets };
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

/** Counts that must hold, worked out from the page's own structure rather than from the targets found. */
async function expected(page: Page, view: string): Promise<Record<string, number>> {
  return page.evaluate((view) => {
    const n = (sel: string) => document.querySelectorAll(sel).length;
    if (view === "board") return { "board-badge-number": -1 };
    const plates = n("#villageSvg g.vhood rect");
    const out: Record<string, number> = { "plate-name": plates, "plate-note": plates };
    if (view === "thistledown") {
      Object.assign(out, {
        "node-number": n("#villageSvg .vnode.open"),
        callout: n("#villageSvg .vtoday"),
        "node-check": n("#villageSvg .vnode.done"),
        ring: n("#villageSvg .vring"),
        "chip-number": n("#mapLanes .vchip:not(.locked)"),
        "chip-name": n("#mapLanes .vchip"),
        "chip-lock": n("#mapLanes .vchip.locked"),
        "star-gold": -1,
        "star-empty": -1,
      });
      out["node-lock"] = n("#villageSvg .vnode.locked") * 2; // padlock body and shackle
    }
    return out;
  }, view);
}

async function checkView(page: Page, view: string, season: string, all: Row[], over: Set<string>) {
  const { rows, targets } = await measureView(page, view, season);
  const want = await expected(page, view);
  const got = new Map<string, number>();
  for (const t of targets) got.set(t.name, (got.get(t.name) ?? 0) + 1);
  for (const [name, count] of Object.entries(want)) {
    const have = rows.filter((r) => r.name === name).length;
    if (count >= 0 ? have !== count : have < 1) all.push({ season, view, name, id: `${name}:expected-set`, kind: "text", ratio: 0, why: `found ${have}, expected ${count >= 0 ? count : "at least 1"}` });
  }
  for (const r of rows) {
    all.push(r);
    if (r.over?.length) over.add(`${view} ${r.id.replace(/#\d+$/, "")} covered by ${r.over.join("+")}`);
  }
}

test("rendered contrast: the maps and a board, in every season", async ({ page }, info) => {
  test.setTimeout(240_000);
  const all: Row[] = [];
  const overlaps = new Set<string>();

  // Thistledown: two finished lanes (3 stars, 1 star), one open, the rest locked
  const ids = await newGameToMap(page);
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
    await checkView(page, "thistledown", s, all, overlaps);
  }
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  for (const s of SEASONS) {
    await setSeason(page, s);
    await checkView(page, "board", s, all, overlaps);
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
  await page.locator("#mapEnter").evaluate((e) => (e as HTMLElement).click()); // a real tap is intercepted by the fog ellipse over it on phones (reported separately)
  await expect(page.locator("#mapTitle")).toHaveText("Hollowmere");
  expect(await page.evaluate(() => document.querySelector(".wrap")!.parentElement!.dataset.season)).toBe("summer");
  await page.evaluate(() => document.fonts.ready);
  await checkView(page, "hollowmere", "summer", all, overlaps);

  // report: ids and ratios only
  const fails = all.filter((r) => r.why || r.ratio < NEED[r.kind]);
  const byType = new Map<string, number[]>();
  for (const r of all) {
    if (r.why) continue;
    const key = `${r.view} ${r.name} (${r.kind})`;
    const m = byType.get(key) ?? SEASONS.map(() => Infinity);
    const k = SEASONS.indexOf(r.season as (typeof SEASONS)[number]);
    m[k] = Math.min(m[k], r.ratio);
    byType.set(key, m);
  }
  const lines = [`[${info.project.name}] min ratio per element type, ${SEASONS.join(" / ")}:`];
  for (const [k, m] of byType) lines.push(`  ${k}: ${m.map((x) => (x === Infinity ? "-" : x.toFixed(2))).join(" / ")}`);
  if (overlaps.size) lines.push("OVERLAPS (warnings, #103):", ...[...overlaps].map((o) => `  ${o}`));
  lines.push(fails.length ? "FAILURES:" : "all targets measured and at or above AA", ...fails.map((r) => `  ${r.season} ${r.view} ${r.id} ${r.why ?? r.ratio.toFixed(3)}`));
  console.log(lines.join("\n"));
  expect(fails.map((r) => `${r.season} ${r.view} ${r.id} ${r.why ?? r.ratio.toFixed(3)}`), "targets below AA or unmeasurable (ids and ratios)").toEqual([]);
});
