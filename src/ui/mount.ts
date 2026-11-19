import type { Route } from "../levels";
import { mountVillage, type VillageMap, type VillageMapOptions } from "../village/map";
import { drawPipSpines } from "./draw";
import { startGame, type GameApi, type GameOptions } from "./game";
import layout from "./layout.html?raw";
import sprites from "./sprites.svg?raw";
import { mountAlbum } from "./album";
import { applyMotion, loadReduceMotion } from "./motion";
import { mountSettings } from "./settings";
import { forgetMuted, reloadMuted } from "./sound";
import { $ } from "./svg";
import { isReturning, mountTitle, type Title, type TitleOptions } from "./title";
import { loadSave } from "./save";
import { resetProgress } from "../save";
import { NEIGHBOURHOODS } from "../village/data";
import { villageProgress } from "../village/progress";

export type App = GameApi & { readonly map: VillageMap; readonly title: Title };

export interface AppOptions extends Omit<GameOptions, "onLeave">, Pick<TitleOptions, "onAlbum" | "onSettings"> {
  /** Go straight to the map even for a returning player (default false). */
  skipTitle?: boolean;
  /** Called before a new village's map shows (the welcome intro hook, #61). Default: nothing. */
  onEnterVillage?: VillageMapOptions["onEnterVillage"];
  /** Preview tools only (#120): every village can be entered. Never set in a production build. */
  openAll?: boolean;
}

/**
 * Put the sprite sheet and page layout into `root`, then start the game.
 * The village map is the hub: it shows first, choosing a lane starts that route,
 * and leaving a route comes back to it. The route list stays reachable from the map ("How to play").
 * Everyone sees the title first: a returning player (any saved best) gets Continue and a confirmed New Game,
 * a first-time player gets New Game, which just opens the map. `opts.skipTitle` always goes to the map. `onAlbum` wires that button; Settings opens the Settings view (`onSettings` is also called).
 * `opts.afterRoute` plays after a finished route (the door scene); `onLeave` is always the map.
 */
const mounted = new WeakMap<HTMLElement, () => void>();

export function mountApp(root: HTMLElement, routes: Route[], opts: AppOptions = {}): App {
  mounted.get(root)?.(); // mounting again on the same root replaces the old app: release its document-level listeners
  const { skipTitle, onAlbum, onSettings, onEnterVillage, openAll, ...gameOpts } = opts;
  root.innerHTML = sprites + layout;
  drawPipSpines();
  applyMotion();
  const wrap = root.querySelector<HTMLElement>(".wrap")!;
  const showMap = () => {
    map.show();
    map.focus();
  };
  const game = startGame(routes, { ...gameOpts, onLeave: showMap });
  const map: VillageMap = mountVillage(wrap, routes, {
    onStart: (i) => game.openLevel(i),
    onEnterVillage,
    openAll,
    onRouteList: () => {
      map.hide();
      $("routesView").hidden = false;
    },
    onAlbum: () => (map.hide(), album.open($("mapAlbum"), () => map.show())),
    onSettings: () => openSettings(map.hide, map.show, "mapSettings"),
  });
  const album = mountAlbum(wrap, routes);
  // Settings returns to whichever view opened it, with focus back on the opening button.
  let back: () => void = () => {};
  const openSettings = (hide: () => void, restore: () => void, opener: string) => {
    onSettings?.();
    hide();
    back = () => (restore(), $(opener).focus());
    settings.open();
  };
  // The first village's welcome (#61) plays on a New Game or after a reset, through the same hook as any village.
  // Continuing a save never plays it. Leaving (a second New Game, a reset) aborts one that is still open.
  let welcome: AbortController | null = null;
  const showMapAfterWelcome = () => {
    welcome?.abort();
    welcome = null;
    if (!onEnterVillage) return showMap();
    const ac = (welcome = new AbortController());
    void Promise.resolve()
      .then(() => onEnterVillage?.(NEIGHBOURHOODS[0].id, true, ac.signal))
      .catch(() => {})
      .then(() => {
        if (welcome === ac) welcome = null;
        if (!ac.signal.aborted) showMap();
      });
  };
  // After a full wipe (Settings reset or New Game): drop the in-memory state and open a fresh map.
  const startFresh = () => {
    game.forgetProgress();
    forgetMuted();
    applyMotion(false);
    title.setReturning(false);
    map.reload();
    title.hide();
    showMapAfterWelcome();
  };
  /**
   * After a reset that only half worked: reload EVERY piece of in-memory state derived from saved data,
   * so memory and the DOM match whatever survived in storage. It covers:
   *  - best times / stars (game.reloadProgress)
   *  - the title's returning flag, Continue button and label
   *  - the mute switch (reloadMuted)
   *  - reduced motion: the html.reduce-motion class (applyMotion from the saved pref)
   *  - the current village and any entry in flight (map.reload)
   *  - the Settings switches (settings.refresh), whether or not the view is open
   * Ending, letters, album and voices read storage each time they are used, so they need nothing here.
   * Add any new cached state to this function.
   */
  const reconcile = () => {
    game.reloadProgress();
    const best = loadSave().best;
    const returning = isReturning(best);
    title.setReturning(returning);
    if (returning) title.setProgress(villageProgress(best));
    reloadMuted();
    applyMotion(loadReduceMotion());
    map.reload();
    settings.refresh();
  };
  const settings = mountSettings(wrap, {
    onBack: () => (settings.close(), back()),
    onReset: () => (settings.close(), startFresh()),
    onResetFailed: reconcile,
  });
  const title = mountTitle(wrap, {
    onNewGame: () => {
      // A first-time player has nothing to wipe: just open the map and leave settings alone.
      if (!title.returning) return (title.hide(), showMapAfterWelcome(), true);
      if (!resetProgress()) return (reconcile(), false);
      startFresh();
      return true;
    },
    onContinue: () => (title.hide(), showMap()),
    onAlbum: () => (onAlbum?.(), title.hide(), album.open($("titleAlbum"), () => title.show())),
    onSettings: () => openSettings(title.hide, title.show, "titleSettings"),
  });
  $("toMap").addEventListener("click", () => {
    $("routesView").hidden = true;
    showMap();
  });
  $("routesView").hidden = true;
  const best = loadSave().best;
  const returning = isReturning(best);
  title.setReturning(returning);
  if (returning) title.setProgress(villageProgress(best));
  if (skipTitle) showMap();
  else title.show();
  mounted.set(root, () => {
    game.dispose();
    map.dispose();
    album.dispose();
    welcome?.abort();
  });
  return Object.assign(game, { map, title });
}
