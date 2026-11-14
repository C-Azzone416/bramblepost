import type { Route } from "../levels";
import { drawPipSpines } from "./draw";
import { startGame, type GameApi } from "./game";
import layout from "./layout.html?raw";
import sprites from "./sprites.svg?raw";

/** Put the sprite sheet and page layout into `root`, then start the game. */
export function mountApp(root: HTMLElement, routes: Route[]): GameApi {
  root.innerHTML = sprites + layout;
  drawPipSpines();
  return startGame(routes);
}
