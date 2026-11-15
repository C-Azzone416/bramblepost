/**
 * The title screen, shown to everyone. A first-time player sees New Game as the primary button
 * (it just opens the map). A returning player sees Continue as primary, and New Game asks for an
 * in-page confirm before it wipes anything. Village Album (#19) and Settings (#18) are hooks, shown as "Coming soon" until wired.
 *
 * Art is a placeholder built from the existing sprites (tree-stump post office, Pip, letters);
 * final key art is still an open call (#24).
 */
import "./title.css";
import { reducedMotion } from "./motion";
import type { VillageProgress } from "../village/progress";
import { NEIGHBOURHOODS, type Neighbourhood } from "../village/data";
import { allLanes } from "../village/progress";

export interface TitleOptions {
  /** Continue was chosen: open the village map. */
  onContinue(): void;
  /**
   * New Game was chosen (after the confirm, for a returning player). Wipe saved progress if needed and open
   * the map. Return false if the wipe only half worked: the title then stays up and says so.
   */
  onNewGame(): boolean;
  /** Wire the Village Album (#19). Without it the button is disabled and says "Coming soon". */
  onAlbum?(): void;
  /** Wire Settings (#18). Without it the button is disabled and says "Coming soon". */
  onSettings?(): void;
}

export interface Title {
  show(): void;
  hide(): void;
  /** Update the Continue label from progress. */
  setProgress(p: VillageProgress): void;
  /** Returning players get Continue and a confirmed New Game; first-time players get a plain New Game. */
  setReturning(returning: boolean): void;
  readonly visible: boolean;
  readonly returning: boolean;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * "Spring · Day 4": the season of the next open lane, and that lane's number in the season
 * (so four lanes stamped reads Day 5, the number of the lane Pip heads for next).
 * With no open lane left, the season reads "All lanes stamped" only when every slot has a route and
 * all of them are stamped. Reserved slots with no route yet read "More lanes soon" instead.
 * `hoods` supplies each season's slot count (the real map by default).
 */
export function continueLabel(p: VillageProgress, hoods: Pick<Neighbourhood, "id" | "slots">[] = NEIGHBOURHOODS): string {
  const lanes = allLanes(p);
  const next = lanes.find((l) => l.id === p.today);
  if (next) return `${cap(next.hood.season)} · Day ${next.n}`;
  const last = lanes.filter((l) => l.state === "done").pop();
  if (!last) return "Spring · Day 1";
  const season = cap(last.hood.season);
  const slots = hoods.find((h) => h.id === last.hood.id)?.slots.length ?? 0;
  const full = last.hood.lanes.length === slots && last.hood.stamps === last.hood.lanes.length;
  return `${season} · ${full ? "All lanes stamped" : "More lanes soon"}`;
}

/** Shown when a reset leaves some saved keys behind (Settings and New Game share it). */
export const RESET_FAILED_MSG = "Some of your progress didn't clear. Try again, or clear this site's data in your browser settings.";

/** True once the player has any saved progress (a best on any route). */
export function isReturning(best: Record<string, unknown>): boolean {
  return Object.keys(best).length > 0;
}

const LETTERS = [8, 24, 42, 60, 78].map((left, i) => `<svg class="tletter" style="left:${left}%;--d:${i * 1.3}s;--t:${7 + (i % 3)}s" viewBox="0 0 40 30" aria-hidden="true"><use href="#icoLetter"/></svg>`).join("");

export function mountTitle(container: HTMLElement, opts: TitleOptions): Title {
  container.insertAdjacentHTML(
    "afterbegin",
    `<section id="titleView" class="title" hidden aria-labelledby="titleName">
  <div class="tsky" aria-hidden="true">${LETTERS}</div>
  <div class="tart" aria-hidden="true">
    <svg class="tpo" viewBox="-82 -156 164 172"><use href="#rbPO"/></svg>
    <svg class="tpip" viewBox="0 0 360 340"><use href="#pip"/></svg>
  </div>
  <h1 id="titleName">Bramblepost</h1>
  <p class="tsub">Post for Thistledown</p>
  <nav class="tmenu" aria-label="Main menu">
    <button class="btn tbtn" type="button" id="titleContinue" hidden>Continue<small id="titleDay"></small></button>
    <button class="btn tbtn" type="button" id="titleNew" aria-describedby="titleMsg">New Game</button>
    <div id="titleConfirm" class="tconfirm" role="group" aria-label="Confirm new game" hidden>
      <p>This wipes your saved progress. Start over?</p>
      <button class="btn red tbtn" type="button" id="titleNewYes">Yes, start over</button>
      <button class="btn ghost tbtn" type="button" id="titleNewNo">Keep playing</button>
    </div>
    <button class="btn ghost tbtn" type="button" id="titleAlbum">Village Album</button>
    <button class="btn ghost tbtn" type="button" id="titleSettings">Settings</button>
  </nav>
  <p id="titleMsg" class="tmsg" role="status"></p>
</section>`,
  );
  const view = container.querySelector<HTMLElement>("#titleView")!;
  const btn = (id: string) => view.querySelector<HTMLButtonElement>("#" + id)!;
  const cont = btn("titleContinue");
  const newGame = btn("titleNew");
  const confirm = view.querySelector<HTMLElement>("#titleConfirm")!;
  const msg = view.querySelector<HTMLElement>("#titleMsg")!;
  let returning = false;
  const closeConfirm = () => {
    confirm.hidden = true;
    newGame.hidden = false;
  };

  const sky = view.querySelector(".tsky")!;
  const setDrift = () => sky.classList.toggle("drift", !reducedMotion());
  setDrift();

  const wire = (b: HTMLButtonElement, fn?: () => void) => {
    if (fn) b.addEventListener("click", fn);
    else {
      b.setAttribute("aria-disabled", "true");
      b.insertAdjacentHTML("beforeend", "<small>Coming soon</small>");
      b.addEventListener("click", (e) => e.preventDefault());
    }
  };
  cont.addEventListener("click", () => opts.onContinue());
  newGame.addEventListener("click", () => {
    msg.textContent = "";
    if (!returning) return void opts.onNewGame();
    newGame.hidden = true;
    confirm.hidden = false;
    btn("titleNewNo").focus();
  });
  btn("titleNewNo").addEventListener("click", () => (closeConfirm(), newGame.focus()));
  btn("titleNewYes").addEventListener("click", () => {
    closeConfirm();
    if (opts.onNewGame()) return;
    msg.textContent = RESET_FAILED_MSG;
    newGame.focus();
  });
  view.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Escape" || confirm.hidden) return;
    e.preventDefault();
    closeConfirm();
    newGame.focus();
  });
  wire(btn("titleAlbum"), opts.onAlbum);
  wire(btn("titleSettings"), opts.onSettings);

  // Up/down arrows move between the items; Tab and Enter work as on any buttons.
  view.querySelector(".tmenu")!.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== "ArrowDown" && k !== "ArrowUp") return;
    const items = [...view.querySelectorAll<HTMLButtonElement>(".tbtn")].filter((b) => !b.closest("[hidden]"));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (k === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    e.preventDefault();
  });

  return {
    show() {
      setDrift();
      closeConfirm();
      msg.textContent = "";
      view.hidden = false;
      (returning ? cont : newGame).focus();
    },
    hide() {
      view.hidden = true;
    },
    setProgress(p) {
      view.querySelector("#titleDay")!.textContent = continueLabel(p);
    },
    setReturning(r) {
      returning = r;
      cont.hidden = !r;
      newGame.classList.toggle("ghost", r);
    },
    get returning() {
      return returning;
    },
    get visible() {
      return !view.hidden;
    },
  };
}
