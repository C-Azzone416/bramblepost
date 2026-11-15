// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A tiny fake Web Audio: just enough graph to see what sound.ts schedules, mutes and cleans up. */
class FakeParam {
  value = 0;
  calls: string[] = [];
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push(`set:${v}@${t}`);
  }
  exponentialRampToValueAtTime() {}
  cancelScheduledValues(t: number) {
    this.calls.push(`cancel@${t}`);
  }
}
class FakeNode {
  disconnected = false;
  connect(n: FakeNode) {
    return n;
  }
  disconnect() {
    this.disconnected = true;
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeCtx {
  static last: FakeCtx;
  state = "running";
  currentTime = 5;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscs: FakeOsc[] = [];
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  constructor() {
    FakeCtx.last = this;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
}

type Sound = typeof import("../src/ui/sound");
async function load(): Promise<Sound> {
  vi.resetModules();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  return import("../src/ui/sound");
}
const gesture = () => document.dispatchEvent(new Event("pointerdown"));

describe("sound with a fake AudioContext", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => delete (window as unknown as { AudioContext?: unknown }).AudioContext);

  it("plays through one master gain, and muting zeroes it immediately", async () => {
    const s = await load();
    s.armSound();
    gesture();
    const c = FakeCtx.last;
    s.ding();
    expect(c.oscs.length).toBe(2);
    const master = c.gains[0];
    expect(master.gain.value).toBe(1);
    s.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(master.gain.calls.slice(-2)).toEqual(["cancel@5", "set:0@5"]);
    // later sounds are not even scheduled while muted
    s.kettle();
    expect(c.oscs.length).toBe(2);
    s.setMuted(false);
    expect(master.gain.value).toBe(1);
    s.pluck(1);
    expect(c.oscs.length).toBe(3);
  });

  it("starts silent when the saved mute is on", async () => {
    localStorage.setItem("bramblepost-sound-v1", JSON.stringify({ muted: true }));
    const s = await load();
    s.armSound();
    gesture();
    expect(s.isMuted()).toBe(true);
    expect(FakeCtx.last.gains[0].gain.value).toBe(0);
  });

  it("a suspended context resumes on the next gesture, and the listeners stay", async () => {
    const s = await load();
    s.armSound();
    gesture();
    const c = FakeCtx.last;
    c.state = "suspended";
    s.ding();
    expect(c.oscs.length).toBe(0); // not running: nothing scheduled, but a resume was tried
    expect(c.resume).toHaveBeenCalledTimes(1);
    c.state = "suspended";
    c.resume.mockClear();
    document.dispatchEvent(new Event("keydown"));
    expect(c.resume).toHaveBeenCalledTimes(1);
    expect(c.state).toBe("running");
    s.ding();
    expect(c.oscs.length).toBe(2);
    // and again after a second interruption
    c.state = "suspended";
    c.resume.mockClear();
    gesture();
    expect(c.resume).toHaveBeenCalledTimes(1);
  });

  it("disconnects a voice's nodes when it ends", async () => {
    const s = await load();
    s.armSound();
    gesture();
    const c = FakeCtx.last;
    s.kettle();
    const [o, lfo] = c.oscs;
    const voiceGains = c.gains.slice(1);
    expect(voiceGains.length).toBe(2);
    expect(o.onended).toBeTypeOf("function");
    o.onended!();
    expect(o.disconnected).toBe(true);
    expect(lfo.disconnected).toBe(true);
    expect(voiceGains.every((g) => g.disconnected)).toBe(true);
    expect(c.gains[0].disconnected).toBe(false); // the master stays
    s.ding();
    const n = c.oscs[2];
    n.onended!();
    expect(n.disconnected).toBe(true);
  });
});
