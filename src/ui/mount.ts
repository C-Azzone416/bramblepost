import type { Route } from "../levels";
import { mountVillage, type VillageMap } from "../village/map";
import { drawPipSpines } from "./draw";
import { startGame, type GameApi } from "./game";
import layout from "./layout.html?raw";
import sprites from "./sprites.svg?raw";
import { $ } from "./svg";

export type App = GameApi & { readonly map: VillageMap };

/**
 * Put the sprite sheet and page layout into `root`, then start the game.
 * The village map is the hub: it shows first, choosing a lane starts that route,
 * and leaving a route comes back to it. The route list stays reachable from the map ("How to play").
 */
export function mountApp(root: HTMLElement, routes: Route[]): App {
  root.innerHTML = sprites + layout;
  drawPipSpines();
  const wrap = root.querySelector<HTMLElement>(".wrap")!;
  const game = startGame(routes, { onLeave: () => map.show() });
  const map: VillageMap = mountVillage(wrap, routes, {
    onStart: (i) => game.openLevel(i),
    onRouteList: () => {
      map.hide();
      $("routesView").hidden = false;
    },
  });
  $("toMap").addEventListener("click", () => {
    $("routesView").hidden = true;
    map.show();
  });
  $("routesView").hidden = true;
  map.show();
  return Object.assign(game, { map });
}
