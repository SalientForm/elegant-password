import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate, type Requirements } from './generate';
import { fromSentence } from './fromSentence';
import { scoreCold } from './score';
import { seeded } from './testRandom';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

describe('scoreCold', () => {
  it('is a pure function of the password and hint', () => {
    const password = '13;Worthy;storks;openly;pet;twisty;toys';
    const hint = '13 worthy storks openly pet twisty toys';
    const a = scoreCold(password, hint);
    const b = scoreCold(password, hint);
    expect(a).toEqual(b);
    expect(a.aligned).toBe(true);
    expect(a.template).toEqual(['num', 'adj', 'noun', 'adv', 'verb', 'adj', 'noun']);
    expect(a.twistCount).toBe(0);
    expect(a.initialBits).toBe(0);
    expect(a.sentenceBits).toBeGreaterThan(40);
    expect(a.bits).toBe(a.sentenceBits);
    expect(a.difficulty.measurements.chunks).toBe(7);
    // The same password with a different hint is a different score: the hint is part of the input, nothing else is.
    expect(scoreCold(password, 'something else entirely').bits).not.toBe(a.bits);
  });

  it('stays within the plan: never above the unconstrained sentence space', () => {
    for (const comfort of ['strict', 'balanced', 'relaxed'] as const) {
      const r = generate(req({ comfort, twists: 0, maxLength: 80, count: 5 }), { rng: seeded(4) });
      const unconstrained = r.plan.bits + r.plan.lengthPenaltyBits;
      for (const s of r.suggestions) {
        const cold = scoreCold(s.password, s.hint);
        expect(cold.template, s.hint).toBeDefined();
        expect(cold.sentenceBits).toBeLessThanOrEqual(unconstrained + 1e-6);
        // A stricter comfort level may happen to contain every word; it never costs more than a few bits.
        expect(cold.sentenceBits).toBeGreaterThan(unconstrained - 15);
      }
    }
  });

  it('reads the documented sentence-mode example', () => {
    const s = scoreCold('jr;B;5ls;Fpc', 'jupiter brings 5 leds for piece');
    expect(s.words.map((w) => `${w.word}:${w.form}:${w.text}`)).toEqual([
      'jupiter:short:jr',
      'brings:initial:B',
      '5:number:5',
      'leds:short:ls',
      'for:initial:F',
      'piece:short:pc',
    ]);
    expect(s.template).toBeUndefined();
    expect(s.initialBits).toBeCloseTo(Math.log2(4)); // one random initial among jupiter, brings, leds, piece
    expect(s.twistCount).toBe(0);
    expect(s.bits).toBeCloseTo(2);
  });

  it('finds twisted words, including a symbol at the start, and counts how the swaps could have landed', () => {
    const s = scoreCold('Smoky;stagz;stuff;8;5cary;@pples', 'smoky stags stuff 8 scary apples');
    expect(s.aligned).toBe(true);
    expect(s.words.map((w) => w.twists)).toEqual([0, 1, 0, 0, 1, 1]);
    expect(s.twistCount).toBe(3);
    expect(s.twistOptions).toBeGreaterThan(256);
    expect(s.twistBits).toBeGreaterThan(8);
    expect(s.difficulty.measurements.chunks).toBe(6 + 3);
    expect(s.template).toEqual(['adj', 'noun', 'verb', 'num', 'adj', 'noun']);
  });

  it('handles whole words in capitals, made-up nouns and glue', () => {
    const r = generate(req({ minUppercase: 3, madeUp: 1, glue: true, initials: 1, separator: ';', twists: 1, count: 8 }), { rng: seeded(21) });
    for (const s of r.suggestions) {
      const cold = scoreCold(s.password, s.hint);
      expect(cold.aligned, `${s.password} / ${s.hint}`).toBe(true);
      expect(cold.template).toBeDefined();
      expect(cold.bits).toBe(s.bits);
    }
  });

  it('marks words it cannot find as dropped and keeps scoring', () => {
    const s = scoreCold('Cats;dogs', 'cats and dogs and owls');
    expect(s.words.map((w) => w.form)).toEqual(['word', 'dropped', 'word', 'dropped', 'dropped']);
    expect(s.aligned).toBe(false);
    expect(s.bits).toBe(0);
    expect(scoreCold('x', '').bits).toBe(0);
  });

  it('agrees with sentence mode, which uses it for every card', () => {
    const r = fromSentence('the otters eat their salad at noon', req({ minDigits: 2, minSymbols: 3, twists: 2, count: 5 }), undefined, { rng: seeded(6) });
    for (const s of r.suggestions) {
      const cold = scoreCold(s.password, s.hint);
      expect(s.hint).toBe('the otters eat their salad at noon');
      expect(s.bits).toBe(cold.bits);
      expect(cold.template).toBeUndefined();
      expect(cold.twistCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('is fast enough to score a whole list on every render', () => {
    const r = generate(req({ twists: 3, count: 20, maxLength: 48 }), { rng: seeded(8) });
    const start = performance.now();
    for (const s of r.suggestions) scoreCold(`${s.password}`, `${s.hint} `); // cache miss: different key
    expect(performance.now() - start).toBeLessThan(400);
  });
});
