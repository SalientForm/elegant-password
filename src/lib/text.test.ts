import { describe, expect, it } from 'vitest';
import { MAX_SENTENCE_LENGTH, sentenceLengthProblem } from './text';

describe('sentenceLengthProblem', () => {
  it('takes a sentence up to the cap and refuses one past it, naming both lengths', () => {
    expect(MAX_SENTENCE_LENGTH).toBe(500);
    expect(sentenceLengthProblem('')).toBeUndefined();
    expect(sentenceLengthProblem('a'.repeat(500))).toBeUndefined();
    expect(sentenceLengthProblem('a'.repeat(501))).toBe('The sentence is 501 characters; 500 is the most this tool takes. Use a shorter sentence.');
  });

  it('counts UTF-16 code units, as the fields and the CLI do', () => {
    expect(sentenceLengthProblem('😀'.repeat(250))).toBeUndefined();
    expect(sentenceLengthProblem('😀'.repeat(251))).toMatch(/^The sentence is 502 characters/);
  });
});
