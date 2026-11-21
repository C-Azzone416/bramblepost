/**
 * The Village Album, by season in year order (spring, summer, autumn, winter): each village's stamps, its welcome
 * replay and its letters, with empty slots for what is still to find. A season not reached yet shows only a placeholder. It reads everything fresh each time it opens:
 * stamps from the saved bests, letter slots from the registry (so it fills in once #8 adds letters),
 * letters read from the letters save.
 *
 * Art reuses the existing stamp, star and envelope sprites in the current palette; final look is #24.
 */
import "./album.css";
import { ACTIVE_PACK } from "../content/active";
import type { Route } from "../levels";
import { loadLetters } from "../letters/save";
import type { Letter } from "../letters/types";
import { currentLetters } from "../letters/registry";
import { NEIGHBOURHOODS, reservedSlots, type Neighbourhood, type Season } from "../village/data";
import { introsForPack, introsSeen, playIntro } from "../village/intro";
import { villageProgress } from "../village/progress";
import { loadSave } from "./save";
import { icon, starRow } from "./svg";

export interface Album {
  /** Show the album. `back` re-shows the view it covered; focus then returns to `opener`. */
  open(opener: HTMLElement | null, back: () => void): void;
  close(): void;
  /** Cancel any open replay and stop listening. For when the app is torn down. */
  dispose(): void;
  readonly visible: boolean;
}

const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

/**
 * Letter slots per village id, each village's in route order then parcel slot. One slot per (route, slot) placement,
 * so exclusive variants (#9) count once. A letter rides its route's village; an unplaced letter, or one on a route no
 * village lists, is its own slot in the first village (spring), after that village's placed ones.
 */
export function letterSlotsBySeason(letters: readonly Letter[], hoods: readonly Pick<Neighbourhood, "id" | "routes">[]): Map<string, Letter[][]> {
  const out = new Map<string, Letter[][]>(hoods.map((h) => [h.id, []]));
  const placed = new Map<string, { at: number; slot: number; group: Letter[] }>();
  const loose = new Map<string, Letter[]>();
  for (const l of letters) {
    const hood = l.placement ? hoods.findIndex((h) => h.routes.includes(l.placement!.route)) : -1;
    if (hood < 0) {
      const key = l.placement ? `${l.placement.route}#${l.placement.slot}` : `id:${l.id}`;
      loose.set(key, [...(loose.get(key) ?? []), l]);
      continue;
    }
    const key = `${l.placement!.route}#${l.placement!.slot}`;
    const prev = placed.get(key);
    if (prev) prev.group.push(l);
    else placed.set(key, { at: hood, slot: l.placement!.slot, group: [l] });
  }
  const route = (g: Letter[]) => hoods.find((h) => h.routes.includes(g[0].placement!.route))!.routes.indexOf(g[0].placement!.route);
  [...placed.values()]
    .sort((a, b) => a.at - b.at || route(a.group) - route(b.group) || a.slot - b.slot)
    .forEach((p) => out.get(hoods[p.at].id)!.push(p.group));
  if (hoods.length) out.get(hoods[0].id)!.push(...loose.values());
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
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
  const intros = introsForPack(ACTIVE_PACK);
  const names = new Map(routes.map((r) => [r.id, r.name]));
  let opener: HTMLElement | null = null;
  let back: () => void = () => {};

  function render() {
    const progress = villageProgress(loadSave().best);
    const read = new Set(loadLetters().read);
    const seenIntros = introsSeen();
    const bySeason = letterSlotsBySeason(currentLetters(), NEIGHBOURHOODS);
    let html = "";

    // One section per village, in year order. A season not yet reached is a quiet placeholder: nothing of it is counted or named.
    for (const h of progress.hoods) {
      const hood = NEIGHBOURHOODS.find((n) => n.id === h.id)!;
      const label = `${SEASON_LABEL[h.season]} · ${h.name}`;
      const welcomed = !!intros[h.id] && seenIntros.includes(h.id);
      if (h.state !== "open" && !welcomed) {
        html += `<section class="asec aseason locked" aria-labelledby="alb-${h.id}"><h2 id="alb-${h.id}">${esc(label)}</h2><p class="alock">Opens in ${SEASON_LABEL[h.season].toLowerCase()}</p></section>`;
        continue;
      }
      let inner = "";
      if (h.lanes.length) {
        const reserved = reservedSlots(hood).length;
        const items = h.lanes.map((l) => {
          const name = names.get(l.id) ?? l.id;
          return l.state === "done"
            ? stamp(name, l.stars)
            : `<li class="astamp" aria-label="${esc(name)}, not yet stamped">${icon("icoCheck", "0 0 28 28", "astampArt")}<b>${esc(name)}</b></li>`;
        });
        for (let i = 0; i < reserved; i++) items.push(`<li class="astamp reserved" aria-label="Not yet stamped"><span class="aq" aria-hidden="true">?</span></li>`);
        inner += `<h3 id="alb-${h.id}-stamps">Stamps <small>${h.stamps} of ${h.lanes.length + reserved}</small></h3><ul class="astamps" aria-labelledby="alb-${h.id}-stamps">${items.join("")}</ul>`;
      }
      // Replay a welcome already read. Replaying never touches the seen flag: only playIntro runs, nothing is saved.
      if (welcomed) {
        inner += `<h3 id="alb-${h.id}-welcome">Welcome</h3><ul class="awelcomes" aria-labelledby="alb-${h.id}-welcome"><li><span>${esc(h.name)}</span><button class="btn ghost" type="button" data-replay="${esc(h.id)}" aria-label="${esc(`Replay welcome, ${h.name}`)}">Replay welcome</button></li></ul>`;
      }
      const slots = bySeason.get(h.id) ?? [];
      const letterItems = slots.map((group) => {
        const l = group.find((x) => read.has(x.id));
        return l
          ? `<li class="aletter done" aria-label="${esc(`Letter read: ${l.envelope}`)}">${icon("icoLetter", "0 0 40 30")}<span>${esc(l.envelope)}</span></li>`
          : `<li class="aletter" aria-label="Letter still to find"><span class="aq" aria-hidden="true">?</span></li>`;
      });
      const got = slots.filter((group) => group.some((l) => read.has(l.id))).length;
      inner += `<h3 id="alb-${h.id}-letters">Letters${slots.length ? ` <small>${got} of ${slots.length}</small>` : ""}</h3>${
        letterItems.length ? `<ul class="aletters" aria-labelledby="alb-${h.id}-letters">${letterItems.join("")}</ul>` : `<p class="anone">No letters yet</p>`
      }`;
      html += `<section class="asec aseason" aria-labelledby="alb-${h.id}"><h2 id="alb-${h.id}">${esc(label)}</h2>${inner}</section>`;
    }
    body.innerHTML = html;
  }

  function close() {
    if (view.hidden) return;
    stopReplay();
    view.hidden = true;
    back();
    opener?.focus();
    opener = null;
  }

  // One replay at a time. Its controller lives as long as the Album view: closing or disposing aborts it.
  let replay: AbortController | null = null;
  /** Cancel an open replay. The buttons go first so the letter view's delayed focus restore has nothing to land on. */
  function stopReplay() {
    if (!replay) return;
    body.replaceChildren();
    replay.abort();
    replay = null;
  }
  body.addEventListener("click", async (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>("[data-replay]");
    if (!btn || replay) return;
    const mine = (replay = new AbortController());
    try {
      await playIntro(btn.dataset.replay!, { intros }, mine.signal);
    } finally {
      if (replay === mine) replay = null;
    }
    // The intro skips its own focus restore when read through (the map normally moves focus); do it here.
    if (!mine.signal.aborted && btn.isConnected && !view.hidden) btn.focus();
  });

  view.querySelector("#albumBack")!.addEventListener("click", close);
  view.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
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
    dispose() {
      stopReplay();
      view.hidden = true;
    },
    get visible() {
      return !view.hidden;
    },
  };
}
