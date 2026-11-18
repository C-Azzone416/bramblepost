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
import { MIN_TARGET_PX } from "../ui/board";
import { reducedMotion } from "../ui/motion";
import { LOOK } from "./look";
import { el, icon, seeded, starRow } from "../ui/svg";
import { BRIDGE, LANES, MAP_H, MAP_W, NEIGHBOURHOODS, POND, SEASONS, STREAM, fogAt, reservedSlots, sceneryOf, type Lane, type Season } from "./data";
import { allLanes, newStamps, villageProgress, type LaneProgress, type NeighbourhoodProgress, type VillageProgress } from "./progress";
import { endingSeen } from "../door/endingSave";
import { PIP_SIZE, RING_HALO_W, RING_R, calloutShape, layoutMarkers } from "./pip";
import { loadVillage, markStamped } from "./save";
import { loadCurrent, saveCurrent } from "./current";

export interface VillageMapOptions {
  /** Start the route at this index of `routes`. */
  onStart(index: number): void;
  /** Show the plain route list with the how-to-play notes. */
  onRouteList(): void;
  /** Open the Village Album (#19). Without it the Album button is hidden. */
  onAlbum?(): void;
  /** Open Settings (#18). Without it the Settings button is hidden. */
  onSettings?(): void;
  /**
   * Called before a village's map is shown, with whether it is the first time the player enters it. The
   * welcome intro (#61) plays here; the map waits for the returned promise. The signal aborts when the entry is
   * dropped (the player left, or reset), so the hook can close what it opened. Defaults to nothing.
   */
  onEnterVillage?(id: string, firstTime: boolean, signal?: AbortSignal): void | Promise<void>;
  /**
   * Preview tools only (#120): every village can be entered, even one whose season before it has no routes yet.
   * Never set in a production build. Default false.
   */
  openAll?: boolean;
}

export interface VillageMap {
  /** Re-read progress, draw the map and show it. */
  show(): void;
  /** Move focus to the next lane's chip (or the map heading when no lane is open), for keyboard and screen reader users. */
  focus(): void;
  hide(): void;
  /** Re-read the saved village after a reset and drop any entry in flight, without painting. */
  reload(): void;
  /** Tear the map down when its app is replaced: drop any entry in flight and remove the window and observer listeners. */
  dispose(): void;
  /** Select a lane (shows its details in the side panel). */
  select(id: string): void;
  readonly selected: string | null;
  readonly progress: VillageProgress;
  readonly visible: boolean;
  /** The id of the village whose map is showing. */
  readonly village: string;
}

const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
const SEASON_COLOUR: Record<Season, string> = { spring: "#8fc263", summer: "#e3a43a", autumn: "#d0672f", winter: "#9fc7d8" };

const MARKUP = `
<section id="mapView" class="village" hidden aria-labelledby="mapTitle">
  <div class="vtop">
    <div class="vplate">
      <svg class="vwheel" id="mapWheel" viewBox="-40 -40 80 80" aria-hidden="true"></svg>
      <div><small id="mapSeason">Spring</small><h1 id="mapTitle" tabindex="-1">Thistledown</h1></div>
    </div>
    <div class="vcount">
      <span title="Stamps">${icon("icoCheckHud", "0 0 28 28")}<b id="mapStamps">0</b><i id="mapStampsOf">/ 5 stamps</i></span>
      <span title="Stars">${icon("rbStarRim", "0 0 48 48")}<b id="mapStars">0</b><i id="mapStarsOf">/ 15 stars</i></span>
    </div>
    <button class="btn ghost" id="mapBack" type="button" hidden></button>
    <button class="btn ghost" id="mapAlbum" type="button" hidden>Album</button>
    <button class="btn ghost" id="mapSettings" type="button" hidden>Settings</button>
    <button class="btn ghost" id="mapHowTo" type="button">How to play</button>
  </div>
  <p class="vnews" id="mapNews" role="status" hidden></p>
  <div class="vbody">
    <div class="vstage">
      <svg id="villageSvg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Map of Thistledown"></svg>
      <button class="btn red vgo" id="mapEnter" type="button" hidden></button>
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
  /**
   * Thistledown is complete: all its lanes are stamped AND the closing scene has been seen. That opens the way
   * to Hollowmere. (Stamped alone is not enough: the ending plays when the last route is finished, and a player
   * who has stamped it but not seen it just plays that route again.)
   */
  let finished = false;
  /**
   * The village whose map is showing (saved), a guard so a slow intro can't be entered twice, and a run token for
   * the entry in flight: leaving the map, Back, or a reset bumps it, and a stale entry then does nothing when its hook resolves.
   */
  let current = NEIGHBOURHOODS[0].id;
  let entering = false;
  let run = 0;
  let entry: AbortController | null = null;
  const hoodIndex = () => NEIGHBOURHOODS.findIndex((n) => n.id === current);
  const hoodNow = () => NEIGHBOURHOODS[hoodIndex()];
  const lanesNow = () => allLanes(progress).filter((l) => l.hood.id === current);
  /** Villages open to enter: the first, and any whose predecessor is complete. */
  const hoodDone = (i: number) => !!progress.hoods[i]?.lanes.length && progress.hoods[i].lanes.every((l) => l.state === "done");
  const canEnter = (i: number) =>
    i === 0 || (i > 0 && i < NEIGHBOURHOODS.length && (!!opts.openAll || (hoodDone(i - 1) && (i !== 1 || endingSeen()))));

  q("mapHowTo").addEventListener("click", () => opts.onRouteList());
  if (opts.onAlbum) {
    q("mapAlbum").hidden = false;
    q("mapAlbum").addEventListener("click", () => opts.onAlbum!());
  }

  if (opts.onSettings) {
    q("mapSettings").hidden = false;
    q("mapSettings").addEventListener("click", () => opts.onSettings!());
  }

  function laneOf(id: string): (LaneProgress & { hood: NeighbourhoodProgress }) | undefined {
    return lanesNow().find((l) => l.id === id);
  }
  const routeOf = (id: string): Route | undefined => routes[index.get(id) ?? -1];
  const nameOf = (id: string) => routeOf(id)?.name ?? id;

  /* ---------- reading progress ---------- */
  function refresh() {
    progress = villageProgress(loadSave().best);
    finished = hoodDone(0) && endingSeen();
    const saved = loadCurrent().id;
    current = canEnter(NEIGHBOURHOODS.findIndex((n) => n.id === saved)) ? saved : NEIGHBOURHOODS[0].id;
    const seen = loadVillage().stamped;
    fresh = newStamps(progress, seen);
    markStamped(fresh);
  }

  function defaultLane(): string | null {
    const here = lanesNow();
    if (progress.today && here.some((l) => l.id === progress.today)) return progress.today;
    const done = here.filter((l) => l.state === "done");
    return done.length ? done[done.length - 1].id : (here[0]?.id ?? null);
  }

  /* ---------- the HUD ---------- */
  function renderHud() {
    const hood = progress.hoods[hoodIndex()];
    (container.parentElement ?? container).dataset.season = hood.season; // drives the light tokens in styles.css
    q("mapSeason").textContent = SEASON_LABEL[hood.season];
    q("mapTitle").textContent = hood.name;
    q("mapStamps").textContent = String(hood.stamps);
    q("mapStampsOf").textContent = `/ ${hood.lanes.length} stamps`;
    q("mapStars").textContent = String(hood.stars);
    q("mapStarsOf").textContent = `/ ${hood.lanes.length * 3} stars`;
    view.querySelector<HTMLElement>(".vcount")!.hidden = !hood.lanes.length;
    const prev = NEIGHBOURHOODS[hoodIndex() - 1];
    q("mapBack").hidden = !prev;
    if (prev) q("mapBack").textContent = `Back to ${prev.name}`;
    drawWheel(q<SVGSVGElement>("mapWheel"), hood.season);

    const news = q("mapNews");
    news.textContent = newsLine();
    news.hidden = !news.textContent;
  }

  function newsLine(): string {
    if (hoodIndex() > 0) return `${SEASON_LABEL[hoodNow().season]} routes coming.`;
    if (finished) return `Spring is done. ${progress.hoods.find((h) => h.state !== "open")?.name ?? "A new village"} next.`;
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
          stroke: LOOK.nodeRim,
          "stroke-width": 3,
        },
        w,
      );
    });
    el("circle", { r: 9, fill: LOOK.nodeRim }, w);
  }

  /* ---------- the map picture ---------- */
  function drawMap() {
    svg.innerHTML = "";
    const defs = el("defs", {}, svg);
    defs.innerHTML =
      '<linearGradient id="vMeadow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9d98a"/><stop offset=".55" stop-color="#9cc66e"/><stop offset="1" stop-color="#7fae58"/></linearGradient>' +
      '<radialGradient id="vSun" cx="200" cy="80" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--sun-core);stop-opacity:var(--sun-a)"/><stop offset=".5" style="stop-color:var(--sun-edge);stop-opacity:.16"/><stop offset="1" style="stop-color:var(--sun-edge);stop-opacity:0"/></radialGradient>' +
      '<linearGradient id="vWater" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd8e4"/><stop offset="1" stop-color="#5fa9c0"/></linearGradient>' +
      '<linearGradient id="vMere" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fe0e8"/><stop offset="1" stop-color="#4aa0bc"/></linearGradient>' +
      '<linearGradient id="vBrook" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4ece8"/><stop offset="1" stop-color="#8fc3c4"/></linearGradient>' +
      '<radialGradient id="vFog" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fbf6ea" stop-opacity=".96"/><stop offset="1" stop-color="#fbf6ea" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vVig" cx="50%" cy="50%" r="72%"><stop offset=".62" stop-color="#3d5a24" stop-opacity="0"/><stop offset="1" stop-color="#3d5a24" stop-opacity=".4"/></radialGradient>' +
      `<radialGradient id="vStamp" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${LOOK.stampLight}"/><stop offset="1" stop-color="${LOOK.stampDark}"/></radialGradient>` +
      '<filter id="vDrop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3" style="flood-color:var(--shadow);flood-opacity:var(--shadow-a)"/></filter>';

    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vMeadow)" }, svg);
    drawMeadow();
    el("rect", { width: MAP_W, height: MAP_H, style: "fill:var(--tint);opacity:var(--tint-a)", "pointer-events": "none" }, svg); // the season's sky tint (none in spring)
    if (sceneryOf(hoodNow()).water) drawWater();
    if (sceneryOf(hoodNow()).mere) drawMere();
    if (sceneryOf(hoodNow()).brook) drawBrook();

    drawLanes();
    if (sceneryOf(hoodNow()).water) drawBridge(BRIDGE.x, BRIDGE.y, BRIDGE.angle);
    drawTrees();
    drawBuildings();
    drawReserved();
    const brook = sceneryOf(hoodNow()).brook;
    if (brook) drawBridge(brook.bridge.x, brook.bridge.y, brook.bridge.angle); // above the hedge, so lane 6 reads as crossing on it
    const drawPlates = drawLockedHoods();
    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vSun)", "pointer-events": "none" }, svg);
    el("rect", { width: MAP_W, height: MAP_H, fill: "url(#vVig)", "pointer-events": "none" }, svg);
    drawPlates();
    drawNodes();
    drawPip();
    sizeMarkerHits();

    const p = progress.hoods[hoodIndex()];
    svg.setAttribute(
      "aria-label",
      hoodIndex() > 0
        ? `Map of ${p.name}. ${newsLine()}`
        : `Map of ${p.name}. ${p.stamps} of ${p.lanes.length} lanes stamped.` +
            (progress.today ? ` Next: ${nameOf(progress.today)}.` : finished ? " The whole path is complete. Spring is done. Hollowmere next." : ""),
    );
  }

  /** The stream and the mill pond. */
  function drawWater() {
    el("path", { d: STREAM, fill: "none", stroke: "#5f9fb4", "stroke-width": 40, "stroke-linecap": "round", opacity: 0.45 }, svg);
    el("path", { d: STREAM, fill: "none", stroke: "url(#vWater)", "stroke-width": 30, "stroke-linecap": "round" }, svg);
    el("path", { d: STREAM, fill: "none", stroke: "#e6f7fa", "stroke-width": 3, "stroke-dasharray": "14 22", opacity: 0.75 }, svg);
    el("ellipse", { cx: POND.x, cy: POND.y + 6, rx: POND.rx + 10, ry: POND.ry + 8, fill: "#5f9fb4", opacity: 0.45 }, svg);
    el("ellipse", { cx: POND.x, cy: POND.y, rx: POND.rx, ry: POND.ry, fill: "url(#vWater)" }, svg);
    el("path", { d: `M${POND.x - 70} ${POND.y - 8} C ${POND.x - 30} ${POND.y - 22}, ${POND.x + 40} ${POND.y - 24}, ${POND.x + 80} ${POND.y - 10}`, stroke: "#e6f7fa", "stroke-width": 3, fill: "none", opacity: 0.7 }, svg);
  }

  /**
   * Hollowmere's mere (the picked mockup): a round pond with a sandy shore, ripples, lily pads, reeds, a jetty and a red boat.
   * Water reads as water, never as a road: a sand bank round it, soft ripples, no lane colours. Every prop has its base on the
   * ground (reeds on the shore, the jetty's landward end on the sand) or sits on the water (pads, boat).
   */
  function drawMere() {
    const m = sceneryOf(hoodNow()).mere!;
    const g = el("g", { class: "vmere", "aria-hidden": "true" }, svg);
    el("ellipse", { ...m.shore, fill: "#f0dca0" }, g);
    el("ellipse", { ...m.deep, fill: "#5f9fb4", opacity: 0.5 }, g);
    el("ellipse", { ...m.water, fill: "url(#vMere)" }, g);
    for (const [x, y, w] of m.ripples) el("path", { d: `M${x} ${y} q${w / 2} -8 ${w} 0 t${w} 0`, stroke: "#e6f7fa", "stroke-width": 3, fill: "none", opacity: 0.8 }, g);
    for (const [x, y] of m.lilies) {
      el("ellipse", { cx: x, cy: y, rx: 13, ry: 8, fill: "#5f9a48" }, g);
      el("path", { d: `M${x} ${y} l12 -3`, stroke: "#4f9fb8", "stroke-width": 2 }, g);
    }
    el("circle", { cx: m.lilyFlower[0], cy: m.lilyFlower[1], r: 4, fill: "#f6b9c4" }, g);
    const j = el("g", { filter: "url(#vDrop)" }, g);
    el("rect", { x: m.jetty.x, y: m.jetty.y, width: m.jetty.w, height: m.jetty.h, rx: 3, fill: "#a8723f" }, j);
    el("path", { d: [16, 32, 48, 64].map((dy) => `M${m.jetty.x} ${m.jetty.y + 12 + dy - 16} h${m.jetty.w}`).join(" "), stroke: "#8a5a33", "stroke-width": 2 }, j);
    const boat = el("g", { transform: `translate(${m.boat[0]} ${m.boat[1]})` }, g);
    el("path", { d: "M-22 0 q22 14 44 0 l-6 -6 h-32z", fill: "#c4452e" }, boat);
    el("path", { d: "M0 -6 v-22 l14 16z", fill: "#fffaf0" }, boat);
    for (const [x, y, k] of m.reeds) drawReed(g, x, y, k);
  }

  /** A clump of reeds with two brown heads, base at (x, y). */
  function drawReed(g: SVGGElement, x: number, y: number, k: number) {
    const r = el("g", { transform: `translate(${x} ${y}) scale(${k})` }, g);
    el("path", { d: "M-8 0 q-2 -18 -6 -30 M-2 0 q0 -22 2 -36 M5 0 q2 -16 8 -28 M10 0 q3 -10 10 -16", stroke: "#6f8f3a", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, r);
    el("rect", { x: -2.5, y: -42, width: 5, height: 12, rx: 2.5, fill: "#7a4d2a" }, r);
    el("rect", { x: -16.5, y: -36, width: 5, height: 11, rx: 2.5, fill: "#7a4d2a" }, r);
  }

  /** A sunflower: a stem and two leaves, ten petals and a brown heart, base at (x, y). */
  function drawSunflower(g: SVGGElement, x: number, y: number, k: number) {
    const f = el("g", { transform: `translate(${x} ${y}) scale(${k})` }, g);
    el("path", { d: "M0 0 C1 -12 -1 -24 0 -36", stroke: "#5f8a3a", "stroke-width": 3, fill: "none" }, f);
    el("path", { d: "M0 -16 q-10 -6 -12 2 q8 2 12 -2z M0 -22 q10 -6 12 2 q-8 2 -12 -2z", fill: "#6f9c48" }, f);
    for (let i = 0; i < 10; i++) el("ellipse", { cx: 0, cy: -46, rx: 3.6, ry: 7.5, fill: i % 2 ? "#f4c02c" : "#f7d04a", transform: `rotate(${i * 36} 0 -38)` }, f);
    el("circle", { cx: 0, cy: -38, r: 6, fill: "#6b4423" }, f);
  }

  /** A small dashed arrow that curves down and right: the hint where a turning sunflower matters. */
  function drawTurnHint(g: SVGGElement, x: number, y: number) {
    const h = el("g", { transform: `translate(${x} ${y})`, opacity: 0.9 }, g);
    el("path", { d: "M0 0 A22 22 0 0 1 22 22", stroke: "#fffaf0", "stroke-width": 3.5, fill: "none", "stroke-linecap": "round", "stroke-dasharray": "5 5" }, h);
    el("path", { d: "M15 17 L22 25 L29 17", stroke: "#fffaf0", "stroke-width": 3.5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, h);
  }

  /** A smooth curve through `pts`: quadratic segments between their midpoints. */
  function smoothPath(pts: [number, number][]): string {
    const mid = (a: [number, number], b: [number, number]) => `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
    return `M${pts[0][0]} ${pts[0][1]} ` + pts.slice(1, -1).map((p, i) => `Q${p[0]} ${p[1]} ${mid(p, pts[i + 2])}`).join(" ") + ` L${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  }

  /**
   * Conker Corner's brook (the picked mockup): a pale stream from a spring pool at the top, running south through the wood.
   * Water reads as water, never as a road: a darker bank, ripple dashes, pebbles and stepping stones, and no lane colour.
   * The plank footbridge is drawn above the lanes, where lane 6 crosses it.
   */
  function drawBrook() {
    const b = sceneryOf(hoodNow()).brook!;
    const g = el("g", { class: "vbrook", "aria-hidden": "true" }, svg);
    const d = smoothPath(b.points);
    el("ellipse", { cx: b.pool.cx, cy: b.pool.cy + 3, rx: b.pool.rx + 8, ry: b.pool.ry + 6, fill: "#8fc3c4", opacity: 0.45 }, g);
    el("path", { d, fill: "none", stroke: "#8fc3c4", "stroke-width": b.bank * 2, "stroke-linecap": "round", opacity: 0.45 }, g);
    el("path", { d, fill: "none", stroke: "url(#vBrook)", "stroke-width": b.water * 2, "stroke-linecap": "round" }, g);
    el("ellipse", { ...b.pool, fill: "url(#vBrook)" }, g);
    // ripples: short arcs across the flow, uneven in length and spacing, never a line along the middle
    for (const [x, y, w] of b.ripples) el("path", { d: `M${x} ${y} q${w / 2} -4 ${w} 0`, fill: "none", stroke: "#e6f7fa", "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.85 }, g);
    el("path", { d: `M${b.pool.cx - 16} ${b.pool.cy} q8 -5 16 0 t16 0`, fill: "none", stroke: "#e6f7fa", "stroke-width": 2.5, opacity: 0.8 }, g);
    for (const [x, y] of b.pebbles) {
      el("ellipse", { cx: x, cy: y + 1.5, rx: 5, ry: 3.2, fill: "#8a5a33", opacity: 0.5 }, g);
      el("ellipse", { cx: x, cy: y, rx: 5, ry: 3.2, fill: "#fffaf0" }, g);
    }
    for (const [x, y] of b.stones) {
      el("ellipse", { cx: x, cy: y + 2, rx: 8, ry: 5, fill: "#8a5a33", opacity: 0.55 }, g);
      el("ellipse", { cx: x, cy: y, rx: 8, ry: 5, fill: "#fffaf0" }, g);
    }
  }

  /** The windmill on the east bank: a cream tower with a wooden cap, a door and four lattice sails. Its base is on the ground. */
  function drawWindmill(g: SVGGElement, x: number, y: number, k: number) {
    const m = el("g", { transform: `translate(${x} ${y}) scale(${k})` }, g);
    el("ellipse", { cx: 4, cy: 4, rx: 40, ry: 9, fill: "#4f7a35", opacity: 0.35 }, m);
    el("path", { d: "M-30 0 L-21 -92 L21 -92 L30 0Z", fill: "#fffaf0" }, m);
    el("path", { d: "M-27 -22 h54 M-24.5 -46 h49 M-22.5 -70 h45", stroke: "#e6dcc4", "stroke-width": 2 }, m);
    el("path", { d: "M-22 -92 L0 -118 L22 -92Z", fill: "#7a4d2a" }, m);
    el("path", { d: "M-9 0 v-20 a9 9 0 0 1 18 0 v20z", fill: "#7a4d2a" }, m);
    el("rect", { x: -5, y: -66, width: 10, height: 12, rx: 3, fill: "#e3a43a" }, m);
    const sails = el("g", { transform: "translate(0 -98) rotate(35)" }, m);
    for (let i = 0; i < 4; i++) {
      el("rect", { x: 6, y: -9, width: 76, height: 18, rx: 2, fill: "#7a4d2a", transform: `rotate(${i * 90})` }, sails);
      el("rect", { x: 11, y: -5.5, width: 66, height: 11, fill: "#fffaf0", transform: `rotate(${i * 90})` }, sails);
      el("path", { d: "M30 -5.5 v11 M48 -5.5 v11 M66 -5.5 v11", stroke: "#7a4d2a", "stroke-width": 1.5, transform: `rotate(${i * 90})` }, sails);
    }
    el("circle", { r: 7, fill: "#7a4d2a" }, sails);
  }

  /** The fenced pumpkin patch: tilled soil, a fence with its posts on the ground, pumpkins and a scarecrow. */
  function drawPatch(g: SVGGElement) {
    const { fence: f, pumpkins, scarecrow } = sceneryOf(hoodNow()).patch!;
    const p = el("g", { class: "vpatch" }, g);
    el("rect", { x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0, rx: 8, fill: "#7a4d2a", opacity: 0.45 }, p);
    el("path", { d: `M${f.x0} ${f.y0 + 6} H${f.x1} M${f.x0} ${f.y1 - 8} H${f.x1}`, stroke: "#5c3a1f", "stroke-width": 2, opacity: 0.35 }, p);
    for (const [x, y, k] of pumpkins) {
      const q = el("g", { transform: `translate(${x} ${y}) scale(${k})` }, p);
      el("path", { d: "M-6 -9 q-8 -4 -12 4", stroke: "#5f8d3e", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, q);
      el("ellipse", { cx: 0, cy: -8, rx: 13, ry: 10, fill: "#e05a3c" }, q);
      el("ellipse", { cx: 0, cy: -8, rx: 5.5, ry: 10, fill: "#e3a43a" }, q);
      el("rect", { x: -1.5, y: -21, width: 3, height: 6, rx: 1.5, fill: "#5f8d3e" }, q);
    }
    // the fence: a rail along each side and posts with their feet on the ground
    const rail = (x0: number, y0: number, x1: number, y1: number) => el("path", { d: `M${x0} ${y0} L${x1} ${y1}`, stroke: "#7a4d2a", "stroke-width": 3, "stroke-linecap": "round" }, p);
    rail(f.x0, f.y0 - 7, f.x1, f.y0 - 7);
    rail(f.x0, f.y1 - 7, f.x1, f.y1 - 7);
    rail(f.x0, f.y0 - 7, f.x0, f.y1 - 7);
    rail(f.x1, f.y0 - 7, f.x1, f.y1 - 7);
    const post = (x: number, y: number) => el("rect", { x: x - 2.5, y: y - 14, width: 5, height: 14, rx: 2, fill: "#a8723f" }, p);
    for (let x = f.x0; x <= f.x1 + 0.1; x += (f.x1 - f.x0) / 6) {
      post(x, f.y0);
      post(x, f.y1);
    }
    for (let y = f.y0 + (f.y1 - f.y0) / 3; y < f.y1 - 1; y += (f.y1 - f.y0) / 3) {
      post(f.x0, y);
      post(f.x1, y);
    }
    const [sx, sy] = scarecrow;
    const c = el("g", { transform: `translate(${sx} ${sy})` }, p);
    el("ellipse", { cx: 2, cy: 2, rx: 14, ry: 4, fill: "#4f7a35", opacity: 0.35 }, c);
    el("rect", { x: -2, y: -56, width: 4, height: 56, rx: 1.5, fill: "#7a4d2a" }, c);
    el("rect", { x: -24, y: -44, width: 48, height: 4, rx: 2, fill: "#7a4d2a" }, c);
    el("path", { d: "M-10 -46 h20 l-3 22 h-14z", fill: "#4f9fb8" }, c);
    el("path", { d: "M-24 -40 l-5 9 M24 -40 l5 9 M-4 -24 l-2 8 M4 -24 l2 8", stroke: "#e3a43a", "stroke-width": 2.5, "stroke-linecap": "round" }, c);
    el("circle", { cx: 0, cy: -56, r: 7, fill: "#f1dfb4" }, c);
    el("path", { d: "M-11 -60 h22 l-5 -11 h-12z", fill: "#7a4d2a" }, c);
  }

  /** A leaf gust: two soft streaks with three leaves riding them. A hint where a gust matters (#125); it sits above the lanes. */
  function drawGust(g: SVGGElement, x: number, y: number, angle: number, len: number) {
    const k = len / 130;
    const h = el("g", { transform: `translate(${x} ${y}) rotate(${angle}) scale(${k})`, opacity: 0.9 }, g);
    el("path", { d: "M0 0 C39 -18, 78 18, 130 0", stroke: "#fffaf0", "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, h);
    el("path", { d: "M19.5 14 C52 -2, 84.5 26, 117 12", stroke: "#fffaf0", "stroke-width": 3, fill: "none", "stroke-linecap": "round", opacity: 0.7 }, h);
    for (const [lx, ly, c] of [[32.5, -6, "#e05a3c"], [71.5, 8, "#e3a43a"], [110.5, -4, "#a8723f"]] as const) el("path", { d: `M${lx} ${ly} q6 -7 12 0 q-6 7 -12 0z`, fill: c }, h);
  }

  /** A lumpy leafy clump, base at (x, y): a pile of autumn leaves. No dots, no berries. */
  function drawBush(g: SVGGElement, x: number, y: number, k: number) {
    const b = el("g", { transform: `translate(${x} ${y}) scale(${k})` }, g);
    el("ellipse", { cx: 3, cy: 4, rx: 34, ry: 8, fill: "#7a4d2a", opacity: 0.3 }, b);
    const lumps: [number, number, number, number][] = [[-18, -12, 12, 0], [15, -14, 12, 1], [-2, -24, 13, 2], [-24, -3, 10, 1], [25, -4, 10, 0], [-9, -6, 12, 2], [10, -7, 12, 1], [0, -14, 11, 0]];
    const cols = ["#e05a3c", "#e3a43a", "#a8723f"];
    for (const [cx, cy, r, c] of lumps) el("circle", { cx, cy, r, fill: cols[c] }, b);
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
    const sc = sceneryOf(hoodNow());
    let last: { x: number; y: number } = sc.start;
    // a short footpath from the post office door to where the first lane starts
    if (sc.postOfficeAt) {
      const d = `M${sc.postOfficeAt.x} ${sc.postOfficeAt.y - 3} L${sc.start.x} ${sc.start.y}`;
      el("path", { d, stroke: "#c9a874", "stroke-width": 32, opacity: 0.7 }, g);
      el("path", { d, stroke: "#f1dfb4", "stroke-width": 24 }, g);
    }
    for (const l of lanesNow()) {
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
    const spare = reservedSlots(hoodNow());
    if (spare.length) last = spare[spare.length - 1];
    // a faint track toward the next village once the lanes run out
    const next = NEIGHBOURHOODS[hoodIndex() + 1];
    if (next && !next.routes.length) {
      const at = fogAt(next, hoodNow().id);
      const mx = (last.x + at.x) / 2 + 30;
      const my = (last.y + at.y) / 2 + 10;
      el("path", { d: `M${last.x} ${last.y} Q ${mx} ${my}, ${at.x} ${at.y + 50}`, stroke: "#efe4c8", "stroke-width": 16, "stroke-dasharray": "2 16", opacity: 0.85 }, g);
    }
  }

  function drawBridge(x: number, y: number, angle: number) {
    const g = el("g", { transform: `translate(${x} ${y}) rotate(${angle})`, filter: "url(#vDrop)" }, svg);
    el("rect", { x: -34, y: -22, width: 68, height: 44, rx: 7, fill: "#a8723f" }, g);
    el("path", { d: "M-24 -22 v44 M-8 -22 v44 M8 -22 v44 M24 -22 v44", stroke: "#8a5a33", "stroke-width": 3 }, g);
    el("rect", { x: -38, y: -28, width: 76, height: 8, rx: 4, fill: "#7a4d2a" }, g);
    el("rect", { x: -38, y: 20, width: 76, height: 8, rx: 4, fill: "#7a4d2a" }, g);
  }

  function drawTrees() {
    const r = seeded(17);
    const g = el("g", { "aria-hidden": "true" }, svg);
    const sc = sceneryOf(hoodNow());
    for (const [x, y, s] of sc.trees) {
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
    const { sunflowers, turnHints } = sc;
    for (const [x, y, k] of sunflowers ?? []) drawSunflower(g, x, y, k);
    for (const [x, y] of turnHints ?? []) drawTurnHint(g, x, y);
    for (const [x, y, k] of sc.reeds ?? []) drawReed(g, x, y, k);
    for (const [x, y, k] of sc.bushes ?? []) drawBush(g, x, y, k);
    if (sc.windmill) drawWindmill(g, sc.windmill.x, sc.windmill.y, sc.windmill.scale);
    if (sc.patch) drawPatch(g);
    for (const [x, y, a, len] of sc.gusts ?? []) drawGust(g, x, y, a, len);
  }

  function drawBuildings() {
    const g = el("g", { filter: "url(#vDrop)", "aria-hidden": "true" }, svg);
    const { start, postOffice, postOfficeAt } = sceneryOf(hoodNow());
    if (postOfficeAt) {
      // the village's own post office sprite comes with #141; until then the stump post office stands in
      const w = 100 * postOfficeAt.scale, h = 105 * postOfficeAt.scale;
      el("use", { href: "#rbPO", x: postOfficeAt.x - w / 2, y: postOfficeAt.y - h, width: w, height: h }, g);
    } else if (postOffice) el("use", { href: "#rbPO", x: start.x - 50, y: start.y - 98, width: 100, height: 105 }, g);
    else drawGate(g, start);
    for (const l of lanesNow()) {
      const L = LANES[l.id];
      if (!L) continue;
      const n = NEIGHBOURS[L.style];
      const w = n.w * (L.houseScale ?? 0.95);
      const h = n.h * (L.houseScale ?? 0.95);
      el(
        "use",
        { href: "#" + n.sym, x: L.x + L.house[0], y: L.y + L.house[1], width: w, height: h, class: l.state === "locked" ? "vfaded" : "" },
        g,
      );
    }
  }

  /** Where the path comes in on a village with no post office: a pair of gateposts. */
  function drawGate(g: SVGGElement, at: { x: number; y: number }) {
    for (const dx of [-26, 26]) {
      el("rect", { x: at.x + dx - 7, y: at.y - 52, width: 14, height: 60, rx: 5, fill: "#7a4d2a" }, g);
      el("circle", { cx: at.x + dx, cy: at.y - 54, r: 9, fill: "#a8723f" }, g);
    }
  }

  /** Lane slots with no route yet: a hedge across the way, a bush where the stamp will go, fog on top. */
  function drawReserved() {
    {
      const N = hoodNow();
      let prev: { x: number; y: number } = N.slots[N.routes.length - 1] ?? sceneryOf(N).start;
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

  /**
   * The villages ahead of this one. Only the next one is teased (#118): fog, ghost houses and a name plate, or an
   * entry button once it is open. Villages further on are plain mist, with no name or houses, until you get closer.
   */
  function drawLockedHoods(): () => void {
    const later: (() => void)[] = [];
    const entry = q("mapEnter");
    entry.hidden = true;
    // farthest season first, so the next village's fog, ghosts and plate always sit on top of any far mist
    for (const [i, N] of [...NEIGHBOURHOODS.entries()].reverse()) {
      const h = progress.hoods[i];
      if (i <= hoodIndex() || !h) continue;
      const { x, y } = fogAt(N, hoodNow().id);
      const next = i === hoodIndex() + 1;
      const open = next && canEnter(i);
      const g = el("g", { transform: `translate(${x} ${y})`, class: next ? "vfog" : "vfog vfar", "data-hood": h.id }, svg);
      el("ellipse", { cx: 0, cy: 10, rx: 170, ry: 96, fill: "url(#vFog)" }, g);
      if (!next) continue;
      const ghosts = el("g", { opacity: 0.45 }, g);
      el("use", { href: "#mushHouse", x: -64, y: -64, width: 60, height: 71 }, ghosts);
      el("use", { href: "#acornHouse", x: 6, y: -50, width: 50, height: 62 }, ghosts);
      el("ellipse", { cx: -10, cy: 34, rx: 140, ry: 44, fill: "url(#vFog)" }, g);
      if (open) {
        // a real button laid over the map where the plate would be, so keyboard, touch and screen readers can use it
        entry.hidden = false;
        entry.dataset.hood = h.id;
        entry.textContent = `Go to ${h.name}`;
        if (entering) entry.setAttribute("aria-disabled", "true");
        else entry.removeAttribute("aria-disabled");
        entry.style.left = `${((x / MAP_W) * 100).toFixed(2)}%`;
        entry.style.top = `${(((y + 42) / MAP_H) * 100).toFixed(2)}%`;
        continue;
      }
      later.push(() => {
        // the name plate is drawn above the sun and vignette so they can't wash out its text (#95)
        const hood = el("g", { transform: `translate(${x} ${y})`, class: "vhood", "data-hood": h.id }, svg);
        const plate = el("g", { transform: "translate(0 42)" }, hood);
        el("rect", { x: -100, y: -24, width: 200, height: 50, rx: 25, fill: LOOK.plateFill, opacity: LOOK.plateOpacity }, plate);
        const t1 = el("text", { x: 0, y: -1, "text-anchor": "middle", class: "vplateName" }, plate);
        t1.textContent = h.name;
        const t2 = el("text", { x: 0, y: 17, "text-anchor": "middle", class: "vplateNote" }, plate);
        t2.textContent = h.state === "soon" ? `${SEASON_LABEL[h.season]} routes coming soon` : `Opens in ${SEASON_LABEL[h.season].toLowerCase()}`;
      });
    }
    return () => later.forEach((f) => f());
  }

  /* ---------- tap targets on the lane markers ---------- */
  /** The hit circles of the tappable (open or stamped) markers, and every marker's centre, in SVG units. */
  let hitMarks: { circle: SVGCircleElement; x: number; y: number }[] = [];
  let centres: { x: number; y: number }[] = [];

  /**
   * Size each tappable marker's transparent hit circle to MIN_TARGET_PX across on screen, whatever the map
   * is scaled to. Capped at half the distance to the nearest other marker, so neighbouring hit circles never
   * overlap and a tap lands on the marker it is nearest. With no rendered scale (jsdom, or the map hidden)
   * the circles keep their size; the ResizeObserver and window resize re-run this once the map is shown.
   */
  function sizeMarkerHits() {
    const m = svg.getScreenCTM?.();
    const scale = m ? Math.abs(m.a) : 0;
    if (!(scale > 0)) return;
    const want = MIN_TARGET_PX / 2 / scale;
    for (const h of hitMarks) {
      let cap = Infinity;
      for (const o of centres) {
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        if (d > 0) cap = Math.min(cap, d / 2);
      }
      h.circle.setAttribute("r", String(Math.min(want, cap)));
    }
  }
  const sizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => sizeMarkerHits()) : undefined;
  sizeObserver?.observe(svg);
  const onResize = () => sizeMarkerHits();
  window.addEventListener("resize", onResize);

  function drawNodes() {
    const g = el("g", { class: "vnodes" }, svg);
    hitMarks = [];
    centres = lanesNow()
      .map((l) => LANES[l.id])
      .filter((L): L is Lane => !!L)
      .map((L) => ({ x: L.x, y: L.y }));
    for (const l of lanesNow()) {
      const L = LANES[l.id];
      if (!L) continue;
      const n = el("g", { transform: `translate(${L.x} ${L.y})`, class: `vnode ${l.state}` + (l.id === selected ? " sel" : ""), "data-lane": l.id }, g);
      // a transparent finger-sized hit circle, only on the tappable markers; sized in sizeMarkerHits()
      if (l.state === "open" || l.state === "done") {
        const circle = el("circle", { r: 0, fill: "transparent", class: "vhit" }, n);
        hitMarks.push({ circle, x: L.x, y: L.y });
      }
      if (l.id === selected) {
        // a cream halo under the navy dashes keeps the ring readable on light and dark ground alike
        const ring = el("g", { class: "vring" }, n);
        el("circle", { r: RING_R, fill: "none", stroke: LOOK.ringHalo, "stroke-width": RING_HALO_W }, ring);
        el("circle", { r: RING_R, fill: "none", stroke: LOOK.ringDash, "stroke-width": 4, "stroke-dasharray": "7 6" }, ring);
      }
      const body = el("g", { filter: "url(#vDrop)", class: fresh.includes(l.id) ? "vfresh" : "" }, n);
      if (l.state === "done") {
        el("circle", { r: 24, fill: "url(#vStamp)", stroke: LOOK.nodeRim, "stroke-width": 4 }, body);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          el("circle", { cx: (Math.cos(a) * 24).toFixed(1), cy: (Math.sin(a) * 24).toFixed(1), r: 3, fill: LOOK.nodeRim }, body);
        }
        el("path", { d: "M-9 0 l6 7 l12 -14", stroke: LOOK.iconDark, "stroke-width": 4, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, body);
        const s = el("g", { transform: "translate(-27 27)", class: "vstars" }, n);
        el("rect", { x: -4, y: -3, width: 62, height: 24, rx: 12, fill: LOOK.pillFill, opacity: LOOK.pillOpacity }, s); // a dark pill so the stars read on any ground
        for (let i = 0; i < 3; i++) el("use", { href: i < l.stars ? "#rbStar" : "#rbStarOff", x: i * 18, y: 0, width: 18, height: 18 }, s);
      } else if (l.state === "open") {
        el("circle", { r: 38, fill: LOOK.nodeRed, opacity: 0.25, class: "vpulse" }, n);
        el("circle", { r: 24, fill: LOOK.nodeRed, stroke: LOOK.nodeRim, "stroke-width": 4 }, body);
        const t = el("text", { y: 8, "text-anchor": "middle", class: "vnum" }, body);
        t.textContent = String(l.n);
      } else {
        el("circle", { r: 21, fill: LOOK.nodeGrey, stroke: LOOK.nodeRim, "stroke-width": 4 }, body);
        el("rect", { x: -8, y: -2, width: 16, height: 12, rx: 3, fill: LOOK.iconDark }, body);
        el("path", { d: "M-4.5 -2 v-4 a4.5 4.5 0 0 1 9 0 v4", stroke: LOOK.iconDark, "stroke-width": 3, fill: "none" }, body);
      }
      n.addEventListener("click", () => select(l.id));
    }
    // "Today" callout above the open lane
    if (progress.today && LANES[progress.today] && laneOf(progress.today)) {
      const L = LANES[progress.today];
      const lane = laneOf(progress.today)!;
      const label = `Today · Route ${lane.n}`;
      const w = 24 + label.length * 8;
      const sh = calloutShape(L, w, markers().callout ?? [0, -62]); // above the marker unless that covers Pip, a star pill or another node: then higher or to a side
      const c = el("g", { transform: `translate(${sh.cx} ${sh.cy})`, filter: "url(#vDrop)", class: "vtoday", "pointer-events": "none" }, svg);
      el("rect", { x: -w / 2, y: -19, width: w, height: 34, rx: 17, fill: LOOK.calloutBg }, c);
      // the tail points at the marker, whichever way the pill moved
      const rel = (p: { x: number; y: number }) => `${(p.x - sh.cx).toFixed(1)} ${(p.y - sh.cy).toFixed(1)}`;
      el("path", { d: `M${sh.base.x - sh.cx - 7} ${sh.base.y - sh.cy} L${rel(sh.tip)} L${sh.base.x - sh.cx + 7} ${sh.base.y - sh.cy}Z`, fill: LOOK.calloutBg }, c);
      const t = el("text", { y: 4, "text-anchor": "middle", class: "vcallout" }, c);
      t.textContent = label;
    }
  }

  /** Where Pip stands and where the Today callout sits (clear of each other, the star pills, other nodes and the open marker; #103). */
  function markers() {
    const at = defaultLane();
    const hood = hoodNow();
    const { start } = sceneryOf(hood);
    const lanes = lanesNow();
    const today = progress.today ? laneOf(progress.today) : undefined;
    const done = new Set(lanes.flatMap((l, i) => (l.state === "done" ? [i] : [])));
    // Pip heads for the open lane; a village with no open route (Hollowmere) has him wait at its gate, on the approach to its first lane.
    const target = at ? hood.routes.indexOf(at) : 0;
    const w = 24 + `Today · Route ${today ? today.n : 15}`.length * 8;
    const todayIdx = today ? hood.routes.indexOf(today.id) : null;
    return layoutMarkers(hood.slots, start, lanes.length, done, target < 0 ? 0 : target, todayIdx !== null && todayIdx >= 0 ? todayIdx : null, w);
  }

  function drawPip() {
    const spot = markers().pip;
    el("use", { id: "mapPip", href: "#pip", x: spot.x, y: spot.y, width: PIP_SIZE.w, height: PIP_SIZE.h, filter: "url(#vDrop)", class: "vpip", "pointer-events": "none" }, svg);
  }

  /* ---------- lane list and side panel ---------- */
  function renderLanes() {
    const ol = q("mapLanes");
    ol.innerHTML = "";
    for (const l of lanesNow()) {
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
        (l.state === "done" ? `<span class="srow" aria-hidden="true">${starRow(l.stars, true)}</span>` : "");
      b.addEventListener("click", () => select(l.id));
      li.appendChild(b);
      ol.appendChild(li);
    }
  }

  function renderSeasons() {
    const ul = q("mapSeasons");
    ul.innerHTML = "";
    // seasons up to the first locked one: the next season is teased, the ones after it stay unnamed (#118)
    const firstLocked = progress.hoods.findIndex((h) => h.state === "locked");
    const shown = firstLocked < 0 ? progress.hoods : progress.hoods.slice(0, firstLocked + 1);
    for (const h of shown) {
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
      best = `<div class="vbest"><span class="srow" aria-label="${l.stars} of 3 stars">${starRow(l.stars, true)}</span><span>Best ${l.moves} ${l.moves === 1 ? "move" : "moves"} · par ${L.par}</span></div>`;
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

  /** Draw the whole view for the current village. */
  function paint() {
    selected = defaultLane();
    renderHud();
    drawMap();
    renderLanes();
    renderSeasons();
    renderPanel();
    view.classList.toggle("vcomplete", finished);
    view.hidden = false;
    sizeMarkerHits();
    try {
      window.scrollTo(0, 0);
    } catch {
      /* jsdom */
    }
  }

  function show() {
    refresh();
    paint();
  }

  /** A short fade-in of another village's map (the old view is replaced at once); none under reduced motion. */
  function fade() {
    view.classList.remove("vfade");
    if (reducedMotion()) return;
    void view.offsetWidth;
    view.classList.add("vfade");
  }

  /** Drop any entry in flight: its hook may still resolve, but it will not save or paint. */
  function cancelEntry() {
    run++;
    entry?.abort();
    entry = null;
    entering = false;
    q("mapEnter").removeAttribute("aria-disabled");
  }

  /** Go into a village that is open: let the intro hook run first, then show its map. */
  async function enter(id: string) {
    const i = NEIGHBOURHOODS.findIndex((n) => n.id === id);
    if (entering || !canEnter(i)) return;
    entering = true;
    q("mapEnter").setAttribute("aria-disabled", "true");
    const token = ++run;
    const ac = (entry = new AbortController());
    try {
      await opts.onEnterVillage?.(id, !loadCurrent().visited.includes(id), ac.signal);
    } catch {
      if (token === run) cancelEntry(); // the intro failed: stay where we are
      return;
    } finally {
      if (entry === ac) entry = null; // settled: a later Back, hide or reset has nothing of this entry to abort
    }
    if (token !== run || view.hidden) return; // the player left the map, reset or went back meanwhile
    entering = false;
    progress = villageProgress(loadSave().best);
    if (!canEnter(i)) {
      paint(); // the unlock is gone: show the map as it now stands
      return;
    }
    current = id;
    saveCurrent(id);
    paint();
    fade();
    q("mapTitle").focus();
  }

  /** Back to the village before this one, with focus on the way in. */
  function back() {
    const prev = NEIGHBOURHOODS[hoodIndex() - 1];
    if (!prev) return;
    cancelEntry();
    current = prev.id;
    saveCurrent(prev.id);
    paint();
    fade();
    (q("mapEnter").hidden ? q("mapTitle") : q("mapEnter")).focus();
  }
  q("mapEnter").addEventListener("click", () => void enter(q("mapEnter").dataset.hood!));
  q("mapBack").addEventListener("click", back);

  function focus() {
    const chip = [...q("mapLanes").querySelectorAll<HTMLButtonElement>("button")].find((b) => b.dataset.lane === progress.today);
    (chip ?? q("mapTitle")).focus();
  }

  function hide() {
    cancelEntry();
    view.hidden = true;
  }

  /** Re-read the saved village after a reset (even a half-working one) without painting; also drops any entry in flight. */
  function reload() {
    cancelEntry();
    refresh();
  }

  function dispose() {
    cancelEntry();
    window.removeEventListener("resize", onResize);
    sizeObserver?.disconnect();
  }

  return {
    show,
    focus,
    hide,
    reload,
    dispose,
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
    get village() {
      return current;
    },
  };
}
