import { describe, expect, it } from 'vitest';
import { LengthModel, wordsByLength } from './lengthModel';
import { seeded } from './testRandom';

const POOLS = [
  ['a', 'bb', 'ccc'],
  ['dd', 'eee', 'ffff', 'g'],
  ['hh', 'iii'],
];

function bruteForce(lo: number, hi: number): string[][] {
  const out: string[][] = [];
  for (const a of POOLS[0]!)
    for (const b of POOLS[1]!)
      for (const c of POOLS[2]!) {
        const n = a.length + b.length + c.length;
        if (n >= lo && n <= hi) out.push([a, b, c]);
      }
  return out;
}

describe('LengthModel', () => {
  const model = new LengthModel(POOLS);

  it('counts exactly the sequences in the length range', () => {
    for (const [lo, hi] of [[0, 100], [5, 7], [8, 8], [11, 20], [0, 3]] as const) {
      expect(model.count(lo, hi)).toBe(bruteForce(lo, hi).length);
    }
  });

  it('computes the mean length of the valid set', () => {
    const valid = bruteForce(5, 8);
    const mean = valid.reduce((s, w) => s + w.join('').length, 0) / valid.length;
    expect(model.meanLength(5, 8)).toBeCloseTo(mean, 10);
  });

  it('samples uniformly from the valid set only', () => {
    const rng = seeded(42);
    const valid = bruteForce(6, 8).map((w) => w.join('|'));
    const counts = new Map(valid.map((k) => [k, 0]));
    const draws = valid.length * 400;
    for (let i = 0; i < draws; i++) {
      const key = model.sample(6, 8, rng).join('|');
      expect(counts.has(key)).toBe(true);
      counts.set(key, counts.get(key)! + 1);
    }
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(300);
      expect(n).toBeLessThan(500);
    }
  });

  it('refuses an impossible range', () => {
    expect(() => model.sample(30, 40, seeded())).toThrow(RangeError);
  });

  it("groups a pool's words by length once, so every model over the pool shares the groups", () => {
    const pool = POOLS[1]!;
    expect(wordsByLength(pool)).toBe(wordsByLength(pool));
    expect([...wordsByLength(['a', 'bb', 'cc', 'd'])]).toEqual([
      [1, ['a', 'd']],
      [2, ['bb', 'cc']],
    ]);
  });

  it('counts and samples the same over a shared pool as over a copy of it', () => {
    const pool = POOLS[1]!;
    const shared = new LengthModel([pool, pool]);
    const copied = new LengthModel([[...pool], [...pool]]);
    for (const [lo, hi] of [[0, 100], [2, 4], [5, 5], [6, 8], [9, 20]] as const) {
      expect(shared.count(lo, hi)).toBe(copied.count(lo, hi));
      expect(shared.meanLength(lo, hi)).toBe(copied.meanLength(lo, hi));
    }
    const a = seeded(7);
    const b = seeded(7);
    for (let i = 0; i < 200; i++) expect(shared.sample(3, 7, a)).toEqual(copied.sample(3, 7, b));
  });
});
