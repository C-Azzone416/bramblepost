/**
 * The door scene on screen: after a whole route, Pip stays for tea with one neighbour,
 * hears a few lines, picks one of two kind replies, and collects the route's stamp.
 * Nothing here can fail a route. Continue hands control back to the game.
 */
import { reducedMotion } from "../ui/motion";
import { NEIGHBOURS } from "../ui/cast";
import type { AfterRoute, RouteResult } from "../ui/game";
import { icon, starRow } from "../ui/svg";
import "./door.css";
import portraits from "./portraits.svg?raw";
import { ACTIVE_SCENES } from "../content/active";
import { loadSave } from "../ui/save";
import { villageProgress } from "../village/progress";
import { loadDoorSave, setFlag, type DoorSave, type Store } from "./save";
import { stampSvg } from "./stamp";
import { resolveLines, sceneFor, type Choice, type DoorScene } from "./story";
import { blip, wakeAudio } from "./voice";

export interface DoorOptions {
  scene: DoorScene;
  result: RouteResult;
  /** Called once, when the player presses Continue. */
  onContinue: () => void;
  save?: DoorSave;
  store?: Store | null;
  /** Milliseconds per letter while a line types out. 0 shows lines whole. */
  typeMs?: number;
}

export interface DoorHandle {
  readonly el: HTMLElement;
  /** Finish the current line, or move on: the same as tapping the dialogue box. */
  next(): void;
  skip(): void;
  choose(id: string): void;
  close(): void;
}

function ensurePortraits() {
  if (document.getElementById("clem")) return;
  const holder = document.createElement("div");
  holder.innerHTML = portraits;
  const svg = holder.firstElementChild;
  if (svg) document.body.appendChild(svg);
}

/** Each neighbour's portrait symbol in portraits.svg. All share one 420x520 frame. */
export const PORTRAIT_SYMBOLS: Partial<Record<DoorScene["host"], string>> = { tea: "clem", acorn: "barnaby", mush: "bea", burrow: "moles" };

function hostArt(scene: DoorScene): string {
  return `<svg class="door-host portrait" data-host="${scene.host}" viewBox="0 0 420 520" aria-hidden="true"><use href="#${PORTRAIT_SYMBOLS[scene.host]}"/></svg>`;
}

export function showDoorScene(o: DoorOptions): DoorHandle {
  const { scene, result } = o;
  const store = o.store; // undefined: this browser's localStorage
  const save = o.save ?? loadDoorSave(store);
  const typeMs = o.typeMs ?? (reducedMotion() ? 0 : 28);
  const lines = resolveLines(scene, { coldPie: result.coldPie, flags: { ...save.flags } });
  const before = save.flags[scene.flag];
  // Stamps are the village map's: a route is stamped once it has a saved finish, which the game
  // records before this scene opens. Count them the same way the map's HUD does.
  const fresh = result.firstFinish;
  const village = villageProgress(loadSave().best);
  const host = NEIGHBOURS[scene.host];

  ensurePortraits();
  const prevFocus = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "door";
  root.id = "doorScene";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "doorSpeaker");
  root.setAttribute("aria-describedby", "doorLine");
  const L = result.route;
  const moveText = `${result.moves} ${result.moves === 1 ? "move" : "moves"} · par ${L.par}`;
  root.innerHTML =
    '<div class="door-room">' +
    '<div class="door-window" aria-hidden="true"></div><div class="door-shelf" aria-hidden="true"></div>' +
    '<div class="door-reward">' +
    `<div class="door-score"><small>Spring · Route ${result.index + 1} · ${host.house}</small><strong></strong>` +
    `<div class="srow door-stars" aria-label="${result.stars} of 3 stars">${starRow(result.stars)}</div><span>${moveText}</span></div>` +
    `<div class="door-stamp">${stampSvg(scene.stamp)}<div><small>${fresh ? "Stamp collected" : "Stamp in your album"}</small>` +
    `<strong class="door-stampname"></strong><span>Spring, ${scene.stamp.value}¢ · ${village.stamps} of ${village.lanes}</span></div></div>` +
    "</div>" +
    '<div class="door-cast" aria-hidden="true">' +
    '<svg class="door-pip" viewBox="0 0 360 340"><use href="#pip"/></svg>' +
    hostArt(scene) +
    `<span class="door-cups">${icon("icoCup", "0 0 36 30")}${icon("icoCup", "0 0 36 30")}</span>` +
    "</div>" +
    '<div class="door-table" aria-hidden="true"></div>' +
    "</div>" +
    '<div class="door-box">' +
    '<h3 class="door-name" id="doorSpeaker"></h3>' +
    '<p class="door-line" id="doorLine" aria-live="polite"></p>' +
    '<div class="door-choices" role="group" aria-label="Your reply" hidden></div>' +
    '<div class="door-foot">' +
    '<span class="door-step" aria-hidden="true"></span>' +
    '<button class="btn ghost" type="button" data-door="skip">Skip</button>' +
    '<button class="btn red" type="button" data-door="next">Next</button>' +
    "</div></div>";

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  q(".door-score strong").textContent = L.name;
  q(".door-stampname").textContent = scene.stamp.name;
  q(".door-name").textContent = scene.speaker;
  const lineEl = q("#doorLine");
  const choicesEl = q(".door-choices");
  const nextBtn = q<HTMLButtonElement>('[data-door="next"]');
  const skipBtn = q<HTMLButtonElement>('[data-door="skip"]');
  const stepEl = q(".door-step");

  type Phase = "lines" | "choose" | "reply" | "end";
  let phase: Phase = "lines";
  let i = 0;
  let typing: ReturnType<typeof setInterval> | null = null;
  let full = "";
  let closed = false;

  function stopTyping() {
    if (typing) clearInterval(typing);
    typing = null;
    lineEl.textContent = full;
    lineEl.classList.remove("typing");
  }

  function say(text: string) {
    stopTyping();
    full = text;
    if (typeMs <= 0) {
      lineEl.textContent = text;
      return;
    }
    let n = 0;
    lineEl.textContent = "";
    lineEl.classList.add("typing");
    typing = setInterval(() => {
      n++;
      const ch = text.charAt(n - 1);
      if (save.voices && n % 2 === 1 && /\p{L}/u.test(ch)) blip(scene.voice, ch);
      lineEl.textContent = text.slice(0, n);
      if (n >= text.length) stopTyping();
    }, typeMs);
  }

  function paint() {
    choicesEl.hidden = phase !== "choose";
    nextBtn.hidden = phase === "choose";
    skipBtn.hidden = phase === "choose" || phase === "end";
    nextBtn.textContent = phase === "end" ? "Continue" : "Next";
    stepEl.textContent = phase === "lines" ? `${i + 1} / ${lines.length}` : "";
    root.dataset.phase = phase;
  }

  function focus(el: HTMLElement | null) {
    if (!el) return;
    setTimeout(() => {
      try {
        el.focus();
      } catch {
        /* ignore */
      }
    }, 30);
  }

  function toChoices() {
    stopTyping();
    phase = "choose";
    choicesEl.innerHTML = "";
    scene.choices.forEach((c: Choice) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "door-choice";
      b.dataset.choice = c.id;
      b.textContent = c.label;
      if (before === c.id) {
        const tag = document.createElement("small");
        tag.textContent = "Last time";
        b.appendChild(tag);
      }
      b.addEventListener("click", () => choose(c.id));
      choicesEl.appendChild(b);
    });
    paint();
    focus(choicesEl.querySelector("button"));
  }

  function choose(id: string) {
    if (phase !== "choose") return;
    const c = scene.choices.find((x) => x.id === id);
    if (!c) return;
    wakeAudio();
    setFlag(save, scene.flag, c.id, store);
    root.dataset.chose = c.id;
    phase = "reply";
    paint();
    say(c.reply);
    focus(nextBtn);
  }

  function toEnd() {
    stopTyping();
    phase = "end";
    paint();
    focus(nextBtn);
  }

  function next() {
    wakeAudio();
    if (typing) {
      stopTyping();
      return;
    }
    if (phase === "lines") {
      if (i < lines.length - 1) {
        i++;
        paint();
        say(lines[i]);
      } else toChoices();
    } else if (phase === "reply") toEnd();
    else if (phase === "end") close(true);
  }

  function skip() {
    wakeAudio();
    if (phase === "lines") toChoices();
    else if (phase === "reply") toEnd();
  }

  function close(go = false) {
    if (closed) return;
    closed = true;
    stopTyping();
    root.remove();
    document.removeEventListener("keydown", trap, true);
    document.removeEventListener("focusin", keepFocus, true);
    document.removeEventListener("click", blockOutside, true);
    // Give the page back exactly as it was: only remove inert where this scene added it.
    for (const el of madeInert) el.removeAttribute("inert");
    madeInert.length = 0;
    document.body.classList.remove("door-open");
    if (go) o.onContinue();
    else if (prevFocus) focus(prevFocus);
  }

  nextBtn.addEventListener("click", next);
  skipBtn.addEventListener("click", skip);
  // Tapping the speech itself moves things on, like most dialogue boxes.
  lineEl.addEventListener("click", () => {
    if (phase !== "choose") next();
  });
  /** The scene's buttons that can be pressed right now, in page order. */
  function controls(): HTMLButtonElement[] {
    return [...root.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.disabled && !b.closest("[hidden]"));
  }

  /** Tab and Shift+Tab go round the scene's own buttons and never leave it. */
  function cycle(e: KeyboardEvent) {
    const list = controls();
    e.preventDefault();
    if (!list.length) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = at < 0 ? (e.shiftKey ? list.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + list.length) % list.length;
    list[to].focus();
  }

  // Keep the board's keyboard shortcuts (undo, arrows) from firing behind the scene.
  root.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      skip();
    } else if (e.key === "Tab") cycle(e);
  });

  // Keys pressed while focus sits outside the scene (say, on the page body) are kept from the board too.
  const trap = (e: KeyboardEvent) => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    e.stopPropagation();
    if (e.key === "Escape") skip();
    else if (e.key === "Tab") cycle(e);
    // Enter or Space would press whatever has focus behind the scene.
    else if (e.key === "Enter" || e.key === " ") e.preventDefault();
  };
  document.addEventListener("keydown", trap, true);

  // If focus lands behind the scene anyway (an older browser without inert), bring it back.
  const keepFocus = (e: FocusEvent) => {
    if (e.target instanceof Node && !root.contains(e.target)) (controls()[0] ?? root).focus();
  };
  document.addEventListener("focusin", keepFocus, true);

  // Clicks behind the scene do nothing until it closes.
  const blockOutside = (e: MouseEvent) => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener("click", blockOutside, true);

  // Everything else on the page is inert while the scene is open: no focus, no clicks, hidden from
  // screen readers. Elements that were already inert stay that way when the scene closes.
  const madeInert: Element[] = [];
  for (const el of [...document.body.children]) {
    if (el.hasAttribute("inert")) continue;
    el.setAttribute("inert", "");
    madeInert.push(el);
  }

  root.tabIndex = -1;
  paint();
  document.body.appendChild(root);
  document.body.classList.add("door-open");
  say(lines[0]);
  focus(nextBtn);

  return {
    el: root,
    next,
    skip,
    choose,
    close: () => close(false),
  };
}

/**
 * The game's after-route hook: plays the route's door scene, then continues to the finish card.
 * Routes without a scene go straight on.
 */
export function doorAfterRoute(scenes: DoorScene[] = ACTIVE_SCENES, extra: Partial<DoorOptions> = {}): AfterRoute {
  return (result, onContinue) => {
    const scene = sceneFor(scenes, result.route.id);
    if (!scene) {
      onContinue();
      return;
    }
    const handle = showDoorScene({ ...extra, scene, result, onContinue });
    return () => handle.close();
  };
}
