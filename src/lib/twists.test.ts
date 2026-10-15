import { describe, expect, it } from 'vitest';
import { applyTwists, BUILT_IN_MAPPINGS, mappingKey, validateMapping, type Mapping, type TwistOptions } from './twists';
import { seeded } from './testRandom';
import { DEFAULT_REQUIREMENTS, generate } from './generate';

const m = (from: string, to: string): Mapping => ({ from, to, kind: 'custom' });
const opts = (over: Partial<TwistOptions>): TwistOptions => ({
  count: 1,
  mappings: [],
  skip: () => false,
  protectFirstLetter: false,
  minDelta: -100,
  maxDelta: 100,
  ...over,
});

describe('built-in mappings', () => {
  it('has 64 distinct, valid mappings', () => {
    expect(BUILT_IN_MAPPINGS).toHaveLength(64);
    expect(new Set(BUILT_IN_MAPPINGS.map(mappingKey)).size).toBe(64);
    for (const b of BUILT_IN_MAPPINGS) expect(validateMapping(b.from, b.to), mappingKey(b)).toBeUndefined();
  });
});

describe('validateMapping', () => {
  it('rejects unusable mappings', () => {
    expect(validateMapping('A', '4')).toMatch(/lowercase/);
    expect(validateMapping('a', 'a')).toMatch(/same/);
    expect(validateMapping('a', 'é')).toMatch(/keyboard/);
    expect(validateMapping('a', 'a b')).toMatch(/spaces/);
    expect(validateMapping('e', '')).toBeUndefined(); // dropping a letter is a valid misspelling
  });
});

describe('applyTwists', () => {
  it('counts every distinct placement and picks one of them', () => {
    // "salad": a>@ at 2 places, l>! at 1 place => 3 single twists.
    const r = applyTwists(['salad'], opts({ mappings: [m('a', '@'), m('l', '!')] }), seeded());
    expect(r.options).toBe(3);
    expect(r.bits).toBeCloseTo(Math.log2(3));
    expect(['s@lad', 'sal@d', 'sa!ad']).toContain(r.words[0]);
    expect(r.applied).toHaveLength(1);
  });

  it('never overlaps twists and dedupes identical results', () => {
    // "an": a>@ and an>@n both give "@n"; overlapping pairs are not allowed.
    const r = applyTwists(['an'], opts({ count: 2, mappings: [m('a', '@'), m('an', '@n'), m('n', 'm')] }), seeded());
    expect(r.words).toEqual(['@m']);
    expect(r.options).toBe(1);
    const single = applyTwists(['an'], opts({ mappings: [m('a', '@'), m('an', '@n')] }), seeded());
    expect(single.options).toBe(1);
  });

  it('respects skip, first-letter protection and the length limits', () => {
    const mappings = [m('a', '@'), m('a', 'e')];
    const skipped = applyTwists(['7', 'amber'], opts({ mappings, skip: (i) => i === 0, protectFirstLetter: true }), seeded());
    expect(skipped.options).toBe(1);
    expect(skipped.words).toEqual(['7', 'ember']);
    const none = applyTwists(['amber'], opts({ mappings, minDelta: 1 }), seeded());
    expect(none).toMatchObject({ words: ['amber'], bits: 0, applied: [] });
    const shorter = applyTwists(['phone'], opts({ mappings: [m('ph', 'f'), m('o', '0')], maxDelta: -1 }), seeded());
    expect(shorter.words).toEqual(['fone']);
  });

  it('falls back to fewer twists when there is no room', () => {
    const r = applyTwists(['cat'], opts({ count: 3, mappings: [m('a', '@')] }), seeded());
    expect(r.applied).toHaveLength(1);
  });

  it('is uniform over the distinct results', () => {
    const counts = new Map<string, number>();
    const rng = seeded(11);
    for (let i = 0; i < 3000; i++) {
      const w = applyTwists(['salad'], opts({ mappings: [m('a', '@'), m('l', '!')] }), rng).words[0]!;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    for (const n of counts.values()) expect(n).toBeGreaterThan(850);
  });
});

describe('twists inside generate', () => {
  it('only uses symbols the site allows and keeps every requirement', () => {
    const req = { ...DEFAULT_REQUIREMENTS, twists: 3, allowedSymbols: '.', allowSpaces: false, separator: 'auto' as const, count: 20 };
    for (const s of generate(req, { rng: seeded(5) }).suggestions) {
      expect(s.password).not.toMatch(/[@!$(#+*|&]/);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.password).toMatch(/^[^a-z]*[A-Z]/); // the first letter is the capital
      expect(s.bits).toBeCloseTo(s.twistBits + Math.log2(2 ** (s.bits - s.twistBits)));
    }
  });

  it('adds bits and stays fast at the maximum setting', () => {
    const start = performance.now();
    const result = generate({ ...DEFAULT_REQUIREMENTS, twists: 3, count: 20, targetBits: 72 }, { rng: seeded(9) });
    const ms = performance.now() - start;
    for (const s of result.suggestions) {
      expect(s.twists).toHaveLength(3);
      expect(s.twistBits).toBeGreaterThan(8);
    }
    console.log(`3 twists x 20: ${ms.toFixed(0)} ms, twist bits ${result.suggestions.map((s) => s.twistBits.toFixed(1)).join(' ')}`);
    console.log(result.suggestions.slice(0, 5).map((s) => s.password).join('\n'));
    expect(ms).toBeLessThan(500);
  });
});
