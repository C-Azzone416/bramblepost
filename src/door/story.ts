/**
 * Door scene logic with no DOM: scene shapes and picking which lines to say.
 * A scene plays once a whole route is finished (not after each parcel).
 */
import type { HouseStyle } from "../levels";

/** When a line variant applies. Every listed condition must hold. */
export interface Cond {
  /** True when at least one timed parcel (the pie) arrived late on this round. */
  coldPie?: boolean;
  /** Another scene's reply flag. `is: "unset"` matches a flag never chosen. */
  flag?: string;
  is?: string;
}

export interface Variant {
  if?: Cond;
  say: string;
}

/** A plain line, or variants where the first match wins. The last variant should have no `if`. */
export type LineSpec = string | Variant[];

export interface Choice {
  /** Saved as the flag's value. */
  id: string;
  /** Button text: a small kindness, never a wrong answer. */
  label: string;
  /** What the neighbour says back. */
  reply: string;
}

export interface Stamp {
  name: string;
  /** Face value in cents, printed on the stamp. */
  value: number;
  motif: "primrose" | "clover" | "wheel" | "bridge" | "teapot" | "willow" | "brook" | "lantern" | "gate" | "hedge" | "pietin" | "seal" | "kitten" | "dove" | "sprig";
  /** Stamp background colour. */
  sky: string;
}

export interface DoorScene {
  /** Which route this scene closes. */
  route: string;
  /** Whose home Pip stays for tea in. Must be one of the route's houses. */
  host: HouseStyle;
  /** Speaker name on the dialogue box. */
  speaker: string;
  /** Pitch of the gibberish voice, in Hz. */
  voice: number;
  lines: LineSpec[];
  /** Exactly two replies. */
  choices: [Choice, Choice];
  /** Save key for the chosen reply, e.g. "clementine.sisterNote". Later scenes and letters read it. */
  flag: string;
  stamp: Stamp;
}

export interface SceneContext {
  coldPie: boolean;
  flags: Record<string, string>;
}

export function matches(c: Cond | undefined, ctx: SceneContext): boolean {
  if (!c) return true;
  if (c.coldPie !== undefined && c.coldPie !== ctx.coldPie) return false;
  if (c.flag !== undefined) {
    const v = ctx.flags[c.flag];
    if (c.is === "unset" ? v !== undefined : v !== c.is) return false;
  }
  return true;
}

/** The lines to say this time, with variants resolved. */
export function resolveLines(scene: DoorScene, ctx: SceneContext): string[] {
  return scene.lines.map((spec) => {
    if (typeof spec === "string") return spec;
    const hit = spec.find((v) => matches(v.if, ctx));
    return hit ? hit.say : spec[spec.length - 1].say;
  });
}

export function sceneFor(scenes: DoorScene[], routeId: string): DoorScene | undefined {
  return scenes.find((s) => s.route === routeId);
}
