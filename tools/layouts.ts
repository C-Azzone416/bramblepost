/** Layouts for the generator: rooted tiles fixed, "?" cells filled at random. */
import type { Parcel, Puzzle } from "../src/engine";
import type { Mix } from "./lib/generate";

export interface Layout {
  wind?: Puzzle["wind"];
  layout: string[];
  parcels: Parcel[];
  mix: Mix;
  /** Only accept boards whose best line uses at least one slide. */
  needSlide?: boolean;
  cap?: number;
}

export const LAYOUTS: Record<string, Layout> = {
  // Small active area keeps later-season depth regressions practical to replay.
  // Mix ice crossings, a turning bridge, a sunflower and periodic gusts.
  headroom: {
    layout: ["T T T T T T", "P ? # ? A T", "~ ? =NS ? ~ T", "B ? # @N C T", "T T T T T T"],
    parcels: [
      { to: "A", kind: "pie", limit: 6 },
      { to: "B", kind: "signed", key: "A" },
      { to: "C", kind: "cat" },
    ],
    wind: { line: "row", index: 1, d: 1, every: 3 },
    mix: { bed: 0.08, tee: 0.08, str: 0.42 },
    needSlide: true,
  },
  primrose: {
    layout: ["? ? ? ? ?", "? P ? ? ?", "? ? T ? ?", "? ? ? A ?", "B ? ? ? ?"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "letter" }],
    mix: { bed: 0.12, tee: 0.04, str: 0.42 },
    needSlide: true,
  },
  millpond: {
    layout: ["? ? ? A ?", "? ? ~ ? ?", "P ? ~ ? ?", "? ? ? ? C", "? B ? ? ?"],
    parcels: [{ to: "C", kind: "letter" }, { to: "B", kind: "seeds" }, { to: "A", kind: "pie", limit: 4 }],
    mix: { bed: 0.12, tee: 0.03, str: 0.4 },
    needSlide: true,
  },
  footbridge: {
    layout: ["B ? ~ ? ?", "? ? ~ ? A", "P ? =EW ? ?", "? T ~ ? ?", "? ? ~ C ?"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "seeds" }, { to: "C", kind: "cat" }],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
  },
  wrap: {
    layout: ["? ? ? ? A", "? ? T ? ?", "P ? ? ? ?", "? ? ? T ?", "B ? ? C ?"],
    parcels: [{ to: "A", kind: "letter" }, { to: "B", kind: "seeds" }, { to: "C", kind: "pie", limit: 5 }],
    mix: { bed: 0.14, tee: 0.03, str: 0.42 },
    needSlide: true,
  },
  twopies: {
    layout: ["? ? ~ ? A", "P ? ~ ? ?", "? ? ~ ? ?", "? ? ? ? B", "C ? ~ ? ?"],
    parcels: [{ to: "A", kind: "pie", limit: 5 }, { to: "B", kind: "pie", limit: 6 }, { to: "C", kind: "seeds" }],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
  },
  gate: {
    layout: ["B ? ? ~ ? ?", "? ? ? ~ ? D", "? P ? =EW ? ?", "? ? T ~ ? ?", "? A ? ~ ? C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "seeds" },
      { to: "D", kind: "cat" },
    ],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
    cap: 6e6,
  },
  gate3: {
    layout: ["? ? ? ~ ? ?", "? ? ? ~ ? D", "? P ? =EW ? ?", "? ? T ~ ? ?", "A ? ? ~ ? C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "D", kind: "cat" },
    ],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
    cap: 6e6,
  },
  pies: {
    layout: ["? ? ? ~ ? A", "? P ? ~ ? ?", "? ? ? =EW ? ?", "B ? T ~ ? ?", "? ? ? ~ ? C"],
    parcels: [{ to: "A", kind: "pie", limit: 6 }, { to: "B", kind: "seeds" }, { to: "C", kind: "pie", limit: 7 }],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
  },
  grand: {
    layout: ["B ? ? ~ ? ?", "? ? ? ~ ? D", "? P ? =EW ? ?", "? ? T ~ ? E", "A ? ? ~ ? C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "pie", limit: 6 },
      { to: "D", kind: "cat" },
    ],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
    cap: 6e6,
  },
  sunday: {
    layout: ["B ? ? ~ ? ?", "? ? ? ~ ? D", "? P ? =EW ? ?", "? ? T ~ ? ?", "A ? ? ~ ? C"],
    parcels: [
      { to: "A", kind: "letter" },
      { to: "C", kind: "signed", key: "A" },
      { to: "B", kind: "pie", limit: 5 },
      { to: "D", kind: "cat" },
    ],
    mix: { bed: 0.12, tee: 0.03, str: 0.42 },
    needSlide: true,
    cap: 6e6,
  },
};
