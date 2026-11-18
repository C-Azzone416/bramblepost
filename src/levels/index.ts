import { AUTUMN } from "./autumn";
import { SUMMER } from "./summer";
import { SPRING } from "./spring";
import type { Route } from "./types";

export type { HouseStyle, Route } from "./types";
export { SPRING } from "./spring";
export { SUMMER } from "./summer";
export { AUTUMN } from "./autumn";

/** Every playable route, in the order shown on the route list. Add new seasons here. */
export const ROUTES: Route[] = [...SPRING, ...SUMMER, ...AUTUMN];
