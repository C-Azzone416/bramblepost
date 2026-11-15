/**
 * The village map: Thistledown between routes. Finished lanes carry a stamp with their best stars,
 * the next lane is open, and later seasons wait under fog. Choosing a lane starts its route.
 *
 * This module only draws and handles input. Which lanes are open comes from progress.ts, and the
 * stars come from the game's own save (src/ui/save.ts).
 */
import "./village.css";
import type { Route } from "../levels";
import { NEIGHBOURS, PARCELS } from "../ui/cast";
import { loadSave } from "../ui/save";
import { el, icon, seeded, starRow } from "../ui/svg";
import { BRIDGE, LANES, MAP_H, MAP_W, NEIGHBOURHOODS, POND, POST_OFFICE, SEASONS, STREAM, TREES, reservedSlots, type Lane, type Season } from "./data";
import { allLanes, newStamps, villageProgress, type LaneProgress, type NeighbourhoodProgress, type VillageProgress } from "./progress";
import { loadVillage, markStamped } from "./save";

export interface VillageMapOptions {
  /** Start the route at this index of `routes`. */
  onStart(index: number): void;
  /** Show the plain route list with the how-to-play notes. */
  onRouteList(): void;
}

export interface VillageMap {
  /** Re-read progress, draw the map and show it. */
  show(): void;
  hide(): void;
  /** Select a lane (shows its details in the side panel). */
  select(id: string): void;
  readonly selected: string | null;
  readonly progress: VillageProgress;
  readonly visible: boolean;
}

const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
const SEASON_COLOUR: Record<Season, string> = { spring: "#8fc263", summer: "#e3a43a", autumn: "#d0672f", winter: "#9fc7d8" };

const MARKUP = `
<section id="mapView" class="village" hidden aria-labelledby="mapTitle">
  <div class="vtop">
    <div class="vplate">
      <svg class="vwheel" id="mapWheel" viewBox="-40 -40 80 80" aria-hidden="true"></svg>
      <div><small id="mapSeason">Spring</small><h1 id="mapTitle">Thistledown</h1></div>
    </div>
    <div class="vcount">
      <span title="Stamps">${icon("icoCheck", "0 0 28 28")}<b id="mapStamps">0</b><i id="mapStampsOf">/ 5 stamps</i></span>
      <span title="Stars">${icon("rbStar", "0 0 48 48")}<b id="mapStars">0</b><i id="mapStarsOf">/ 15 stars</i></span>
    </div>
    <button class="btn ghost" id="mapHowTo" type="button">How to play</button>
  </div>
  <p class="vnews" id="mapNews" role="status" hidden></p>
  <div class="vbody">
    <div class="vstage">
      <svg id="villageSvg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Map of Thistledown"></svg>
    </div>
    <aside class="vpanel" id="mapPanel" aria-live="polite"></aside>
  </div>
  <nav class="vlanes" aria-label="Lanes"><ol id="mapLanes"></ol></nav>
  <ul class="vseasons" id="mapSeasons" aria-label="Seasons"></ul>
</section>`;

export function mountVillage(container: HTMLElement, routes: Route[], opts: VillageMapOptions): VillageMap {
  container.insertAdjacentHTML("afterbegin", MARKUP);
  const q = <T extends Element = HTMLElement>(id: string) => container.querySelector<HTMLElement>("#" + id) as unknown as T;
  const view = q("mapView");
  const svg = q<SVGSVGElement>("villageSvg");
  const index = new Map(routes.map((r, i) => [r.id, i]));
  let progress = villageProgress({});
  let selected: string | null = null;
  let fresh: string[] = [];

  q("mapHowTo").addEventListener("click", () => opts.onRouteList());

  function laneOf(id: string): (LaneProgress & { hood: NeighbourhoodProgress }) | undefined {
    return allLanes(progress).find((l) => l.id === id);
  }
  const routeOf = (id: string): Route | undefined => routes[index.get(id) ?? -1];
  const nameOf = (id: string) => routeOf(id)?.name ?? id;

  /* ---------- reading progress ---------- */
  function refresh() {
    progress = villageProgress(loadSave().best);
    const seen = loadVillage().stamped;
    fresh = newStamps(progress, seen);
    markStamped(fresh);
  }

  function defaultLane(): string | null {
    if (progress.today) return progress.today;
    const done = allLanes(progress).filter((l) => l.state === "done");
    return done.length ? done[done.length - 1].id : (allLanes(progress)[0]?.id ?? null);
  }

  /* ---------- the HUD ---------- */
  function renderHud() {
    const open = progress.hoods.filter((h) => h.state === "open");
    const hood = open.find((h) => h.lanes.some((l) => l.state === "open")) ?? open[open.length - 1] ?? progress.hoods[0];
    q("mapSeason").textContent = SEASON_LABEL[hood.season];
    q("mapTitle").textContent = hood.name;
    q("mapStamps").textContent = String(progress.stamps);
    q("mapStampsOf").textContent = `/ ${progress.lanes} stamps`;
    q("mapStars").textContent = String(progress.stars);
    q("mapStarsOf").textContent = `/ ${progress.maxStars} stars`;
    drawWheel(q<SVGSVGElement>("mapWheel"), hood.season);

    const news = q("mapNews");
    news.textContent = newsLine();
    news.hidden = !news.textContent;
  }

  function newsLine(): string {
    if (!fresh.length) return "";
    const next = progress.today ? ` ${nameOf(progress.today)} is open.` : "";
    const springDone = progress.hoods[0]?.lanes.every((l) => l.state === "done");
    const nextHood = progress.hoods.find((h) => h.state === "soon");
    if (!progress.today && springDone && nextHood)
      return `Every ${SEASON_LABEL[progress.hoods[0].season].toLowerCase()} lane is stamped. ${nextHood.name} opens in ${SEASON_LABEL[nextHood.season].toLowerCase()}.`;
    if (fresh.length === 1) return `Stamp added for ${nameOf(fresh[0])}.${next}`;
    return `${fresh.length} stamps added.${next}`;
  }

  function drawWheel(w: SVGSVGElement, now: Season) {
    w.innerHTML = "";
    SEASONS.forEach((s, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI) / 2;
      const a1 = a0 + Math.PI / 2;
      const R = s === now ? 36 : 30;
      el(
        "path",
        {
          d: `M0 0 L${(Math.cos(a0) * R).toFixed(1)} ${(Math.sin(a0) * R).toFixed(1)} A${R} ${R} 0 0 1 ${(Math.cos(a1) * R).toFixed(1)} ${(Math.sin(a1) * R).toFixed(1)}Z`,
          fill: SEASON_COLOUR[s],
          opacity: s === now ? 1 : 0.45,
          stroke: "#fffaf0",
          "stroke-width": 3,
        },
        w,
      );
    });
    el("circle", { r: 9, fill: "#fffaf0" }, w);
  }

  /* ---------- the map picture ---------- */
  function drawMap() {
    svg.innerHTML = "";
    const defs = el("defs", {}, svg);
    defs.innerHTML =
      '<linearGradient id="vMeadow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9d98a"/><stop offset=".55" stop-color="#9cc66e"/><stop offset="1" stop-color="#7fae58"/></linearGradient>' +
      '<radialGradient id="vSun" cx="200" cy="80" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff1c2" stop-opacity=".7"/><stop offset=".5" stop-color="#ffd98a" stop-opacity=".16"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="vWater" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd8e4"/><stop offset="1" stop-color="#5fa9c0"/></linearGradient>' +
      '<radialGradient id="vFog" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fbf6ea" stop-opacity=".96"/><stop offset="1" stop-color="#fbf6ea" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vVig" cx="50%" cy="50%" r="72%"><stop offset=".62" stop-color="#3d5a24" stop-opacity="0"/><stop offset="1" stop-color="#3d5a24" stop-opacity=".4"/></radialGradient>' +
      '<radialGradient id="vStamp" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe6a3"/><stop offset="1" stop-color="#d58f26"/></radialGradient>' +
      '<filter id="vDrop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#2b2410" flood-opacity=".3"/></filter>';

    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vMeadow)" }, svg);
    drawMeadow();
    // stream and pond
    el("path", { d: STREAM, fill: "none", stroke: "#5f9fb4", "stroke-width": 40, "stroke-linecap": "round", opacity: 0.45 }, svg);
    el("path", { d: STREAM, fill: "none", stroke: "url(#vWater)", "stroke-width": 30, "stroke-linecap": "round" }, svg);
    el("path", { d: STREAM, fill: "none", stroke: "#e6f7fa", "stroke-width": 3, "stroke-dasharray": "14 22", opacity: 0.75 }, svg);
    el("ellipse", { cx: POND.x, cy: POND.y + 6, rx: POND.rx + 10, ry: POND.ry + 8, fill: "#5f9fb4", opacity: 0.45 }, svg);
    el("ellipse", { cx: POND.x, cy: POND.y, rx: POND.rx, ry: POND.ry, fill: "url(#vWater)" }, svg);
    el("path", { d: `M${POND.x - 70} ${POND.y - 8} C ${POND.x - 30} ${POND.y - 22}, ${POND.x + 40} ${POND.y - 24}, ${POND.x + 80} ${POND.y - 10}`, stroke: "#e6f7fa", "stroke-width": 3, fill: "none", opacity: 0.7 }, svg);

    drawLanes();
    drawBridge();
    drawTrees();
    drawBuildings();
    drawReserved();
    drawLockedHoods();
    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vSun)", "pointer-events": "none" }, svg);
    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vVig)", "pointer-events": "none" }, svg);
    drawNodes();
    drawPip();

    const p = progress;
    svg.setAttribute(
      "aria-label",
      `Map of Thistledown. ${p.stamps} of ${p.lanes} lanes stamped.` + (p.today ? ` Next: ${nameOf(p.today)}.` : ""),
    );
  }

  function drawMeadow() {
    const r = seeded(91);
    const g = el("g", { "aria-hidden": "true" }, svg);
    for (let i = 0; i < 20; i++)
      el("ellipse", { cx: r() * MAP_W, cy: r() * MAP_H, rx: 40 + r() * 90, ry: 20 + r() * 40, fill: r() < 0.5 ? "#c6e19a" : "#8dbb62", opacity: 0.35 }, g);
    for (let i = 0; i < 46; i++) {
      const x = r() * MAP_W;
      const y = r() * MAP_H;
      el("path", { d: `M${x.toFixed(0)} ${y.toFixed(0)} q3 -9 6 0 m2 0 q3 -11 6 0`, stroke: "#6f9c48", "stroke-width": 2, fill: "none", opacity: 0.55 }, g);
    }
    for (let i = 0; i < 50; i++) el("circle", { cx: r() * MAP_W, cy: r() * MAP_H, r: 2.5 + r() * 2, fill: ["#fff4e0", "#f6b9c4", "#ffd97a"][i % 3] }, g);
  }

  /** Lane geometry: from the previous stop (or the post office) to this one. */
  function lanePath(L: Lane, prev: { x: number; y: number }): string {
    return `M${prev.x} ${prev.y} Q ${L.via[0]} ${L.via[1]}, ${L.x} ${L.y}`;
  }

  function drawLanes() {
    const g = el("g", { fill: "none", "stroke-linecap": "round", class: "vlaneLines" }, svg);
    let last: { x: number; y: number } = POST_OFFICE;
    for (const h of progress.hoods) {
      for (const l of h.lanes) {
        const L = LANES[l.id];
        if (!L) continue;
        const d = lanePath(L, last);
        if (l.state === "locked") {
          el("path", { d, stroke: "#efe4c8", "stroke-width": 18, "stroke-dasharray": "2 16", opacity: 0.95 }, g);
        } else {
          el("path", { d, stroke: "#c9a874", "stroke-width": 32, opacity: 0.7 }, g);
          el("path", { d, stroke: "#f1dfb4", "stroke-width": 24 }, g);
          if (l.state === "open") el("path", { d, stroke: "#e3a43a", "stroke-width": 6, "stroke-dasharray": "1 14", class: "vdash" }, g);
        }
        last = L;
      }
      // slots no route has claimed yet are hedged in, so the lane chain carries on to the last one
      const spare = reservedSlots(NEIGHBOURHOODS.find((n) => n.id === h.id)!);
      if (spare.length) last = spare[spare.length - 1];
      // a faint track toward the next neighbourhood once its lanes run out
      if (h.state === "open") {
        const next = progress.hoods[progress.hoods.indexOf(h) + 1];
        const at = next && NEIGHBOURHOODS.find((n) => n.id === next.id)?.at;
        if (at && !next.lanes.length) {
          const mx = (last.x + at.x) / 2 + 30;
          const my = (last.y + at.y) / 2 + 10;
          el("path", { d: `M${last.x} ${last.y} Q ${mx} ${my}, ${at.x} ${at.y + 50}`, stroke: "#efe4c8", "stroke-width": 16, "stroke-dasharray": "2 16", opacity: 0.85 }, g);
        }
      }
    }
  }

  function drawBridge() {
    const g = el("g", { transform: `translate(${BRIDGE.x} ${BRIDGE.y}) rotate(${BRIDGE.angle})`, filter: "url(#vDrop)" }, svg);
    el("rect", { x: -34, y: -22, width: 68, height: 44, rx: 7, fill: "#a8723f" }, g);
    el("path", { d: "M-24 -22 v44 M-8 -22 v44 M8 -22 v44 M24 -22 v44", stroke: "#8a5a33", "stroke-width": 3 }, g);
    el("rect", { x: -38, y: -28, width: 76, height: 8, rx: 4, fill: "#7a4d2a" }, g);
    el("rect", { x: -38, y: 20, width: 76, height: 8, rx: 4, fill: "#7a4d2a" }, g);
  }

  function drawTrees() {
    const r = seeded(17);
    const g = el("g", { "aria-hidden": "true" }, svg);
    for (const [x, y, s] of TREES) {
      const t = el("g", { transform: `translate(${x} ${y}) scale(${s})` }, g);
      el("ellipse", { cx: 6, cy: 34, rx: 42, ry: 12, fill: "#4f7a35", opacity: 0.35 }, t);
      el("rect", { x: -6, y: 4, width: 12, height: 30, rx: 4, fill: "#7a4d2a" }, t);
      el("circle", { cx: 0, cy: -10, r: 34, fill: "#5f8d3e" }, t);
      el("circle", { cx: -16, cy: 2, r: 24, fill: "#5f8d3e" }, t);
      el("circle", { cx: 18, cy: 0, r: 25, fill: "#5f8d3e" }, t);
      el("circle", { cx: -8, cy: -18, r: 23, fill: "#7fb257" }, t);
      el("circle", { cx: 11, cy: -12, r: 18, fill: "#8fc263" }, t);
      el("circle", { cx: -13, cy: -26, r: 9, fill: "#b5dc84", opacity: 0.8 }, t);
      if (r() < 0.4) for (const [a, b] of [[-15, -4], [9, -22], [17, 5]]) el("circle", { cx: a, cy: b, r: 4, fill: "#e05a3c" }, t);
    }
  }

  function drawBuildings() {
    const g = el("g", { filter: "url(#vDrop)", "aria-hidden": "true" }, svg);
    el("use", { href: "#rbPO", x: POST_OFFICE.x - 50, y: POST_OFFICE.y - 98, width: 100, height: 105 }, g);
    for (const l of allLanes(progress)) {
      const L = LANES[l.id];
      if (!L) continue;
      const n = NEIGHBOURS[L.style];
      const w = n.w * 0.95;
      const h = n.h * 0.95;
      el(
        "use",
        { href: "#" + n.sym, x: L.x + L.house[0], y: L.y + L.house[1], width: w, height: h, class: l.state === "locked" ? "vfaded" : "" },
        g,
      );
    }
  }

  /** Lane slots with no route yet: a hedge across the way, a bush where the stamp will go, fog on top. */
  function drawReserved() {
    for (const h of progress.hoods) {
      const N = NEIGHBOURHOODS.find((n) => n.id === h.id);
      if (!N) continue;
      let prev: { x: number; y: number } = N.slots[N.routes.length - 1] ?? POST_OFFICE;
      N.slots.forEach((L, i) => {
        if (i < N.routes.length) return;
        const g = el("g", { class: "vreserved", "data-hood": N.id, "data-slot": i + 1, "aria-hidden": "true" }, svg);
        const d = lanePath(L, prev);
        el("path", { d, fill: "none", "stroke-linecap": "round", stroke: "#3f6b2b", "stroke-width": 30 }, g);
        el("path", { d, fill: "none", "stroke-linecap": "round", stroke: "#5f8d3e", "stroke-width": 22, "stroke-dasharray": "0 15" }, g);
        el("path", { d, fill: "none", "stroke-linecap": "round", stroke: "#8fc263", "stroke-width": 9, "stroke-dasharray": "0 23", "stroke-dashoffset": -6, opacity: 0.8 }, g);
        const bush = el("g", { transform: `translate(${L.x} ${L.y})` }, g);
        el("ellipse", { cx: 2, cy: 18, rx: 34, ry: 9, fill: "#4f7a35", opacity: 0.4 }, bush);
        for (const [cx, cy, r, fill] of [[-16, 4, 17, "#4f7a35"], [16, 4, 17, "#4f7a35"], [0, -6, 21, "#5f8d3e"], [-5, -12, 11, "#7fb257"]] as const)
          el("circle", { cx, cy, r, fill }, bush);
        el("ellipse", { cx: L.x, cy: L.y, rx: 78, ry: 52, fill: "url(#vFog)", opacity: 0.75 }, g);
        prev = L;
      });
    }
  }

  function drawLockedHoods() {
    for (const h of progress.hoods) {
      if (h.state === "open") continue;
      const N = NEIGHBOURHOODS.find((n) => n.id === h.id);
      if (!N) continue;
      const { x, y } = N.at;
      const g = el("g", { transform: `translate(${x} ${y})`, class: "vhood", "data-hood": h.id }, svg);
      el("ellipse", { cx: 0, cy: 10, rx: 170, ry: 96, fill: "url(#vFog)" }, g);
      const ghosts = el("g", { opacity: 0.45 }, g);
      el("use", { href: "#mushHouse", x: -64, y: -64, width: 60, height: 71 }, ghosts);
      el("use", { href: "#acornHouse", x: 6, y: -50, width: 50, height: 62 }, ghosts);
      el("ellipse", { cx: -10, cy: 34, rx: 140, ry: 44, fill: "url(#vFog)" }, g);
      const plate = el("g", { transform: "translate(0 42)" }, g);
      el("rect", { x: -100, y: -24, width: 200, height: 50, rx: 25, fill: "#2a2b1f", opacity: 0.88 }, plate);
      const t1 = el("text", { x: 0, y: -1, "text-anchor": "middle", class: "vplateName" }, plate);
      t1.textContent = h.name;
      const t2 = el("text", { x: 0, y: 17, "text-anchor": "middle", class: "vplateNote" }, plate);
      t2.textContent = h.state === "soon" ? `${SEASON_LABEL[h.season]} routes coming soon` : `Opens in ${SEASON_LABEL[h.season].toLowerCase()}`;
    }
  }

  function drawNodes() {
    const g = el("g", { class: "vnodes" }, svg);
    for (const l of allLanes(progress)) {
      const L = LANES[l.id];
      if (!L) continue;
      const n = el("g", { transform: `translate(${L.x} ${L.y})`, class: `vnode ${l.state}` + (l.id === selected ? " sel" : ""), "data-lane": l.id }, g);
      // generous invisible hit area for fingers
      el("circle", { r: 40, fill: "transparent" }, n);
      if (l.id === selected) el("circle", { r: 33, fill: "none", stroke: "#2d4b78", "stroke-width": 4, "stroke-dasharray": "7 6", class: "vring" }, n);
      const body = el("g", { filter: "url(#vDrop)", class: fresh.includes(l.id) ? "vfresh" : "" }, n);
      if (l.state === "done") {
        el("circle", { r: 24, fill: "url(#vStamp)", stroke: "#fffaf0", "stroke-width": 4 }, body);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          el("circle", { cx: (Math.cos(a) * 24).toFixed(1), cy: (Math.sin(a) * 24).toFixed(1), r: 3, fill: "#fffaf0" }, body);
        }
        el("path", { d: "M-9 0 l6 7 l12 -14", stroke: "#fffaf0", "stroke-width": 4, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, body);
        const s = el("g", { transform: "translate(-27 27)", class: "vstars" }, n);
        for (let i = 0; i < 3; i++) el("use", { href: i < l.stars ? "#rbStar" : "#rbStarOff", x: i * 18, y: 0, width: 18, height: 18 }, s);
      } else if (l.state === "open") {
        el("circle", { r: 38, fill: "#c4452e", opacity: 0.25, class: "vpulse" }, n);
        el("circle", { r: 24, fill: "#c4452e", stroke: "#fffaf0", "stroke-width": 4 }, body);
        const t = el("text", { y: 8, "text-anchor": "middle", class: "vnum" }, body);
        t.textContent = String(l.n);
      } else {
        el("circle", { r: 21, fill: "#b8b29a", stroke: "#fffaf0", "stroke-width": 4 }, body);
        el("rect", { x: -8, y: -2, width: 16, height: 12, rx: 3, fill: "#fffaf0" }, body);
        el("path", { d: "M-4.5 -2 v-4 a4.5 4.5 0 0 1 9 0 v4", stroke: "#fffaf0", "stroke-width": 3, fill: "none" }, body);
      }
      n.addEventListener("click", () => select(l.id));
    }
    // "Today" callout above the open lane
    if (progress.today && LANES[progress.today]) {
      const L = LANES[progress.today];
      const lane = laneOf(progress.today)!;
      const label = `Today · Route ${lane.n}`;
      const w = 24 + label.length * 8;
      const c = el("g", { transform: `translate(${L.x} ${L.y - 62})`, filter: "url(#vDrop)", class: "vtoday", "pointer-events": "none" }, svg);
      el("rect", { x: -w / 2, y: -19, width: w, height: 34, rx: 17, fill: "#c4452e" }, c);
      el("path", { d: "M-7 14 L0 22 L7 14Z", fill: "#c4452e" }, c);
      const t = el("text", { y: 4, "text-anchor": "middle", class: "vcallout" }, c);
      t.textContent = label;
    }
  }

  function drawPip() {
    const at = progress.today ?? defaultLane();
    const L = at ? LANES[at] : null;
    const spot = L ? { x: L.x + L.pip[0], y: L.y + L.pip[1] } : { x: POST_OFFICE.x + 40, y: POST_OFFICE.y - 60 };
    el("use", { href: "#pip", x: spot.x, y: spot.y, width: 74, height: 70, filter: "url(#vDrop)", class: "vpip", "pointer-events": "none" }, svg);
  }

  /* ---------- lane list and side panel ---------- */
  function renderLanes() {
    const ol = q("mapLanes");
    ol.innerHTML = "";
    for (const l of allLanes(progress)) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = `vchip ${l.state}`;
      b.dataset.lane = l.id;
      b.setAttribute("aria-pressed", String(l.id === selected));
      const status = l.state === "done" ? `${l.stars} of 3 stars` : l.state === "open" ? "open" : "locked";
      b.setAttribute("aria-label", `Route ${l.n}, ${nameOf(l.id)}, ${status}`);
      b.innerHTML =
        `<span class="vchipNum">${l.state === "locked" ? icon("icoLock", "0 0 24 24") : l.n}</span>` +
        `<span class="vchipName">${nameOf(l.id)}</span>` +
        (l.state === "done" ? `<span class="srow" aria-hidden="true">${starRow(l.stars)}</span>` : "");
      b.addEventListener("click", () => select(l.id));
      li.appendChild(b);
      ol.appendChild(li);
    }
  }

  function renderSeasons() {
    const ul = q("mapSeasons");
    ul.innerHTML = "";
    for (const h of progress.hoods) {
      const li = document.createElement("li");
      li.className = `vseason ${h.season} ${h.state}`;
      const note =
        h.state === "open" ? `${h.stamps} of ${h.lanes.length} stamped` : h.state === "soon" ? "Routes coming soon" : `Opens in ${SEASON_LABEL[h.season].toLowerCase()}`;
      li.innerHTML = `<small>${SEASON_LABEL[h.season]}</small><b>${h.name}</b><span>${note}</span>`;
      ul.appendChild(li);
    }
  }

  function renderPanel() {
    const panel = q("mapPanel");
    const l = selected ? laneOf(selected) : undefined;
    const L = selected ? routeOf(selected) : undefined;
    if (!l || !L) {
      panel.innerHTML = "<p>No routes yet.</p>";
      return;
    }
    const parcels = L.parcels
      .map((p) => {
        const look = PARCELS[p.kind];
        const who = NEIGHBOURS[L.houses[p.to]]?.who;
        return `<li><span class="pico">${icon(look.ico, look.vb)}</span>${look.label}${who ? ` for ${who}` : ""}</li>`;
      })
      .join("");
    let best: string;
    let act: string;
    if (l.state === "done") {
      best = `<div class="vbest"><span class="srow" aria-label="${l.stars} of 3 stars">${starRow(l.stars)}</span><span>Best ${l.moves} ${l.moves === 1 ? "move" : "moves"} · par ${L.par}</span></div>`;
      act = `<button class="btn red" type="button" id="mapStart">${l.stars < 3 ? "Try for three stars" : "Play again"}</button>`;
    } else if (l.state === "open") {
      best = `<div class="vbest"><span>Not delivered yet · par ${L.par}</span></div>`;
      act = `<button class="btn red" type="button" id="mapStart">Start route</button>`;
    } else {
      const prev = l.n > 1 ? l.hood.lanes[l.n - 2] : undefined;
      const why =
        l.hood.state !== "open"
          ? `This lane opens in ${SEASON_LABEL[l.hood.season].toLowerCase()}.`
          : prev
            ? `Deliver ${nameOf(prev.id)} first to open this lane.`
            : "This lane is still overgrown.";
      best = `<div class="vbest locked">${icon("icoLock", "0 0 24 24")}<span>${why}</span></div>`;
      act = `<button class="btn" type="button" id="mapStart" disabled>Locked</button>`;
    }
    panel.innerHTML =
      `<span class="eyebrow">${SEASON_LABEL[l.hood.season]} · Route ${l.n}</span>` +
      (L.tag ? `<span class="vtag${L.sunday ? " red" : ""}">${L.tag}</span>` : "") +
      `<h2 id="mapLaneName">${L.name}</h2><p>${L.blurb}</p>` +
      `<ul class="vparcels" aria-label="Today's satchel">${parcels}</ul>` +
      best +
      act;
    const start = panel.querySelector<HTMLButtonElement>("#mapStart");
    if (start && l.state !== "locked") start.addEventListener("click", () => start_(l.id));
  }

  function start_(id: string) {
    const lane = laneOf(id);
    const i = index.get(id);
    if (!lane || lane.state === "locked" || i == null) return;
    hide();
    opts.onStart(i);
  }

  /* ---------- API ---------- */
  function select(id: string) {
    if (!laneOf(id)) return;
    selected = id;
    // redraw so the selection ring and chips follow; stamps that just landed only pop once
    fresh = [];
    drawMap();
    renderLanes();
    renderPanel();
  }

  function show() {
    refresh();
    selected = defaultLane();
    renderHud();
    drawMap();
    renderLanes();
    renderSeasons();
    renderPanel();
    view.hidden = false;
    try {
      window.scrollTo(0, 0);
    } catch {
      /* jsdom */
    }
  }

  function hide() {
    view.hidden = true;
  }

  return {
    show,
    hide,
    select,
    get selected() {
      return selected;
    },
    get progress() {
      return progress;
    },
    get visible() {
      return !view.hidden;
    },
  };
}
