/** The board view: SVG drawing, Pip's walk, and tap / swipe (Pointer Events) and keyboard input. */
import { BED, SUN, reachable, type Move } from "../engine";
import { createAmbient, spotFor, washSide, type Spot } from "./ambient";
import { PARCELS } from "./cast";
import { EDGE, LEAF_COLOURS, MB, MX, MY, T, TILT, TILT_TRANSFORM, boardHeight, cellXY, drawBed, drawBridge, drawFlecks, drawGrass, drawLeaf, drawPath, drawWater, drawWindArrow, projY, screenXY } from "./draw";
import type { GameState } from "./game";
import { reducedMotion } from "./motion";
import { gateOpen, houseOf } from "./satchel";
import { createStepout } from "./neighbours";
import { $, el, seeded } from "./svg";

export interface Anim {
  rot?: { i: number; d: number };
  slide?: { to: number; dx: number; dy: number; wrap?: boolean }[];
  /** Sunflower cells (where they are now) that just turned a quarter clockwise by themselves. */
  sun?: number[];
}

export interface BoardHost {
  /** The current game. Only called where a route is open. */
  g(): GameState;
  /** The current game, or null on the route list. */
  readonly G: GameState | null;
  readonly reduce: boolean;
  tryMove(m: Move): void;
  undo(): void;
  toast(msg: string): void;
  renderSide(): void;
}

/** Minimum tap target for the slide arrows, in CSS pixels (WCAG 2.5.5 / platform guidance). */
export const MIN_TARGET_PX = 44;

/** How far (CSS px) a slide arrow's hit area may reach past the svg's own box, into the stage padding. */
export const OVERFLOW_PX = 20;

/**
 * The invisible hit rectangle of a slide arrow along its outward axis, in SVG units, for a board rendered at
 * `scale` CSS px per unit. `inner` is the room between the arrow and the grid edge (the rectangle must never
 * cross it, so a tap on a tile edge always turns the tile); `outer` is the room on the far side. The rectangle
 * fills the inner room first, then reaches outward, so the total is MIN_TARGET_PX on screen whenever the
 * room allows. Returns the extent either side of the arrow centre.
 */
export function hitExtent(scale: number, inner: number, outer: number): { inner: number; outer: number } {
  const len = MIN_TARGET_PX / (scale > 0 ? scale : 1);
  const i = Math.min(inner, len);
  return { inner: i, outer: Math.min(outer, len - i) };
}

export function createBoard(host: BoardHost) {
  const g = () => host.g();
  const reduce = () => host.reduce;
  const ambient = createAmbient(() => !$("gameView").hidden, $("gameView"));
  const stepout = createStepout(() => (host.reduce || reducedMotion()));

  const layers = {} as {
    proj: SVGGElement;
    tiles: SVGGElement;
    glow: SVGGElement;
    tops: SVGGElement;
    wind: SVGGElement;
    badges: SVGGElement;
    gust: SVGGElement;
    ambient: SVGGElement;
    pip: SVGGElement;
    cursor: SVGGElement;
    handles: SVGGElement;
    pipG: SVGGElement;
    pipFlip: SVGGElement;
  };
  /** A cell's top-left in flat grid space (what the engine and the slide animation use). */
  const xy = (i: number) => cellXY(g().P, i);
  /** A cell's top-left as drawn on the tilted board. Things that stand up are placed from here, unsquashed. */
  const sxy = (i: number) => screenXY(g().P, i);

  function buildBoard() {
    const P = g().P;
    const svg = $("board") as unknown as SVGSVGElement;
    svg.innerHTML = "";
    hits.length = 0;
    stepout.stop();
    lastScale = -1;
    const W = P.w * T + MX * 2;
    const H = boardHeight(P.h);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const defs = el("defs", {}, svg);
    const cp = el("clipPath", { id: "boardClip" }, defs);
    el("rect", { x: MX, y: MY - 30, width: P.w * T, height: P.h * T + 30 }, cp);
    // the tabletop: a soft shadow on the ground, the front edge (the board's thickness), and the grass bed on top
    const gh = P.h * T * TILT; // the grid's height on screen
    el("ellipse", { cx: W / 2, cy: MY + gh + EDGE + 26, rx: P.w * T * 0.54, ry: 20, fill: "#3b2a14", opacity: 0.3, filter: "url(#soft)" }, svg);
    el("rect", { x: MX - 12, y: MY - 12 + EDGE, width: P.w * T + 24, height: gh + 22, rx: 24, fill: "#4a2f18" }, svg);
    el("rect", { x: MX - 12, y: MY - 12 + EDGE * 0.45, width: P.w * T + 24, height: gh + 22, rx: 24, fill: "#7f532d" }, svg);
    el("rect", { x: MX - 12, y: MY - 12, width: P.w * T + 24, height: gh + 22, rx: 24, fill: "#5d7a3a" }, svg);
    // the tile layer: grid space, foreshortened. Its CTM maps pointers back to the flat grid.
    layers.proj = el("g", { id: "boardTilt", transform: TILT_TRANSFORM }, svg);
    const clipG = el("g", { "clip-path": "url(#boardClip)" }, layers.proj);
    layers.tiles = el("g", {}, clipG);
    layers.glow = el("g", { "pointer-events": "none" }, svg);
    layers.tops = el("g", { "pointer-events": "none" }, svg);
    layers.wind = el("g", { "pointer-events": "none", "aria-hidden": "true", class: "windmark" }, svg);
    layers.badges = el("g", { "pointer-events": "none" }, svg);
    layers.ambient = el("g", {}, svg); // above the houses, below Pip
    ambient.build(
      layers.ambient,
      { x0: MX, y0: projY(MY), x1: MX + P.w * T, y1: projY(MY + P.h * T) },
      P.kind.filter((k, i) => k === "b" && P.name[i] !== "P").length,
    );
    layers.pip = el("g", { "pointer-events": "none" }, svg);
    layers.gust = el("g", { "pointer-events": "none", "aria-hidden": "true" }, svg);
    layers.cursor = el("g", { "pointer-events": "none" }, svg);
    layers.handles = el("g", {}, svg);
    // Pip
    const pg = el("g", { id: "pipMover" }, layers.pip);
    const flip = el("g", { id: "pipFlip" }, pg);
    el("use", { href: "#pip", x: -36, y: -62, width: 70, height: 66 }, flip);
    layers.pipG = pg;
    layers.pipFlip = flip;
    placePip(pipSpot(g().at), false);
    // slide handles
    for (let y = 0; y < P.h; y++) {
      if (P.rowsM[y].length < 2) continue;
      const hy = projY(MY + y * T + T / 2);
      handle(MX - 34, hy, 180, { t: "row", y, d: -1 }, `Slide row ${y + 1} left`, 34, MX - 34);
      handle(MX + P.w * T + 34, hy, 0, { t: "row", y, d: 1 }, `Slide row ${y + 1} right`, 34, MX - 34);
    }
    for (let x = 0; x < P.w; x++) {
      if (P.colsM[x].length < 2) continue;
      handle(MX + x * T + T / 2, MY - 44, -90, { t: "col", x, d: -1 }, `Slide column ${x + 1} up`, 44, MY - 44);
      handle(MX + x * T + T / 2, MY + P.h * T * TILT + EDGE + 36, 90, { t: "col", x, d: 1 }, `Slide column ${x + 1} down`, 36, MB - 36);
    }
    sizeHandles();
  }

  /** Each arrow's hit area: at least MIN_TARGET_PX on screen, whatever the board is scaled to, never over the grid. */
  function sizeHandles() {
    const svg = $("board") as unknown as SVGSVGElement;
    const m = svg.getScreenCTM?.();
    const scale = m ? Math.abs(m.a) : 0;
    if (scale === lastScale) return;
    lastScale = scale;
    for (const hz of hits) {
      const e = hitExtent(scale, hz.inner, hz.outer + (scale > 0 ? OVERFLOW_PX / scale : 0));
      // Across the row (or column) the hit area is MIN_TARGET_PX where there's room, but never wider than the pitch
      // to the next arrow, so neighbouring hit areas touch and never overlap.
      const len = Math.min(MIN_TARGET_PX / (scale > 0 ? scale : 1), hz.pitch);
      const [ax, ay] = hz.axis; // unit vector pointing away from the grid
      const a0 = -e.inner;
      const a1 = e.outer;
      hz.rect.setAttribute("x", String(ax ? Math.min(a0 * ax, a1 * ax) : -len / 2));
      hz.rect.setAttribute("y", String(ay ? Math.min(a0 * ay, a1 * ay) : -len / 2));
      hz.rect.setAttribute("width", String(ax ? a1 + e.inner : len));
      hz.rect.setAttribute("height", String(ay ? a1 + e.inner : len));
    }
  }
  const hits: { rect: SVGRectElement; axis: [number, number]; inner: number; outer: number; pitch: number }[] = [];
  let lastScale = -1;

  function handle(cx: number, cy: number, ang: number, move: Move, label: string, inner: number, outer: number) {
    // distance (board units) to the neighbouring arrow along the row/column: a row's arrows are T * TILT apart, a column's T
    const pitch = move.t === "row" ? T * TILT : T;
    const h = el("g", { transform: `translate(${cx} ${cy})`, class: "hdl", role: "button", "aria-label": label }, layers.handles);
    const rad = (ang * Math.PI) / 180;
    const rect = el("rect", { fill: "transparent" }, h) as SVGRectElement; // sized in sizeHandles()
    hits.push({ rect, axis: [Math.round(Math.cos(rad)), Math.round(Math.sin(rad))], inner, outer, pitch });
    el("circle", { r: 17, fill: "#c4452e", stroke: "#fffaf0", "stroke-width": 3 }, h);
    el(
      "path",
      { d: "M-4 -7 L4 0 L-4 7", transform: `rotate(${ang})`, fill: "none", stroke: "#fffaf0", "stroke-width": 3.6, "stroke-linecap": "round", "stroke-linejoin": "round" },
      h,
    );
    el("title", {}, h).textContent = label;
    h.style.cursor = "pointer";
    h.addEventListener("pointerdown", (e) => e.stopPropagation());
    h.addEventListener("click", (e) => {
      e.stopPropagation();
      host.tryMove(move);
    });
  }

  function render(anim?: Anim) {
    const s = g();
    const P = s.P;
    const v = s.v;
    const reach = reachable(P, v, s.at);
    layers.tiles.innerHTML = "";
    layers.tops.innerHTML = "";
    layers.badges.innerHTML = "";
    drawWind();
    const made: Record<number, SVGGElement> = {};
    live = [];
    for (let i = 0; i < P.w * P.h; i++) {
      const [x0, y0] = xy(i);
      const [, sy0] = sxy(i); // where this cell's top lands on the tilted board
      const cx = x0 + T / 2;
      const cy = y0 + T / 2;
      const k = P.kind[i];
      const outer = el("g", { transform: `translate(${cx} ${cy})`, "data-cell": i }, layers.tiles);
      const tg = el("g", { class: "tl" }, outer);
      made[i] = tg;
      const id = k === "m" ? s.ids[i] : i;
      const rnd = seeded(id + 11);
      const alt = (id * 5 + 3) % 3 === 0;
      if (k === "m") {
        drawGrass(tg, false, alt);
        if (v[i] === BED) drawBed(tg, rnd);
        else {
          drawFlecks(tg, rnd, v[i] & 15);
          drawPath(tg, v[i] & 15, reach.has(i));
          if (v[i] & SUN) el("use", { href: "#sunflower", x: -20, y: -20, width: 40, height: 40, class: "sun" }, tg);
        }
      } else if (k === "water") {
        drawWater(tg, P, i);
      } else if (k === "bridge") {
        drawWater(tg, P, i);
        drawBridge(tg, v[i], reach.has(i));
      } else {
        drawGrass(tg, true, alt);
        el("ellipse", { cx: 0, cy: 28, rx: 30, ry: 9, fill: "#efd29c", opacity: 0.85 }, tg);
        // standing things: unsquashed, with their feet at the projected spot (rows are drawn back to front, so near overlaps far)
        if (k === "tree") el("use", { href: "#oak", x: cx - 42, y: sy0 + 78 * TILT - 92, width: 84, height: 92 }, layers.tops);
        if (k === "b") drawBuilding(i, cx, sy0);
      }
    }
    // next stop ring
    if (s.next < s.order.length && s.phase !== "done") {
      const [tx, ty] = sxy(P.bld[s.L.parcels[s.order[s.next]].to]);
      el(
        "rect",
        { x: tx + 4, y: ty + 4 * TILT, width: T - 8, height: (T - 8) * TILT, rx: 16, fill: "none", stroke: "#e3a43a", "stroke-width": 5, "stroke-dasharray": "12 8", class: "pulse" },
        layers.badges,
      );
    }
    ambient.set(live);
    drawBadges();
    drawCursor();
    if (anim && !reduce()) animate(anim, made);
    host.renderSide();
  }

  /** Houses whose parcel has been delivered this route: their ambient effects are on. Rebuilt on every render. */
  let live: Spot[] = [];

  function drawBuilding(i: number, cx: number, sy0: number) {
    const name = g().P.name[i];
    if (name === "P") {
      el("use", { href: "#rbPO", x: cx - 40, y: sy0 + 88 * TILT - 84, width: 80, height: 84 }, layers.tops);
      return;
    }
    const nb = houseOf(g(), name);
    const h = el("use", { href: "#" + nb.sym, x: cx - nb.w / 2, y: sy0 + (T - 6) * TILT - nb.h, width: nb.w, height: nb.h, "data-house": i }, layers.tops);
    stepout.redraw(i, h);
    const s = g();
    if (s.L.parcels.some((p, k) => p.to === name && s.got[k] != null)) {
      const top = sy0 + (T - 6) * TILT - nb.h;
      // the washing line runs to a tree in the next tile along the row if there is one, else to a post towards the board's middle
      // where it covers no path (a short line, post inside the house's own tile, when neither side is free)
      const plan = washSide(g().P, i, cx < MX + (g().P.w * T) / 2);
      const dir = plan.dir;
      const trunk = plan.tree ? { x: cx + dir * T - dir * 6, y: sy0 + 78 * TILT - 92 + (98 * 92) / 130 } : undefined;
      live.push(spotFor(nb.sym, cx, top, nb.w, nb.h, dir, trunk, plan.short));
    }
  }

  /** Where the wind blows, in screen space: the line's cells, which end the gust starts from, and the angle of the arrow. */
  function windGeometry() {
    const P = g().P;
    const w = P.level.wind;
    if (!w) return null;
    const cells = w.line === "row" ? P.rowsM[w.index] : P.colsM[w.index];
    if (!cells || cells.length < 2) return null;
    const first = w.d > 0 ? cells[0] : cells[cells.length - 1]; // where the wind comes from
    const last = w.d > 0 ? cells[cells.length - 1] : cells[0]; // where it blows to
    const centre = (c: number): [number, number] => {
      const [x0, y0] = sxy(c);
      return [x0 + T / 2, y0 + (T * TILT) / 2];
    };
    const rot = w.line === "row" ? (w.d > 0 ? 0 : 180) : w.d > 0 ? 90 : -90;
    const ux = w.line === "row" ? w.d : 0; // unit vector the wind blows along, on screen
    const uy = w.line === "row" ? 0 : w.d;
    const [ax, ay] = w.line === "row" ? [MX, projY(MY + w.index * T)] : [MX + w.index * T, projY(MY)];
    const [bw, bh] = w.line === "row" ? [P.w * T, T * TILT] : [T, P.h * T * TILT];
    return { from: centre(first), to: centre(last), rot, ux, uy, band: { x: ax, y: ay, w: bw, h: bh } };
  }

  /** The windy line: a pale band along it, a few leaves where the wind starts and an arrow where it blows to. */
  function drawWind() {
    layers.wind.innerHTML = "";
    const wg = windGeometry();
    if (!wg) return;
    const b = wg.band;
    el("rect", { x: b.x + 3, y: b.y + 3, width: b.w - 6, height: b.h - 6, rx: 16, fill: "#fffaf0", opacity: 0.22 }, layers.wind);
    // two smooth swooshes along the wind (not a regular pattern: different lengths and heights)
    const horiz = wg.ux !== 0;
    const sw = (along: number, across: number, len: number, bend: number) => {
      const cx = horiz ? b.x + b.w * along : b.x + b.w * across;
      const cy = horiz ? b.y + b.h * across : b.y + b.h * along;
      const dir = horiz ? wg.ux : wg.uy;
      const d = horiz ? `M${cx - (dir * len) / 2} ${cy} q${dir * len * 0.25} ${-bend} ${dir * len * 0.5} 0 t${dir * len * 0.5} 0` : `M${cx} ${cy - (dir * len) / 2} q${-bend} ${dir * len * 0.25} 0 ${dir * len * 0.5} t0 ${dir * len * 0.5}`;
      el("path", { d, fill: "none", stroke: "#fffaf0", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.8 }, layers.wind);
    };
    sw(0.34, 0.3, 74, 9);
    sw(0.62, 0.72, 56, 7);
    // leaves tumbling at the upstream end, turned along the wind with a little scatter
    const spread: [number, number, number][] = [[-8, -16, 18], [14, 12, -22], [-22, 10, 40]];
    spread.forEach(([along, across, tilt], k) => {
      const x = wg.from[0] + (horiz ? along * wg.ux : across);
      const y = wg.from[1] + (horiz ? across : along * wg.uy);
      drawLeaf(layers.wind, x, y, wg.rot + 90 + tilt, LEAF_COLOURS[k]);
    });
    drawWindArrow(layers.wind, wg.to[0], wg.to[1], wg.rot);
  }

  /** The gust itself: a few leaves blow along the windy line and fade. Not under reduced motion. */
  function blow() {
    if (reduce()) return;
    const wg = windGeometry();
    if (!wg) return;
    layers.gust.innerHTML = "";
    const horiz = wg.ux !== 0;
    const gs: SVGGElement[] = [];
    for (let k = 0; k < 5; k++) {
      const across = (k % 3 - 1) * 24 + (k > 2 ? 9 : -6);
      const x = wg.from[0] + (horiz ? 0 : across);
      const y = wg.from[1] + (horiz ? across : 0);
      const at = el("g", { transform: `translate(${x} ${y})` }, layers.gust); // the CSS transform below would replace this attribute, so it sits one level up
      const holder = el("g", { opacity: 0 }, at) as SVGGElement;
      drawLeaf(holder, 0, 0, wg.rot + 90 + k * 31, LEAF_COLOURS[k % 3]);
      gs.push(holder);
    }
    const dx = wg.to[0] - wg.from[0];
    const dy = wg.to[1] - wg.from[1];
    gs.forEach((h, k) => {
      h.style.transition = "none";
      h.style.transform = "translate(0,0)";
      void h.getBoundingClientRect();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          h.style.transition = `transform ${0.5 + k * 0.05}s ease-out ${k * 0.04}s, opacity .5s ${k * 0.04}s`;
          h.style.transform = `translate(${dx * (0.8 + k * 0.08)}px,${dy * (0.8 + k * 0.08)}px) rotate(${60 + k * 25}deg)`;
          h.style.opacity = "1";
        }),
      );
    });
    setTimeout(() => (layers.gust.innerHTML = ""), 900);
  }

  function drawBadges() {
    const s = g();
    s.order.forEach((pk, pos) => {
      const p = s.L.parcels[pk];
      const [x0, y0] = sxy(s.P.bld[p.to]);
      const b = el("g", { transform: `translate(${x0 + T - 16} ${y0 + 10})` }, layers.badges);
      if (s.got[pk] != null) {
        el("use", { href: "#icoCheck", x: -15, y: -15, width: 30, height: 30 }, b);
        return;
      }
      el("circle", { r: 16, fill: "#fffaee", stroke: pos === s.next ? "#e3a43a" : "#c4452e", "stroke-width": 3 }, b);
      el(
        "text",
        { y: 6, "text-anchor": "middle", "font-family": "Fraunces, Georgia, serif", "font-weight": 900, "font-size": 18, fill: "#2a2b1f" },
        b,
      ).textContent = String(pos + 1);
      if (p.kind === "signed" && !gateOpen(s, p)) el("use", { href: "#icoLock", x: -38, y: -12, width: 22, height: 22 }, b);
      const k = PARCELS[p.kind];
      const ib = el("g", { transform: "translate(-2 22)" }, b);
      el("rect", { x: -17, y: -12, width: 34, height: 26, rx: 8, fill: "#f7e9c6", stroke: "#e2cfa3", "stroke-width": 1.5 }, ib);
      const sv = el("svg", { x: -13, y: -9, width: 26, height: 20, viewBox: k.vb }, ib);
      el("use", { href: "#" + k.ico }, sv);
    });
  }

  function drawCursor() {
    layers.cursor.innerHTML = "";
    const s = g();
    if (s.sel < 0) return;
    const [x0, y0] = sxy(s.sel);
    el("rect", { x: x0 + 1, y: y0 + TILT, width: T - 2, height: (T - 2) * TILT, rx: 16, fill: "none", stroke: "#2d4b78", "stroke-width": 4, "stroke-dasharray": "10 7" }, layers.cursor);
  }

  function animate(a: Anim, made: Record<number, SVGGElement>) {
    // One transform per cell: a sunflower that slides and turns in the same move does both at once.
    const list = new Map<SVGGElement, { tf: string[]; wrap?: boolean }>();
    const add = (cell: number, tf: string, wrap?: boolean) => {
      const t = made[cell];
      if (!t) return;
      const e = list.get(t) ?? { tf: [] };
      e.tf.push(tf);
      if (wrap) e.wrap = true;
      list.set(t, e);
    };
    if (a.rot) add(a.rot.i, `rotate(${-90 * a.rot.d}deg)`);
    for (const s of a.slide ?? []) add(s.to, `translate(${s.dx}px,${s.dy}px)`, s.wrap);
    // the sunflower's quarter turn is clockwise: it starts a quarter back and swings round to where it is now
    for (const c of a.sun ?? []) add(c, "rotate(-90deg)");
    for (const [t, e] of list) {
      t.style.transition = "none";
      t.style.transform = e.tf.join(" ");
      if (e.wrap) t.style.opacity = "0";
    }
    void $("board").getBoundingClientRect();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const t of list.keys()) {
          t.style.transition = "transform .22s cubic-bezier(.3,.8,.4,1), opacity .22s";
          t.style.transform = "none";
          t.style.opacity = "1";
        }
      }),
    );
  }

  /** A small shake on a tile that won't do what was asked (a sunflower that can't be turned by hand). Not under reduced motion. */
  function nudge(i: number) {
    if (reduce()) return;
    const t = layers.tiles.querySelector(`[data-cell="${i}"] > .tl`);
    if (!t) return;
    t.classList.remove("nope");
    void (t as SVGGElement).getBoundingClientRect();
    t.classList.add("nope");
    setTimeout(() => t.classList.remove("nope"), 400);
  }

  /* ---------- Pip ---------- */
  function pipSpot(letter: string): [number, number] {
    const [x0, y0] = sxy(g().P.bld[letter]);
    return [x0 + 24, y0 + (T - 4) * TILT];
  }
  function cellSpot(c: number): [number, number] {
    const [x0, y0] = sxy(c);
    return [x0 + T / 2, y0 + (T / 2 + 20) * TILT];
  }
  let pipPos: [number, number] = [0, 0];
  function placePip(pt: [number, number], faceLeft: boolean) {
    pipPos = pt;
    layers.pipG.style.transform = `translate(${pt[0]}px,${pt[1]}px)`;
    layers.pipFlip.style.transform = faceLeft ? "scale(-1,1)" : "none";
  }
  /** The pending timer of the walk under way (one at a time); cancelled when the game it belongs to goes away. */
  let walkTimer: ReturnType<typeof setTimeout> | undefined;
  function cancelWalk() {
    clearTimeout(walkTimer);
    walkTimer = undefined;
    stepout.stop();
  }
  function walk(path: number[], done: () => void) {
    cancelWalk();
    const P = g().P;
    const pts = path.map((c, j) => (j === path.length - 1 ? pipSpot(P.name[c]) : cellSpot(c)));
    pts[0] = pipPos;
    // the neighbour steps out as Pip sets off, and goes back in when he arrives (or after a moment). It never gates the walk.
    const dest = path[path.length - 1];
    if (P.name[dest] !== "P") {
      const [dx, dy] = sxy(dest);
      stepout.show(dest, houseOf(g(), P.name[dest]).id, dx + T / 2, dy + (T - 6) * TILT, layers.tops.querySelector(`[data-house="${dest}"]`));
    }
    const arrived = done;
    done = () => {
      stepout.hide();
      arrived();
    };
    // light the leg
    layers.glow.innerHTML = "";
    for (const c of path) {
      const [x0, y0] = sxy(c);
      el("rect", { x: x0 + 8, y: y0 + 8 * TILT, width: T - 16, height: (T - 16) * TILT, rx: 18, fill: "#ffd66e", opacity: 0.32 }, layers.glow);
    }
    if (reduce()) {
      placePip(pts[pts.length - 1], false);
      walkTimer = setTimeout(() => {
        layers.glow.innerHTML = "";
        done();
      }, 250);
      return;
    }
    let j = 1;
    const step = () => {
      if (j >= pts.length) {
        walkTimer = setTimeout(() => {
          layers.glow.innerHTML = "";
          done();
        }, 140);
        return;
      }
      const from = pipPos;
      const to = pts[j];
      layers.pipG.style.transition = "transform .17s linear";
      placePip(to, to[0] < from[0] - 1);
      j++;
      walkTimer = setTimeout(step, 175);
    };
    step();
  }

  /** Put Pip back at a building with no walk animation (undo). */
  function resetPip(letter: string) {
    cancelWalk();
    layers.pipG.style.transition = "none";
    placePip(pipSpot(letter), false);
  }

  /* ---------- input: pointer (tap, swipe), keyboard ---------- */
  const board = $("board") as unknown as SVGSVGElement;
  let drag: { id: number; c: number; x: number; y: number; scale: number } | null = null;

  /**
   * A pointer in flat grid space. The tile layer's own CTM includes the tilt, so inverting it undoes the foreshortening:
   * a tap on any row lands on the tile drawn under the finger, and distances are measured in board space.
   * Null when the board has no screen matrix (e.g. detached). Also returns the horizontal CSS px per board unit (the tilt does not change it).
   */
  function gridPoint(clientX: number, clientY: number): [number, number, number] | null {
    const m = layers.proj.getScreenCTM();
    if (!m) return null;
    const pt = board.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y, Math.abs(m.a) || 1];
  }
  const svgPoint = (e: PointerEvent) => gridPoint(e.clientX, e.clientY);
  function cellAt(pt: [number, number, number]): number {
    const P = g().P;
    const x = Math.floor((pt[0] - MX) / T);
    const y = Math.floor((pt[1] - MY) / T);
    if (x < 0 || y < 0 || x >= P.w || y >= P.h) return -1;
    return y * P.w + x;
  }

  /** One path for every pointer (finger, pen, mouse): down, move, up, cancel. */
  const hit = (d: NonNullable<typeof drag>, e: PointerEvent) => Math.max(Math.abs(e.clientX - d.x), Math.abs(e.clientY - d.y)) >= Math.max(24, 34 * d.scale);

  /** The swipe's direction is decided in board space, so the tilt (a shorter screen distance per row) does not bias it. */
  function swipeTo(d: NonNullable<typeof drag>, e: PointerEvent) {
    const a = gridPoint(d.x, d.y);
    const b = gridPoint(e.clientX, e.clientY);
    if (!a || !b) return; // no valid board point: abandon the gesture rather than read a zero delta as "column up"
    swipe(d, b[0] - a[0], b[1] - a[1]);
  }
  function swipe(d: NonNullable<typeof drag>, dx: number, dy: number) {
    const s = host.g();
    const x = d.c % s.P.w;
    const y = Math.floor(d.c / s.P.w);
    if (Math.abs(dx) > Math.abs(dy)) {
      if (s.P.rowsM[y].length >= 2 && s.P.kind[d.c] === "m") host.tryMove({ t: "row", y, d: dx > 0 ? 1 : -1 });
      else host.toast("Only garden tiles slide. Swipe along a row of lanes.");
    } else {
      if (s.P.colsM[x].length >= 2 && s.P.kind[d.c] === "m") host.tryMove({ t: "col", x, d: dy > 0 ? 1 : -1 });
      else host.toast("Only garden tiles slide. Swipe along a column of lanes.");
    }
  }
  function endInput() {
    drawCursor();
    host.renderSide();
  }
  function release(e: PointerEvent) {
    try {
      board.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
  }

  // A tap or swipe that makes a move can reflow the page (the first move locks the satchel, which shrinks the panel above the board).
  // Safari then fires the trailing click at the same page point, which can now be an arrow: swallow that ghost click.
  // Only pointer-generated clicks (detail > 0) are swallowed; keyboard activation of an arrow (detail 0) always goes through.
  // Any new pointerdown clears this, so a real follow-up tap on an arrow still works.
  let ghostClickUntil = 0;
  board.addEventListener("pointerdown", () => (ghostClickUntil = 0), true);
  board.addEventListener(
    "click",
    (e) => {
      if (e.detail > 0 && performance.now() < ghostClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );

  board.addEventListener("pointerdown", (e) => {
    // One pointer at a time; and input that begins while Pip is walking is dropped, so it can't land after he stops.
    if (!host.G || drag || host.G.busy) return;
    const pt = svgPoint(e);
    if (!pt) return;
    const c = cellAt(pt);
    if (c < 0) return;
    // A mouse's secondary button turns the tile back; touch has the Turn back button instead.
    if (e.pointerType === "mouse" && e.button === 2) {
      host.G.sel = c;
      host.tryMove({ t: "r", i: c, d: -1 });
      endInput();
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = { id: e.pointerId, c, x: e.clientX, y: e.clientY, scale: pt[2] };
    try {
      board.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  // A swipe lands as soon as the finger passes the threshold, so it feels immediate.
  board.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || !host.G || !hit(drag, e)) return;
    const d = drag;
    drag = null;
    release(e);
    host.G.sel = d.c;
    swipeTo(d, e);
    ghostClickUntil = performance.now() + 600;
    endInput();
  });
  board.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    release(e);
    if (!host.G) return;
    host.G.sel = d.c;
    if (hit(d, e)) swipeTo(d, e);
    else host.tryMove({ t: "r", i: d.c, d: 1 });
    ghostClickUntil = performance.now() + 600;
    endInput();
  });
  const abandon = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  board.addEventListener("pointercancel", abandon);
  board.addEventListener("lostpointercapture", abandon);
  // Keep the arrows' tap targets at MIN_TARGET_PX as the board is scaled (rotation, resize, layout changes).
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(sizeHandles).observe(board);
  window.addEventListener("resize", sizeHandles);
  // No context menu on the board (long-press on touch, right-click on mouse is handled above).
  board.addEventListener("contextmenu", (e) => e.preventDefault());

  const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener("keydown", (e) => {
    if (!host.G || $("gameView").hidden) return;
    const s = host.G;
    const tag = (e.target as Element | null)?.tagName ?? "";
    const onButton = tag === "BUTTON";
    const k = e.key;
    if ((k === "z" || k === "Z") && !e.altKey) {
      e.preventDefault();
      host.undo();
      return;
    }
    if (s.phase === "done" || s.phase === "dry") return;
    const a = ARROWS[k];
    if (a) {
      if (onButton && !e.shiftKey && document.activeElement !== board) return;
      e.preventDefault();
      if (s.sel < 0) s.sel = s.P.bld.P;
      let x = s.sel % s.P.w;
      let y = Math.floor(s.sel / s.P.w);
      if (e.shiftKey) {
        if (a[0]) {
          if (s.P.rowsM[y].length >= 2) host.tryMove({ t: "row", y, d: a[0] as 1 | -1 });
        } else if (s.P.colsM[x].length >= 2) host.tryMove({ t: "col", x, d: a[1] as 1 | -1 });
      } else {
        x = Math.min(s.P.w - 1, Math.max(0, x + a[0]));
        y = Math.min(s.P.h - 1, Math.max(0, y + a[1]));
        s.sel = y * s.P.w + x;
      }
      drawCursor();
      host.renderSide();
      return;
    }
    if (onButton) return;
    if (k === "r" || k === "R" || k === "Enter" || k === " ") {
      if (s.sel >= 0) {
        e.preventDefault();
        host.tryMove({ t: "r", i: s.sel, d: 1 });
      }
      return;
    }
    if (k === "q" || k === "Q") {
      if (s.sel >= 0) {
        e.preventDefault();
        host.tryMove({ t: "r", i: s.sel, d: -1 });
      }
    }
  });

  return { build: buildBoard, render, drawCursor, walk, nudge, blow, resetPip, cancelWalk, stopAmbient: ambient.stop, dispose: ambient.dispose, xy };
}
