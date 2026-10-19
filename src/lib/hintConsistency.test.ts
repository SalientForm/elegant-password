// The "Test a password" field scores a password with no hint from the text
// alone (scoreAlone) and with a hint from the cold scorer (scoreCold). The
// password is the same either way, so its strength (bits) and difficulty
// (every typing mode) must be the same either way. Memorability needs the
// hint and is not compared here.
//
// The hint in each case is the password's own words: what a user would type
// in the field's Hint box for a password they entered by hand.
//
// And a hint can only help an attacker: whatever the hint says, the strength
// with it is never above the strength of the password alone. Words in the
// hint that are not in the password add nothing, and a hint that reveals a
// swapped or shortened word is capped at the text reading.

import { describe, expect, it } from 'vitest';
import { difficultyIn, TYPING_MODE_IDS } from './difficulty';
import { DEFAULT_REQUIREMENTS, generate, STRENGTH_PRESETS } from './generate';
import { pools } from './grammar';
import { scoreAlone, scoreCold } from './score';
import { seeded } from './testRandom';

/** What the field shows without a hint. */
const withoutHint = (password: string) => {
  const alone = scoreAlone(password);
  return { bits: alone.bits, difficulty: TYPING_MODE_IDS.map((mode) => difficultyIn(password, alone.difficulty, mode).score) };
};

/** What the field shows with a hint. */
const withHint = (password: string, hint: string) => {
  const cold = scoreCold(password, hint);
  return { bits: cold.bits, difficulty: TYPING_MODE_IDS.map((mode) => difficultyIn(password, cold.difficulty, mode).score) };
};

const expectSame = (password: string, hint: string) => {
  const a = withoutHint(password);
  const b = withHint(password, hint);
  expect(a.bits, `bits for ${password} / "${hint}"`).toBeCloseTo(b.bits, 6);
  expect(a.difficulty, `difficulty (${TYPING_MODE_IDS.join(', ')}) for ${password} / "${hint}"`).toEqual(b.difficulty);
};

// 50 hard-coded passwords, each with its natural hint.
const CASES: [password: string, hint: string][] = [
  // Plain words from the tool's lists, separators and closing marks
  ['Sleepy;otters;paint;7;boats!!', 'sleepy otters paint 7 boats'],
  ['Sally;eats;sweets', 'Sally eats sweets'],
  ['Blue-tiger-42', 'blue tiger 42'],
  ['Happy.cats.dance.3', 'happy cats dance 3'],
  ['quiet_rivers_flow_9', 'quiet rivers flow 9'],
  ['Brave;knights;ride;home;8!', 'brave knights ride home 8'],
  ['Tiny,frogs,hop,quickly,5?', 'tiny frogs hop quickly 5'],
  ['Green.apples.fall.12.', 'green apples fall 12'],
  ['Old;dogs;sleep;late;6', 'old dogs sleep late 6'],
  ['Wild;geese;fly;south;21!', 'wild geese fly south 21'],
  // Capitalised every word, or none
  ['Red;Foxes;Run;Fast;4', 'red foxes run fast 4'],
  ['red;foxes;run;fast;4', 'red foxes run fast 4'],
  ['RED;FOXES;RUN;FAST;4', 'red foxes run fast 4'],
  // Number first, in the middle, last
  ['77;silver;spoons;shine', '77 silver spoons shine'],
  ['silver;77;spoons;shine', 'silver 77 spoons shine'],
  ['silver;spoons;shine;77', 'silver spoons shine 77'],
  // Memorable and free digit runs
  ['Cold;winds;blow;1234', 'cold winds blow 1234'],
  ['Cold;winds;blow;8402', 'cold winds blow 8402'],
  ['Cold;winds;blow;7777', 'cold winds blow 7777'],
  ['Cold;winds;blow;2468', 'cold winds blow 2468'],
  // No separators at all
  ['SleepyOttersPaint7Boats', 'sleepy otters paint 7 boats'],
  ['bluetiger42', 'bluetiger 42'],
  ['BlueTiger42', 'blue tiger 42'],
  // Spaces as separators
  ['sleepy otters paint 7 boats', 'sleepy otters paint 7 boats'],
  ['Brave knights ride home 8', 'brave knights ride home 8'],
  // Words on no list (English-like text)
  ['xqzv;plork;99', 'xqzv plork 99'],
  ['Zorblat;Quixing;31!', 'zorblat quixing 31'],
  ['Mxyzptlk', 'mxyzptlk'],
  ['correct;horse;battery;staple', 'correct horse battery staple'],
  ['Tr0ub4dor', 'tr 0 ub 4 dor'],
  // Mixed list words and made-up words
  ['Sleepy;zorblat;paint;7', 'sleepy zorblat paint 7'],
  ['Flimbo;eats;sweets;3', 'flimbo eats sweets 3'],
  // Repeated and varied symbol runs
  ['Sally;eats;sweets!!!!', 'Sally eats sweets'],
  ['Sally;eats;sweets!@#$', 'Sally eats sweets'],
  ['!!Sally;eats;sweets', 'Sally eats sweets'],
  ['Sally;;eats;;sweets', 'Sally eats sweets'],
  ['Sally;eats;sweets;', 'Sally eats sweets'],
  ['Sally;eats;sweets;%50', 'Sally eats sweets 50'],
  // Short passwords
  ['cat', 'cat'],
  ['cat1', 'cat 1'],
  ['a', 'a'],
  ['42', '42'],
  ['Hi!', 'hi'],
  // Long passwords
  ['Thirteen;worthy;storks;openly;pet;twisty;toys;13', 'thirteen worthy storks openly pet twisty toys 13'],
  ['Many;small;quiet;brown;foxes;jump;over;lazy;dogs;2026', 'many small quiet brown foxes jump over lazy dogs 2026'],
  // Two-word and three-word sentences with "and"
  ['Cats;and;dogs;7', 'cats and dogs 7'],
  ['Salt;and;pepper', 'salt and pepper'],
  // Accented and non-ASCII text
  ['naïve;otters', 'naive otters'],
  ['café;au;lait;9', 'cafe au lait 9'],
  ['日本;otters;5', 'otters 5'],
];

describe('the test field scores a password the same with and without its hint', () => {
  it('has 50 hard-coded cases', () => {
    expect(CASES).toHaveLength(50);
  });

  for (const [password, hint] of CASES) {
    it(`${password} / "${hint}"`, () => expectSame(password, hint));
  }

  // 10 random passwords made at runtime from the tool's own word lists, a number, a separator and a closing mark.
  const SEPARATORS = [';', '.', '-', ',', '_', '', ' '];
  const CLOSERS = ['', '!', '?', '.', '!!', '#'];
  const rng = seeded(Date.now() >>> 0);
  const pick = <T,>(list: readonly T[]) => list[rng.uint32() % list.length]!;
  const relaxed = pools('relaxed', 1);
  const randomCases: [string, string][] = Array.from({ length: 10 }, () => {
    const count = 2 + (rng.uint32() % 5);
    const slots = ['adj', 'noun', 'verb', 'adv', 'end', 'prep'] as const;
    const words = Array.from({ length: count }, () => pick(relaxed[pick(slots)]));
    const number = String(rng.uint32() % 10000);
    const at = rng.uint32() % (count + 1);
    const tokens = [...words.slice(0, at), number, ...words.slice(at)];
    const separator = pick(SEPARATORS);
    // With no separator every word is capitalised, or the password itself would not say where one word ends ("nearclocks").
    const cased = tokens.map((t, i) => (separator === '' || rng.uint32() % 3 === 0 || i === 0 ? t[0]!.toUpperCase() + t.slice(1) : t));
    const password = cased.join(separator) + pick(CLOSERS);
    return [password, tokens.join(' ')];
  });

  for (const [password, hint] of randomCases) {
    it(`random: ${password} / "${hint}"`, () => expectSame(password, hint));
  }

  describe('a hint never raises the strength above the password alone', () => {
    /** Hints a user might type for a password: its own words, and wrong, partial, reordered or padded ones. */
    const variants = (hint: string) => {
      const words = hint.split(' ');
      return [hint, `${hint} elephants`, `giant ${hint}`, words.slice(1).join(' ') || 'x', [...words].reverse().join(' '), 'completely unrelated hint 99', `${hint} ${hint}`];
    };
    const expectNeverAbove = (password: string, hint: string) => {
      const ceiling = withoutHint(password).bits;
      for (const h of variants(hint)) expect(scoreCold(password, h).bits, `${password} / "${h}"`).toBeLessThanOrEqual(ceiling + 1e-9);
    };

    for (const [password, hint] of CASES) {
      it(`${password} / "${hint}" and six variations`, () => expectNeverAbove(password, hint));
    }
    for (const [password, hint] of randomCases) {
      it(`random: ${password} / "${hint}" and six variations`, () => expectNeverAbove(password, hint));
    }

    it('words in the hint that are not in the password add nothing', () => {
      const alone = scoreAlone('Sleepy;otters').bits;
      // The two words that are there, however many the hint names.
      expect(scoreCold('Sleepy;otters', 'sleepy otters paint 7 boats').bits).toBeLessThanOrEqual(alone);
      expect(scoreCold('Sleepy;otters', 'sleepy otters paint 7 boats').bits).toBeCloseTo(alone, 6);
      // A hint that describes none of the password leaves the text reading.
      expect(scoreCold('Sleepy;otters', 'otters paint 7 boats').bits).toBeCloseTo(alone, 6);
      expect(scoreCold('Sleepy;otters', 'otters paint 7 boats').leftoverBits).toBeGreaterThan(0);
    });

    it('a hint that reveals a swapped or shortened word is capped at the text reading', () => {
      for (const [password, hint] of [
        ['T!ger42', 'tiger 42'],
        ['Jptr;Wyse;42!', 'jupiter wise 42'],
        ['Sl33py;0tters;paint;7;boats!!', 'sleepy otters paint 7 boats'],
        ['T;otrs;e@t;T;salad;A;no0n;4', 'the otters eat their salad at noon 4'],
      ] as const) {
        const cold = scoreCold(password, hint);
        expect(cold.bits, password).toBeLessThanOrEqual(scoreAlone(password).bits + 1e-9);
        expect(cold.textBits).toBeCloseTo(scoreAlone(password).bits, 6);
      }
    });

    it('holds for generated passwords with their own hints, and leaves made-up cards alone', () => {
      const rng = seeded(0xc0ffee);
      let cards = 0;
      let capped = 0;
      for (const preset of STRENGTH_PRESETS) {
        for (let n = 0; n < 12; n++) {
          const r = generate({ ...DEFAULT_REQUIREMENTS, targetBits: preset.bits, easeSwaps: n % 2 === 1 }, { rng });
          for (const s of r.suggestions) {
            cards++;
            const cold = scoreCold(s.password, s.hint);
            expect(cold.bits, `${s.password} / "${s.hint}"`).toBeLessThanOrEqual(scoreAlone(s.password).bits + 1e-9);
            if (cold.capped) capped++;
          }
        }
      }
      expect(cards).toBeGreaterThan(50);
      // The text reading recovers a card's swaps from the mapping table, so the ceiling only rarely bites.
      expect(capped / cards).toBeLessThan(0.05);
    });
  });
});
