/**
 * "Voiced by gibberish": a soft blip for every couple of letters, pitched per neighbour.
 * Silent wherever Web Audio is missing or blocked (tests, some browsers before a tap).
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function audio(): Ctx | null {
  if (ctx) return ctx;
  try {
    const A = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a click or key handler: browsers only start audio after the player does something. */
export function wakeAudio(): void {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

/** One short syllable around `pitch` Hz. Vowels sit a little higher than consonants. */
export function blip(pitch: number, ch: string): void {
  const a = audio();
  if (!a || a.state !== "running") return;
  try {
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    const vowel = /[aeiouy]/i.test(ch);
    const wobble = 0.88 + ((ch.charCodeAt(0) * 37) % 25) / 100;
    o.type = "triangle";
    o.frequency.setValueAtTime(pitch * wobble * (vowel ? 1.12 : 1), t);
    o.frequency.exponentialRampToValueAtTime(pitch * wobble * 0.82, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.09);
  } catch {
    /* ignore */
  }
}
