import { expect, it } from "vitest";
import { SolverStates } from "../src/engine/solver-states";

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
