/** Who lives where, and how each parcel looks. Display data only; the rules don't read this. */
import type { ParcelKind } from "../engine";
import type { HouseStyle } from "../levels";
import type { NeighbourId } from "../letters/cast";

export interface Neighbour {
  /** Stable id letters use as `recipient`. */
  id: NeighbourId;
  house: string;
  who: string;
  /** Sprite symbol id in sprites.svg, and its drawn size on the board. */
  sym: string;
  vb: string;
  w: number;
  h: number;
}

export const NEIGHBOURS: Record<HouseStyle, Neighbour> = {
  tea: { id: "clementine", house: "Teapot Cottage", who: "Clementine", sym: "teaHouse", vb: "0 0 190 200", w: 84, h: 88 },
  acorn: { id: "barnaby", house: "Acorn House", who: "Old Barnaby", sym: "acornHouse", vb: "0 0 160 200", w: 70, h: 88 },
  burrow: { id: "moles", house: "The Burrow", who: "the Mole Bros.", sym: "burrowHouse", vb: "0 0 170 170", w: 84, h: 84 },
  mush: { id: "bea", house: "Mushroom House", who: "Bea Thimblewick", sym: "mushHouse", vb: "0 0 160 190", w: 76, h: 90 },
};

/** Display name for a letter recipient id. */
export const neighbourName = (id: NeighbourId): string => Object.values(NEIGHBOURS).find((n) => n.id === id)!.who;

export interface ParcelLook {
  label: string;
  ico: string;
  vb: string;
}

export const PARCELS: Record<ParcelKind, ParcelLook> = {
  letter: { label: "Letter", ico: "icoLetter", vb: "0 0 40 30" },
  parcel: { label: "Parcel", ico: "icoSeed", vb: "0 0 34 40" },
  seeds: { label: "Seed packet", ico: "icoSeed", vb: "0 0 34 40" },
  pie: { label: "Warm pie", ico: "icoPie", vb: "0 0 44 30" },
  cat: { label: "The cat", ico: "icoCat", vb: "0 0 40 34" },
  signed: { label: "Signed letter", ico: "icoLetter", vb: "0 0 40 30" },
};
