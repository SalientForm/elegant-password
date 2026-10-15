import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS, dropVowels, fromSentence, normalizeSentence, trimInterior } from './fromSentence';
import { DEFAULT_REQUIREMENTS, RequirementsError, type Requirements } from './generate';
import { seeded } from './testRandom';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, minLength: 8, ...over });

describe('normalizing', () => {
  it('lowercases and strips accents and punctuation', () => {
    expect(normalizeSentence("Sally's café: eats 3 sweets!")).toEqual(['sallys', 'cafe', 'eats', '3', 'sweets']);
  });

  it('drops inner vowels but keeps the first letter', () => {
    expect(dropVowels('sweets')).toBe('swts');
    expect(dropVowels('eats')).toBe('ets');
    expect(dropVowels('aa')).toBe('aa');
  });

  it('trims interior letters, keeping the first and last', () => {
    expect(trimInterior('jptr')).toBe('jpr');
    expect(trimInterior('lds')).toBe('ls');
    expect(trimInterior('ls')).toBe('ls');
  });
});

describe('fromSentence', () => {
  it('turns "Sally eats sweets" into a conforming password', () => {
    const r = fromSentence('Sally eats sweets', req({ separator: '', twists: 1, count: 10 }), undefined, { rng: seeded(2) });
    expect(r.suggestions.length).toBeGreaterThan(3);
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.steps.join(' ')).toContain('“sweets” → “swts”');
      expect(s.password).toMatch(/^S/);
      expect(s.typing.caseChanges).toBeLessThanOrEqual(1);
    }
    expect(r.warnings.join(' ')).toMatch(/Short sentences/);
    console.log(r.suggestions.map((s) => s.password).join('  '));
  });

  it('compresses "jupiter brings 5 leds for piece" toward 12 characters', () => {
    const r = fromSentence(
      'jupiter brings 5 leds for piece',
      req({ separator: ';', glue: true, initials: 1, twists: 0, minLength: 8, count: 8 }),
      { shrink: 'vowels', shrinkFrom: 6, allowDropping: true, smallWordInitials: true, targetLength: 12 },
      { rng: seeded(12) },
    );
    console.log(r.suggestions.map((s) => s.password).join('  '));
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.password.length).toBeLessThanOrEqual(12);
      expect(s.password).toContain(';5'); // the number glues onto "leds"
      expect(s.password).toMatch(/;F/); // "for" is a capital initial, glued to what follows
      expect(s.password.replace(/F/, '')).toMatch(/[A-Z]/); // plus one random initial
      expect(s.bits).toBeCloseTo(Math.log2(4)); // which of the 4 other words became the initial
    }
  });

  it('shrinks words to first and last consonant', () => {
    const r = fromSentence(
      'jupiter brings bright leds',
      req({ separator: ' ', twists: 0, minDigits: 0, minSymbols: 0, minUppercase: 0, minLength: 4, count: 1 }),
      { shrink: 'ends', shrinkFrom: 4, allowDropping: true, smallWordInitials: true, targetLength: null },
      { rng: seeded() },
    );
    expect(r.suggestions[0]!.password).toBe('jr bs bt ls');
  });

  it('drops small words, then others, for very short targets', () => {
    const opts = { shrink: 'vowels' as const, shrinkFrom: 6, allowDropping: true, smallWordInitials: false, targetLength: 8 };
    const r = fromSentence('the cat sat on the warm mat by the door', req({ separator: '', twists: 0, minLength: 6, count: 3 }), opts, {
      rng: seeded(),
    });
    for (const s of r.suggestions) {
      expect(s.password.length).toBeLessThanOrEqual(8);
      expect(s.steps.join(' ')).toMatch(/dropped to fit: “the”/);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
    // Without dropping, initials are the most it can do.
    expect(() =>
      fromSentence('the cat sat on the warm mat by the door', req({ separator: ';', twists: 0, minLength: 6, maxLength: 12, count: 1 }), {
        ...opts,
        allowDropping: false,
      }),
    ).toThrow(/over the 12 maximum/);
  });

  it('meets "at least N" rules with twists before appending', () => {
    const r = fromSentence('the otters eat their salad at noon', req({ minDigits: 2, minSymbols: 3, minUppercase: 3, separator: ' ', count: 5 }), undefined, {
      rng: seeded(6),
    });
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.steps.join(' ')).toMatch(/for the digit and symbol rule/);
    }
  });

  it('shortens long sentences to fit the maximum', () => {
    const r = fromSentence('extraordinary elephants remember wonderful afternoons', req({ maxLength: 40, count: 3 }), undefined, { rng: seeded() });
    for (const s of r.suggestions) {
      expect(s.password.length).toBeLessThanOrEqual(40);
      expect(s.steps.some((step) => step.startsWith('shortened'))).toBe(true);
    }
  });

  it('reports only the random twists as strength', () => {
    const none = fromSentence('four little words here', req({ twists: 0, count: 1 }), undefined, { rng: seeded() });
    expect(none.suggestions[0]!.bits).toBe(0);
    const some = fromSentence('four little words here', req({ twists: 2, count: 1 }), undefined, { rng: seeded() });
    expect(some.suggestions[0]!.bits).toBeGreaterThan(3);
  });

  it('explains what cannot be fitted', () => {
    expect(() => fromSentence('', req({}))).toThrow(/Type a sentence/);
    expect(() => fromSentence('hi', req({ minLength: 20 }), undefined, { rng: seeded() })).toThrow(/under the 20 minimum/);
    const noDropping = { ...DEFAULT_SENTENCE_OPTIONS, allowDropping: false };
    expect(() => fromSentence('a b c d e f g h i j k l m n o p', req({ maxLength: 12 }), noDropping, { rng: seeded() })).toThrow(RequirementsError);
  });
});
