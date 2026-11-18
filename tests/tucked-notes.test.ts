/** Tucked notes (4a): a tucked letter may ride any parcel kind; untucked ones only letter or signed parcels. Counts and ids only. */
import { describe, expect, it } from "vitest";
import standInJson from "../src/content/stand-in-pack.json";
import type { ContentPack } from "../src/content/types";
import { ROUTES } from "../src/levels";
import { letterForParcel } from "../src/letters";
import { NEIGHBOURS } from "../src/ui/cast";

const pack = standInJson as unknown as ContentPack;
const letters = pack.letters;
const tucked = letters.filter((l) => l.placement?.tucked);
const untucked = letters.filter((l) => !l.placement?.tucked);
const parcelOf = (l: (typeof letters)[number]) => ROUTES.find((r) => r.id === l.placement!.route)?.parcels[l.placement!.slot];

describe("stand-in pack: tucked notes", () => {
  it("every tucked placement is a parcel on its route, addressed to that parcel's neighbour", () => {
    const bad = tucked.filter((l) => {
      const route = ROUTES.find((r) => r.id === l.placement!.route);
      const p = parcelOf(l);
      return !route || !p || NEIGHBOURS[route.houses[p.to]].id !== l.recipient;
    });
    expect(bad.map((l) => l.id)).toEqual([]);
  });

  it("the lookup finds a note on each tucked parcel", () => {
    // With no door replies a swap slot carries its default, so that is the id expected for a swap version.
    const expected = (id: string) => pack.slots.find((s) => [s.letter, ...Object.values(s.by ?? {}), ...(s.cases ?? []).map((c) => c.letter)].includes(id))?.letter ?? id;
    const wrong = tucked.filter((l) => letterForParcel(l.placement!.route, l.placement!.slot, {}, letters, pack.slots)?.id !== expected(l.id));
    expect(wrong.map((l) => l.id)).toEqual([]);
  });

  it("untucked letters ride letter or signed parcels only", () => {
    const bad = untucked.filter((l) => !["letter", "signed"].includes(parcelOf(l)?.kind ?? ""));
    expect(bad.map((l) => l.id)).toEqual([]);
  });
});
