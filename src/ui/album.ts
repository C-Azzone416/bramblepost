/**
 * The Village Album: stamps collected per route (with their stars) and letters read per neighbour,
 * with empty slots for what is still to find. It reads everything fresh each time it opens:
 * stamps from the saved bests, letter slots from the registry (so it fills in once #8 adds letters),
 * letters read from the letters save.
 *
 * Art reuses the existing stamp, star and envelope sprites in the current palette; final look is #24.
 */
import "./album.css";
import type { Route } from "../levels";
import { loadLetters } from "../letters/save";
import { currentLetters } from "../letters/registry";
import { NEIGHBOURHOODS, reservedSlots } from "../village/data";
import { villageProgress } from "../village/progress";
import { NEIGHBOURS } from "./cast";
import { loadSave } from "./save";
import { icon, starRow } from "./svg";

export interface Album {
  /** Show the album. `back` re-shows the view it covered; focus then returns to `opener`. */
  open(opener: HTMLElement | null, back: () => void): void;
  close(): void;
  readonly visible: boolean;
}

/** The neighbours in the order the album lists them. */
const ORDER = ["tea", "acorn", "mush", "burrow"] as const;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const norm = (s: string) => s.toLowerCase().replace(/^the /, "").replace(/[^a-z0-9]/g, "");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function stamp(name: string, stars: number): string {
  return `<li class="astamp done" aria-label="${esc(`${name}, ${plural(stars, "star")}`)}">${icon("icoCheck", "0 0 28 28", "astampArt")}<b>${esc(name)}</b><span class="astars" aria-hidden="true">${starRow(stars)}</span></li>`;
}

export function mountAlbum(container: HTMLElement, routes: Route[]): Album {
  container.insertAdjacentHTML(
    "afterbegin",
    `<section id="albumView" class="album" hidden aria-labelledby="albumTitle">
  <div class="atop"><h1 id="albumTitle" tabindex="-1">Village Album</h1><button class="btn ghost" id="albumBack" type="button">Back</button></div>
  <div id="albumBody"></div>
</section>`,
  );
  const view = container.querySelector<HTMLElement>("#albumView")!;
  const body = view.querySelector<HTMLElement>("#albumBody")!;
  const names = new Map(routes.map((r) => [r.id, r.name]));
  let opener: HTMLElement | null = null;
  let back: () => void = () => {};

  function render() {
    const progress = villageProgress(loadSave().best);
    const read = new Set(loadLetters().read);
    const letters = currentLetters();
    let html = "";

    for (const h of progress.hoods) {
      const hood = NEIGHBOURHOODS.find((n) => n.id === h.id)!;
      const reserved = reservedSlots(hood).length;
      if (!h.lanes.length && !reserved) continue;
      const items = h.lanes.map((l) => {
        const name = names.get(l.id) ?? l.id;
        return l.state === "done"
          ? stamp(name, l.stars)
          : `<li class="astamp" aria-label="${esc(name)}, not yet stamped">${icon("icoCheck", "0 0 28 28", "astampArt")}<b>${esc(name)}</b></li>`;
      });
      for (let i = 0; i < reserved; i++) items.push(`<li class="astamp reserved" aria-label="Not yet stamped"><span class="aq" aria-hidden="true">?</span></li>`);
      html += `<section class="asec" aria-labelledby="alb-${h.id}"><h2 id="alb-${h.id}">${esc(h.name)} stamps <small>${h.stamps} of ${h.lanes.length + reserved}</small></h2><ul class="astamps">${items.join("")}</ul></section>`;
    }

    let neighbours = "";
    for (const style of ORDER) {
      const n = NEIGHBOURS[style];
      const who = cap(n.who);
      const mine = letters.filter((l) => norm(l.recipient) === norm(n.who));
      const items = mine.map((l) =>
        read.has(l.id)
          ? `<li class="aletter done" aria-label="${esc(`Letter read: ${l.envelope}`)}">${icon("icoLetter", "0 0 40 30")}<span>${esc(l.envelope)}</span></li>`
          : `<li class="aletter" aria-label="Letter still to find"><span class="aq" aria-hidden="true">?</span></li>`,
      );
      const got = mine.filter((l) => read.has(l.id)).length;
      neighbours += `<section class="aneighbour" aria-labelledby="aln-${style}"><svg class="ahouse" viewBox="${n.vb}" aria-hidden="true"><use href="#${n.sym}"/></svg><h3 id="aln-${style}">${esc(who)}${mine.length ? ` <small>${got} of ${mine.length}</small>` : ""}</h3>${
        items.length ? `<ul class="aletters">${items.join("")}</ul>` : `<p class="anone">No letters yet</p>`
      }</section>`;
    }
    html += `<section class="asec"><h2>Letters read</h2><div class="aneighbours">${neighbours}</div></section>`;
    body.innerHTML = html;
  }

  function close() {
    if (view.hidden) return;
    view.hidden = true;
    back();
    opener?.focus();
    opener = null;
  }

  view.querySelector("#albumBack")!.addEventListener("click", close);
  view.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  return {
    open(from, onBack) {
      opener = from;
      back = onBack;
      render();
      view.hidden = false;
      view.querySelector<HTMLElement>("#albumTitle")!.focus();
    },
    close,
    get visible() {
      return !view.hidden;
    },
  };
}
