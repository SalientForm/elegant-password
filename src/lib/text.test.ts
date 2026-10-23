import { describe, expect, it } from 'vitest';
import { capitalise, lowerFirst, MAX_HINT_LENGTH, plural, sentenceLengthProblem } from './text';

describe('the wording helpers', () => {
  it('pairs a count with the noun that agrees with it, the plural given when it is not an s', () => {
    expect(plural(1, 'digit')).toBe('1 digit');
    expect(plural(0, 'digit')).toBe('0 digits');
    expect(plural(3, 'digit')).toBe('3 digits');
    expect(plural(1, 'fix', 'fixes')).toBe('1 fix');
    expect(plural(2, 'fix', 'fixes')).toBe('2 fixes');
  });

  it('turns only the first character up or down, and leaves an empty text empty', () => {
    expect(capitalise('required digits')).toBe('Required digits');
    expect(capitalise('Already')).toBe('Already');
    expect(lowerFirst('The minimum is 12.')).toBe('the minimum is 12.');
    expect(lowerFirst('ABC')).toBe('aBC');
    expect(capitalise('')).toBe('');
    expect(lowerFirst('')).toBe('');
  });
});

describe('sentenceLengthProblem', () => {
  it('takes a sentence up to the cap and refuses one past it, naming both lengths', () => {
    expect(MAX_HINT_LENGTH).toBe(512);
    expect(sentenceLengthProblem('')).toBeUndefined();
    expect(sentenceLengthProblem('a'.repeat(512))).toBeUndefined();
    expect(sentenceLengthProblem('a'.repeat(513))).toBe('The sentence is 513 characters; 512 is the most this tool takes. Use a shorter sentence.');
  });

  it('counts UTF-16 code units, as the fields and the CLI do', () => {
    expect(sentenceLengthProblem('😀'.repeat(256))).toBeUndefined();
    expect(sentenceLengthProblem('😀'.repeat(257))).toMatch(/^The sentence is 514 characters/);
  });
});
