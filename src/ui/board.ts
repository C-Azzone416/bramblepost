/** The board view: SVG drawing, Pip's walk, and tap / swipe (Pointer Events) and keyboard input. */
import { BED, reachable, type Move } from "../engine";
import { PARCELS } from "./cast";
import { MB, MX, MY, T, cellXY, drawBed, drawBridge, drawFlecks, drawGrass, drawPath, drawWater } from "./draw";
import type { GameState } from "./game";
import { gateOpen, houseOf } from "./satchel";
import { $, el, seeded } from "./svg";

export interface Anim {
  rot?: { i: number; d: number };
  slide?: { to: number; dx: number; dy: number; wrap?: boolean }[];
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

  const layers = {} as {
    tiles: SVGGElement;
    glow: SVGGElement;
    tops: SVGGElement;
    badges: SVGGElement;
    pip: SVGGElement;
    cursor: SVGGElement;
    handles: SVGGElement;
    pipG: SVGGElement;
    pipFlip: SVGGElement;
  };
  const xy = (i: number) => cellXY(g().P, i);

  function buildBoard() {
    const P = g().P;
    const svg = $("board") as unknown as SVGSVGElement;
    svg.innerHTML = "";
    hits.length = 0;
    lastScale = -1;
    const W = P.w * T + MX * 2;
    const H = P.h * T + MY + MB;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const defs = el("defs", {}, svg);
    const cp = el("clipPath", { id: "boardClip" }, defs);
    el("rect", { x: MX, y: MY - 30, width: P.w * T, height: P.h * T + 30 }, cp);
    // island: soil lip and grass bed
    el("ellipse", { cx: W / 2, cy: MY + P.h * T + 30, rx: P.w * T * 0.52, ry: 18, fill: "#5b6a3a", opacity: 0.22, filter: "url(#soft)" }, svg);
    el("rect", { x: MX - 12, y: MY - 8, width: P.w * T + 24, height: P.h * T + 30, rx: 26, fill: "#7f532d" }, svg);
    el("rect", { x: MX - 12, y: MY - 12, width: P.w * T + 24, height: P.h * T + 22, rx: 24, fill: "#5d7a3a" }, svg);
    const clipG = el("g", { "clip-path": "url(#boardClip)" }, svg);
    layers.tiles = el("g", {}, clipG);
    layers.glow = el("g", { "pointer-events": "none" }, svg);
    layers.tops = el("g", { "pointer-events": "none" }, svg);
    layers.badges = el("g", { "pointer-events": "none" }, svg);
    layers.pip = el("g", { "pointer-events": "none" }, svg);
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
      handle(MX - 34, MY + y * T + T / 2, 180, { t: "row", y, d: -1 }, `Slide row ${y + 1} left`, 34, MX - 34);
      handle(MX + P.w * T + 34, MY + y * T + T / 2, 0, { t: "row", y, d: 1 }, `Slide row ${y + 1} right`, 34, MX - 34);
    }
    for (let x = 0; x < P.w; x++) {
      if (P.colsM[x].length < 2) continue;
      handle(MX + x * T + T / 2, MY - 44, -90, { t: "col", x, d: -1 }, `Slide column ${x + 1} up`, 44, MY - 44);
      handle(MX + x * T + T / 2, MY + P.h * T + 36, 90, { t: "col", x, d: 1 }, `Slide column ${x + 1} down`, 36, MB - 36);
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
      const len = MIN_TARGET_PX / (scale > 0 ? scale : 1);
      const [ax, ay] = hz.axis; // unit vector pointing away from the grid
      const a0 = -e.inner;
      const a1 = e.outer;
      hz.rect.setAttribute("x", String(ax ? Math.min(a0 * ax, a1 * ax) : -len / 2));
      hz.rect.setAttribute("y", String(ay ? Math.min(a0 * ay, a1 * ay) : -len / 2));
      hz.rect.setAttribute("width", String(ax ? a1 + e.inner : len));
      hz.rect.setAttribute("height", String(ay ? a1 + e.inner : len));
    }
  }
  const hits: { rect: SVGRectElement; axis: [number, number]; inner: number; outer: number }[] = [];
  let lastScale = -1;

  function handle(cx: number, cy: number, ang: number, move: Move, label: string, inner: number, outer: number) {
    const h = el("g", { transform: `translate(${cx} ${cy})`, class: "hdl", role: "button", "aria-label": label }, layers.handles);
    const rad = (ang * Math.PI) / 180;
    const rect = el("rect", { fill: "transparent" }, h) as SVGRectElement; // sized in sizeHandles()
    hits.push({ rect, axis: [Math.round(Math.cos(rad)), Math.round(Math.sin(rad))], inner, outer });
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
    const made: Record<number, SVGGElement> = {};
    for (let i = 0; i < P.w * P.h; i++) {
      const [x0, y0] = xy(i);
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
          drawFlecks(tg, rnd, v[i]);
          drawPath(tg, v[i], reach.has(i));
        }
      } else if (k === "water") {
        drawWater(tg, P, i);
      } else if (k === "bridge") {
        drawWater(tg, P, i);
        drawBridge(tg, v[i], reach.has(i));
      } else {
        drawGrass(tg, true, alt);
        el("ellipse", { cx: 0, cy: 28, rx: 30, ry: 9, fill: "#efd29c", opacity: 0.85 }, tg);
        if (k === "tree") el("use", { href: "#oak", x: cx - 42, y: y0 - 14, width: 84, height: 92 }, layers.tops);
        if (k === "b") drawBuilding(i, cx, y0);
      }
    }
    // next stop ring
    if (s.next < s.order.length && s.phase !== "done") {
      const [tx, ty] = xy(P.bld[s.L.parcels[s.order[s.next]].to]);
      el(
        "rect",
        { x: tx + 4, y: ty + 4, width: T - 8, height: T - 8, rx: 16, fill: "none", stroke: "#e3a43a", "stroke-width": 5, "stroke-dasharray": "12 8", class: "pulse" },
        layers.badges,
      );
    }
    drawBadges();
    drawCursor();
    if (anim && !reduce()) animate(anim, made);
    host.renderSide();
  }

  function drawBuilding(i: number, cx: number, y0: number) {
    const name = g().P.name[i];
    if (name === "P") {
      el("use", { href: "#rbPO", x: cx - 40, y: y0 + 4, width: 80, height: 84 }, layers.tops);
      return;
    }
    const nb = houseOf(g(), name);
    el("use", { href: "#" + nb.sym, x: cx - nb.w / 2, y: y0 + T - 6 - nb.h, width: nb.w, height: nb.h }, layers.tops);
  }

  function drawBadges() {
    const s = g();
    s.order.forEach((pk, pos) => {
      const p = s.L.parcels[pk];
      const [x0, y0] = xy(s.P.bld[p.to]);
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
    const [x0, y0] = xy(s.sel);
    el("rect", { x: x0 + 1, y: y0 + 1, width: T - 2, height: T - 2, rx: 16, fill: "none", stroke: "#2d4b78", "stroke-width": 4, "stroke-dasharray": "10 7" }, layers.cursor);
  }

  function animate(a: Anim, made: Record<number, SVGGElement>) {
    const list: [SVGGElement, string, boolean?][] = [];
    if (a.rot) {
      const t = made[a.rot.i];
      if (t) list.push([t, `rotate(${-90 * a.rot.d}deg)`]);
    }
    for (const s of a.slide ?? []) {
      const t = made[s.to];
      if (t) list.push([t, `translate(${s.dx}px,${s.dy}px)`, s.wrap]);
    }
    for (const [t, tf, wrap] of list) {
      t.style.transition = "none";
      t.style.transform = tf;
      if (wrap) t.style.opacity = "0";
    }
    void $("board").getBoundingClientRect();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const [t] of list) {
          t.style.transition = "transform .22s cubic-bezier(.3,.8,.4,1), opacity .22s";
          t.style.transform = "none";
          t.style.opacity = "1";
        }
      }),
    );
  }

  /* ---------- Pip ---------- */
  function pipSpot(letter: string): [number, number] {
    const [x0, y0] = xy(g().P.bld[letter]);
    return [x0 + 24, y0 + T - 4];
  }
  function cellSpot(c: number): [number, number] {
    const [x0, y0] = xy(c);
    return [x0 + T / 2, y0 + T / 2 + 20];
  }
  let pipPos: [number, number] = [0, 0];
  function placePip(pt: [number, number], faceLeft: boolean) {
    pipPos = pt;
    layers.pipG.style.transform = `translate(${pt[0]}px,${pt[1]}px)`;
    layers.pipFlip.style.transform = faceLeft ? "scale(-1,1)" : "none";
  }
  function walk(path: number[], done: () => void) {
    const P = g().P;
    const pts = path.map((c, j) => (j === path.length - 1 ? pipSpot(P.name[c]) : cellSpot(c)));
    pts[0] = pipPos;
    // light the leg
    layers.glow.innerHTML = "";
    for (const c of path) {
      const [x0, y0] = xy(c);
      el("rect", { x: x0 + 8, y: y0 + 8, width: T - 16, height: T - 16, rx: 18, fill: "#ffd66e", opacity: 0.32 }, layers.glow);
    }
    if (reduce()) {
      placePip(pts[pts.length - 1], false);
      setTimeout(() => {
        layers.glow.innerHTML = "";
        done();
      }, 250);
      return;
    }
    let j = 1;
    const step = () => {
      if (j >= pts.length) {
        setTimeout(() => {
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
      setTimeout(step, 175);
    };
    step();
  }

  /** Put Pip back at a building with no walk animation (undo). */
  function resetPip(letter: string) {
    layers.pipG.style.transition = "none";
    placePip(pipSpot(letter), false);
  }

  /* ---------- input: pointer (tap, swipe), keyboard ---------- */
  const board = $("board") as unknown as SVGSVGElement;
  let drag: { id: number; c: number; x: number; y: number; scale: number } | null = null;

  function svgPoint(e: PointerEvent): [number, number, number] {
    const m = board.getScreenCTM();
    if (!m) return [-1, -1, 1];
    const pt = board.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y, Math.abs(m.a) || 1];
  }
  function cellAt(pt: [number, number, number]): number {
    const P = g().P;
    const x = Math.floor((pt[0] - MX) / T);
    const y = Math.floor((pt[1] - MY) / T);
    if (x < 0 || y < 0 || x >= P.w || y >= P.h) return -1;
    return y * P.w + x;
  }

  /** One path for every pointer (finger, pen, mouse): down, move, up, cancel. */
  const hit = (d: NonNullable<typeof drag>, e: PointerEvent) => Math.max(Math.abs(e.clientX - d.x), Math.abs(e.clientY - d.y)) >= Math.max(24, 34 * d.scale);

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
    swipe(d, e.clientX - d.x, e.clientY - d.y);
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
    if (hit(d, e)) swipe(d, e.clientX - d.x, e.clientY - d.y);
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

  return { build: buildBoard, render, drawCursor, walk, resetPip, xy };
}
