/** The end-of-route cards: Route complete (with the after-route hook) and the out-of-tea card. */
import { starsFor } from "../engine";
import type { Route } from "../levels";
import type { GameOptions, GameState } from "./game";
import { ding } from "./sound";
import { recordBest, type SaveData } from "./save";
import { $, icon, starRow } from "./svg";

export interface FinishHost {
  /** The current game. Only called where a route is open. */
  g(): GameState;
  /** The current game, or null on the route list. */
  readonly G: GameState | null;
  readonly routes: Route[];
  readonly save: SaveData;
  /** The options startGame received; read live so a replaced afterRoute is honoured. */
  readonly opts: GameOptions;
  clearToast(): void;
  renderSide(): void;
  openLevel(i: number): void;
  restart(): void;
  undo(): void;
  backToRoutes(): void;
}

export function createFinish(host: FinishHost) {
  const g = () => host.g();

  function finish() {
    const s = g();
    const L = s.L;
    const cold = L.parcels.filter((p, k) => p.limit && s.got[k] > p.limit);
    const n = starsFor(s.moves, L.par, cold.length > 0);
    s.phase = "done";
    ding();
    const firstFinish = !host.save.best[L.id];
    recordBest(host.save, L.id, n, s.moves);
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
    const last = s.li === host.routes.length - 1;
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
    host.clearToast();
    // The card stays hidden while an after-route scene plays, then shows on Continue.
    if (host.opts.afterRoute) {
      host.renderSide();
      const result = { route: L, index: s.li, stars: n, moves: s.moves, coldPie: cold.length > 0, firstFinish };
      host.opts.afterRoute(result, () => {
        if (host.G === s && s.phase === "done") showCard(d);
      });
    } else showCard(d);
  }

  function showCard(d: HTMLElement) {
    d.hidden = false;
    d.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const a = b.getAttribute("data-act");
        if (a === "next") host.openLevel(g().li + 1);
        else if (a === "replay") host.restart();
        else if (a === "undo") host.undo();
        else host.backToRoutes();
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
    host.renderSide();
  }

  function showOutOfTea() {
    const s = g();
    const left = s.order.length - s.next;
    s.phase = "dry";
    host.clearToast();
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

  return { finish, showOutOfTea };
}
