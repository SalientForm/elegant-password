import { describe, expect, it } from 'vitest';
import { compressions, DEFAULT_SENTENCE_OPTIONS, dropVowels, fromSentence, normalizeSentence, trimInterior, type SentenceOptions, type ShrinkStyle } from './fromSentence';
import { DEFAULT_REQUIREMENTS, RequirementsError, type Requirements } from './generate';
import { easedText } from './ease';
import { scoreCold } from './score';
import { randomInt, type RandomSource } from './random';
import { seeded } from './testRandom';
import { BUILT_IN_MAPPINGS, type Mapping } from './twists';
import { ADJECTIVES, NOUNS, VERBS } from './words';

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
      expect(s.password).toMatch(/[A-Z]/); // the capital goes on a random word, for variety across the batch
      expect(s.typing.caseChanges).toBeLessThanOrEqual(2);
    }
    expect(r.warnings.join(' ')).toMatch(/Short sentences/);
    console.log(r.suggestions.map((s) => s.password).join('  '));
  });

  it('compresses "jupiter brings 5 leds for piece" toward 12 characters', () => {
    const r = fromSentence(
      'jupiter brings 5 leds for piece',
      req({ separator: ';', glue: true, initials: 1, twists: 0, minLength: 8, count: 8 }),
      { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'vowels', shrinkFrom: 6, allowDropping: true, smallWordInitials: true, targetLength: 12 },
      { rng: seeded(12) },
    );
    console.log(r.suggestions.map((s) => s.password).join('  '));
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.password.length).toBeLessThanOrEqual(12);
      expect(s.password).toContain(';5'); // the number glues onto "leds"
      expect(s.password).toMatch(/;F/); // "for" is a capital initial, glued to what follows
      expect(s.password.replace(/F/, '')).toMatch(/[A-Z]/); // plus one random initial
      const cold = scoreCold(s.password, s.hint);
      expect(cold.initialBits).toBeCloseTo(Math.log2(4)); // which of the 4 other words became the initial
      expect(s.bits).toBe(cold.bits); // the words themselves count too, by the same text rule as any password
    }
  });

  it('shrinks words to first and last consonant', () => {
    const r = fromSentence(
      'jupiter brings bright leds',
      req({ separator: ' ', twists: 0, minDigits: 0, minSymbols: 0, minUppercase: 0, minLength: 4, count: 1 }),
      { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'ends', shrinkFrom: 4, allowDropping: true, smallWordInitials: true, targetLength: null },
      { rng: seeded() },
    );
    expect(r.suggestions[0]!.password).toBe('jr bs bt ls');
  });

  it('drops small words, then others, for very short targets', () => {
    const opts = { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'vowels' as const, shrinkFrom: 6, allowDropping: true, smallWordInitials: false, targetLength: 8 };
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

  it('meets "at least N" rules by swaps, a number of its own, or closing marks, and says which', () => {
    const r = fromSentence('the otters eat their salad at noon', req({ minDigits: 2, minSymbols: 3, minUppercase: 3, separator: ' ', count: 10 }), undefined, {
      rng: seeded(6),
    });
    const hows = new Set<string>();
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const steps = s.steps.join(' ');
      expect(steps).toMatch(/digit/); // swaps for the digit rule, or a number added in front or at the end
      expect(steps).toMatch(/symbol/); // swaps for the symbol rule, or closing marks
      hows.add(`${/added [0-9]+ in front/.test(steps) ? 'front' : /added [0-9]+ at the end/.test(steps) ? 'end' : 'swap'}`);
    }
    expect(hows.size).toBeGreaterThanOrEqual(2); // not the same way every time
  });

  it('shortens long sentences to fit the maximum', () => {
    const r = fromSentence('extraordinary elephants remember wonderful afternoons', req({ maxLength: 40, count: 3 }), undefined, { rng: seeded() });
    for (const s of r.suggestions) {
      expect(s.password.length).toBeLessThanOrEqual(40);
      expect(s.steps.some((step) => step.startsWith('shortened'))).toBe(true);
    }
  });

  it('scores strength cold from the password and the sentence: only initials and twists count', () => {
    // No random twists, no digit or symbol rule: the words themselves are scored from their text, nothing else.
    const plain = fromSentence('four little words here', req({ twists: 0, minDigits: 0, minSymbols: 0, count: 1 }), undefined, { rng: seeded() });
    const cold = scoreCold(plain.suggestions[0]!.password, plain.suggestions[0]!.hint);
    expect(plain.suggestions[0]!.bits).toBe(cold.bits);
    expect(cold.twistCount).toBe(0);
    expect(cold.initialBits).toBe(0);
    // The words scored from their text, but never above the password's own text reading: a shortened word is charged by the letters typed.
    expect(cold.bits).toBe(Math.min(cold.sentenceBits, cold.textBits));
    expect(cold.leftoverBits).toBe(0);
    // A digit rule forces one digit twist; where it lands is random, so it counts.
    const none = fromSentence('four little words here', req({ twists: 0, count: 1 }), undefined, { rng: seeded() });
    const forced = none.suggestions[0]!;
    expect(forced.bits).toBe(scoreCold(forced.password, forced.hint).bits);
    expect(forced.bits).toBeGreaterThan(0);
    const some = fromSentence('four little words here', req({ twists: 2, count: 1 }), undefined, { rng: seeded() });
    expect(some.suggestions[0]!.bits).toBeGreaterThan(3);
    expect(some.suggestions[0]!.hint).toBe('four little words here');
  });

  it('explains what cannot be fitted', () => {
    expect(() => fromSentence('', req({}))).toThrow(/Type a sentence/);
    const noPadding = { ...DEFAULT_SENTENCE_OPTIONS, padding: false };
    expect(() => fromSentence('hi', req({ minLength: 20 }), noPadding, { rng: seeded() })).toThrow(/under the 20 minimum/);
    const noDropping = { ...DEFAULT_SENTENCE_OPTIONS, allowDropping: false };
    expect(() => fromSentence('a b c d e f g h i j k l m n o p', req({ maxLength: 12 }), noDropping, { rng: seeded() })).toThrow(RequirementsError);
  });
});

describe('padding', () => {
  const short = (over: Partial<Requirements>, opts: Partial<SentenceOptions> = {}, sentence = 'hi there', seed = 3) =>
    fromSentence(sentence, req({ twists: 0, count: 3, ...over }), { ...DEFAULT_SENTENCE_OPTIONS, ...opts }, { rng: seeded(seed) });

  it('pads a short sentence to exactly the minimum, ending with a total-length tag that states that length', () => {
    const r = short({ minLength: 20, maxLength: 32 });
    for (const s of r.suggestions) {
      expect(s.password.length).toBe(20);
      expect(s.password).toMatch(/%20$/);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.steps.join(' ')).toMatch(/padded to the 20-character minimum/);
      expect(s.hint).toMatch(/^([0-9]+ )?hi there .*%20$/); // a number for the digit rule may lead the hint
      expect(scoreCold(s.password, s.hint).aligned).toBe(true);
    }
  });

  it('adds a whole word only when more than 3 characters short, and uses repeats, digits and marks for the rest', () => {
    // "Hi;th3re" is 8 characters; 12 wants 4 more: too few for a word, so one repeat and the tag.
    const small = short({ minLength: 12, maxLength: 32 }).suggestions[0]!;
    expect(small.password).toHaveLength(12);
    expect(small.words.some((w) => w.slot === 'fluff')).toBe(false);
    // 30 wants 22 more: words fill most of it.
    const big = short({ minLength: 30, maxLength: 40 }).suggestions[0]!;
    expect(big.password).toHaveLength(30);
    expect(big.words.filter((w) => w.slot === 'fluff').length).toBeGreaterThan(0);
    expect(big.password).toMatch(/%30$/);
    // No symbols at all, so no tag and no marks: digits and repeats only.
    const bare = short({ minLength: 14, maxLength: 20, minSymbols: 0, allowedSymbols: '', separator: '' }).suggestions[0]!;
    expect(bare.password.length).toBeGreaterThanOrEqual(14);
    expect(bare.password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('uses a factor tag when asked: the number divides the length of everything before it', () => {
    const r = short({ minLength: 20, maxLength: 32 }, { lengthTag: 'factor' });
    for (const s of r.suggestions) {
      expect(s.password).toHaveLength(20);
      const m = s.password.match(/@(\d+)$/);
      expect(m, s.password).toBeTruthy();
      const left = s.password.length - m![0].length;
      expect(left % Number(m![1])).toBe(0);
      expect(scoreCold(s.password, s.hint).aligned).toBe(true);
    }
  });

  it('repeats a digit inside a word to pad, and the cold scorer still reads the word', () => {
    // A two-character gap with no tag symbols and no marks allowed: the repeat is the only exact filler. The digit is in the word already.
    const base = short({ minLength: 1, maxLength: 40, allowedSymbols: ';', separator: ';' }, {}, 'sweet st33l beams').suggestions[0]!;
    expect(base.password).toMatch(/33/);
    const padded = short({ minLength: base.password.length + 2, maxLength: 40, allowedSymbols: ';', separator: ';' }, { lengthTag: 'none' }, 'sweet st33l beams').suggestions[0]!;
    expect(padded.password).toHaveLength(base.password.length + 2);
    expect(padded.password).toMatch(/3333/); // the digit in the word, repeated twice more
    expect(padded.steps.join(' ')).toMatch(/repeated 2 more times/);
    const cold = scoreCold(padded.password, padded.hint);
    expect(cold.aligned).toBe(true);
    expect(cold.twistCount).toBe(scoreCold(base.password, base.hint).twistCount);
  });

  it('respects the maximum and falls back to the sentence problem when padding is off', () => {
    const tight = short({ minLength: 20, maxLength: 20 });
    for (const s of tight.suggestions) expect(s.password).toHaveLength(20);
    expect(() => short({ minLength: 20 }, { padding: false })).toThrow(/under the 20 minimum/);
  });

  it('keeps the sentence\'s own material first: words are kept whole, or a number for the digit rule added, before any padding', () => {
    const r = short({ minLength: 17, maxLength: 32 }, {}, 'Sally eats sweets');
    for (const s of r.suggestions) {
      expect(s.password.length).toBeGreaterThanOrEqual(17);
      expect(s.steps.join(' ')).not.toMatch(/padded/); // "sweets" kept whole, or the digit rule's number, did the job
    }
  });
});

describe('edges of a sentence-mode password', () => {
  it('never start or end with a space or the separator, even with closing marks and padding', () => {
    for (const separator of [';', ' ', '.']) {
      const r = fromSentence('tiny bits', req({ separator, allowedSymbols: '.;?!', minSymbols: 4, minLength: 20, twists: 0, count: 4 }), undefined, { rng: seeded(5) });
      for (const s of r.suggestions) {
        expect(s.password, separator).not.toMatch(new RegExp(`^[ ${separator}]|[ ${separator}]$`));
        for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      }
    }
  });
});

describe('fromSentence: fits found by review', () => {
  const upper = (s: string) => (s.match(/[A-Z]/g) ?? []).length;

  it('pads a short sentence to a power-of-ten minimum with a tag that states that minimum', () => {
    for (const s of ['my dog', 'hi', 'why me']) {
      const r = fromSentence(s, req({ minLength: 10, maxLength: 32 }), undefined, { rng: seeded(3) });
      for (const sg of r.suggestions) {
        expect([...sg.password].length).toBeGreaterThanOrEqual(10);
        expect(sg.checks.every((c) => c.met)).toBe(true);
      }
    }
  });

  it('keeps the separator before a padding word even when a glued number comes right before it', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = fromSentence('why dry', req({ glue: true, minLength: 20, maxLength: 32, separator: ';' }), undefined, { rng: seeded(seed) });
      for (const sg of r.suggestions) expect([...sg.password].length).toBeGreaterThanOrEqual(20);
    }
  });

  it('pads to an exact length when the least-compressed fit is under it and the state before is over it', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = fromSentence('jupiter dog piece', req({ minLength: 12, maxLength: 12 }), undefined, { rng: seeded(seed) });
      for (const sg of r.suggestions) expect([...sg.password].length).toBe(12);
    }
  });

  it('keeps long words whole rather than shrinking away the letters the uppercase rule needs', () => {
    const r = fromSentence('elephants', req({ minUppercase: 3, minLength: 1 }), { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'ends', shrinkFrom: 4 }, { rng: seeded(1) });
    for (const sg of r.suggestions) expect(upper(sg.password)).toBeGreaterThanOrEqual(3);
    const r2 = fromSentence('the elephants remember', req({ minUppercase: 6, minLength: 1 }), { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'ends', shrinkFrom: 4 }, { rng: seeded(1) });
    for (const sg of r2.suggestions) expect(upper(sg.password)).toBeGreaterThanOrEqual(6);
  });

  it('refuses closing marks that would be the separator, naming it, instead of a password that fails the symbol rule', () => {
    // No digit rule here: a number of its own would bring a separator of its own, which may legitimately meet the rule.
    expect(() => fromSentence('tiny cats', req({ separator: '$', allowedSymbols: '$', minSymbols: 2, minDigits: 0 }))).toThrow(/only allowed symbol is the separator/);
    expect(() => fromSentence('cats sit', req({ separator: '(', allowedSymbols: '(', minUppercase: 0, minSymbols: 2, minDigits: 0 }))).toThrow(/only allowed symbol is the separator/);
    const ok = fromSentence('tiny cats sit', req({ separator: '$', allowedSymbols: '$', minSymbols: 2 }), undefined, { rng: seeded(1) });
    for (const sg of ok.suggestions) {
      expect(sg.checks.every((c) => c.met)).toBe(true);
      expect(sg.password.endsWith('$')).toBe(false);
    }
  });

  it('never lets a swap produce the separator character, which the edge trim would remove', () => {
    const mappings: Mapping[] = [...BUILT_IN_MAPPINGS, { from: 's', to: ';', kind: 'symbol' }];
    for (let seed = 1; seed <= 6; seed++) {
      const r = fromSentence('minks buy a rat', req({ minLength: 15, maxLength: 15, separator: ';', twists: 2 }), undefined, { rng: seeded(seed), mappings });
      for (const sg of r.suggestions) {
        expect([...sg.password].length).toBe(15);
        expect(sg.password.includes(';;')).toBe(false);
      }
    }
  });

  it('turns a pasted paragraph into initials without enumerating every choice', () => {
    const paragraph = Array.from({ length: 200 }, (_, i) => ['river', 'otters', 'carry', 'bright', 'stones', 'home', 'under', 'quiet', 'skies'][i % 9]).join(' ');
    const started = performance.now();
    const r = fromSentence(paragraph, req({ initials: 3, minLength: 12, maxLength: 64, count: 1 }), { ...DEFAULT_SENTENCE_OPTIONS, allowDropping: true }, { rng: seeded(1) });
    expect(performance.now() - started).toBeLessThan(3000);
    expect(r.suggestions).toHaveLength(1);
    expect(upper(r.suggestions[0]!.password)).toBeGreaterThanOrEqual(1);
  });

  it('meets a symbol rule of 8 on long words quickly: at most three swaps per rule, closing marks for the rest', () => {
    const started = performance.now();
    const r = fromSentence('supercalifragilisticexpialidocious antidisestablishmentarianism', req({ minSymbols: 8, maxLength: 64 }), undefined, { rng: seeded(1) });
    expect(performance.now() - started).toBeLessThan(1500);
    for (const sg of r.suggestions) expect(sg.checks.every((c) => c.met)).toBe(true);
  });
});

describe('variety across a batch of one sentence', () => {
  it('ends passwords in different closing symbols, meets the digit rule by a swap or a number at either end, and varies the swaps', () => {
    const r = fromSentence(
      'my dog runs fast',
      req({ allowSpaces: true, separator: ' ', allowedSymbols: '!?.$#', minSymbols: 2, minDigits: 1, twists: 1, count: 20 }),
      undefined,
      { rng: seeded(8) },
    );
    expect(new Set(r.suggestions.map((s) => s.password)).size).toBeGreaterThanOrEqual(8); // not the same password over and over
    const endings = new Set(r.suggestions.map((s) => s.password.match(/[!?.$#]+$/)?.[0] ?? ''));
    expect(endings.size).toBeGreaterThanOrEqual(2);
    const inFront = r.suggestions.filter((s) => /^[0-9]/.test(s.hint)).length;
    const atEnd = r.suggestions.filter((s) => /[0-9]$/.test(s.hint)).length;
    const bySwap = r.suggestions.filter((s) => !/^[0-9]|[0-9]$/.test(s.hint)).length;
    expect(inFront).toBeGreaterThan(0);
    expect(atEnd).toBeGreaterThan(0);
    expect(bySwap).toBeGreaterThan(0);
    for (const s of r.suggestions) {
      expect(s.checks.every((c) => c.met)).toBe(true);
      expect(scoreCold(s.password, s.hint).bits).toBeGreaterThan(0); // the hint says where the number went
    }
  });
});

describe('deliberate swaps in your own sentence', () => {
  const plainOpts = { ...DEFAULT_SENTENCE_OPTIONS, shrink: 'none' as const, smallWordInitials: false };

  it('swaps the words kept whole, scored cold at zero bits, with the sentence kept as the hint', () => {
    const r = fromSentence('wise kids like cool bricks', req({ easeSwaps: true, twists: 0, minDigits: 0, minSymbols: 0, maxLength: 40, count: 3 }), plainOpts, { rng: seeded(3) });
    for (const s of r.suggestions) {
      expect(s.password.toLowerCase()).toBe('wyse;kyds;lyke;cul;brix');
      expect(s.hint).toBe('wise kids like cool bricks');
      const cold = scoreCold(s.password, s.hint);
      expect(cold.easedCount).toBe(5);
      expect(cold.twistCount).toBe(0);
      expect(s.bits).toBe(cold.bits);
      expect(s.bits).toBe(scoreCold('wise;kids;like;cool;bricks', s.hint).bits); // the same as the words unswapped
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
  });

  it('leaves shortened words, initials and numbers alone, and random swaps land on the swapped spelling', () => {
    const r = fromSentence('the wise kids carve 12 bricks', req({ easeSwaps: true, twists: 2, maxLength: 40, count: 5 }), { ...DEFAULT_SENTENCE_OPTIONS, shrinkFrom: 6 }, { rng: seeded(4) });
    for (const s of r.suggestions) {
      const cold = scoreCold(s.password, s.hint);
      expect(cold.aligned, `${s.password} / ${s.hint}`).toBe(true);
      expect(s.bits).toBe(cold.bits);
      expect(cold.words.find((w) => w.word === 'the')?.form).toBe('initial');
      expect(cold.words.find((w) => w.word === 'bricks')?.form).toBe('short'); // "brcks": shortened, so not swapped
      expect(cold.words.find((w) => w.word === 'kids')).toMatchObject({ form: 'eased', base: 'kyds' });
      expect(cold.words.find((w) => w.word === '12')?.form).toBe('number');
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
  });

  it('pads a short sentence after the swaps, to exactly the minimum, and the cold scorer still reads every word', () => {
    const r = fromSentence('cool kids', req({ easeSwaps: true, twists: 1, minLength: 24, maxLength: 40, count: 5 }), plainOpts, { rng: seeded(5) });
    for (const s of r.suggestions) {
      expect(s.password.length, s.password).toBe(24);
      expect(s.hint.startsWith('cool kids') || /^[0-9]+ cool kids/.test(s.hint), s.hint).toBe(true);
      const cold = scoreCold(s.password, s.hint);
      expect(cold.aligned, `${s.password} / ${s.hint}`).toBe(true);
      expect(cold.words.find((w) => w.word === 'cool')).toMatchObject({ form: 'eased', base: 'cul' });
      expect(s.bits).toBe(cold.bits);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
  });

  it('skips the swaps when they would leave too few letters for the uppercase rule', () => {
    // Swapped, "brix dux" has 7 letters; 8 capitals are needed, so the words stay as written.
    expect(`${easedText('bricks')} ${easedText('ducks')}`).toBe('brix dux');
    const r = fromSentence('bricks ducks', req({ easeSwaps: true, minUppercase: 8, minDigits: 0, minSymbols: 0, minLength: 1, twists: 0, count: 1 }), plainOpts, { rng: seeded() });
    expect(r.suggestions[0]!.password).toBe('BRICKS;DUCKS');
    expect(scoreCold('BRICKS;DUCKS', 'bricks ducks').easedCount).toBe(0);
  });
});

describe('a compressed state with a problem of its own', () => {
  const met = (r: ReturnType<typeof fromSentence>) => {
    expect(r.suggestions.length).toBeGreaterThan(0);
    for (const s of r.suggestions) expect(s.checks.every((c) => c.met), s.password).toBe(true);
  };

  it('no longer stops the search: a less compressed state with the capitals is used (it used to be refused)', () => {
    met(fromSentence('ducks', req({ minUppercase: 5, count: 3 }), undefined, { rng: seeded(2) }));
    met(fromSentence('big yellow ducks swim across the pond', req({ minUppercase: 5, maxLength: 14, count: 3 }), undefined, { rng: seeded(3) }));
  });

  it('no longer stops the search: with the separator the only symbol allowed, a state with enough separators is used', () => {
    const only = req({ allowedSymbols: ';', separator: ';', allowSpaces: false, minSymbols: 5, maxLength: 64, count: 3 });
    const r = fromSentence('jupiter brings five leds for piece today', only, undefined, { rng: seeded(4) });
    met(r);
    for (const s of r.suggestions) expect([...s.password].filter((c) => c === ';').length).toBeGreaterThanOrEqual(5);
    // Still refused, naming the separator, when no state has enough.
    expect(() => fromSentence('two words', { ...only, minSymbols: 4 }, undefined, { rng: seeded(4) })).toThrow(/only allowed symbol is the separator/);
  });
});

describe('a rule the most compressed state cannot meet', () => {
  const upper = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
  const allMet = (r: ReturnType<typeof fromSentence>) => {
    expect(r.suggestions.length).toBeGreaterThan(0);
    for (const sg of r.suggestions) for (const c of sg.checks) expect(c.met, `${sg.password}: ${c.rule}`).toBe(true);
  };

  it('fits "ducks" with 5 capitals required: the letters are in the uncompressed word', () => {
    // Padded to the 12-character minimum, then with no padding and a minimum the word itself can reach.
    const padded = fromSentence('ducks', { ...DEFAULT_REQUIREMENTS, minUppercase: 5, count: 3 }, undefined, { rng: seeded(1) });
    allMet(padded);
    for (const sg of padded.suggestions) expect(sg.password).toContain('DUCKS');
    const plain = fromSentence('ducks', req({ minUppercase: 5, minLength: 5 }), { ...DEFAULT_SENTENCE_OPTIONS, padding: false }, { rng: seeded(1) });
    allMet(plain);
    for (const sg of plain.suggestions) expect(sg.password).toContain('DUCKS');
    // A target the letters cannot reach is missed, with a warning, rather than refused.
    const targeted = fromSentence('ducks eat', req({ minUppercase: 7, minLength: 8 }), { ...DEFAULT_SENTENCE_OPTIONS, targetLength: 8 }, { rng: seeded(1) });
    allMet(targeted);
    for (const sg of targeted.suggestions) expect(upper(sg.password)).toBeGreaterThanOrEqual(7);
    expect(targeted.warnings.some((w) => /could not get down to 8/.test(w))).toBe(true);
    // One more capital than the sentence has letters is still refused.
    expect(() => fromSentence('ducks', req({ minUppercase: 6 }), undefined, { rng: seeded(1) })).toThrow(/does not have 6 letters to capitalise/);
  });

  it('never compresses away the letters the uppercase rule needs, dropping vowels included', () => {
    const word = (text: string) => ({ text, original: text, kind: 'word' as const, small: false });
    const states = (words: string[], minUppercase: number) =>
      [...compressions(words.map(word), req({ minUppercase }), DEFAULT_SENTENCE_OPTIONS)].map((st) => st.map((t) => t.text).join(' '));
    expect(states(['ducks'], 5)).toEqual(['ducks']);
    expect(states(['ducks'], 1)).toContain('dcks');
    for (const st of states(['ducks', 'eat', 'warm', 'bread'], 12)) expect(st.replace(/[^a-z]/g, '').length, st).toBeGreaterThanOrEqual(12);
  });

  it('keeps small words whole when their initials would leave too few letters for the uppercase rule', () => {
    const the = fromSentence('the', req({ minUppercase: 3, minLength: 1 }), undefined, { rng: seeded(1) });
    allMet(the);
    for (const sg of the.suggestions) expect(sg.password).toContain('THE');
    // The longest small word stays whole first: "for" keeps its three letters, "in" and "my" become initials.
    const three = fromSentence('for in my', req({ minUppercase: 5, minLength: 1 }), { ...DEFAULT_SENTENCE_OPTIONS, padding: false }, { rng: seeded(1) });
    allMet(three);
    for (const sg of three.suggestions) expect(sg.password).toMatch(/FOR.*I.*M/);
    const teach = fromSentence('or teach', req({ minUppercase: 7, minLength: 1 }), undefined, { rng: seeded(1) });
    allMet(teach);
    for (const sg of teach.suggestions) expect(sg.password).toMatch(/OR.TEACH/);
  });

  it('keeps the words whose separators the symbol rule needs when the separator is the only symbol allowed', () => {
    const onlySeparator = { allowedSymbols: ';', separator: ';', allowSpaces: false, minDigits: 0, minLength: 4 };
    // A target of 4 would drop words, and with them separators; three words (two separators) is the most compressed that keeps the rule.
    const two = fromSentence('ducks eat warm bread', req({ ...onlySeparator, minSymbols: 2 }), { ...DEFAULT_SENTENCE_OPTIONS, targetLength: 4 }, { rng: seeded(1) });
    allMet(two);
    for (const sg of two.suggestions) expect(sg.password.split(';')).toHaveLength(3);
    expect(two.warnings.some((w) => /could not get down to 4/.test(w))).toBe(true);
    const three = fromSentence('ducks eat warm bread', req({ ...onlySeparator, minSymbols: 3 }), { ...DEFAULT_SENTENCE_OPTIONS, targetLength: 6 }, { rng: seeded(1) });
    allMet(three);
    for (const sg of three.suggestions) expect(sg.password.split(';')).toHaveLength(4);
    // Four separators from four words cannot be had at any compression: refused, naming the separator.
    expect(() => fromSentence('ducks eat warm bread', req({ ...onlySeparator, minSymbols: 4 }), undefined, { rng: seeded(1) })).toThrow(/only allowed symbol is the separator/);
  });

  it('refuses a sentence only when no state meets every rule, across random sentences and rules', { timeout: 60_000 }, () => {
    const rng = seeded(11);
    const pick = <T,>(items: readonly T[], r: RandomSource): T => items[randomInt(items.length, r)]!;
    const small = ['a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'my', 'is'];
    for (let i = 0; i < 400; i++) {
      const n = 1 + randomInt(6, rng);
      const words = Array.from({ length: n }, () => (randomInt(4, rng) === 0 ? pick(small, rng) : pick([...ADJECTIVES, ...NOUNS, ...VERBS], rng)));
      if (randomInt(4, rng) === 0) words.push(String(randomInt(100, rng)));
      const sentence = words.join(' ');
      const letters = sentence.replace(/[^a-z]/g, '').length;
      // Every rule here can be met by some state: no more capitals than letters, and with the separator as the only
      // symbol, no more symbols than the separators between the words.
      const onlySeparator = randomInt(3, rng) === 0;
      const rules = req({
        minUppercase: Math.min(8, letters, 1 + randomInt(8, rng)),
        minLength: 1 + randomInt(16, rng),
        maxLength: 64,
        minSymbols: onlySeparator ? Math.min(n - 1, randomInt(3, rng)) : randomInt(3, rng),
        twists: randomInt(3, rng),
        initials: randomInt(3, rng),
        easeSwaps: randomInt(2, rng) === 1,
        ...(onlySeparator ? { allowedSymbols: ';', separator: ';', allowSpaces: false } : {}),
        count: 2,
      });
      const opts = {
        ...DEFAULT_SENTENCE_OPTIONS,
        shrink: pick<ShrinkStyle>(['none', 'vowels', 'ends'], rng),
        shrinkFrom: 3 + randomInt(5, rng),
        targetLength: randomInt(2, rng) ? null : Math.max(rules.minLength, 4 + randomInt(10, rng)),
      };
      let r;
      try {
        r = fromSentence(sentence, rules, opts, { rng: seeded(i) });
      } catch (e) {
        throw new Error(`${(e as Error).message}\n  sentence: ${JSON.stringify(sentence)}\n  req: ${JSON.stringify(rules)}\n  opts: ${JSON.stringify(opts)}`);
      }
      allMet(r);
    }
  });
});

describe('a lowercase minimum and the common-password rule', () => {
  const plain = { ...DEFAULT_SENTENCE_OPTIONS, padding: false, shrink: 'none' as const };

  it('never passes "DUCKS" off as meeting a lowercase rule: five capitals and a lowercase letter need six characters', () => {
    const r = req({ minLength: 5, maxLength: 5, minUppercase: 5, minLowercase: 1, minDigits: 0, minSymbols: 0, twists: 0, includeNumber: false });
    expect(() => fromSentence('ducks', r, plain, { rng: seeded(1) })).toThrow(RequirementsError);
  });

  it('refuses a sentence whose capitals leave too few lowercase letters, saying why', () => {
    const r = req({ minLength: 5, maxLength: 20, minUppercase: 5, minLowercase: 6, minDigits: 0, minSymbols: 0, twists: 0, includeNumber: false, separator: ' ' });
    expect(() => fromSentence('ducks quack', r, plain, { rng: seeded(1) })).toThrow(/lowercase letters beside its 5 capitals/);
  });

  it('refuses a sentence that comes out as one of the most common passwords', () => {
    const r = req({ minLength: 8, maxLength: 8, minUppercase: 0, minDigits: 0, minSymbols: 0, twists: 0, includeNumber: false, easeSwaps: false });
    expect(() => fromSentence('password', r, plain, { rng: seeded(1) })).toThrow(/Your sentence makes "password"\. Not allowed: number 1 of the 10,001 most common passwords/);
  });
});
