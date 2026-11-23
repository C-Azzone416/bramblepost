/** Who lives where, and how each parcel looks. Display data only; the rules don't read this. */
import type { ParcelKind } from "../engine";
import type { HouseStyle } from "../levels";
import type { NeighbourId } from "../letters/cast";

export interface Neighbour {
  /** Stable id letters use as `recipient`. */
  id: NeighbourId | "sh1" | "sh2" | "sh3" | "ah1" | "ah2" | "ah3" | "wh1" | "wh2" | "wh3" | "wh4";
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
  sh1: { id: "sh1", house: "sh1", who: "sh1", sym: "teaHouse", vb: "0 0 190 200", w: 84, h: 88 },
  sh2: { id: "sh2", house: "sh2", who: "sh2", sym: "burrowHouse", vb: "0 0 170 170", w: 84, h: 84 },
  sh3: { id: "sh3", house: "sh3", who: "sh3", sym: "mushHouse", vb: "0 0 160 190", w: 76, h: 90 },
  ah1: { id: "ah1", house: "ah1", who: "ah1", sym: "acornHouse", vb: "0 0 160 200", w: 70, h: 88 },
  ah2: { id: "ah2", house: "ah2", who: "ah2", sym: "burrowHouse", vb: "0 0 170 170", w: 84, h: 84 },
  ah3: { id: "ah3", house: "ah3", who: "ah3", sym: "teaHouse", vb: "0 0 190 200", w: 84, h: 88 },
  wh1: { id: "wh1", house: "wh1", who: "wh1", sym: "acornHouse", vb: "0 0 160 200", w: 70, h: 88 },
  wh2: { id: "wh2", house: "wh2", who: "wh2", sym: "burrowHouse", vb: "0 0 170 170", w: 84, h: 84 },
  wh3: { id: "wh3", house: "wh3", who: "wh3", sym: "teaHouse", vb: "0 0 190 200", w: 84, h: 88 },
  wh4: { id: "wh4", house: "wh4", who: "wh4", sym: "mushHouse", vb: "0 0 160 190", w: 76, h: 90 },
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
