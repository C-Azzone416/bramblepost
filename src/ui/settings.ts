/**
 * Settings, opened from the title screen: voices, sound, reduced motion, and a two-step reset.
 * Each switch is a button with aria-pressed and saves as soon as it is pressed. Focus moves in on
 * open; Escape or Back calls onBack (the title takes focus back). Reset asks a second time with an
 * in-page button, then wipes every save key; if it only half worked the player is told.
 */
import "./settings.css";
import { loadDoorSave, setVoices } from "../door/save";
import { resetProgress } from "../save";
import { loadReduceMotion, saveReduceMotion } from "./motion";
import { isMuted, setMuted } from "./sound";

export interface SettingsOptions {
  /** Back or Escape: leave Settings. */
  onBack(): void;
  /** Reset finished and everything was cleared: start fresh. */
  onReset(): void;
}

export interface Settings {
  open(): void;
  /** Hide the view; focus is left to the caller. */
  close(): void;
  readonly visible: boolean;
}

interface Switch {
  id: string;
  label: string;
  hint: string;
  get(): boolean;
  set(on: boolean): void;
}

const SWITCHES: Switch[] = [
  {
    id: "setVoices",
    label: "Voices",
    hint: "Little gibberish voices while neighbours talk.",
    get: () => loadDoorSave().voices,
    set: (on) => setVoices(loadDoorSave(), on),
  },
  {
    id: "setSound",
    label: "Sound",
    hint: "Game sounds, like the kettle and the plucks.",
    get: () => !isMuted(),
    set: (on) => setMuted(!on),
  },
  {
    id: "setMotion",
    label: "Reduced motion",
    hint: "Calm the animations. Also follows your device setting.",
    get: loadReduceMotion,
    set: saveReduceMotion,
  },
];

export function mountSettings(
  container: HTMLElement,
  opts: SettingsOptions,
): Settings {
  container.insertAdjacentHTML(
    "beforeend",
    `<section id="settingsView" class="settings" hidden aria-labelledby="settingsTitle" tabindex="-1">
  <h2 id="settingsTitle">Settings</h2>
  <ul class="slist">${SWITCHES.map(
    (s) =>
      `<li><button class="btn ghost sw" type="button" id="${s.id}" aria-pressed="false" aria-describedby="${s.id}Hint"><span class="swlabel">${s.label}</span><span class="swstate"></span></button><p id="${s.id}Hint">${s.hint}</p></li>`,
  ).join("")}</ul>
  <div class="sreset">
    <h3>Start over</h3>
    <p id="resetHint">Wipes your stars, stamps, replies, letters and settings from this browser.</p>
    <button class="btn ghost" type="button" id="resetAsk" aria-describedby="resetHint">Reset progress</button>
    <div id="resetConfirm" class="sconfirm" role="group" aria-label="Confirm reset" hidden>
      <p>This cannot be undone. Wipe everything?</p>
      <button class="btn red" type="button" id="resetYes">Yes, wipe everything</button>
      <button class="btn ghost" type="button" id="resetNo">Keep my progress</button>
    </div>
    <p id="resetMsg" class="smsg" role="status"></p>
  </div>
  <button class="btn" type="button" id="settingsBack">Back</button>
</section>`,
  );
  const view = container.querySelector<HTMLElement>("#settingsView")!;
  const q = <T extends HTMLElement = HTMLButtonElement>(id: string) =>
    view.querySelector<T>("#" + id)!;
  const ask = q("resetAsk");
  const confirm = q<HTMLElement>("resetConfirm");
  const msg = q<HTMLElement>("resetMsg");

  const paint = () => {
    for (const s of SWITCHES) {
      const b = q(s.id);
      const on = s.get();
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".swstate")!.textContent = on ? "On" : "Off";
    }
  };
  for (const s of SWITCHES)
    q(s.id).addEventListener("click", () => {
      s.set(!s.get());
      paint();
    });

  const closeConfirm = () => {
    confirm.hidden = true;
    ask.hidden = false;
  };
  ask.addEventListener("click", () => {
    msg.textContent = "";
    ask.hidden = true;
    confirm.hidden = false;
    q("resetNo").focus();
  });
  q("resetNo").addEventListener("click", () => {
    closeConfirm();
    ask.focus();
  });
  q("resetYes").addEventListener("click", () => {
    if (resetProgress()) {
      closeConfirm();
      paint();
      opts.onReset();
    } else {
      closeConfirm();
      paint();
      msg.textContent =
        "Some of your progress didn't clear. Try again, or clear this site's data in your browser settings.";
      ask.focus();
    }
  });
  q("settingsBack").addEventListener("click", () => opts.onBack());
  view.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Escape") return;
    e.preventDefault();
    if (!confirm.hidden) {
      closeConfirm();
      ask.focus();
    } else opts.onBack();
  });

  return {
    open() {
      closeConfirm();
      msg.textContent = "";
      paint();
      view.hidden = false;
      q("setVoices").focus();
    },
    close() {
      view.hidden = true;
    },
    get visible() {
      return !view.hidden;
    },
  };
}
