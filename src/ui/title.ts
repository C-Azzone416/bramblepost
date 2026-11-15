/**
 * The title screen: the first thing a returning player sees. Continue opens the village map,
 * Village Album and Settings are hooks for #19 and #18 (shown as "Coming soon" until wired).
 *
 * Art is a placeholder built from the existing sprites (tree-stump post office, Pip, letters);
 * final key art is still an open call (#24).
 */
import "./title.css";
import type { VillageProgress } from "../village/progress";
import { allLanes } from "../village/progress";

export interface TitleOptions {
  /** Continue was chosen: open the village map. */
  onContinue(): void;
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
  readonly visible: boolean;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * "Spring · Day 4": the season of the next open lane, and that lane's number in the season
 * (so four lanes stamped reads Day 5, the number of the lane Pip heads for next).
 * With every lane stamped there is no next lane, so it reads "Spring · All lanes stamped".
 */
export function continueLabel(p: VillageProgress): string {
  const lanes = allLanes(p);
  const next = lanes.find((l) => l.id === p.today);
  if (next) return `${cap(next.hood.season)} · Day ${next.n}`;
  const last = lanes.filter((l) => l.state === "done").pop();
  return last ? `${cap(last.hood.season)} · All lanes stamped` : "Spring · Day 1";
}

/** True once the player has any saved progress (a best on any route). */
export function isReturning(best: Record<string, unknown>): boolean {
  return Object.keys(best).length > 0;
}

const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    <button class="btn tbtn" type="button" id="titleContinue">Continue<small id="titleDay"></small></button>
    <button class="btn ghost tbtn" type="button" id="titleAlbum">Village Album</button>
    <button class="btn ghost tbtn" type="button" id="titleSettings">Settings</button>
  </nav>
</section>`,
  );
  const view = container.querySelector<HTMLElement>("#titleView")!;
  const btn = (id: string) => view.querySelector<HTMLButtonElement>("#" + id)!;
  const cont = btn("titleContinue");

  if (!prefersReducedMotion()) view.querySelector(".tsky")!.classList.add("drift");

  const wire = (b: HTMLButtonElement, fn?: () => void) => {
    if (fn) b.addEventListener("click", fn);
    else {
      b.setAttribute("aria-disabled", "true");
      b.insertAdjacentHTML("beforeend", "<small>Coming soon</small>");
      b.addEventListener("click", (e) => e.preventDefault());
    }
  };
  cont.addEventListener("click", () => opts.onContinue());
  wire(btn("titleAlbum"), opts.onAlbum);
  wire(btn("titleSettings"), opts.onSettings);

  // Up/down arrows move between the items; Tab and Enter work as on any buttons.
  view.querySelector(".tmenu")!.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== "ArrowDown" && k !== "ArrowUp") return;
    const items = [...view.querySelectorAll<HTMLButtonElement>(".tbtn")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (k === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    e.preventDefault();
  });

  return {
    show() {
      view.hidden = false;
      cont.focus();
    },
    hide() {
      view.hidden = true;
    },
    setProgress(p) {
      view.querySelector("#titleDay")!.textContent = continueLabel(p);
    },
    get visible() {
      return !view.hidden;
    },
  };
}
