/**
 * The playable page: route list, game state and moves. The board view is in board.ts, the satchel
 * panel in satchel.ts and the finish / out-of-tea cards in finish.ts.
 * All rules come from src/engine; the ui files only draw and handle input.
 */
import {
  apply,
  defaultOrder,
  deliverChain,
  LOW_TEA_WARNING,
  legal,
  orderProblem,
  outOfTea,
  parse,
  teapot,
  type Board,
  type Delivery,
  type Move,
} from "../engine";
import type { Route } from "../levels";
import { PARCELS } from "./cast";
import { createBoard, type Anim } from "./board";
import { T } from "./draw";
import { createFinish } from "./finish";
import { loadSave, type SaveData } from "./save";
import { createSatchel, houseOf } from "./satchel";
import { reducedMotion } from "./motion";
import { armSound, kettle, pluck } from "./sound";
import { $, icon, starRow } from "./svg";

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
  /** Drop the in-memory bests after a reset, so the next finish does not write the old ones back. */
  forgetProgress(): void;
  /** Re-read the bests from storage (after a reset that only half worked), so memory matches what survived. */
  reloadProgress(): void;
  /** The app is going away: drop the ambient loop's listeners and observers. */
  dispose(): void;
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
  /** No finish was saved for this route before, so its stamp is new on the village map. */
  firstFinish: boolean;
}

/**
 * Runs when a route is finished, before the Route complete card. Call `onContinue` once to show
 * the card (with Next route, Play again and All routes). It may return a cancel function: the game
 * calls it if the player leaves or replays the route before then, so nothing is left open.
 */
export type AfterRoute = (result: RouteResult, onContinue: () => void) => void | (() => void);

export interface GameOptions {
  /** Called when the player leaves a route ("Routes" button, "All routes" on a card). Without it, the route list shows. */
  onLeave?: () => void;
  /** Plays after a finished route, before the Route complete card (the door scene). */
  afterRoute?: AfterRoute;
}

export function startGame(routes: Route[], opts: GameOptions = {}): GameApi {
  let G: GameState | null = null;
  const save: SaveData = loadSave();

  /** The current game. Only called where a route is open. */
  const g = (): GameState => G!;

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

  /** Bumped whenever the game a walk belongs to goes away (leave, restart, open another route); stale delivery callbacks check it. */
  let run = 0;
  function endRun() {
    run++;
    board.cancelWalk();
    board.stopAmbient();
  }

  function openLevel(i: number, keepScroll = false) {
    finishFlow.cancelAfterRoute();
    endRun();
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
    board.build();
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
    finishFlow.cancelAfterRoute();
    endRun();
    G = null;
    $("gameView").hidden = true;
    renderRoutes();
    if (opts.onLeave) opts.onLeave();
    else $("routesView").hidden = false;
    scrollTop();
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
        const a = board.xy(from);
        const b = board.xy(to);
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
    board.render(anim);
    const chain = deliverChain(P, s.v, s.order, s.next);
    if (chain.length) {
      s.busy = true;
      const mine = run;
      setTimeout(() => run === mine && runDeliveries(chain, 0), reducedMotion() ? 0 : 230);
    } else checkTea();
  }

  function checkTea() {
    const s = g();
    if (s.phase === "play" && outOfTea(s.moves, s.L.par, s.next, s.order.length)) finishFlow.showOutOfTea();
    else if (s.phase === "play" && teapot(s.L.par) - s.moves === LOW_TEA_WARNING) kettle();
  }

  function runDeliveries(chain: Delivery[], j: number) {
    const s = g();
    if (j >= chain.length) {
      s.busy = false;
      render();
      if (s.next >= s.order.length) finishFlow.finish();
      else checkTea();
      return;
    }
    const d = chain[j];
    const mine = run;
    board.walk(d.path, () => {
      if (run !== mine || G !== s) return;
      const p = s.L.parcels[d.k];
      s.got[d.k] = s.moves;
      s.next++;
      s.at = p.to;
      pluck(s.next);
      const late = p.limit && s.moves > p.limit;
      toast(PARCELS[p.kind].label + " delivered to " + houseOf(s, p.to).who + (p.limit ? (late ? ", a little cold." : ", still warm.") : "."));
      render();
      runDeliveries(chain, j + 1);
    });
  }

  function undo() {
    if (!G || G.busy || !G.hist.length) return;
    const s = G;
    finishFlow.cancelAfterRoute();
    const h = s.hist.pop()!;
    s.v = h.v;
    s.ids = h.ids;
    s.moves = h.moves;
    s.next = h.next;
    s.at = h.at;
    s.got = h.got;
    s.phase = s.moves === 0 ? "sort" : "play";
    $("done").hidden = true;
    board.resetPip(s.at);
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

  /* ---------- wiring ---------- */
  const board = createBoard({
    g,
    get G() {
      return G;
    },
    get reduce() {
      return reducedMotion();
    },
    tryMove,
    undo,
    toast,
    renderSide: () => satchel.renderSide(),
  });
  const satchel = createSatchel({ g, render });
  const finishFlow = createFinish({
    g,
    get G() {
      return G;
    },
    routes,
    save,
    opts,
    clearToast,
    renderSide: () => satchel.renderSide(),
    openLevel,
    restart,
    undo,
    backToRoutes,
  });

  /** Redraw the board, which also refreshes the satchel and HUD. */
  function render(anim?: Anim) {
    board.render(anim);
  }

  $("ccwBtn").addEventListener("click", () => {
    if (G && G.sel >= 0) tryMove({ t: "r", i: G.sel, d: -1 });
  });
  $("undoBtn").addEventListener("click", undo);
  $("restartBtn").addEventListener("click", restart);
  $("toRoutes").addEventListener("click", backToRoutes);

  armSound();

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
    forgetProgress() {
      for (const k of Object.keys(save.best)) delete save.best[k];
    },
    dispose() {
      endRun();
      board.dispose();
    },
    reloadProgress() {
      const fresh = loadSave().best;
      for (const k of Object.keys(save.best)) delete save.best[k];
      Object.assign(save.best, fresh);
    },
  };
}
