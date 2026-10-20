import { describe, expect, it } from 'vitest';
import { changedWordsOf, easedIn, easedLine, separatorPhrase, shiftReasons, twistLine, twistOptionsLine, typingLines } from './explain';
import { DEFAULT_REQUIREMENTS, generate } from './generate';
import { scoreCold } from './score';
import { seeded } from './testRandom';

describe('the "Why?" sentences', () => {
  it('say why Shift is pressed', () => {
    // The words carry no case (capitals go on at render), so the case is read from the password.
    const w = (...texts: string[]) => texts.map((text) => ({ text }));
    expect(shiftReasons('Sleepy otters!', w('sleepy', 'otters'))).toBe('the opening capital and "!"');
    expect(shiftReasons('SLEEPY otters', w('sleepy', 'otters'))).toBe('held once for the word in capitals (SLEEPY)');
    expect(shiftReasons('B C otters', w('B', 'C', 'otters'))).toBe('2 capital initials');
    expect(shiftReasons('5 iop dab CVB', w('5', 'iop', 'dab', 'CVB'))).toBe('held once for the word in capitals (CVB)'); // a made-up noun in capitals, no opening capital
    expect(shiftReasons('Ffancy;puffs', w('F', 'fancy', 'puffs'))).toBe('1 capital initial'); // glued to the next word, still an initial
    expect(shiftReasons('Red;Foxes;Run', w('red', 'foxes', 'run'))).toBe('capitals on 3 words');
    expect(shiftReasons('abc', w('abc'))).toBe('');
  });

  it('say what the separator does', () => {
    expect(separatorPhrase(' ')).toBe('Spaces between words go to your thumb, so your fingers never leave the letters.');
    expect(separatorPhrase('')).toBe('Words run together with no separator keys at all.');
    expect(separatorPhrase(';')).toBe('Words are joined with ";", the same key every time, so it becomes a rhythm.');
    expect(separatorPhrase('-')).toMatch(/It is a pinky stretch, kept because you chose it\.$/);
  });

  it('give five "Fast to type" lines for any suggestion, the separator\'s last', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, count: 3 }, { rng: seeded(3) });
    for (const s of r.suggestions) {
      const lines = typingLines(s, { separator: r.plan.separator });
      expect(lines).toHaveLength(5);
      expect(lines[1]).toMatch(/^\d+% of letter-to-letter moves stay on the same keyboard row\.$/);
      expect(lines[4]).toBe(separatorPhrase(r.plan.separator));
    }
  });

  it('read deliberate swaps from the password and hint, and word them', () => {
    const eased = easedIn('wyse owls', 'wise owls');
    expect(eased.map((e) => e.word)).toEqual(['wise']);
    expect(easedLine(eased[0]!)).toMatch(/^i → y in "wise" \(wyse\) removes .+ \(deliberate swap\)$/);
    expect(changedWordsOf(scoreCold('wyse owls', 'wise owls').words)).toEqual([]);
  });

  it('word random swaps and where they landed', () => {
    const t = { wordIndex: 0, mapping: { from: 'a', to: '@', kind: 'symbol' as const }, before: 'cat', after: 'c@t' };
    expect(twistLine(t)).toBe('a → @ in "cat" (symbol swap)');
    expect(twistOptionsLine({ twistOptions: 1, twistBits: 0 })).toBeUndefined();
    expect(twistOptionsLine({ twistOptions: 1200, twistBits: 10.2 })).toBe('Remember the sentence first, then the swaps. Where they landed was one of 1,200 possibilities, which adds 10.2 bits.');
  });
});
