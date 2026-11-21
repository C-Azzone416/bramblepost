import { expect, it } from "vitest";
import { SolverStates } from "../src/engine/solver-states";
import { solveOrder } from "../src/engine/solver";
import type { Board } from "../src/engine/types";

it("rejects values that do not fit packed solver keys at setup", () => {
  const board = { kind: ["m"], init: [64], level: { parcels: [] } } as unknown as Board;
  expect(() => solveOrder(board, [], 1)).toThrow(/tile value.*6 bits/);
  board.init[0] = 0;
  expect(() => solveOrder(board, new Array(65536).fill(0), 1)).toThrow(/parcel progress.*16 bits/);
  board.level.parcels = new Array(65536);
  expect(() => solveOrder(board, [], 1)).toThrow(/parcel progress.*16 bits/);
  board.level.parcels = [];
  board.level.wind = { line: "row", index: 0, d: 1, every: 65537 };
  expect(() => solveOrder(board, [], 1)).toThrow(/wind phase.*16 bits/);
});

it("checks complete packed keys on hash collisions, growth and block boundaries", () => {
  const states = new SolverStates(2);
  const keys: Uint32Array[] = [];
  for (let i = 0; i < 18_000; i++) {
    // These first 100 distinct keys deliberately have the same FNV hash.
    const key = new Uint32Array([i, i < 100 ? Math.imul(0x811c9dc5 ^ i, 0x01000193) : i * 17]);
    keys.push(key);
    expect(states.add(key, i - 1, i * 6)).toBe(i);
  }
  for (const [i, key] of keys.entries()) {
    expect(states.add(key, 0, 0)).toBe(-1);
    expect([...states.read(i)]).toEqual([key[0], key[1], (i - 1) >>> 0, i * 6]);
  }
  expect(states.size).toBe(keys.length);
});
