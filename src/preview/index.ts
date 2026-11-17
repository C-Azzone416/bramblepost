/**
 * Preview tools (#120): a small panel for dev previews that jumps to any season's village map or opens any route.
 *
 * Loaded only from src/main.ts behind `import.meta.env.DEV` with the story pack off, so a production build has
 * none of this and a story-mode dev server (`npm run play`) never shows it. Every jump plays on the scratch save
 * (sandbox.ts), so the real save is never written by the panel; "Back to my real save" returns to it.
 */
import "./preview.css";
import pack from "virtual:content-pack";
import type { Route } from "../levels";
import { localStorageAdapter, setAdapter, type StorageAdapter } from "../save/adapter";
import { ACTIVE_KEYS, type KeySet } from "../save/keys";
import { mountApp, type App, type AppOptions } from "../ui/mount";
import { reloadMuted } from "../ui/sound";
import { NEIGHBOURHOODS, type Season } from "../village/data";
import { fillScratch, needsOpenAll, prefixedAdapter, readSession, seedVillage, snapshot, writeSession, type PreviewSession, type SessionStore } from "./sandbox";

export * from "./sandbox";

export interface PreviewDeps {
  /** The real storage. Default: this browser's localStorage. */
  base?: StorageAdapter;
  /** Where the preview state lives. Default: sessionStorage (null when blocked). */
  session?: SessionStore | null;
  keys?: KeySet;
  /** Where the panel goes. Default: document.body. */
  host?: HTMLElement;
}

export interface Preview {
  readonly app: App;
  readonly state: Readonly<PreviewSession>;
  /** Show this village's map on a scratch save where every season before it is complete. */
  goToVillage(id: string): void;
  /** Open this route on the scratch save (started as a copy of the real save if it was off). */
  openRoute(id: string): void;
  /** Scratch save only: let every village be entered. */
  setOpenAll(on: boolean): void;
  /** Leave the scratch save (it is kept) and go back to the real one. */
  backToReal(): void;
  /** Empty the scratch save. */
  clearScratch(): void;
  /** Remove the panel. */
  dispose(): void;
}

const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

function defaultSession(): SessionStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

const MARKUP = `
<div class="pv" id="pvRoot">
  <button class="pvToggle" id="pvToggle" type="button" aria-expanded="false" aria-controls="pvPanel">Preview<span class="pvBadge" id="pvBadge" hidden>scratch save</span></button>
  <section class="pvPanel" id="pvPanel" hidden aria-labelledby="pvTitle">
    <div class="pvHead"><h2 id="pvTitle">Preview tools</h2><button class="pvClose" id="pvClose" type="button" aria-label="Close preview tools">&times;</button></div>
    <p class="pvStatus" id="pvStatus" role="status"></p>
    <h3>Village maps</h3>
    <p class="pvNote">Seasons before the one you pick count as finished.</p>
    <div class="pvGrid" id="pvVillages"></div>
    <label class="pvCheck"><input type="checkbox" id="pvOpenAll"> Open every village</label>
    <h3>Open a route</h3>
    <div class="pvRow"><select id="pvRoute" aria-label="Route"></select><button class="pvBtn" id="pvOpen" type="button">Open</button></div>
    <div class="pvRow pvFoot"><button class="pvBtn" id="pvReal" type="button">Back to my real save</button><button class="pvBtn" id="pvClear" type="button">Clear scratch save</button></div>
  </section>
</div>`;

export function bootPreview(root: HTMLElement, routes: Route[], opts: AppOptions = {}, deps: PreviewDeps = {}): Preview {
  if (pack.mode === "story") throw new Error("Preview tools never run with the story pack");
  const base = deps.base ?? localStorageAdapter();
  const session = deps.session === undefined ? defaultSession() : deps.session;
  const keys = deps.keys ?? ACTIVE_KEYS;
  const scratch = prefixedAdapter(base);
  let state = readSession(session);
  let app!: App;

  const host = deps.host ?? document.body;
  host.insertAdjacentHTML("beforeend", MARKUP);
  const box = host.querySelector<HTMLElement>("#pvRoot")!;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => box.querySelector<T>("#" + id)!;

  /** Set when a scratch save write failed, so the panel can say the jump didn't happen. Cleared by the next change. */
  let failed = false;

  /** (Re)start the game on whichever save `state` names. The adapter always follows `state`. */
  function mount(skipTitle: boolean) {
    setAdapter(state.scratch ? scratch : base);
    app = mountApp(root, routes, { ...opts, openAll: state.scratch && state.openAll, skipTitle: skipTitle || opts.skipTitle });
    reloadMuted(); // the sound module read the mute switch at import, before the save was chosen
    paint();
  }

  /**
   * Move to `next` all or nothing: `prepare` writes the scratch save first, and only once it has fully worked are
   * the state, the session and the running game's adapter switched together. If it throws (storage full or
   * blocked), nothing switches: the game is remounted on the save it was already on, so the state, the adapter
   * and the game can never disagree and the real save is never left under a game that thinks it is scratch.
   */
  function change(next: PreviewSession, prepare: () => void = () => {}, skipTitle = true): boolean {
    try {
      prepare();
    } catch {
      failed = true;
      mount(true);
      return false;
    }
    failed = false;
    state = next;
    writeSession(session, state);
    mount(skipTitle);
    return true;
  }

  function paint() {
    q("pvBadge").hidden = !state.scratch;
    q("pvStatus").textContent =
      (failed ? "Couldn't write the scratch save (storage full or blocked), so nothing changed. " : "") +
      (state.scratch ? "Playing a scratch save. Your real save is untouched." : "Playing your real save. A jump switches to a scratch save first.");
    const all = q<HTMLInputElement>("pvOpenAll");
    all.checked = state.scratch && state.openAll;
    all.disabled = !state.scratch;
    q<HTMLButtonElement>("pvReal").disabled = !state.scratch;
    const here = app?.map.visible ? app.map.village : null;
    for (const b of q("pvVillages").querySelectorAll<HTMLButtonElement>("button"))
      b.setAttribute("aria-pressed", String(state.scratch && b.dataset.hood === here));
  }

  function goToVillage(id: string) {
    const seed = seedVillage(id, keys, routes);
    change({ scratch: true, openAll: (state.scratch && state.openAll) || needsOpenAll(id) }, () => fillScratch(scratch, keys, seed));
  }

  function openRoute(id: string) {
    const i = routes.findIndex((r) => r.id === id);
    if (i < 0) return;
    // from the real save, the scratch save starts as a copy of it
    const prepare = state.scratch ? undefined : () => fillScratch(scratch, keys, snapshot(base, keys));
    if (!change({ scratch: true, openAll: state.scratch && state.openAll }, prepare)) return;
    app.map.hide();
    app.openLevel(i);
    paint();
  }

  function setOpenAll(on: boolean) {
    if (!state.scratch) return;
    change({ ...state, openAll: on });
  }

  function backToReal() {
    change({ scratch: false, openAll: false }, undefined, false);
  }

  function clearScratch() {
    if (state.scratch) {
      change(state, () => fillScratch(scratch, keys, {}));
      return;
    }
    try {
      fillScratch(scratch, keys, {});
      failed = false;
    } catch {
      failed = true;
    }
    paint();
  }

  /* ---------- the panel ---------- */
  const villages = q("pvVillages");
  for (const h of NEIGHBOURHOODS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pvBtn pvHood";
    b.dataset.hood = h.id;
    b.innerHTML = `<small>${SEASON_LABEL[h.season]}</small><b></b>`;
    b.querySelector("b")!.textContent = h.name;
    b.addEventListener("click", () => goToVillage(h.id));
    villages.appendChild(b);
  }
  const select = q<HTMLSelectElement>("pvRoute");
  const placed = new Set<string>();
  for (const h of NEIGHBOURHOODS) {
    if (!h.routes.length) continue;
    const group = document.createElement("optgroup");
    group.label = `${SEASON_LABEL[h.season]} · ${h.name}`;
    h.routes.forEach((id, k) => {
      const r = routes.find((x) => x.id === id);
      if (!r) return;
      placed.add(id);
      group.appendChild(new Option(`${k + 1}. ${r.name}`, id));
    });
    select.appendChild(group);
  }
  for (const r of routes) if (!placed.has(r.id)) select.appendChild(new Option(r.name, r.id));

  const panel = q("pvPanel");
  const toggle = q("pvToggle");
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) paint();
  };
  toggle.addEventListener("click", () => setOpen(!!panel.hidden));
  q("pvClose").addEventListener("click", () => (setOpen(false), toggle.focus()));
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") (setOpen(false), toggle.focus());
  });
  q("pvOpenAll").addEventListener("change", (e) => setOpenAll((e.target as HTMLInputElement).checked));
  q("pvOpen").addEventListener("click", () => openRoute(select.value));
  q("pvReal").addEventListener("click", backToReal);
  q("pvClear").addEventListener("click", clearScratch);

  mount(false);

  return {
    get app() {
      return app;
    },
    get state() {
      return state;
    },
    goToVillage,
    openRoute,
    setOpenAll,
    backToReal,
    clearScratch,
    dispose() {
      box.remove();
    },
  };
}
