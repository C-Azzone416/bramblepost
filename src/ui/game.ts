/**
 * The playable page: route list, board, satchel, tea and finish cards.
 * All rules come from src/engine; this file only draws and handles input.
 */
import {
  BED,
  LOW_TEA_WARNING,
  apply,
  canRotate,
  defaultOrder,
  deliverChain,
  legal,
  orderProblem,
  outOfTea,
  parse,
  reachable,
  starsFor,
  teapot,
  type Board,
  type Delivery,
  type Move,
  type Parcel,
} from "../engine";
import type { Route } from "../levels";
import { NEIGHBOURS, PARCELS, type Neighbour } from "./cast";
import { MB, MX, MY, T, cellXY, drawBed, drawBridge, drawFlecks, drawGrass, drawPath, drawWater } from "./draw";
import { loadSave, recordBest, type SaveData } from "./save";
import { $, el, icon, seeded, starRow } from "./svg";

export type Phase = "sort" | "play" | "done" | "dry";

interface Snapshot {
  v: number[];
  ids: number[];
  moves: number;
  next: number;
  at: string;
  got: Record<number, number>;
}

export interface GameState {
  li: number;
  L: Route;
  P: Board;
  /** Current cell values (edges or BED). */
  v: number[];
  /** Which original tile sits in each cell, so artwork travels with a slide. */
  ids: number[];
  order: number[];
  /** Position in `order` of the next parcel to deliver. */
  next: number;
  /** Building Pip is standing at. */
  at: string;
  moves: number;
  /** Parcel index -> move number it was delivered on. */
  got: Record<number, number>;
  hist: Snapshot[];
  phase: Phase;
  /** Keyboard / last-tapped cell, -1 for none. */
  sel: number;
  /** True while Pip is walking. */
  busy: boolean;
}

export interface GameApi {
  readonly G: GameState | null;
  openLevel(i: number, keepScroll?: boolean): void;
  tryMove(m: Move): void;
  undo(): void;
  restart(): void;
  readonly routes: Route[];
}

/** What a finished route came to, for anything that plays after it (the door scene). */
export interface RouteResult {
  route: Route;
  /** Position in the route list. */
  index: number;
  stars: number;
  moves: number;
  /** A timed parcel (the pie) arrived late. */
  coldPie: boolean;
}

/**
 * Runs when a route is finished, before the Route complete card. Call `onContinue` once to show
 * the card (with Next route, Play again and All routes).
 */
export type AfterRoute = (result: RouteResult, onContinue: () => void) => void;

export interface GameOptions {
  afterRoute?: AfterRoute;
}

interface Anim {
  rot?: { i: number; d: number };
  slide?: { to: number; dx: number; dy: number; wrap?: boolean }[];
}

export function startGame(routes: Route[], opts: GameOptions = {}): GameApi {
  let G: GameState | null = null;
  const save: SaveData = loadSave();
  let reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* no matchMedia */
  }

  /** The current game. Only called where a route is open. */
  const g = (): GameState => G!;
  const houseOf = (letter: string): Neighbour => NEIGHBOURS[g().L.houses[letter]];
  const pot = () => teapot(g().L.par);

  /* ---------- route select ---------- */
  function renderRoutes() {
    const list = $("routeList");
    list.innerHTML = "";
    routes.forEach((L, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rcard" + (L.sunday ? " sunday" : "");
      const best = save.best[L.id];
      const P = parse(L);
      const icons = L.parcels
        .map((p) => {
          const k = PARCELS[p.kind];
          return "<span>" + icon(k.ico, k.vb) + "</span>";
        })
        .join("");
      const n = best ? best.stars : 0;
      b.innerHTML =
        `<span class="num">Spring · Route ${i + 1}</span>` +
        (L.tag ? `<span class="tag${L.sunday ? " red" : ""}">${L.tag}</span>` : "") +
        `<h3>${L.name}</h3><p>${L.blurb}</p><div class="icons">${icons}</div>` +
        `<div class="foot"><span>${P.w} × ${P.h} · par ${L.par}</span><span class="srow" aria-label="${n} of 3 stars">${starRow(n)}</span></div>`;
      b.addEventListener("click", () => openLevel(i));
      list.appendChild(b);
    });
  }

  /* ---------- game state ---------- */
  function snapshot(): Snapshot {
    const s = g();
    return { v: s.v.slice(), ids: s.ids.slice(), moves: s.moves, next: s.next, at: s.at, got: { ...s.got } };
  }

  function openLevel(i: number, keepScroll = false) {
    const L = routes[i];
    const P = parse(L);
    G = {
      li: i,
      L,
      P,
      v: P.init.slice(),
      ids: P.init.map((_, j) => j),
      order: defaultOrder(L),
      next: 0,
      at: "P",
      moves: 0,
      got: {},
      hist: [],
      phase: "sort",
      sel: -1,
      busy: false,
    };
    $("routesView").hidden = true;
    $("gameView").hidden = false;
    $("routeNum").textContent = "Spring · Route " + (i + 1) + (L.sunday ? " · Sunday puzzle" : "");
    $("routeName").textContent = L.name;
    $("done").hidden = true;
    buildBoard();
    render();
    if (!keepScroll) scrollTop();
    setTimeout(() => {
      try {
        $("board").focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }, 30);
  }

  function scrollTop() {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* jsdom */
    }
  }

  function backToRoutes() {
    G = null;
    $("gameView").hidden = true;
    $("routesView").hidden = false;
    renderRoutes();
    scrollTop();
  }

  /* ---------- board drawing ---------- */
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
      handle(MX - 34, MY + y * T + T / 2, 180, { t: "row", y, d: -1 }, `Slide row ${y + 1} left`);
      handle(MX + P.w * T + 34, MY + y * T + T / 2, 0, { t: "row", y, d: 1 }, `Slide row ${y + 1} right`);
    }
    for (let x = 0; x < P.w; x++) {
      if (P.colsM[x].length < 2) continue;
      handle(MX + x * T + T / 2, MY - 44, -90, { t: "col", x, d: -1 }, `Slide column ${x + 1} up`);
      handle(MX + x * T + T / 2, MY + P.h * T + 36, 90, { t: "col", x, d: 1 }, `Slide column ${x + 1} down`);
    }
  }

  function handle(cx: number, cy: number, ang: number, move: Move, label: string) {
    const h = el("g", { transform: `translate(${cx} ${cy})`, class: "hdl", role: "button", "aria-label": label }, layers.handles);
    el("circle", { r: 29, fill: "transparent" }, h);
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
      tryMove(move);
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
    if (anim && !reduce) animate(anim, made);
    renderSide();
  }

  function drawBuilding(i: number, cx: number, y0: number) {
    const name = g().P.name[i];
    if (name === "P") {
      el("use", { href: "#rbPO", x: cx - 40, y: y0 + 4, width: 80, height: 84 }, layers.tops);
      return;
    }
    const nb = houseOf(name);
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
      if (p.kind === "signed" && !gateOpen(p)) el("use", { href: "#icoLock", x: -38, y: -12, width: 22, height: 22 }, b);
      const k = PARCELS[p.kind];
      const ib = el("g", { transform: "translate(-2 22)" }, b);
      el("rect", { x: -17, y: -12, width: 34, height: 26, rx: 8, fill: "#f7e9c6", stroke: "#e2cfa3", "stroke-width": 1.5 }, ib);
      const sv = el("svg", { x: -13, y: -9, width: 26, height: 20, viewBox: k.vb }, ib);
      el("use", { href: "#" + k.ico }, sv);
    });
  }

  /** A signed letter's gate opens once the key holder has had their post. */
  function gateOpen(p: Parcel): boolean {
    if (p.kind !== "signed") return true;
    const s = g();
    return Object.keys(s.got).some((pk) => s.L.parcels[+pk].to === p.key);
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
    if (reduce) {
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

  /* ---------- moves ---------- */
  function tryMove(m: Move) {
    if (!G || G.busy || G.phase === "done" || G.phase === "dry") return;
    const s = G;
    const why = orderProblem(s.L, s.order);
    if (why) {
      toast(why + " Fix the satchel order first.");
      return;
    }
    if (!legal(s.P, s.v, m)) {
      if (m.t === "r") {
        const k = s.P.kind[m.i];
        toast(
          k === "b"
            ? "Houses and the post office never move."
            : k === "tree"
              ? "The old oak stays put."
              : k === "water"
                ? "That's the stream. Bridges turn, water doesn't."
                : "A flowerbed has no lane to turn.",
        );
      }
      return;
    }
    s.hist.push(snapshot());
    const P = s.P;
    const anim: Anim = {};
    if (m.t === "r") anim.rot = { i: m.i, d: m.d };
    else {
      const line = m.t === "row" ? P.rowsM[m.y] : P.colsM[m.x];
      const n = line.length;
      anim.slide = line.map((from, j) => {
        const to = line[(j + m.d + n) % n];
        const a = xy(from);
        const b = xy(to);
        const wrap = (m.d > 0 && j === n - 1) || (m.d < 0 && j === 0);
        if (wrap) {
          const horiz = m.t === "row";
          return { to, dx: horiz ? -m.d * T : 0, dy: horiz ? 0 : -m.d * T, wrap: true };
        }
        return { to, dx: a[0] - b[0], dy: a[1] - b[1] };
      });
      s.ids = apply(P, s.ids, m);
    }
    s.v = apply(P, s.v, m);
    s.moves++;
    if (s.phase === "sort") s.phase = "play";
    render(anim);
    const chain = deliverChain(P, s.v, s.order, s.next);
    if (chain.length) {
      s.busy = true;
      setTimeout(() => runDeliveries(chain, 0), reduce ? 0 : 230);
    } else checkTea();
  }

  function checkTea() {
    const s = g();
    if (s.phase === "play" && outOfTea(s.moves, s.L.par, s.next, s.order.length)) showOutOfTea();
  }

  function runDeliveries(chain: Delivery[], j: number) {
    const s = g();
    if (j >= chain.length) {
      s.busy = false;
      render();
      if (s.next >= s.order.length) finish();
      else checkTea();
      return;
    }
    const d = chain[j];
    walk(d.path, () => {
      const p = s.L.parcels[d.k];
      s.got[d.k] = s.moves;
      s.next++;
      s.at = p.to;
      const late = p.limit && s.moves > p.limit;
      toast(PARCELS[p.kind].label + " delivered to " + houseOf(p.to).who + (p.limit ? (late ? ", a little cold." : ", still warm.") : "."));
      render();
      runDeliveries(chain, j + 1);
    });
  }

  function undo() {
    if (!G || G.busy || !G.hist.length) return;
    const s = G;
    const h = s.hist.pop()!;
    s.v = h.v;
    s.ids = h.ids;
    s.moves = h.moves;
    s.next = h.next;
    s.at = h.at;
    s.got = h.got;
    s.phase = s.moves === 0 ? "sort" : "play";
    $("done").hidden = true;
    layers.pipG.style.transition = "none";
    placePip(pipSpot(s.at), false);
    render();
  }

  function restart() {
    if (!G || G.busy) return;
    const keepOrder = G.order;
    const sel = G.sel;
    openLevel(G.li, true);
    g().order = keepOrder;
    g().sel = sel;
    render();
  }

  /* ---------- finishing ---------- */
  function finish() {
    const s = g();
    const L = s.L;
    const cold = L.parcels.filter((p, k) => p.limit && s.got[k] > p.limit);
    const n = starsFor(s.moves, L.par, cold.length > 0);
    s.phase = "done";
    recordBest(save, L.id, n, s.moves);
    let line = s.moves + (s.moves === 1 ? " move" : " moves") + " · par " + L.par;
    if (L.parcels.some((p) => p.limit)) line += cold.length ? " · pie arrived cold" : " · pie arrived warm";
    const why =
      n === 3
        ? "A perfect round. Clementine is putting the kettle on."
        : cold.length
          ? "Everything arrived, but the pie went cold. A cold parcel caps the route at two stars."
          : n === 2
            ? `Tidy work, just a couple over par. Par is ${L.par} moves for three stars.`
            : `Delivered before the pot ran dry. Par is ${L.par} moves, so a different order or a cleverer slide could save some tea.`;
    const last = s.li === routes.length - 1;
    const d = $("done");
    d.innerHTML =
      `<div class="dcard" role="dialog" aria-labelledby="doneTitle"><small>Route complete</small><h3 id="doneTitle">${L.name}</h3>` +
      `<div class="big" aria-label="${n} of 3 stars">${starRow(n)}</div><p><b style="color:#fffaf0">${line}</b></p><p style="margin-top:6px">${why}</p>` +
      '<div class="acts">' +
      (last
        ? '<button class="btn red" type="button" data-act="routes">All routes</button>'
        : '<button class="btn red" type="button" data-act="next">Next route</button>') +
      `<button class="btn ghost" type="button" data-act="replay">${n < 3 ? "Try for three stars" : "Play again"}</button>` +
      (last ? "" : '<button class="btn ghost" type="button" data-act="routes">All routes</button>') +
      "</div></div>";
    clearToast();
    // The card stays hidden while an after-route scene plays, then shows on Continue.
    if (opts.afterRoute) {
      renderSide();
      const result = { route: L, index: s.li, stars: n, moves: s.moves, coldPie: cold.length > 0 };
      opts.afterRoute(result, () => {
        if (G === s && s.phase === "done") showCard(d);
      });
    } else showCard(d);
  }

  function showCard(d: HTMLElement) {
    d.hidden = false;
    d.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const a = b.getAttribute("data-act");
        if (a === "next") openLevel(g().li + 1);
        else if (a === "replay") restart();
        else if (a === "undo") undo();
        else backToRoutes();
      }),
    );
    const first = d.querySelector("button");
    if (first)
      setTimeout(() => {
        try {
          first.focus();
        } catch {
          /* ignore */
        }
      }, 50);
    renderSide();
  }

  function showOutOfTea() {
    const s = g();
    const left = s.order.length - s.next;
    s.phase = "dry";
    clearToast();
    const d = $("done");
    const cup = icon("icoCup", "0 0 36 30");
    d.innerHTML =
      '<div class="dcard dry" role="dialog" aria-labelledby="doneTitle"><small>The teapot is empty</small><h3 id="doneTitle">Pip ran out of tea!</h3>' +
      `<div class="big pot" aria-hidden="true">${cup}${cup}${cup}</div>` +
      `<p><b style="color:#fffaf0">${s.moves} cups poured · ${left}${left === 1 ? " parcel" : " parcels"} still in the satchel</b></p>` +
      `<p style="margin-top:6px">Nobody can sort post on an empty pot. Pip is popping home to brew a fresh one, and then he will start the ${s.L.name} round again from the post office.</p>` +
      '<div class="acts"><button class="btn red" type="button" data-act="replay">Restart route</button>' +
      '<button class="btn ghost" type="button" data-act="undo">Undo last move</button>' +
      '<button class="btn ghost" type="button" data-act="routes">All routes</button></div></div>';
    showCard(d);
  }

  /* ---------- side panels, HUD, banner ---------- */
  function renderSide() {
    const s = g();
    const L = s.L;
    const cupsTotal = pot();
    const used = s.moves;
    // tea
    let cups = "";
    for (let i = 0; i < cupsTotal; i++) {
      cups += `<svg viewBox="0 0 36 30" aria-hidden="true" style="color:${i < cupsTotal - used ? "#c4452e" : "#d9caa6"}"><use href="#icoCup"/></svg>`;
    }
    $("cups").innerHTML = cups;
    $("cups").setAttribute("aria-label", `${Math.max(0, cupsTotal - used)} of ${cupsTotal} cups left`);
    $("moveCount").innerHTML = used + (used === 1 ? " move" : " moves") + ` <span>· par ${L.par}</span>`;
    // satchel
    const sorting = s.phase === "sort";
    $("satchelState").textContent = sorting ? "Set the order" : s.phase === "done" ? "All delivered" : s.phase === "dry" ? "Out of tea" : "Order locked";
    const list = $("plist");
    list.innerHTML = "";
    s.order.forEach((pk, pos) => {
      const p = L.parcels[pk];
      const k = PARCELS[p.kind];
      const nb = houseOf(p.to);
      const li = document.createElement("li");
      const delivered = s.got[pk] != null;
      li.className = "pc" + (delivered ? " got" : "") + (!sorting && !delivered && pos === s.next ? " next" : "");
      let rule = "";
      if (p.kind === "pie" && p.limit != null) {
        if (delivered) rule = s.got[pk] <= p.limit ? '<em class="ok">Arrived warm</em>' : "<em>Arrived cold</em>";
        else if (s.moves === 0) rule = `<em>Cools after move ${p.limit}</em>`;
        else {
          const warm = p.limit - s.moves;
          rule = s.moves >= p.limit ? "<em>Gone cold</em>" : `<em>Warm for ${warm} more ${warm === 1 ? "move" : "moves"}</em>`;
        }
      } else if (p.kind === "cat") rule = delivered ? '<em class="ok">Home at last</em>' : "<em>Always rides last</em>";
      else if (p.kind === "signed")
        rule = delivered
          ? '<em class="ok">Signed for</em>'
          : gateOpen(p)
            ? '<em class="ok">Gate open</em>'
            : `<em>Gate latched. Key with ${houseOf(p.key!).who}</em>`;
      else if (delivered) rule = '<em class="ok">Delivered</em>';
      let right = "";
      if (sorting)
        right =
          `<span class="nudge"><button type="button" aria-label="Move ${k.label} earlier" data-up="${pos}"${pos === 0 ? " disabled" : ""}>${icon("icoUp", "0 0 16 16")}</button>` +
          `<button type="button" aria-label="Move ${k.label} later" data-down="${pos}"${pos === s.order.length - 1 ? " disabled" : ""}>${icon("icoDown", "0 0 16 16")}</button></span>`;
      else if (delivered) right = icon("icoCheck", "0 0 28 28", "st");
      li.innerHTML =
        `<span class="ord">${pos + 1}</span><span class="ic">${icon(k.ico, k.vb)}</span>` +
        `<span class="tx"><b>${k.label}</b><span>to ${nb.who} · ${nb.house}</span>${rule}</span>${right}`;
      list.appendChild(li);
    });
    list.querySelectorAll<HTMLButtonElement>("[data-up]").forEach((b) => b.addEventListener("click", () => swap(+b.getAttribute("data-up")!, -1)));
    list.querySelectorAll<HTMLButtonElement>("[data-down]").forEach((b) => b.addEventListener("click", () => swap(+b.getAttribute("data-down")!, 1)));
    const why = orderProblem(L, s.order);
    $("rulemsg").textContent = sorting && why ? why : "";
    $("lockline").innerHTML = sorting
      ? "The order locks with your first move. Restart is free and lets you re-sort."
      : s.phase === "done"
        ? ""
        : icon("icoLock", "0 0 24 24").replace("<svg", '<svg style="width:16px;height:16px"') + " Locked for this round. Restart to re-sort.";
    // controls
    $<HTMLButtonElement>("undoBtn").disabled = !s.hist.length || s.busy;
    $<HTMLButtonElement>("ccwBtn").disabled = s.sel < 0 || s.phase === "done" || s.phase === "dry" || !canRotate(s.P, s.v, s.sel);
    // banner
    const b = $("banner");
    let txt: string;
    b.className = "banner";
    if (s.phase === "done" || s.next >= s.order.length) txt = "Round finished. Replay any route to chase a better rating.";
    else if (s.phase === "dry") {
      b.className = "banner warn";
      txt = "The teapot is empty. Restart the route, or undo a move to try another way.";
    } else if (sorting && why) {
      b.className = "banner warn";
      txt = why;
    } else if (sorting) txt = "Sort the satchel, then make your first move. " + L.teach;
    else {
      const p = L.parcels[s.order[s.next]];
      txt = `Next stop: ${PARCELS[p.kind].label.toLowerCase()} for ${houseOf(p.to).who}. Pip sets off as soon as the lane connects.`;
      if (p.kind === "signed" && !gateOpen(p)) {
        b.className = "banner warn";
        txt = `The gate is latched until ${houseOf(p.key!).who} gets their post.`;
      }
      const left = cupsTotal - s.moves;
      if (left <= LOW_TEA_WARNING) {
        b.className = "banner warn";
        txt += left === 1 ? " Last cup in the pot!" : " Only 2 cups left in the pot.";
      }
    }
    $("bannerText").textContent = txt;
  }

  function swap(pos: number, dir: -1 | 1) {
    const s = g();
    if (s.phase !== "sort") return;
    const j = pos + dir;
    if (j < 0 || j >= s.order.length) return;
    const o = s.order.slice();
    [o[pos], o[j]] = [o[j], o[pos]];
    s.order = o;
    render();
    const btn =
      document.querySelector<HTMLButtonElement>(`[data-${dir < 0 ? "up" : "down"}="${j}"]`) ??
      document.querySelector<HTMLButtonElement>(`[data-${dir < 0 ? "down" : "up"}="${j}"]`);
    if (btn && !btn.disabled) {
      try {
        btn.focus();
      } catch {
        /* ignore */
      }
    }
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function clearToast() {
    clearTimeout(toastTimer);
    $("toast").classList.remove("show");
  }

  /* ---------- input: tap, swipe, right-click, keyboard ---------- */
  const board = $("board") as unknown as SVGSVGElement;
  let drag: { c: number; x: number; y: number; scale: number } | null = null;

  function svgPoint(e: MouseEvent): [number, number, number] {
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

  board.addEventListener("pointerdown", (e) => {
    if (!G || e.button === 2) return;
    const pt = svgPoint(e);
    const c = cellAt(pt);
    if (c < 0) return;
    drag = { c, x: e.clientX, y: e.clientY, scale: pt[2] };
    try {
      board.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  board.addEventListener("pointerup", (e) => {
    if (!drag || !G) return;
    const s = G;
    const d = drag;
    drag = null;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const thresh = Math.max(24, 34 * d.scale);
    s.sel = d.c;
    if (dist < thresh) {
      tryMove({ t: "r", i: d.c, d: 1 });
      drawCursor();
      renderSide();
      return;
    }
    const x = d.c % s.P.w;
    const y = Math.floor(d.c / s.P.w);
    if (Math.abs(dx) > Math.abs(dy)) {
      if (s.P.rowsM[y].length >= 2 && s.P.kind[d.c] === "m") tryMove({ t: "row", y, d: dx > 0 ? 1 : -1 });
      else toast("Only garden tiles slide. Swipe along a row of lanes.");
    } else {
      if (s.P.colsM[x].length >= 2 && s.P.kind[d.c] === "m") tryMove({ t: "col", x, d: dy > 0 ? 1 : -1 });
      else toast("Only garden tiles slide. Swipe along a column of lanes.");
    }
    drawCursor();
    renderSide();
  });
  board.addEventListener("pointercancel", () => {
    drag = null;
  });
  board.addEventListener("contextmenu", (e) => {
    if (!G) return;
    e.preventDefault();
    drag = null;
    const c = cellAt(svgPoint(e));
    if (c < 0) return;
    G.sel = c;
    tryMove({ t: "r", i: c, d: -1 });
    drawCursor();
    renderSide();
  });

  const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener("keydown", (e) => {
    if (!G || $("gameView").hidden) return;
    const s = G;
    const tag = (e.target as Element | null)?.tagName ?? "";
    const onButton = tag === "BUTTON";
    const k = e.key;
    if ((k === "z" || k === "Z") && !e.altKey) {
      e.preventDefault();
      undo();
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
          if (s.P.rowsM[y].length >= 2) tryMove({ t: "row", y, d: a[0] as 1 | -1 });
        } else if (s.P.colsM[x].length >= 2) tryMove({ t: "col", x, d: a[1] as 1 | -1 });
      } else {
        x = Math.min(s.P.w - 1, Math.max(0, x + a[0]));
        y = Math.min(s.P.h - 1, Math.max(0, y + a[1]));
        s.sel = y * s.P.w + x;
      }
      drawCursor();
      renderSide();
      return;
    }
    if (onButton) return;
    if (k === "r" || k === "R" || k === "Enter" || k === " ") {
      if (s.sel >= 0) {
        e.preventDefault();
        tryMove({ t: "r", i: s.sel, d: 1 });
      }
      return;
    }
    if (k === "q" || k === "Q") {
      if (s.sel >= 0) {
        e.preventDefault();
        tryMove({ t: "r", i: s.sel, d: -1 });
      }
    }
  });
  $("ccwBtn").addEventListener("click", () => {
    if (G && G.sel >= 0) tryMove({ t: "r", i: G.sel, d: -1 });
  });
  $("undoBtn").addEventListener("click", undo);
  $("restartBtn").addEventListener("click", restart);
  $("toRoutes").addEventListener("click", backToRoutes);

  renderRoutes();

  return {
    get G() {
      return G;
    },
    openLevel,
    tryMove,
    undo,
    restart,
    routes,
  };
}
