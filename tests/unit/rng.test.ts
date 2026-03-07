// tests/unit/rng.test.ts — T059: Seeded PRNG unit tests
// Deterministic output, seed injection, sequence reproducibility.

import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng.js';

describe('Seeded PRNG (Mulberry32)', () => {
  it('should produce deterministic output for same seed', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('should produce different output for different seeds', () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toBe(val2);
  });

  it('should produce values in [0, 1)', () => {
    const rng = createRng(42);

    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('should produce integers within range (inclusive)', () => {
    const rng = createRng(42);

    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('should return single value when min equals max', () => {
    const rng = createRng(42);

    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(7, 7)).toBe(7);
    }
  });

  it('should reproduce sequence from same seed', () => {
    const rng1 = createRng(99999);
    const sequence1 = Array.from({ length: 50 }, () => rng1.next());

    const rng2 = createRng(99999);
    const sequence2 = Array.from({ length: 50 }, () => rng2.next());

    expect(sequence1).toEqual(sequence2);
  });

  it('should expose current seed state via getSeed', () => {
    const rng = createRng(42);
    const initialSeed = rng.getSeed();

    rng.next();
    const afterOneSeed = rng.getSeed();

    expect(afterOneSeed).not.toBe(initialSeed);
  });

  it('should have reasonable distribution', () => {
    const rng = createRng(42);
    const buckets = new Array(10).fill(0);

    for (let i = 0; i < 10000; i++) {
      const val = rng.next();
      const bucket = Math.min(Math.floor(val * 10), 9);
      buckets[bucket]++;
    }

    // Each bucket should have roughly 1000 ± 200 values
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});
