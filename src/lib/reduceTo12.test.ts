// Property tests: any sentence (with at least one letter) can be reduced to
// a 12-character password that still meets every rule. Minimum lengths are
// kept at 1 here because padding a too-short sentence up is a different
// problem; the last block checks that compression never undershoots a
// minimum when the sentence has enough material.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS, fromSentence, type SentenceOptions, type ShrinkStyle } from './fromSentence';
import { DEFAULT_REQUIREMENTS, type Requirements, type Separator } from './generate';
import { randomInt, type RandomSource } from './random';
import { seeded } from './testRandom';
import { ADJECTIVES, NOUNS, VERBS } from './words';

const pick = <T,>(items: readonly T[], rng: RandomSource): T => items[randomInt(items.length, rng)]!;

const LONG_WORDS = ['supercalifragilisticexpialidocious', 'antidisestablishmentarianism', 'pneumonoultramicroscopic', 'strengths', 'rhythms'];
const SMALL = ['a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'my', 'is'];
const ODD = ["don't", "Sally's", 'café', 'naïve', 'ROCK', 'x', 'I', 'e-mail', 'well-known', '!!!', '...', '42', '2026', '1234567890123'];

/** A random messy sentence of 1-30 pieces with at least one letter. */
function randomSentence(rng: RandomSource): string {
  const n = 1 + randomInt(30, rng);
  const pieces = Array.from({ length: n }, () => {
    const kind = randomInt(10, rng);
    if (kind < 4) return pick([...ADJECTIVES, ...NOUNS, ...VERBS], rng);
    if (kind < 6) return pick(SMALL, rng);
    if (kind < 7) return pick(LONG_WORDS, rng);
    if (kind < 8) return String(randomInt(10 ** (1 + randomInt(9, rng)), rng));
    return pick(ODD, rng);
  });
  if (!pieces.some((p) => /[a-z]/i.test(p))) pieces.push(pick(NOUNS, rng));
  return pieces.join(pick([' ', '  ', ', ', ' - '], rng));
}

const SEPARATORS: Separator[] = [' ', ';', '-', '.', '', 'auto'];
const SHRINK: ShrinkStyle[] = ['none', 'vowels', 'ends'];

function randomSettings(rng: RandomSource): { req: Requirements; opts: SentenceOptions } {
  return {
    req: {
      ...DEFAULT_REQUIREMENTS,
      minLength: 1,
      maxLength: 12,
      minUppercase: randomInt(3, rng),
      minDigits: randomInt(3, rng),
      minSymbols: randomInt(3, rng),
      separator: pick(SEPARATORS, rng),
      twists: randomInt(4, rng),
      initials: randomInt(4, rng),
      glue: randomInt(2, rng) === 1,
      avoidPinkyStretch: randomInt(2, rng) === 1,
      count: 3,
    },
    opts: {
      ...DEFAULT_SENTENCE_OPTIONS,
      shrink: pick(SHRINK, rng),
      shrinkFrom: 2 + randomInt(8, rng),
      smallWordInitials: randomInt(2, rng) === 1,
    },
  };
}

function expectFits(sentence: string, req: Requirements, opts: SentenceOptions, seed: number, limit = 12) {
  let result;
  try {
    result = fromSentence(sentence, req, opts, { rng: seeded(seed) });
  } catch (e) {
    throw new Error(`${(e as Error).message}\n  sentence: ${JSON.stringify(sentence)}\n  req: ${JSON.stringify(req)}\n  opts: ${JSON.stringify(opts)}`);
  }
  expect(result.suggestions.length).toBeGreaterThan(0);
  for (const s of result.suggestions) {
    const context = `${JSON.stringify(sentence)} -> ${JSON.stringify(s.password)}`;
    expect([...s.password].length, context).toBeLessThanOrEqual(limit);
    for (const c of s.checks) expect(c.met, `${context}: ${c.rule}`).toBe(true);
  }
}

describe('any sentence reduces to 12 characters', { timeout: 60_000 }, () => {
  it('with the default settings', () => {
    const rng = seeded(1);
    for (let i = 0; i < 300; i++) {
      expectFits(randomSentence(rng), { ...DEFAULT_REQUIREMENTS, minLength: 1, maxLength: 12 }, DEFAULT_SENTENCE_OPTIONS, i);
    }
  });

  it('with random rules, separators, shrink styles, initials, glue and twists', () => {
    const rng = seeded(2);
    for (let i = 0; i < 600; i++) {
      const { req, opts } = randomSettings(rng);
      expectFits(randomSentence(rng), req, opts, i);
    }
  });

  it('with deliberate swaps for typing ease on, across the same random rules', () => {
    const rng = seeded(2);
    for (let i = 0; i < 600; i++) {
      const { req, opts } = randomSettings(rng);
      expectFits(randomSentence(rng), { ...req, easeSwaps: true }, opts, i);
    }
  });

  it('when compressing toward 12 under the default 32-character maximum', () => {
    const rng = seeded(3);
    for (let i = 0; i < 300; i++) {
      const { req, opts } = randomSettings(rng);
      expectFits(randomSentence(rng), { ...req, maxLength: 32 }, { ...opts, targetLength: 12 }, i);
    }
  });

  it.each([
    ['one enormous word', 'supercalifragilisticexpialidocious'],
    ['only small words', 'a the of for to in on and or my is a the of for to in on and or'],
    ['only numbers and one letter', '1234567890 9876543210 5555555555 x'],
    ['a long quote', 'it was the best of times it was the worst of times it was the age of wisdom it was the age of foolishness'],
    ['punctuation and accents', "Ça va? Don't panic!!! Naïve café-goers, well-known e-mail."],
    ['the example', 'jupiter brings 5 leds for piece'],
    ['one letter', 'x'],
  ])('%s', (_name, sentence) => {
    for (let seed = 0; seed < 20; seed++) {
      expectFits(sentence, { ...DEFAULT_REQUIREMENTS, minLength: 1, maxLength: 12, twists: seed % 4, initials: seed % 3 }, DEFAULT_SENTENCE_OPTIONS, seed);
    }
  });

  it('never compresses below the minimum when the sentence has enough material', () => {
    const rng = seeded(4);
    for (let i = 0; i < 300; i++) {
      const sentence = randomSentence(rng);
      if (sentence.replace(/[^a-z0-9]/gi, '').length < 16) continue;
      const { req, opts } = randomSettings(rng);
      const minLength = 4 + randomInt(5, rng); // 4-8, typical for a 12-character site
      let result;
      try {
        result = fromSentence(sentence, { ...req, minLength }, opts, { rng: seeded(i) });
      } catch (e) {
        throw new Error(`${(e as Error).message}\n  sentence: ${JSON.stringify(sentence)}\n  req: ${JSON.stringify({ ...req, minLength })}\n  opts: ${JSON.stringify(opts)}`);
      }
      for (const s of result.suggestions) {
        expect(s.password.length, `${JSON.stringify(sentence)} -> ${s.password}`).toBeGreaterThanOrEqual(minLength);
        expect(s.password.length).toBeLessThanOrEqual(12);
      }
    }
  });

  it('needs a letter or digit to work with, and says so for another script', () => {
    expect(() => fromSentence('日本語 !!! ...', { ...DEFAULT_REQUIREMENTS, maxLength: 12 })).toThrow(/no words made of the letters a-z or digits/);
    expect(() => fromSentence('   ', { ...DEFAULT_REQUIREMENTS, maxLength: 12 })).toThrow(/Type a sentence/);
  });
});
