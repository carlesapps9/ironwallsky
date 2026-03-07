// src/core/rng.ts — Seeded PRNG (Constitution Principle I: deterministic, injectable)

/**
 * Mulberry32 — fast, deterministic 32-bit PRNG.
 * Returns a function that produces the next random number in [0, 1).
 * The seed advances with each call for reproducible sequences.
 */
export interface SeededRng {
  /** Returns the next random number in [0, 1). */
  next(): number;
  /** Returns a random integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns the current seed state for serialization. */
  getSeed(): number;
}

/**
 * Creates a seeded PRNG using the Mulberry32 algorithm.
 * @param seed - Initial seed value (any 32-bit integer).
 */
export function createRng(seed: number): SeededRng {
  let state = seed | 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function getSeed(): number {
    return state;
  }

  return { next, nextInt, getSeed };
}
