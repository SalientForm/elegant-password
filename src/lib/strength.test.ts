import { describe, expect, it } from 'vitest';
import { BITS_PER_ENGLISH_LETTER, collapseRuns, isMemorableDigits, MEMORABLE_DIGITS_CHOICES, rawBits, strengthBits, strengthParts, SYMBOL_CHOICES } from './strength';

const L = (n: number) => n * BITS_PER_ENGLISH_LETTER;
const S = Math.log2(SYMBOL_CHOICES);
const D = Math.log2(10);

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
    expect(strengthBits('remote')).toBe(strengthBits('rqmote'));
    expect(strengthBits('Sm@rt')).toBeCloseTo(strengthBits('Sm') + strengthBits('rt') + S, 9); // the symbol splits the run and is one pick
  });

  it('counts a repeated character once, wherever it is', () => {
    expect(strengthBits('aaaaaaaaaaaa')).toBeCloseTo(Math.log2(26), 9); // one letter's pick is the floor
    expect(strengthBits('asdfasdfasdf')).toBeCloseTo(L(12), 9); // a repeated pattern is still 12 letters
    expect(strengthBits('a;;;b')).toBe(strengthBits('a;b'));
    expect(strengthBits('x!y!z!')).toBeCloseTo(3 * Math.log2(26) + S, 9); // a symbol used three times is one choice
  });

  it('reads digits: a single digit, a memorable run as one pick, any other run by its digits', () => {
    expect(strengthBits('7')).toBeCloseTo(D, 9);
    expect(strengthBits('7777')).toBeCloseTo(D, 9); // collapsed to one digit first
    expect(strengthBits('1234')).toBeCloseTo(Math.log2(MEMORABLE_DIGITS_CHOICES), 9);
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

describe('memorable digit runs', () => {
  it('means repeats, consecutive runs and well-known skips, not any pair of digits', () => {
    for (const run of ['1', '11', '7777', '123', '4321', '2468', '8642', '13579', '1357']) expect(isMemorableDigits(run), run).toBe(true);
    for (const run of ['84', '8402', '1357 ', '2469', '1324']) expect(isMemorableDigits(run), run).toBe(false);
  });
});
