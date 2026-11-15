/**
 * Game sounds, synthesised with Web Audio (no audio files): a typewriter ding when a route
 * finishes, a kettle whistle when the pot runs low, a soft pluck on each delivery.
 * Like door/voice.ts, everything is a silent no-op where Web Audio is missing (jsdom) or not yet
 * unlocked. The context is created lazily on the first player gesture.
 */
import { loadMuted, saveMuted } from "./soundPref";

type Win = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = loadMuted();
let armed = false;

function create(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const w = window as unknown as Win;
    const A = w.AudioContext ?? w.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
    master = ctx.createGain();
    master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

function resume(a: AudioContext): void {
  if (a.state === "running") return;
  try {
    a.resume()?.catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * On any player gesture, create the audio context if needed and resume it whenever it is not running.
 * The listeners stay for good: the browser can suspend the context again later (a tab switch, an iOS interruption).
 */
export function armSound(): void {
  if (armed || typeof document === "undefined") return;
  armed = true;
  const wake = () => {
    const a = create();
    if (a) resume(a);
  };
  for (const e of ["pointerdown", "keydown", "click"]) document.addEventListener(e, wake, true);
}

export const isMuted = (): boolean => muted;

function applyMute(m: boolean): void {
  muted = m;
  if (ctx && master) {
    // Cut everything already playing or scheduled, not just future sounds.
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(m ? 0 : 1, now);
  }
}

export function setMuted(m: boolean): void {
  applyMute(m);
  saveMuted(m);
}

/** After a progress reset: back to unmuted without writing the key the reset just cleared. */
export function forgetMuted(): void {
  applyMute(false);
}

/** The running context, or null when muted, unavailable or not yet unlocked by a gesture. */
function live(): AudioContext | null {
  if (muted || !ctx || !master) return null;
  if (ctx.state !== "running") {
    resume(ctx);
    return null;
  }
  return ctx;
}

/** Disconnect a voice's nodes once its last oscillator has finished. */
function cleanup(osc: OscillatorNode, nodes: AudioNode[]): void {
  osc.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  };
}

/** One enveloped oscillator note. */
function note(a: AudioContext, type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number): void {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  cleanup(o, [o, g]);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function play(fn: (a: AudioContext) => void): void {
  const a = live();
  if (!a) return;
  try {
    fn(a);
  } catch {
    /* ignore */
  }
}

/** Typewriter bell: a bright ping with a high overtone and a long ring. */
export function ding(): void {
  play((a) => {
    note(a, "sine", 2093, 2093, 0, 0.9, 0.12);
    note(a, "sine", 3136, 3136, 0, 0.5, 0.05);
  });
}

/** Kettle whistle: a rising, wavering whistle. */
export function kettle(): void {
  play((a) => {
    const t = a.currentTime;
    const o = a.createOscillator();
    const lfo = a.createOscillator();
    const lg = a.createGain();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(2300, t + 0.5);
    lfo.frequency.value = 22;
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
    g.gain.setValueAtTime(0.06, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(g).connect(master!);
    cleanup(o, [o, lfo, lg, g]);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.85);
    lfo.stop(t + 0.85);
  });
}

/** Plucked string: a quick triangle note that decays fast; pitch rises a little per delivery. */
export function pluck(step = 0): void {
  play((a) => {
    const scale = [392, 440, 523.25, 587.33, 659.25];
    note(a, "triangle", scale[Math.abs(step) % scale.length], scale[Math.abs(step) % scale.length] * 0.99, 0, 0.45, 0.1);
  });
}
