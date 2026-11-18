/**
 * The welcome intro (#61): a short "Welcome to <village>" the first time a village is entered. It plays in the
 * letter view (same focus, Escape and reduced-motion handling), as the `onEnterVillage` hook the map waits on.
 *
 * The copy is data per village id, 3 to 5 lines of under 140 characters. Hollowmere's is placeholder copy, to be
 * rewritten by the owner. Which villages have been welcomed is saved under INTRO_KEY (per pack, cleared by reset).
 * Seen is saved only when the player reads it through; leaving mid-intro cancels it cleanly and it plays again.
 */
import { readRaw, writeRaw } from "../save/core";
import { INTRO_KEY } from "../save/keys";
import { showLetter, type LetterHandle } from "../letters/view";
import { NEIGHBOURHOODS } from "./data";
import type { VillageMapOptions } from "./map";

type VillageMapHook = NonNullable<VillageMapOptions["onEnterVillage"]>;

export const VILLAGE_INTROS: Record<string, string[]> = {
  thistledown: [
    "Welcome to Thistledown, Pip.",
    "The kettle is always on here, and the post office door is never locked.",
    "Take a satchel, take your time, and say hello to everyone you pass.",
  ],
  hollowmere: [
    "Welcome to Hollowmere, Pip.",
    "The pond is still and the lanes are quiet. Everyone here is glad of a letter.",
    "Mind the puddles, and stop for a cup of tea if you are offered one.",
  ],
  conker: [
    "Welcome to Conker Corner, Pip.",
    "The hedges are full of acorns and the lanes smell of woodsmoke.",
    "There is plenty of post to carry. There is plenty of time, too.",
  ],
  snowberry: [
    "Welcome to Snowberry End, Pip.",
    "The windows are glowing and the chimneys are puffing.",
    "Wrap up warm. The post still needs delivering, and so do the kind words.",
  ],
};

export type Store = Pick<Storage, "getItem" | "setItem">;

/** The ids of villages whose welcome has been read. Never throws. */
export function introsSeen(store?: Store | null): string[] {
  try {
    const raw = readRaw(INTRO_KEY, store);
    const p = raw ? JSON.parse(raw) : null;
    return p && Array.isArray(p.seen) ? p.seen.filter((s: unknown): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function markIntroSeen(id: string, store?: Store | null): void {
  try {
    const seen = introsSeen(store);
    if (!seen.includes(id)) writeRaw(INTRO_KEY, JSON.stringify({ seen: [...seen, id] }), store);
  } catch {
    /* private mode: play without saving */
  }
}

export interface IntroOptions {
  store?: Store | null;
  typeMs?: number;
  /** Copy per village id. Default: VILLAGE_INTROS. */
  intros?: Record<string, string[]>;
}

/** Show one village's intro now (the Album can use this to replay it). Resolves when it is closed or cancelled. */
export function playIntro(id: string, o: IntroOptions = {}, signal?: AbortSignal): Promise<boolean> {
  const lines = (o.intros ?? VILLAGE_INTROS)[id];
  if (!lines?.length || signal?.aborted) return Promise.resolve(false);
  const name = NEIGHBOURHOODS.find((n) => n.id === id)?.name ?? id;
  return new Promise((resolve) => {
    let handle: LetterHandle | null = null;
    const onAbort = () => {
      handle?.cancel();
      handle = null;
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    handle = showLetter({
      letter: { id: `intro:${id}`, sender: name, recipient: "bea", thread: "intro", envelope: "", body: lines },
      title: `Welcome to ${name}`,
      kicker: "Pip arrives",
      save: { read: [] },
      store: null, // not a thread letter: nothing is written to the letters save
      typeMs: o.typeMs,
      focusBackOnRead: false, // the map moves focus to the village title itself
      onDone: () => {
        signal?.removeEventListener("abort", onAbort);
        handle = null;
        resolve(true);
      },
    });
  });
}

/** The `onEnterVillage` hook: plays the intro on a first entry that has not been welcomed yet. */
export function villageIntro(o: IntroOptions = {}): VillageMapHook {
  return async (id, firstTime, signal) => {
    if (!firstTime || introsSeen(o.store).includes(id)) return;
    if (await playIntro(id, o, signal)) markIntroSeen(id, o.store);
  };
}
