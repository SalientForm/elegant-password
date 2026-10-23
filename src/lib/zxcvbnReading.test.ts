import { describe, expect, it } from 'vitest';
import { ZXCVBN_BAND, ZXCVBN_LABELS, zxcvbnBand, zxcvbnLine } from './zxcvbnReading';

describe("reading zxcvbn's crack time", () => {
  it('turns crack times into four words', () => {
    expect(zxcvbnBand('less than a second', 'x').label).toBe('very weak');
    expect(zxcvbnBand('2 minutes', 'x')).toEqual({ label: 'very weak', fill: 23 });
    expect(zxcvbnBand('3 hours', 'x')).toEqual({ label: 'weak', fill: 36 });
    expect(zxcvbnBand('1 day', 'x')).toEqual({ label: 'weak', fill: 49 });
    expect(zxcvbnBand('20 days', 'x')).toEqual({ label: 'weak', fill: 49 });
    expect(zxcvbnBand('4 months', 'x')).toEqual({ label: 'good', fill: 62 });
    expect(zxcvbnBand('3 years', 'x')).toEqual({ label: 'good', fill: 75 });
    expect(zxcvbnBand('centuries', 'short')).toEqual({ label: 'strong', fill: 88 });
    expect(zxcvbnBand('centuries', 'sixteen chars ok')).toEqual({ label: 'strong', fill: 100 });
  });

  it('says it in one line', () => {
    expect(zxcvbnLine({ label: 'strong', crackTime: 'centuries' })).toBe('zxcvbn: strong (centuries to crack)');
  });
});

describe("zxcvbn's colour bands", () => {
  it('puts strong and good in green, weak in yellow and very weak in red', () => {
    expect(ZXCVBN_LABELS.map((l) => ZXCVBN_BAND[l])).toEqual(['low', 'mid', 'high', 'high']);
  });
});
