import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate, type Requirements } from './generate';
import { fromSentence } from './fromSentence';
import { isMemorableDigits, scoreAlone, scoreCold, twistsToTry, wordBitsFromText } from './score';
import { initialsOf, pools } from './grammar';
import { seeded } from './testRandom';
import { lookupKey, OFF_MODEL_PRESS, pressFor } from './keyboard';

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

  it('scores words off the lists from their text, the same rule as any password', () => {
    // No template, and none of these words is on any list: English-like text at 2.3 bits a letter.
    const s = scoreCold('Xyzzy;plugh;frobnicate', 'Xyzzy plugh frobnicate');
    expect(s.template).toBeUndefined();
    expect(s.sentenceBits).toBeCloseTo((5 + 5 + 10) * 2.3, 5);
    expect(s.bits).toBe(s.sentenceBits);
    // A list word in a user's sentence is one pick from that list; a number is its digits; an initial is one letter.
    const mixed = scoreCold('Big;otters;eat;42;F;cake', 'big otters eat 42 for cake');
    const words = Object.fromEntries(mixed.words.map((w) => [w.word, wordBitsFromText(w)]));
    expect(words.big).toBeCloseTo(Math.log2(pools('relaxed', 1).adj.length), 5);
    expect(words.otters).toBeCloseTo(Math.log2(pools('relaxed', 1).noun.length), 5);
    expect(words['42']).toBeCloseTo(2 * Math.log2(10), 5);
    expect(words.for).toBeCloseTo(Math.log2(initialsOf(pools('relaxed', 1).prep).length), 5);
    expect(words.cake).toBeCloseTo(4 * 2.3, 5);
    expect(mixed.sentenceBits).toBeCloseTo(Object.values(words).reduce((a, b) => a + b, 0), 5);
    // Nothing about origin goes in: the same password and hint score the same whichever mode made them.
    expect(scoreCold('Big;otters;eat;42;F;cake', 'big otters eat 42 for cake')).toEqual(mixed);
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
    expect(s.sentenceBits).toBeGreaterThan(40); // the words themselves, scored from their text
    expect(s.bits).toBeCloseTo(s.sentenceBits + Math.log2(4));
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
    expect(s.bits).toBeCloseTo(2 * Math.log2(pools('relaxed', 1).noun.length), 5); // only the two words found count
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

  it('reads padding: repeated characters inside a word and a length tag after it', () => {
    const repeated = scoreCold('$t33333l', 'steel');
    expect(repeated.words[0]).toMatchObject({ form: 'word', text: '$t33333l', twists: 3 });
    expect(repeated.aligned).toBe(true);
    const tagged = scoreCold('Sally;e4ts;swts;123;%24', 'Sally eats sweets 123 %24');
    expect(tagged.aligned).toBe(true);
    expect(tagged.words.map((w) => w.text)).toEqual(['Sally', 'e4ts', 'swts', '123', '24']);
    // An in-place symbol still wins over skipping: "@pples" is the word, not a tag.
    expect(scoreCold('Big;@pples', 'big apples').words[1]).toMatchObject({ text: '@pples', twists: 1 });
  });

  it('is fast enough to score a whole list on every render', () => {
    const r = generate(req({ twists: 3, count: 20, maxLength: 48 }), { rng: seeded(8) });
    const start = performance.now();
    for (const s of r.suggestions) scoreCold(`${s.password}`, `${s.hint} `); // cache miss: different key
    expect(performance.now() - start).toBeLessThan(400);
  });
});

describe('scoreAlone', () => {
  it('is a pure function of the text and recognises this tool\'s own words', () => {
    const a = scoreAlone('Sleepy;otters;paint;7;boats!!');
    expect(a).toEqual(scoreAlone('Sleepy;otters;paint;7;boats!!'));
    const words = a.parts.filter((p) => p.kind === 'word');
    expect(words.map((p) => p.text)).toEqual(['Sleepy', 'otters', 'paint', 'boats']);
    expect(words.every((p) => p.poolSize! > 100 && p.bits > 6)).toBe(true);
    expect(a.parts.find((p) => p.text === '7')).toMatchObject({ kind: 'digits' });
    expect(a.parts.find((p) => p.text === '!!')).toMatchObject({ kind: 'symbols' });
    expect(a.bits).toBeGreaterThan(30);
    expect(a.difficulty.measurements.chunks).toBe(10); // 5 runs of letters or digits, 4 separators, the closing marks
  });

  it('counts unknown letters as English-like text and free digits and symbols as full choices', () => {
    const text = scoreAlone('xqzv');
    expect(text.parts[0]).toMatchObject({ kind: 'letters' });
    expect(text.bits).toBeCloseTo(4 * 2.3);
    expect(scoreAlone('8402').bits).toBeCloseTo(4 * Math.log2(10));
    expect(scoreAlone('1234').bits).toBeLessThan(scoreAlone('8402').bits); // a memorable run is one pick
    expect(scoreAlone('!!!!').bits).toBeLessThan(scoreAlone('!@#$').bits); // a repeat is one symbol and a count
    expect(scoreAlone('').bits).toBe(0);
  });
});

describe('memorability', () => {
  it('rewards words that keep their size and short passwords, and penalises swaps', () => {
    const whole = scoreCold('Sally;eats;sweets', 'Sally eats sweets').memorability;
    expect(whole).toMatchObject({ sameSize: 3, swappedWords: 0, fidelity: 1 });
    expect(whole.score).toBeGreaterThanOrEqual(90);
    const swapped = scoreCold('Sally;e4ts;sw33ts', 'Sally eats sweets').memorability;
    expect(swapped.fidelity).toBe(1); // same lengths, just spelled differently
    expect(swapped.swappedWords).toBe(2);
    expect(swapped.score).toBe(whole.score - 10);
    const shortened = scoreCold('jr;B;5ls;Fpc', 'jupiter brings 5 leds for piece').memorability;
    expect(shortened.sameSize).toBe(1); // only "5" kept its length
    expect(shortened.fidelity).toBeLessThan(0.5);
    expect(shortened.score).toBeLessThan(whole.score);
    const dropped = scoreCold('Cats;dogs', 'cats and dogs and owls').memorability;
    expect(dropped.fidelity).toBeCloseTo(2 / 5);
    const long = scoreCold('Sally;eats;sweets;on;sundays;with;friends;and;family;every;week', 'Sally eats sweets on sundays with friends and family every week').memorability;
    expect(long.fidelity).toBe(1);
    expect(long.brevity).toBe(0);
    expect(long.score).toBe(60);
  });

  it('is on every suggestion as plain data and matches the cold score', () => {
    const r = generate(req({ count: 3 }), { rng: seeded(2) });
    for (const s of r.suggestions) expect(s.memorability).toBe(scoreCold(s.password, s.hint).memorability.score);
  });
});

describe('memorable digit runs', () => {
  it('means repeats, consecutive runs and well-known skips, not any pair of digits', () => {
    for (const d of ['7', '77', '123', '4321', '0123', '2468', '97531']) expect(isMemorableDigits(d), d).toBe(true);
    for (const d of ['42', '159', '8402', '1324', '13']) expect(isMemorableDigits(d), d).toBe(false);
  });
});

describe('characters off the US keyboard', () => {
  it('scores pasted text with accents, currency signs or tabs instead of throwing', () => {
    for (const text of ['café', '£12', '€uro', 'naïve;otters', 'tab\there', '日本']) {
      const alone = scoreAlone(text);
      expect(Number.isFinite(alone.bits)).toBe(true);
      expect(alone.difficulty.score).toBeGreaterThanOrEqual(0);
    }
    const cold = scoreCold('naïve;otters', 'naive otters');
    expect(Number.isFinite(cold.bits)).toBe(true);
    expect(cold.memorability.score).toBeGreaterThanOrEqual(0);
  });

  it('charges such a character as a shifted press of the key furthest from home', () => {
    expect(pressFor('é')).toEqual(OFF_MODEL_PRESS);
    expect(OFF_MODEL_PRESS.shifted).toBe(true);
    expect(pressFor('é').key).toBe(lookupKey('`')!.key);
    expect(scoreAlone('cafe').difficulty.score).toBeLessThan(scoreAlone('café').difficulty.score); // it costs more, never nothing
  });
});

describe('cold scoring very long words', () => {
  it('tries fewer swaps on long words, so a 34-letter word scores in milliseconds rather than seconds', () => {
    expect(twistsToTry(8)).toBe(3);
    expect(twistsToTry(12)).toBe(2);
    expect(twistsToTry(34)).toBe(1);
    const started = performance.now();
    const r = scoreCold('Sprclfr6lstcxpldkz;@ntd$stbl$hmntrnsm....', 'supercalifragilisticexpialidocious antidisestablishmentarianism');
    expect(performance.now() - started).toBeLessThan(500);
    expect(Number.isFinite(r.bits)).toBe(true);
  });
});
