/**
 * The after-route hook for the closing scene. Wraps another hook (door scene, letters): once that
 * continues, an ending that hasn't been seen plays in the letter view, then the finish card shows.
 * Seen is saved only when the player reads it through; leaving or replaying mid-ending cancels it
 * cleanly and it plays again next time.
 */
import { loadLetters, type Store as LettersStore } from "../letters/save";
import { showLetter, type LetterHandle, type LetterOptions } from "../letters/view";
import type { AfterRoute } from "../ui/game";
import { ENDING_SCENES, endingFor, resolveLines, type EndingScene } from "./ending";
import { endingSeen, markEndingSeen, type Store } from "./endingSave";
import { loadDoorSave, type Store as DoorStore } from "./save";

export interface EndingOptions {
  store?: Store | null;
  /** Where the read letters and door-reply flags come from, when the scene branches. Default: the real saves. */
  lettersStore?: LettersStore | null;
  doorStore?: DoorStore | null;
  typeMs?: number;
}

export function withEnding(inner: AfterRoute, scenes: EndingScene[] = ENDING_SCENES, extra: EndingOptions = {}): AfterRoute {
  return (result, onContinue) => {
    let cancelled = false;
    let open: LetterHandle | null = null;
    const cancelInner = inner(result, () => {
      if (cancelled) return;
      const scene = endingFor(scenes, result.route.id);
      if (!scene || endingSeen(extra.store)) return onContinue();
      const opts: LetterOptions = {
        letter: { id: `ending:${scene.route}`, sender: "Thistledown", recipient: "clementine", thread: "ending", envelope: scene.envelope, body: resolveLines(scene.lines, { read: loadLetters(extra.lettersStore).read, flags: loadDoorSave(extra.doorStore).flags }) },
        title: scene.title,
        kicker: scene.kicker,
        // the ending is not a thread letter: keep it out of the read list
        save: { read: [] }, // (store: null below: nothing is written to the letters save)
        store: null,
        typeMs: extra.typeMs,
        onDone: () => {
          open = null;
          if (cancelled) return;
          markEndingSeen(extra.store);
          onContinue();
        },
      };
      open = showLetter(opts);
    });
    return () => {
      if (cancelled) return;
      cancelled = true;
      if (typeof cancelInner === "function") cancelInner();
      open?.cancel();
      open = null;
    };
  };
}
