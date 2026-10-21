import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate, type Requirements } from './generate';
import { fromSentence } from './fromSentence';
import { difficultyAlone, editMatch, editsToTry, inferredHint, scoreCold, twistsToTry, wordBitsFromText } from './score';
import { BUILT_IN_MAPPINGS, twistOutcomes, type Mapping } from './twists';
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
    // The same password with a hint that describes none of it falls back to the text reading, never more. The hint is
    // part of the input, nothing else is.
    const wrong = scoreCold(password, 'something else entirely');
    expect(wrong.bits).toBeLessThanOrEqual(a.bits);
    expect(wrong.words.every((w) => w.form === 'dropped')).toBe(true);
    expect(wrong.bits).toBeCloseTo(wrong.textBits, 9);
    expect(wrong.leftoverBits).toBeGreaterThan(0);
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
    expect(s.sentenceBits).toBeCloseTo((4 + 5 + 10) * 2.3, 5); // "zz" counts once
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
    // The hint reveals whole words the password only hints at ("jr" for jupiter): the figure with it is capped at the
    // text reading, which an attacker without the hint faces at most.
    expect(s.capped).toBe(true);
    expect(s.bits).toBeCloseTo(s.textBits, 9);
    expect(s.bits).toBeCloseTo(scoreCold('jr;B;5ls;Fpc', inferredHint('jr;B;5ls;Fpc')).bits, 9);
    expect(s.bits).toBeLessThan(s.sentenceBits + Math.log2(4));
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

  it('counts the start of the word with the capital as protected wherever it is', () => {
    const hint = 'smoky stags stuff 8 scary apples';
    const s = scoreCold('smoky;stagz;stuff;8;5cary;Appl3s', hint);
    const bases = s.words.map((w) => w.base);
    const count = (capitalAt: number) =>
      twistOutcomes(bases, { count: 3, mappings: BUILT_IN_MAPPINGS, skip: (i) => i === 3, capitalAt, minDelta: -Infinity, maxDelta: Infinity }, 3);
    expect(s.twistCount).toBe(3);
    expect(count(5)).not.toBe(count(0));
    expect(s.twistOptions).toBe(count(5)); // "Apples" took the capital, so its "a" was never swapped; "smoky"'s "s" could have been
    expect(scoreCold('Smoky;stagz;stuff;8;5cary;appl3s', hint).twistOptions).toBe(count(0));
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
    expect(scoreCold('x', '').bits).toBeCloseTo(Math.log2(26), 9); // no hint word at all: the one letter is scored as text
    expect(scoreCold('', '').bits).toBe(0);
  });

  it('agrees with sentence mode, which uses it for every card', () => {
    const r = fromSentence('the otters eat their salad at noon', req({ minDigits: 2, minSymbols: 3, twists: 2, count: 5 }), undefined, { rng: seeded(6) });
    for (const s of r.suggestions) {
      const cold = scoreCold(s.password, s.hint);
      expect(s.hint.replace(/^[0-9]+ | [0-9]+$/, '')).toBe('the otters eat their salad at noon'); // a number for the digit rule may join the hint at either end
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

describe('the hint read off the text (inferredHint), the ceiling for the bits', () => {
  it('reads each run as a word, a capital after a lower-case letter as a new one, a run of digits as a number', () => {
    expect(inferredHint('Sleepy;otters;paint;7;boats!!')).toBe('sleepy otters paint 7 boats'); // separators and closing marks are the tool's choices
    expect(inferredHint('BlueTiger42')).toBe('blue tiger 42');
    expect(inferredHint('bluetiger42')).toBe('bluetiger 42');
    expect(inferredHint('RED;FOXES;RUN')).toBe('red foxes run');
    expect(inferredHint('naïve;otters')).toBe('naive otters');
    expect(inferredHint('!!@@##')).toBe('');
  });

  it('reads a swapped spelling back to its word through the mapping table', () => {
    expect(inferredHint('Sm@rt;turtles;salut3;#yenas')).toBe('smart turtles salute hyenas'); // symbol and digit swaps
    expect(inferredHint('Hils;f1ll;96;hamsters')).toBe('hills fill 96 hamsters'); // a misspelling, and a number stays a number
    expect(inferredHint('Jugs;spur;32;tu2rz')).toBe('jugs spur 32 tutors'); // two swaps in one word
    expect(inferredHint('no0n;4')).toBe('noon 4'); // a word on no list still has its swap undone; "4" is not "for"
    expect(inferredHint('T!ger42')).toBe('tiger 42');
    expect(inferredHint('Sally;eats;sweets!!')).toBe('sally eats sweets'); // closing marks are not swaps
    expect(inferredHint('Sally!eats!sweets')).toBe('sally eats sweets'); // a twist symbol used as a separator
    const swapped = scoreCold('Sm@rt;turtles;salut3;#yenas', inferredHint('Sm@rt;turtles;salut3;#yenas'));
    expect(swapped.difficulty.measurements.chunks).toBe(7); // four words and three swaps
    expect(difficultyAlone('Sm@rt;turtles;salut3;#yenas')).toEqual(swapped.difficulty);
  });

  it('never puts the bits with a hint above the password\'s own text reading, whatever the hint says', () => {
    const cases: [string, string][] = [
      ['Sleepy;otters;paint;7;boats!!', 'sleepy otters paint 7 boats'],
      ['jr;B;5ls;Fpc', 'jupiter brings 5 leds for piece'],
      ['Cats;dogs', 'cats and dogs and owls'],
      ['Tr0ub4dor', 'troubadour'],
      ['Sally;eats;sweets', 'something else entirely'],
    ];
    for (const [password, hint] of cases) {
      const own = scoreCold(password, inferredHint(password)).bits;
      expect(scoreCold(password, hint).bits, `${password} / ${hint}`).toBeLessThanOrEqual(own + 1e-9);
    }
  });

  it('counts a repeated letter once in the text reading, so a run of one letter is one letter', () => {
    const run = scoreCold('aaaaaaaaaaaa', 'aaaaaaaaaaaa');
    expect(run.bits).toBeCloseTo(Math.log2(26), 9);
    expect(scoreCold('xqzv', 'xqzv').bits).toBeCloseTo(4 * 2.3, 9);
    expect(scoreCold('xqqqzv', 'xqqqzv').bits).toBeCloseTo(4 * 2.3, 9);
  });
});

describe('a custom swap, and the session\'s swap list', () => {
  const session: readonly Mapping[] = [...BUILT_IN_MAPPINGS, { from: 'e', to: 'q', kind: 'custom' }];

  it('reads a word reached through a swap the built-in table does not know as the word, one step away, not as dropped', () => {
    const s = scoreCold('63;Rqmote;thiqves;chip;fqrns', '63 remote thieves chip ferns');
    expect(s.words.map((w) => `${w.form}:${w.text}:${w.twists}`)).toEqual(['number:63:0', 'word:Rqmote:1', 'word:thiqves:1', 'word:chip:0', 'word:fqrns:1']);
    expect(s.aligned).toBe(true);
    expect(s.memorability.fidelity).toBe(1);
    expect(s.memorability.swappedWords).toBe(3);
    expect(s.difficulty.measurements.chunks).toBe(5 + 3);
  });

  it('counts where the swaps could have landed over the list in force: one custom swap makes 65, not 64', () => {
    const builtIn = scoreCold('Big;rqd;apples', 'big red apples');
    const inSession = scoreCold('Big;rqd;apples', 'big red apples', session);
    expect(builtIn.twistCount).toBe(1);
    expect(inSession.twistOptions).toBeGreaterThan(builtIn.twistOptions);
    expect(inSession.bits).toBeGreaterThan(builtIn.bits);
    // Only the bits see the list: memorability and difficulty are the same wherever the password appears.
    expect(inSession.memorability).toEqual(builtIn.memorability);
    expect(inSession.difficulty).toEqual(builtIn.difficulty);
    expect(inSession.words).toEqual(builtIn.words);
  });

  it('bounds the edits by the word\'s length, so a short word is not read into anything', () => {
    expect([2, 3, 6, 9, 12, 20].map(editsToTry)).toEqual([0, 1, 2, 3, 2, 1]);
    expect(scoreCold('Dog', 'cat').words[0]!.form).toBe('dropped');
    expect(editMatch('rqmote;x', 'remote', 3)).toEqual({ length: 6, edits: 1 });
    expect(editMatch('remot;x', 'remote', 3)).toEqual({ length: 5, edits: 1 }); // a letter removed
    expect(editMatch('reemote;x', 'remote', 3)).toEqual({ length: 7, edits: 1 }); // a letter added
    expect(editMatch('xyzxyz', 'remote', 3)).toBeUndefined();
    expect(editMatch('remote', 'remote', 0)).toBeUndefined(); // no edits allowed: the exact forms handle that
  });

  it('prefers the table\'s reading, and a shortened form, over an edit', () => {
    expect(scoreCold('Sm@rt', 'smart').words[0]).toMatchObject({ form: 'word', twists: 1, text: 'Sm@rt' }); // a>@ is in the table either way
    expect(scoreCold('jr;B', 'jupiter brings').words[0]).toMatchObject({ form: 'short', twists: 0, text: 'jr' }); // not "jupiter" with five edits
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

describe('characters off the US keyboard', () => {
  it('scores pasted text with accents, currency signs or tabs instead of throwing', () => {
    for (const text of ['café', '£12', '€uro', 'naïve;otters', 'tab\there', '日本', '😀sweets']) {
      const alone = scoreCold(text, inferredHint(text));
      expect(Number.isFinite(alone.bits)).toBe(true);
      expect(alone.difficulty.score).toBeGreaterThanOrEqual(0);
    }
    expect(scoreCold('😀sweets', 'sweets').leftoverBits).toBe(0); // the emoji is not a stray letter
    const cold = scoreCold('naïve;otters', 'naive otters');
    expect(Number.isFinite(cold.bits)).toBe(true);
    expect(cold.memorability.score).toBeGreaterThanOrEqual(0);
  });

  it('charges such a character as a shifted press of the key furthest from home', () => {
    expect(pressFor('é')).toEqual(OFF_MODEL_PRESS);
    expect(OFF_MODEL_PRESS.shifted).toBe(true);
    expect(pressFor('é').key).toBe(lookupKey('`')!.key);
    expect(difficultyAlone('cafe').score).toBeLessThan(difficultyAlone('café').score); // it costs more, never nothing
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

describe('deliberate swaps in cold scoring', () => {
  const hint = '13 wise kids openly pet twisty toys';
  const plain = '13;Wise;kids;openly;pet;twisty;toys';
  const eased = '13;Wyse;kyds;openly;pet;twysty;toys';
  const outcomes = (bases: string[], count: number) =>
    twistOutcomes(bases, { count, mappings: BUILT_IN_MAPPINGS, skip: (i) => i === 0, capitalAt: 1, minDelta: -Infinity, maxDelta: Infinity }, count);

  it('recognises a deliberate swap from the hint alone and counts it as zero bits', () => {
    const a = scoreCold(plain, hint);
    const b = scoreCold(eased, hint);
    expect(b.words.filter((w) => w.form === 'eased').map((w) => `${w.word}:${w.text}`)).toEqual(['wise:Wyse', 'kids:kyds', 'twisty:twysty']);
    expect(b.easedCount).toBe(3);
    expect(b.twistCount).toBe(0);
    expect(b.twistBits).toBe(0);
    expect(b.template).toEqual(a.template);
    expect(b.sentenceBits).toBe(a.sentenceBits);
    expect(b.bits).toBe(a.bits);
    expect(scoreCold(eased, hint)).toEqual(b); // pure
  });

  it('never reads a deliberate swap as a random one, which would overstate the bits', () => {
    // "i>y" is also a built-in random swap: read that way, the same text would claim this many outcomes.
    expect(outcomes(['13', 'wise', 'kids', 'openly', 'pet', 'twisty', 'toys'], 3)).toBeGreaterThan(1000);
    expect(scoreCold(eased, hint).twistOptions).toBe(1);
  });

  it('counts random swaps on top from the deliberate spelling, as the generator places them', () => {
    const s = scoreCold('13;Wyse;kyd$;openly;pet;twysty;toys', hint);
    expect(s.words[2]).toMatchObject({ word: 'kids', form: 'eased', base: 'kyds', text: 'kyd$', twists: 1 });
    expect(s.easedCount).toBe(3);
    expect(s.twistCount).toBe(1);
    const expected = outcomes(['13', 'wyse', 'kyds', 'openly', 'pet', 'twysty', 'toys'], 1);
    expect(s.twistOptions).toBe(expected);
    expect(s.bits).toBeCloseTo(scoreCold(eased, hint).bits + Math.log2(expected), 9);
  });

  it('credits the easier typing in difficulty, and charges no memory load or memorability for the swaps', () => {
    const a = scoreCold(plain, hint);
    const b = scoreCold(eased, hint);
    expect(b.difficulty.measurements.sameFingerPer10).toBeLessThan(a.difficulty.measurements.sameFingerPer10);
    expect(b.difficulty.measurements.seconds).toBeLessThan(a.difficulty.measurements.seconds);
    expect(b.difficulty.measurements.chunks).toBe(a.difficulty.measurements.chunks); // the swaps come with their words
    expect(b.difficulty.score).toBeLessThan(a.difficulty.score);
    expect(b.memorability).toEqual(a.memorability);
    expect(b.memorability.swappedWords).toBe(0);
  });

  it('counts a word made shorter by its deliberate swap as kept whole, and still charges random swaps on top', () => {
    const h = 'cool kids lift bricks';
    const plainCold = scoreCold('Cool;kids;lift;bricks', h);
    const easedCold = scoreCold('Cul;kyds;lift;brix', h);
    expect(easedCold.words.filter((w) => w.form === 'eased').map((w) => w.base)).toEqual(['cul', 'kyds', 'brix']);
    expect(easedCold.memorability).toMatchObject({ sameSize: 4, fidelity: 1, swappedWords: 0 });
    expect(easedCold.memorability.score).toBeGreaterThanOrEqual(plainCold.memorability.score); // shorter, and nothing lost
    expect(easedCold.difficulty.measurements.chunks).toBe(4);
    const twisted = scoreCold('Cul;kyd$;lift;brix', h);
    expect(twisted.memorability).toMatchObject({ fidelity: 1, swappedWords: 1 });
    expect(twisted.memorability.score).toBe(easedCold.memorability.score - 5);
    expect(twisted.difficulty.measurements.chunks).toBe(5);
    expect(scoreCold('Cul;kyds;lift;brix', h)).toEqual(easedCold); // pure
  });

  it('never scores above the pools a sentence came from, with the setting on or off', () => {
    for (const easeSwaps of [false, true]) {
      for (const comfort of ['strict', 'balanced', 'relaxed'] as const) {
        const r = generate(req({ comfort, easeSwaps, twists: 0, maxLength: 80, count: 10 }), { rng: seeded(14) });
        const unconstrained = r.plan.bits + r.plan.lengthPenaltyBits;
        for (const s of r.suggestions) {
          const cold = scoreCold(s.password, s.hint);
          expect(cold.template, s.hint).toBeDefined();
          expect(cold.twistCount, s.password).toBe(0);
          expect(cold.sentenceBits).toBeLessThanOrEqual(unconstrained + 1e-6);
        }
      }
    }
  });
});
