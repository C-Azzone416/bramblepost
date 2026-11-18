/** The satchel panel: parcel list and order controls, tea cups, move count, banner and button states. */
import { loadDoorSave } from "../door/save";
import { isAvailable, loadLetters, letterForParcel } from "../letters";
import "../letters/letters.css";
import { LOW_TEA_WARNING, canRotate, orderProblem, teapot, type Parcel } from "../engine";
import { NEIGHBOURS, PARCELS, type Neighbour } from "./cast";
import type { GameState } from "./game";
import { $, icon } from "./svg";

export interface SatchelHost {
  /** The current game. Only called where a route is open. */
  g(): GameState;
  /** Redraw the board (and, through it, this panel). */
  render(): void;
}

export const houseOf = (s: GameState, letter: string): Neighbour => NEIGHBOURS[s.L.houses[letter]];

/** A signed letter's gate opens once the key holder has had their post. */
export function gateOpen(s: GameState, p: Parcel): boolean {
  if (p.kind !== "signed") return true;
  return Object.keys(s.got).some((pk) => s.L.parcels[+pk].to === p.key);
}

export function createSatchel(host: SatchelHost) {
  const g = () => host.g();

  // Keep the cat from moving earlier, including when another parcel swaps past it.
  // Moving a misplaced cat later is still allowed so an old invalid order can be repaired.
  function canSwap(pos: number, dir: -1 | 1): boolean {
    const s = g();
    const j = pos + dir;
    if (s.phase !== "sort" || pos < 0 || pos >= s.order.length || j < 0 || j >= s.order.length) return false;
    const earlier = dir < 0 ? s.order[pos] : s.order[j];
    return s.L.parcels[earlier].kind !== "cat";
  }

  function renderSide() {
    const s = g();
    const L = s.L;
    const cupsTotal = teapot(L.par);
    const used = s.moves;
    // tea
    let cups = "";
    for (let i = 0; i < cupsTotal; i++) {
      cups += `<svg viewBox="0 0 36 30" aria-hidden="true" style="color:${i < cupsTotal - used ? "#c4452e" : "#d9caa6"}"><use href="#icoCup"/></svg>`;
    }
    $("cups").innerHTML = cups;
    $("cups").setAttribute("aria-label", `${Math.max(0, cupsTotal - used)} of ${cupsTotal} cups left`);
    // the wind's counter: one leaf per move until the next gust, losing one each move (a fresh set right after a gust)
    const wind = L.wind;
    $("gust").hidden = !wind;
    if (wind) {
      const left = wind.every - (used % wind.every);
      let leaves = "";
      for (let i = 0; i < wind.every; i++) leaves += `<svg viewBox="-12 -13 24 26" aria-hidden="true"><use href="#${i < left ? "icoLeaf" : "icoLeafOff"}"/></svg>`;
      $("gustLeaves").innerHTML = leaves;
      $("gustLeaves").setAttribute("role", "img");
      $("gustLeaves").setAttribute("aria-label", left === 1 ? "The next move brings a gust" : `${left} moves until the next gust`);
    }
    $("moveCount").innerHTML = used + (used === 1 ? " move" : " moves") + ` <span>· par ${L.par}</span>`;
    // satchel
    const sorting = s.phase === "sort";
    $("satchelState").textContent = sorting ? "Set the order" : s.phase === "done" ? "All delivered" : s.phase === "dry" ? "Out of tea" : "Order locked";
    const list = $("plist");
    list.innerHTML = "";
    const letterState = { read: loadLetters().read, flags: loadDoorSave().flags };
    s.order.forEach((pk, pos) => {
      const p = L.parcels[pk];
      const k = PARCELS[p.kind];
      const nb = houseOf(s, p.to);
      const li = document.createElement("li");
      const delivered = s.got[pk] != null;
      li.className = "pc" + (delivered ? " got" : "") + (!sorting && !delivered && pos === s.next ? " next" : "");
      let rule = "";
      if (p.kind === "pie" && p.limit != null) {
        if (delivered) rule = s.got[pk] <= p.limit ? '<em class="ok">Arrived warm</em>' : "<em>Arrived cold</em>";
        else if (s.moves === 0) rule = `<em>Cools after move ${p.limit}</em>`;
        else {
          const warm = p.limit - s.moves;
          rule = s.moves >= p.limit ? "<em>Gone cold</em>" : `<em>Warm for ${warm} more ${warm === 1 ? "move" : "moves"}</em>`;
        }
      } else if (p.kind === "cat") rule = delivered ? '<em class="ok">Home at last</em>' : "<em>Always rides last</em>";
      else if (p.kind === "signed")
        rule = delivered
          ? '<em class="ok">Signed for</em>'
          : gateOpen(s, p)
            ? '<em class="ok">Gate open</em>'
            : `<em>Gate latched. Key with ${houseOf(s, p.key!).who}</em>`;
      else if (delivered) rule = '<em class="ok">Delivered</em>';
      let right = "";
      if (sorting)
        right =
          `<span class="nudge"><button type="button" aria-label="Move ${k.label} earlier" data-up="${pos}"${!canSwap(pos, -1) ? " disabled" : ""}>${icon("icoUp", "0 0 16 16")}</button>` +
          `<button type="button" aria-label="Move ${k.label} later" data-down="${pos}"${!canSwap(pos, 1) ? " disabled" : ""}>${icon("icoDown", "0 0 16 16")}</button></span>`;
      else if (delivered) right = icon("icoCheck", "0 0 28 28", "st");
      li.innerHTML =
        `<span class="ord">${pos + 1}</span><span class="ic">${icon(k.ico, k.vb)}</span>` +
        `<span class="tx"><b>${k.label}</b><span>to ${nb.who} · ${nb.house}</span>${rule}</span>${right}`;
      const letter = letterForParcel(L.id, pk, letterState.flags, undefined, undefined, letterState.read);
      if (letter && !letterState.read.includes(letter.id) && isAvailable(letter, letterState)) {
        const env = document.createElement("span");
        env.className = letter.placement?.tucked ? "env tucked" : "env";
        const stamp = document.createElement("span");
        stamp.className = "env-stamp";
        stamp.setAttribute("aria-hidden", "true");
        const txt = document.createElement("span");
        const from = document.createElement("b");
        from.textContent = letter.placement?.tucked ? `Note attached, from ${letter.sender}. ` : `Letter from ${letter.sender}. `;
        txt.append(from, letter.envelope);
        env.append(stamp, txt);
        li.querySelector(".tx")!.appendChild(env);
      }
      list.appendChild(li);
    });
    list.querySelectorAll<HTMLButtonElement>("[data-up]").forEach((b) => b.addEventListener("click", () => swap(+b.getAttribute("data-up")!, -1)));
    list.querySelectorAll<HTMLButtonElement>("[data-down]").forEach((b) => b.addEventListener("click", () => swap(+b.getAttribute("data-down")!, 1)));
    const why = orderProblem(L, s.order);
    $("rulemsg").textContent = sorting && why ? why : "";
    $("lockline").innerHTML = sorting
      ? "The order locks with your first move. Restart is free and lets you re-sort."
      : s.phase === "done"
        ? ""
        : icon("icoLock", "0 0 24 24").replace("<svg", '<svg style="width:16px;height:16px"') + " Locked for this round. Restart to re-sort.";
    // controls
    $<HTMLButtonElement>("undoBtn").disabled = !s.hist.length || s.busy;
    $<HTMLButtonElement>("restartBtn").disabled = s.busy;
    $<HTMLButtonElement>("ccwBtn").disabled = s.busy || s.sel < 0 || s.phase === "done" || s.phase === "dry" || !canRotate(s.P, s.v, s.sel);
    // banner
    const b = $("banner");
    let txt: string;
    b.className = "banner";
    if (s.phase === "done" || s.next >= s.order.length) txt = "Round finished. Replay any route to chase a better rating.";
    else if (s.phase === "dry") {
      b.className = "banner warn";
      txt = "The teapot is empty. Restart the route, or undo a move to try another way.";
    } else if (sorting && why) {
      b.className = "banner warn";
      txt = why;
    } else if (sorting) txt = "Sort the satchel, then make your first move. " + L.teach;
    else {
      const p = L.parcels[s.order[s.next]];
      txt = `Next stop: ${PARCELS[p.kind].label.toLowerCase()} for ${houseOf(s, p.to).who}. Pip sets off as soon as the lane connects.`;
      if (p.kind === "signed" && !gateOpen(s, p)) {
        b.className = "banner warn";
        txt = `The gate is latched until ${houseOf(s, p.key!).who} gets their post.`;
      }
      const left = cupsTotal - s.moves;
      if (left <= LOW_TEA_WARNING) {
        b.className = "banner warn";
        txt += left === 1 ? " Last cup in the pot!" : " Only 2 cups left in the pot.";
      }
    }
    $("bannerText").textContent = txt;
  }

  function swap(pos: number, dir: -1 | 1) {
    const s = g();
    if (!canSwap(pos, dir)) return;
    const j = pos + dir;
    const o = s.order.slice();
    [o[pos], o[j]] = [o[j], o[pos]];
    s.order = o;
    host.render();
    const btn =
      document.querySelector<HTMLButtonElement>(`[data-${dir < 0 ? "up" : "down"}="${j}"]:not([disabled])`) ??
      document.querySelector<HTMLButtonElement>(`[data-${dir < 0 ? "down" : "up"}="${j}"]:not([disabled])`);
    if (btn && !btn.disabled) {
      try {
        btn.focus();
      } catch {
        /* ignore */
      }
    }
  }

  return { renderSide };
}
