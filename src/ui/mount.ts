import type { Route } from "../levels";
import { mountVillage, type VillageMap } from "../village/map";
import { drawPipSpines } from "./draw";
import { startGame, type GameApi, type GameOptions } from "./game";
import layout from "./layout.html?raw";
import sprites from "./sprites.svg?raw";
import { applyMotion } from "./motion";
import { mountSettings } from "./settings";
import { forgetMuted } from "./sound";
import { $ } from "./svg";
import { isReturning, mountTitle, type Title, type TitleOptions } from "./title";
import { loadSave } from "./save";
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
 * A returning player (any saved best) sees the title first, and Continue opens the map; a new player
 * lands on the map. `opts.skipTitle` always goes to the map. `onAlbum` wires that button; Settings opens the Settings view (`onSettings` is also called).
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
  });
  const settings = mountSettings(wrap, {
    onBack: () => {
      settings.close();
      title.show();
      $("titleSettings").focus();
    },
    onReset: () => {
      settings.close();
      game.forgetProgress();
      forgetMuted();
      applyMotion(false);
      title.hide();
      showMap();
    },
  });
  const title = mountTitle(wrap, {
    onContinue: () => (title.hide(), showMap()),
    onAlbum,
    onSettings: () => {
      onSettings?.();
      title.hide();
      settings.open();
    },
  });
  $("toMap").addEventListener("click", () => {
    $("routesView").hidden = true;
    showMap();
  });
  $("routesView").hidden = true;
  const best = loadSave().best;
  if (!skipTitle && isReturning(best)) {
    title.setProgress(villageProgress(best));
    title.show();
  } else showMap();
  return Object.assign(game, { map, title });
}
