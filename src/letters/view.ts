/**
 * The letter view: after a route's door scene, each letter delivered on that route is read out here,
 * one line at a time, and then marked read. Focus handling matches the door scene: focus moves in,
 * the page behind is inert, Tab stays inside, Escape or Continue closes and focus goes back.
 */
import { reducedMotion } from "../ui/motion";
import { neighbourName } from "../ui/cast";
import { loadDoorSave } from "../door/save";
import type { AfterRoute } from "../ui/game";
import "./letters.css";
import { unreadForRoute } from "./registry";
import { loadLetters, markRead, type LettersSave, type Store } from "./save";
import type { Letter } from "./types";

export interface LetterOptions {
  letter: Letter;
  /** Heading and small line above it, when the letter isn't one neighbour to another (the ending's letter to Pip). */
  title?: string;
  kicker?: string;
  /** Called once, after the letter is closed and marked read. */
  onDone: () => void;
  save?: LettersSave;
  store?: Store | null;
  /** Milliseconds per letter while a line types out. 0 shows lines whole. */
  typeMs?: number;
  /**
   * Whether closing a letter that was read through sends focus back to what had it before (default true).
   * A caller that moves focus itself afterwards (the village intro) turns this off. A cancel always restores it.
   */
  focusBackOnRead?: boolean;
}

export interface LetterHandle {
  readonly el: HTMLElement;
  /** Finish the current line, or move on: the same as pressing Next. */
  next(): void;
  /** Show the whole letter at once. */
  skip(): void;
  /** Finish reading: marks the letter read and calls onDone. */
  close(): void;
  /** Take the letter away without reading it: no mark, no onDone. For when the player leaves the route. */
  cancel(): void;
}

// One pending focus move at a time, shared by every letter: a late move from a closed dialog can
// never land in the next one.
let focusTimer: ReturnType<typeof setTimeout> | null = null;
function clearFocusTimer() {
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = null;
}

export function showLetter(o: LetterOptions): LetterHandle {
  clearFocusTimer();
  const { letter } = o;
  const store = o.store;
  const save = o.save ?? loadLetters(store);
  const typeMs = o.typeMs ?? (reducedMotion() ? 0 : 28);
  const lines = letter.body.length ? letter.body : [""];

  const prevFocus = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "letter";
  root.id = "letterView";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "letterTitle");
  root.setAttribute("aria-describedby", "letterText");
  root.innerHTML =
    '<div class="letter-paper">' +
    '<small class="letter-kicker">A letter for you to read</small>' +
    '<h3 class="letter-title" id="letterTitle"></h3>' +
    '<p class="letter-env"></p>' +
    '<div class="letter-text" id="letterText" aria-live="polite"></div>' +
    '<div class="letter-foot"><span class="letter-step" aria-hidden="true"></span>' +
    '<button class="btn ghost" type="button" data-letter="skip">Skip</button>' +
    '<button class="btn red" type="button" data-letter="next">Next</button></div></div>';

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  q(".letter-title").textContent = o.title ?? `From ${letter.sender} to ${neighbourName(letter.recipient)}`;
  if (o.kicker) q(".letter-kicker").textContent = o.kicker;
  q(".letter-env").textContent = letter.envelope;
  const textEl = q("#letterText");
  const nextBtn = q<HTMLButtonElement>('[data-letter="next"]');
  const skipBtn = q<HTMLButtonElement>('[data-letter="skip"]');
  const stepEl = q(".letter-step");

  let i = 0;
  let typing: ReturnType<typeof setInterval> | null = null;
  let cur: HTMLElement | null = null;
  let full = "";
  let closed = false;
  const atEnd = () => i >= lines.length - 1 && !typing;

  function stopTyping() {
    if (typing) clearInterval(typing);
    typing = null;
    if (cur) {
      cur.textContent = full;
      cur.classList.remove("typing");
    }
  }

  function say(text: string) {
    stopTyping();
    full = text;
    cur = document.createElement("p");
    textEl.appendChild(cur);
    if (typeMs <= 0) {
      cur.textContent = text;
      return;
    }
    const el = cur;
    let n = 0;
    el.classList.add("typing");
    typing = setInterval(() => {
      n++;
      el.textContent = text.slice(0, n);
      if (n >= text.length) {
        stopTyping();
        // Typing ended by itself: the last line now shows Continue, not Next and Skip.
        paint();
        keepFocusInside();
      }
    }, typeMs);
  }

  function paint() {
    const end = atEnd();
    nextBtn.textContent = end ? "Continue" : "Next";
    skipBtn.hidden = end;
    stepEl.textContent = end ? "" : `${i + 1} / ${lines.length}`;
    root.dataset.phase = end ? "end" : "lines";
  }

  function focus(el: HTMLElement | null) {
    if (!el) return;
    clearFocusTimer();
    focusTimer = setTimeout(() => {
      focusTimer = null;
      try {
        el.focus();
      } catch {
        /* ignore */
      }
    }, 30);
  }

  /** The Next button just turned into Continue, or Skip vanished from under focus: keep focus in the letter. */
  function keepFocusInside() {
    if (!root.contains(document.activeElement) || (document.activeElement as HTMLElement)?.hidden) focus(nextBtn);
  }

  function next() {
    if (typing) {
      stopTyping();
    } else if (i < lines.length - 1) {
      i++;
      say(lines[i]);
    } else {
      close();
      return;
    }
    paint();
    keepFocusInside();
  }

  function skip() {
    stopTyping();
    while (i < lines.length - 1) {
      i++;
      say(lines[i]);
      stopTyping();
    }
    paint();
    focus(nextBtn);
  }

  function close(read = true) {
    if (closed) return;
    closed = true;
    clearFocusTimer();
    stopTyping();
    root.remove();
    document.removeEventListener("keydown", trap, true);
    document.removeEventListener("focusin", keepFocus, true);
    document.removeEventListener("click", blockOutside, true);
    for (const el of madeInert) el.removeAttribute("inert");
    madeInert.length = 0;
    document.body.classList.remove("letter-open");
    if ((!read || o.focusBackOnRead !== false) && prevFocus && prevFocus.isConnected && prevFocus !== document.body) focus(prevFocus);
    if (read) {
      markRead(save, letter.id, store);
      o.onDone();
    }
  }

  /** Escape shows the rest of the letter first, then closes it. */
  function escape() {
    if (atEnd()) close();
    else skip();
  }

  nextBtn.addEventListener("click", next);
  skipBtn.addEventListener("click", skip);
  textEl.addEventListener("click", () => {
    if (typing) stopTyping();
  });

  const controls = () => [...root.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.disabled && !b.closest("[hidden]") && !b.hidden);
  function cycle(e: KeyboardEvent) {
    const list = controls();
    e.preventDefault();
    if (!list.length) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = at < 0 ? (e.shiftKey ? list.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + list.length) % list.length;
    list[to].focus();
  }

  root.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      escape();
    } else if (e.key === "Tab") cycle(e);
  });

  const trap = (e: KeyboardEvent) => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    e.stopPropagation();
    if (e.key === "Escape") escape();
    else if (e.key === "Tab") cycle(e);
    else if (e.key === "Enter" || e.key === " ") e.preventDefault();
  };
  document.addEventListener("keydown", trap, true);

  const keepFocus = (e: FocusEvent) => {
    if (e.target instanceof Node && !root.contains(e.target)) (controls()[0] ?? root).focus();
  };
  document.addEventListener("focusin", keepFocus, true);

  const blockOutside = (e: MouseEvent) => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener("click", blockOutside, true);

  const madeInert: Element[] = [];
  for (const el of [...document.body.children]) {
    if (el.hasAttribute("inert")) continue;
    el.setAttribute("inert", "");
    madeInert.push(el);
  }

  root.tabIndex = -1;
  document.body.appendChild(root);
  document.body.classList.add("letter-open");
  say(lines[0]);
  paint();
  focus(nextBtn);

  return { el: root, next, skip, close: () => close(true), cancel: () => close(false) };
}

/**
 * Wraps an after-route hook (the door scene): once it continues, every unread letter delivered on
 * this route is read in turn, then the route's finish card shows.
 * The returned function cancels whatever is showing (the inner scene or an open letter) and drops
 * the rest of the queue; the game calls it when the player leaves or replays the route.
 */
export function withLetters(inner: AfterRoute, extra: Partial<LetterOptions> = {}): AfterRoute {
  return (result, onContinue) => {
    let cancelled = false;
    let open: LetterHandle | null = null;
    const cancelInner = inner(result, () => {
      if (cancelled) return;
      const save = extra.save ?? loadLetters(extra.store);
      const queue = unreadForRoute(result.route.id, result.route.parcels.length, { read: save.read, flags: loadDoorSave(extra.store).flags });
      const step = () => {
        open = null;
        if (cancelled) return;
        const letter = queue.shift();
        if (!letter) return onContinue();
        open = showLetter({ ...extra, letter, save, onDone: step });
      };
      step();
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
