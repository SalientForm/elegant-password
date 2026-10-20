import { describe, expect, it } from 'vitest';
import { wrapHanging } from './wrap';

const words = (lines: string[]) => lines.join(' ').split(/ +/).filter(Boolean);

describe('wrapHanging', () => {
  it('leaves a line that fits, or any line at an unbounded width, whole', () => {
    expect(wrapHanging('1  Typing mode  One-handed', 40, 17)).toEqual(['1  Typing mode  One-handed']);
    expect(wrapHanging('x'.repeat(500), Number.POSITIVE_INFINITY, 4)).toEqual(['x'.repeat(500)]);
  });

  it('breaks at spaces and starts each run-on line under the column', () => {
    const lines = wrapHanging('3  Options      the One-handed preset: strength target Everyday (40 bits), typing comfort Strict', 40, 15);
    expect(lines).toEqual([
      '3  Options      the One-handed preset:',
      '               strength target Everyday',
      '               (40 bits), typing comfort',
      '               Strict',
    ]);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(40);
  });

  it('keeps the first line\'s leading spaces and the gaps between its columns', () => {
    expect(wrapHanging('        hint: ripe deer offer bulky vultures', 30, 14)).toEqual(['        hint: ripe deer offer', '              bulky vultures']);
  });

  it('drops the gap at a break, so no line ends or starts with stray spaces', () => {
    const lines = wrapHanging('aaa   bbb   ccc', 9, 0);
    expect(lines).toEqual(['aaa   bbb', 'ccc']);
  });

  it('splits a word longer than a line, still under the column', () => {
    const lines = wrapHanging(`Sample: ${'x'.repeat(30)}   Strength 49`, 28, 8);
    expect(lines).toEqual(['Sample: ' + 'x'.repeat(20), '        ' + 'x'.repeat(10), '        Strength 49']);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
  });

  it('starts run-on lines at the left when the column leaves too little room', () => {
    const lines = wrapHanging('1  A long label here  value that runs on and on', 24, 20);
    expect(lines.slice(1).every((l) => !l.startsWith(' '))).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(24);
  });

  it('never loses or reorders a word, at any width', () => {
    const text = '2  Site rules   NIST passphrase (15-64, no must-haves) and a-very-long-hyphenated-word-to-split';
    for (let w = 1; w <= 100; w++) {
      const lines = wrapHanging(text, w, 15);
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(w);
      expect(lines.join('').replace(/ +/g, '')).toBe(text.replace(/ +/g, ''));
      if (w >= 15 + 36) expect(words(lines)).toEqual(words([text])); // once the longest word fits under the column
    }
  });
});
