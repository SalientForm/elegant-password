import { describe, expect, it } from 'vitest';
import { checkWithZxcvbn } from './zxcvbnCheck';

// Reference passwords, two to each word, with the word zxcvbn 4.4.2's crack time gives each (checked 2026-10-20).
const REFERENCE: [string, string][] = [
  ['$*y*hiYRX2HgHzND', 'strong'],
  ['L@Szos72g6ww$&', 'strong'],
  ['NWd3e%zqz6TG', 'good'],
  ['2jWLq!*gZA2', 'good'],
  ['*WP5W5v3i', 'weak'],
  ['^Y66u&VK', 'weak'],
  ['Pt%sdr', 'very weak'],
  ['4fW', 'very weak'],
];

describe('checkWithZxcvbn', () => {
  it('gives each reference password its word', async () => {
    for (const [password, label] of REFERENCE) expect((await checkWithZxcvbn(password)).label, password).toBe(label);
  });

  it('keeps the crack time, the guesses and what made the reading', async () => {
    const r = await checkWithZxcvbn('$*y*hiYRX2HgHzND');
    expect(r).toMatchObject({ crackTime: 'centuries', fill: 100, score: 4, estimator: expect.stringContaining('zxcvbn 4.4.2') });
    expect(r.guessesLog10).toBeGreaterThan(10);
    expect(Date.parse(r.checkedAt)).not.toBeNaN();
  });
});
