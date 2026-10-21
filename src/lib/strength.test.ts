import { describe, expect, it } from 'vitest';
import { commonRank } from './common';
import { randomInt } from './random';
import { seeded } from './testRandom';
import { BITS_PER_ENGLISH_LETTER, collapseBlocks, collapseRuns, isMemorableDigits, KEY_WALK_CHOICES, keyWalks, MEMORABLE_DIGITS_CHOICES, rawBits, strengthBits, strengthParts, SYMBOL_CHOICES } from './strength';

const L = (n: number) => n * BITS_PER_ENGLISH_LETTER;
const S = Math.log2(SYMBOL_CHOICES);
const D = Math.log2(10);
const W = Math.log2(KEY_WALK_CHOICES);

describe('collapseRuns', () => {
  it('cuts every run of one repeated character to that character', () => {
    expect(collapseRuns('aaab!!c')).toBe('ab!c');
    expect(collapseRuns('aaaaaaaaaaaa')).toBe('a');
    expect(collapseRuns('abab')).toBe('abab'); // a repeated pattern is not a repeated character
    expect(collapseRuns('😀😀x')).toBe('😀x');
    expect(collapseRuns('')).toBe('');
  });
});

describe('rawBits: brute force over the characters used', () => {
  it('multiplies the characters by the log of the alphabet the classes present make', () => {
    expect(rawBits('abcd')).toBeCloseTo(4 * Math.log2(26), 9);
    expect(rawBits('Abc1')).toBeCloseTo(4 * Math.log2(26 + 26 + 10), 9);
    expect(rawBits('63;Rqmote;thiqves;chip;fqrns')).toBeCloseTo(28 * Math.log2(95), 9);
    expect(rawBits('a b')).toBeCloseTo(3 * Math.log2(26 + 33), 9); // a space is a symbol
    expect(rawBits('пароль')).toBeCloseTo(6 * Math.log2(50), 9); // another script: about an alphabet
  });

  it('counts a repeated character once, so a run of one letter is one letter', () => {
    expect(rawBits('aaaaaaaaaaaa')).toBeCloseTo(Math.log2(26), 9);
    expect(rawBits('aaaaaaaaaaaaaaaaaaaaaa')).toBe(rawBits('a'));
    expect(rawBits('')).toBe(0);
  });
});

describe('strengthBits: an attacker who knows English and the usual habits, not this tool', () => {
  it('reads letters as English-like text, digits as digits, each distinct symbol as one pick', () => {
    const parts = strengthParts('63;Rqmote;thiqves;chip;fqrns');
    expect(parts.map((p) => p.text)).toEqual(['63', ';', 'Rqmote', ';', 'thiqves', ';', 'chip', ';', 'fqrns']);
    expect(parts.map((p) => p.bits)).toEqual([2 * D, S, L(6) + 1, 0, L(7), 0, L(4), 0, L(5)]);
    expect(strengthBits('63;Rqmote;thiqves;chip;fqrns')).toBeCloseTo(2 * D + S + L(6) + 1 + L(7) + L(4) + L(5), 9);
  });

  it('gives a swapped word the same strength as the word: a swap is not a word\'s business', () => {
    expect(strengthBits('remotes')).toBe(strengthBits('rqmotes')); // ("remote" alone is a common password)
    expect(strengthBits('Sm@rt')).toBeCloseTo(strengthBits('Sm') + strengthBits('rt') + S, 9); // the symbol splits the run and is one pick
  });

  it('counts a repeated character once, wherever it is', () => {
    expect(strengthBits('aaaaaaaaaaaa')).toBeCloseTo(Math.log2(26), 9); // one letter's pick is the floor
    expect(strengthBits('a;;;b')).toBe(strengthBits('a;b'));
    expect(strengthBits('x!y!z!')).toBeCloseTo(3 * Math.log2(26) + S, 9); // a symbol used three times is one choice
  });

  it('reads digits: a single digit, a memorable run as one pick, any other run by its digits', () => {
    expect(strengthBits('7')).toBeCloseTo(D, 9);
    // "7777" and "1234" alone are common passwords; after a letter they are read as digits.
    expect(strengthBits('x7777')).toBeCloseTo(Math.log2(26) + D, 9); // collapsed to one digit first
    expect(strengthBits('x1234')).toBeCloseTo(Math.log2(26) + Math.log2(MEMORABLE_DIGITS_CHOICES), 9);
    expect(strengthBits('8402')).toBeCloseTo(4 * D, 9);
    expect(strengthBits('cat1')).toBeCloseTo(L(3) + D, 9); // a digit against a word is its own run
  });

  it('adds one bit for a capital in a run and starts a new run at a capital after a lower-case letter', () => {
    expect(strengthBits('Password')).toBeCloseTo(L(7) + 1, 9); // "ss" counts once
    expect(strengthBits('PASSWORD')).toBeCloseTo(L(7) + 1, 9);
    expect(strengthBits('Monkey')).toBeCloseTo(L(6) + 1, 9);
    expect(strengthBits('BlueTiger')).toBeCloseTo(L(4) + 1 + L(5) + 1, 9);
    expect(strengthBits('CVB')).toBeCloseTo(L(3) + 1, 9);
  });

  it('never drops below one letter\'s pick for a word, and treats another script as letters', () => {
    expect(strengthBits('a')).toBeCloseTo(Math.log2(26), 9);
    expect(strengthBits('ab')).toBeCloseTo(Math.log2(26), 9); // 4.6 would be less than one letter's pick
    expect(strengthBits('пароль')).toBeCloseTo(L(6), 9);
    expect(strengthBits('café')).toBeCloseTo(L(4), 9);
    expect(strengthBits('')).toBe(0);
  });

  it('reads the audit\'s trivial passwords as weak', () => {
    for (const trivial of ['aaaaaaaaaaaaaaaaaaaaaa', 'asdfasdfasdf', 'qwertyuiop', 'Password1!']) expect(strengthBits(trivial), trivial).toBeLessThan(40);
    expect(strengthBits('correct horse battery staple')).toBeGreaterThan(50);
  });
});

describe('the habits an attacker tries early', () => {
  it('reads a password on the common list as the guesses it takes to reach it there', () => {
    expect(commonRank('password')).toBe(1);
    expect(strengthBits('password')).toBe(0);
    const rank = commonRank('dragon')!;
    expect(strengthParts('dragon')).toEqual([{ text: 'dragon', kind: 'common', bits: Math.log2(rank) }]);
    expect(commonRank('Dragon')).toBeUndefined(); // only an exact match
    expect(strengthBits('Dragon')).toBeCloseTo(L(6) + 1, 9);
  });

  it('counts a block typed again and again once, plus the times it was typed', () => {
    expect(collapseBlocks('Password1!Password1!Password1!')).toEqual({ text: 'Password1!', repeats: [{ block: 'Password1!', times: 3 }] });
    expect(strengthBits('Password1!'.repeat(3))).toBeCloseTo(strengthBits('Password1!') + Math.log2(3), 9);
    expect(strengthBits('aA'.repeat(12))).toBeCloseTo(strengthBits('aA') + Math.log2(12), 9);
    expect(collapseBlocks('xabcabcy').text).toBe('xabcy');
    // Words are not repetitions: two letters twice is English ("banana", "cocoa").
    expect(collapseBlocks('banana').text).toBe('banana');
    expect(collapseBlocks('cocoa').text).toBe('cocoa');
  });

  it('reads every block length off one pass, giving exactly what comparing slices gave', () => {
    // The scan this replaced, kept as the oracle: it sliced and joined a block for every length at every position.
    const isRepetition = (length: number, times: number) => (length >= 3 && times >= 2) || (length === 2 && times >= 3);
    const oracle = (text: string) => {
      const chars = [...text];
      const repeats: { block: string; times: number }[] = [];
      let out = '';
      let i = 0;
      while (i < chars.length) {
        let found: { length: number; times: number } | undefined;
        for (let length = 2; i + 2 * length <= chars.length; length++) {
          const block = chars.slice(i, i + length).join('');
          let times = 1;
          while (chars.slice(i + times * length, i + (times + 1) * length).join('') === block) times++;
          if (isRepetition(length, times) && (!found || length * times > found.length * found.times)) found = { length, times };
        }
        if (found) {
          const block = chars.slice(i, i + found.length).join('');
          out += block;
          repeats.push({ block, times: found.times });
          i += found.length * found.times;
        } else out += chars[i++];
      }
      return { text: out, repeats };
    };
    const crafted = ['', 'a', 'ab', 'abab', 'ababab', 'abcabc', 'abcabcab', 'aabaab', 'abababababab', 'xabcabcabcy', 'abcdabcdabcd', 'aaaa', 'abaabaaba', '😀x😀x😀x', 'Password1!Password1!x'];
    const rng = seeded(7);
    const random = Array.from({ length: 2000 }, () => Array.from({ length: randomInt(41, rng) }, () => 'abc'[randomInt(3, rng)]).join(''));
    for (const text of [...crafted, ...random]) expect(collapseBlocks(text), JSON.stringify(text)).toEqual(oracle(text));
  });

  it('reads a walk along a keyboard row or the alphabet as one pick', () => {
    expect(keyWalks('asdf')).toEqual({ letters: 4, walks: 1 });
    expect(keyWalks('lkjh')).toEqual({ letters: 4, walks: 1 });
    expect(keyWalks('abcdefg')).toEqual({ letters: 7, walks: 1 });
    expect(keyWalks('qwertyuiop')).toEqual({ letters: 10, walks: 1 });
    expect(keyWalks('rest')).toEqual({ letters: 0, walks: 0 }); // three-letter steps happen in English
    expect(strengthBits('sdfg')).toBeCloseTo(W, 9); // ("asdf" alone is a common password)
    expect(strengthBits('Qwertyuiop')).toBeCloseTo(W + 1, 9);
    expect(strengthBits('asdfmonkeys')).toBeCloseTo(W + L(7), 9);
    expect(strengthBits('asdf'.repeat(8))).toBeCloseTo(W + 3, 9);
  });

  it('no longer reads the audit\'s repeated patterns as master passwords', () => {
    for (const p of ['Password1!'.repeat(3), 'aA'.repeat(12), 'asdf'.repeat(8), 'asdfasdfasdf']) expect(strengthBits(p), p).toBeLessThan(30);
  });
});

describe('memorable digit runs', () => {
  it('means repeats, consecutive runs and well-known skips, not any pair of digits', () => {
    for (const run of ['1', '11', '7777', '123', '4321', '2468', '8642', '13579', '1357']) expect(isMemorableDigits(run), run).toBe(true);
    for (const run of ['84', '8402', '1357 ', '2469', '1324']) expect(isMemorableDigits(run), run).toBe(false);
  });
});
