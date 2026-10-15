import { describe, expect, it } from 'vitest';
import { applyRepeat, describeFluff, digitsOf, planFluff, smallestFactor, totalTagNumber, type FluffInputs } from './fluff';
import { seeded } from './testRandom';

const WORDS = ['cat', 'dogs', 'otter', 'rabbit', 'badgers', 'penguins'];
const inputs = (over: Partial<FluffInputs>): FluffInputs => ({
  length: 40,
  min: 50,
  max: 64,
  separator: ';',
  tag: 'total',
  totalSymbol: '%',
  factorSymbol: '@',
  mark: '!',
  words: WORDS,
  rng: seeded(),
  ...over,
});
const text = (plan: ReturnType<typeof planFluff>) => plan!.pieces.map((p) => p.text).join('|');

describe('length tags are solved, not retried', () => {
  it('states the finished total: 47 characters get %50, never %50 on a 50-character password', () => {
    expect(totalTagNumber(47)).toBe(50);
    expect(totalTagNumber(48)).toBe(51);
    expect(totalTagNumber(7)).toBe(9);
    expect(totalTagNumber(8)).toBe(11); // "%9" would make 10, "%10" makes 11
    expect(totalTagNumber(96)).toBe(99);
    expect(totalTagNumber(97)).toBe(101);
    for (let L = 1; L < 200; L++) {
      const n = totalTagNumber(L);
      expect(n).toBe(L + 1 + digitsOf(n));
    }
  });

  it('finds the smallest factor', () => {
    expect(smallestFactor(18)).toBe(2);
    expect(smallestFactor(21)).toBe(3);
    expect(smallestFactor(47)).toBe(47);
  });
});

describe('planFluff', () => {
  it('does nothing when nothing is missing', () => {
    expect(planFluff(inputs({ length: 50 }))).toBeUndefined();
    expect(planFluff(inputs({ length: 60 }))).toBeUndefined();
  });

  it('lands exactly on the minimum with a total tag last', () => {
    const plan = planFluff(inputs({ length: 47 }))!;
    expect(text(plan)).toBe('%50');
    expect(plan.total).toBe(50);
    const bigger = planFluff(inputs({ length: 40 }))!;
    expect(bigger.total).toBe(50);
    expect(bigger.pieces.at(-1)).toMatchObject({ kind: 'tag', text: '%50', number: 50 });
    // 10 short, tag takes 3, a word of 6 plus its separator takes the other 7.
    expect(bigger.pieces[0]).toMatchObject({ kind: 'word', text: 'rabbit' });
  });

  it('lets the tag alone cover a gap smaller than itself, stating the true total, unless the maximum forbids it', () => {
    expect(text(planFluff(inputs({ length: 48 }))!)).toBe('%51');
    expect(planFluff(inputs({ length: 48 }))!.total).toBe(51);
    const capped = planFluff(inputs({ length: 48, max: 50 }))!;
    expect(text(capped)).toBe('!!');
    expect(capped.total).toBe(50);
  });

  it('uses a factor tag whose number divides everything before it', () => {
    const plan = planFluff(inputs({ length: 10, min: 20, tag: 'factor', words: [] }))!;
    expect(plan.total).toBe(20);
    const tag = plan.pieces.at(-1)!;
    expect(tag.kind).toBe('tag');
    expect((20 - tag.text.length) % tag.number!).toBe(0);
    // A prime left side still works: the number is the length itself.
    const prime = planFluff(inputs({ length: 20, min: 23, tag: 'factor', words: [], mark: undefined }))!;
    const t = prime.pieces.at(-1)!;
    expect((prime.total - t.text.length) % t.number!).toBe(0);
  });

  it('adds whole words only when more than 3 short, repeats before digits, marks last', () => {
    const three = planFluff(inputs({ length: 47, tag: 'none', repeatable: { tokenIndex: 1, char: '3' } }))!;
    expect(three.pieces.map((p) => p.kind)).toEqual(['repeat']);
    expect(three.total).toBe(50);
    const seven = planFluff(inputs({ length: 43, tag: 'none', words: [] }))!;
    expect(seven.pieces.map((p) => p.kind)).toEqual(['sequence', 'marks']);
    expect(seven.total).toBe(50);
    const noMarks = planFluff(inputs({ length: 49, tag: 'none', mark: undefined, words: [] }))!;
    expect(noMarks.total).toBe(51); // a one-character gap with a one-character separator: overshoot by one is the only option
    expect(planFluff(inputs({ length: 49, tag: 'none', mark: undefined, words: [], max: 50 }))).toBeUndefined();
  });

  it('applies repeats inside the word and describes the plan', () => {
    expect(applyRepeat('$t33l', '3', '333')).toBe('$t33333l');
    expect(applyRepeat('abc', 'z', 'zz')).toBe('abczz');
    const plan = planFluff(inputs({ length: 40 }))!;
    expect(describeFluff(plan, 50)).toMatch(/padded to the 50-character minimum with the word “rabbit”, “%50” \(the whole password is 50 characters\)/);
  });
});

describe('total tags at a power-of-ten minimum', () => {
  it('never states a number under the minimum: a 7-character body under a minimum of 10 gets %10, not %9', () => {
    expect(totalTagNumber(7, 10)).toBe(10);
    expect(totalTagNumber(7)).toBe(9); // without a minimum, the smallest number that works
    expect(totalTagNumber(96, 100)).toBe(100);
    expect(totalTagNumber(97, 100)).toBe(101);
    const plan = planFluff({ length: 7, min: 10, max: 32, separator: ';', tag: 'total', totalSymbol: '%', factorSymbol: '@', mark: '!', words: [], rng: seeded(1) });
    expect(plan?.total).toBe(10);
    expect(plan?.pieces.at(-1)?.text).toBe('%10');
  });
});
