import type { Route } from "../levels";
import { mountVillage, type VillageMap } from "../village/map";
import { drawPipSpines } from "./draw";
import { startGame, type GameApi, type GameOptions } from "./game";
import layout from "./layout.html?raw";
import sprites from "./sprites.svg?raw";
import { mountAlbum } from "./album";
import { applyMotion } from "./motion";
import { mountSettings } from "./settings";
import { forgetMuted } from "./sound";
import { $ } from "./svg";
import { isReturning, mountTitle, type Title, type TitleOptions } from "./title";
import { loadSave } from "./save";
import { resetProgress } from "../save";
import { villageProgress } from "../village/progress";

export type App = GameApi & { readonly map: VillageMap; readonly title: Title };

export interface AppOptions extends Omit<GameOptions, "onLeave">, Pick<TitleOptions, "onAlbum" | "onSettings"> {
  /** Go straight to the map even for a returning player (default false). */
  skipTitle?: boolean;
}

/**
 * Put the sprite sheet and page layout into `root`, then start the game.
 * The village map is the hub: it shows first, choosing a lane starts that route,
 * and leaving a route comes back to it. The route list stays reachable from the map ("How to play").
 * Everyone sees the title first: a returning player (any saved best) gets Continue and a confirmed New Game,
 * a first-time player gets New Game, which just opens the map. `opts.skipTitle` always goes to the map. `onAlbum` wires that button; Settings opens the Settings view (`onSettings` is also called).
 * `opts.afterRoute` plays after a finished route (the door scene); `onLeave` is always the map.
 */
export function mountApp(root: HTMLElement, routes: Route[], opts: AppOptions = {}): App {
  const { skipTitle, onAlbum, onSettings, ...gameOpts } = opts;
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
  // After a full wipe (Settings reset or New Game): drop the in-memory state and open a fresh map.
  const startFresh = () => {
    game.forgetProgress();
    forgetMuted();
    applyMotion(false);
    title.setReturning(false);
    title.hide();
    showMap();
  };
  const settings = mountSettings(wrap, {
    onBack: () => (settings.close(), back()),
    onReset: () => (settings.close(), startFresh()),
  });
  const title = mountTitle(wrap, {
    onNewGame: () => {
      if (title.returning && !resetProgress()) return false;
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
  return Object.assign(game, { map, title });
}
