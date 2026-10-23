import { describe, expect, it } from 'vitest';
import * as words from './words';
import { WORD_LENGTH_RANGE } from './words';

/** The word lists, not the range beside them. */
const isList = (entry: [string, unknown]): entry is [string, readonly string[]] => Array.isArray(entry[1]);

describe.each(Object.entries(words).filter(isList))('%s', (_name, list) => {
  it('contains only lowercase words of 3-8 letters', () => {
    expect(WORD_LENGTH_RANGE).toEqual({ min: 3, max: 8 });
    const word = new RegExp(`^[a-z]{${WORD_LENGTH_RANGE.min},${WORD_LENGTH_RANGE.max}}$`);
    for (const w of list) expect(w).toMatch(word);
  });

  it('has no duplicates', () => {
    expect(new Set(list).size).toBe(list.length);
  });
});
