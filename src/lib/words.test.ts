import { describe, expect, it } from 'vitest';
import * as words from './words';

describe.each(Object.entries(words))('%s', (_name, list) => {
  it('contains only lowercase words of 3-8 letters', () => {
    for (const w of list) expect(w).toMatch(/^[a-z]{3,8}$/);
  });

  it('has no duplicates', () => {
    expect(new Set(list).size).toBe(list.length);
  });
});
