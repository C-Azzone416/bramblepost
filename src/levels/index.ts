import { SPRING } from "./spring";
import type { Route } from "./types";

export type { HouseStyle, Route } from "./types";
export { SPRING } from "./spring";

/** Every playable route, in the order shown on the route list. Add new seasons here. */
export const ROUTES: Route[] = [...SPRING];
