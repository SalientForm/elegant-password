import { describe, expect, it } from 'vitest';
import { cryptoRandom, randomFloat, randomInt, weightedIndex } from './random';
import { seeded } from './testRandom';

describe('randomInt', () => {
  it('stays in range and covers every value', () => {
    const rng = seeded();
    const seen = new Array(7).fill(0);
    for (let i = 0; i < 7000; i++) seen[randomInt(7, rng)]++;
    for (const n of seen) expect(n).toBeGreaterThan(850);
  });

  it('rejects invalid bounds', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });

  it('works with the crypto source', () => {
    const n = randomInt(10, cryptoRandom);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(10);
  });
});

describe('randomFloat', () => {
  it('is in [0, 1)', () => {
    const rng = seeded();
    for (let i = 0; i < 1000; i++) {
      const f = randomFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe('weightedIndex', () => {
  it('never picks zero-weight entries and follows the weights', () => {
    const rng = seeded();
    const counts = [0, 0, 0];
    for (let i = 0; i < 9000; i++) counts[weightedIndex([1, 0, 2], rng)]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(1.8);
    expect(counts[2]! / counts[0]!).toBeLessThan(2.2);
  });
});
