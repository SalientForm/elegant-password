import { describe, expect, it } from 'vitest';
import { MAX_HINT_LENGTH, sentenceLengthProblem } from './text';

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
