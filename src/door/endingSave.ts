/**
 * Whether the closing scene has been seen, under `bramblepost-ending-v1` through the save module.
 * Shape: { seen: boolean, routes?: string[] }; seen preserves spring saves. Never throws; blocked storage plays unsaved. Reset clears it with the rest.
 */
import { ENDING_KEY } from "../save/keys";
import { readRaw, writeRaw } from "../save/core";

export type Store = Pick<Storage, "getItem" | "setItem">;

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function endingSeen(store?: Store | null, route?: string): boolean {
  try {
    const raw = readRaw(ENDING_KEY, store);
    if (!raw) return false;
    const p: unknown = JSON.parse(raw);
    if (!plainObject(p)) return false;
    return route ? Array.isArray(p.routes) && p.routes.includes(route) : p.seen === true;
  } catch {
    return false;
  }
}

export function markEndingSeen(store?: Store | null, route?: string): void {
  try {
    const raw = readRaw(ENDING_KEY, store);
    let parsed: unknown = {};
    if (raw) { try { parsed = JSON.parse(raw); } catch { /* replace corrupt value */ } }
    const previous = plainObject(parsed) ? parsed : {};
    const routes = Array.isArray(previous.routes) && previous.routes.every((r) => typeof r === "string") ? previous.routes : [];
    writeRaw(ENDING_KEY, JSON.stringify(route ? { ...previous, routes: [...new Set([...routes, route])] } : { ...previous, seen: true }), store);
  } catch {
    /* private mode: play without saving */
  }
}
