// A second opinion from the zxcvbn library (Dropbox's password strength
// estimator, 4.4.2), run in the browser by src/state/zxcvbnCheck.ts. This
// file turns zxcvbn's crack time for an offline attack on a slow hash (10^4
// guesses a second, `crack_times_display.offline_slow_hashing_1e4_per_second`)
// into one of four words, the usual reading of that figure. It is pure, so it
// is tested on its own; the password never leaves the browser.

export const ZXCVBN_URL = 'https://github.com/dropbox/zxcvbn';
/** The estimator and its settings, saved with each reading so an old one can be told from a new one. */
export const ZXCVBN_ESTIMATOR = 'zxcvbn 4.4.2, offline slow hashing (10^4 guesses/s)';

export const ZXCVBN_LABELS = ['very weak', 'weak', 'good', 'strong'] as const;
export type ZxcvbnLabel = (typeof ZXCVBN_LABELS)[number];

/** The crack times each word covers. */
export const ZXCVBN_LEVELS: Record<ZxcvbnLabel, string> = {
  'very weak': 'seconds to minutes',
  weak: 'hours to weeks',
  good: 'months to years',
  strong: 'centuries',
};

export interface ZxcvbnReading {
  label: ZxcvbnLabel;
  /** zxcvbn's own words for the crack time: "3 hours", "centuries". */
  crackTime: string;
  /** How far along the scale the time is, 10-100. */
  fill: number;
  /** log10 of zxcvbn's guess count. */
  guessesLog10: number;
  /** zxcvbn's own 0-4 score (not shown; kept for reference). */
  score: number;
  /** ZXCVBN_ESTIMATOR at the time of the reading. */
  estimator: string;
  /** ISO timestamp of the reading. */
  checkedAt: string;
}

/**
 * The word and the place on the scale for zxcvbn's crack-time words. Days
 * of two weeks or more read as weeks, which only matters for the scale. A
 * password of 16 characters or more (UTF-16 code units) at "centuries" is at
 * the top of it.
 */
export function zxcvbnBand(crackTime: string, password: string): { label: ZxcvbnLabel; fill: number } {
  let a = crackTime.toLowerCase();
  const days = /^(\d+) days?$/.exec(a);
  if (days) {
    const n = Number(days[1]);
    if (n >= 14) a = `${Math.floor(n / 7)} weeks`;
    else if (n >= 8) a = '1 week';
  }
  if (a.includes('second')) return { label: 'very weak', fill: 10 };
  if (a.includes('minute')) return { label: 'very weak', fill: 23 };
  if (a.includes('hour')) return { label: 'weak', fill: 36 };
  if (a.includes('day') || a.includes('week')) return { label: 'weak', fill: 49 };
  if (a.includes('month')) return { label: 'good', fill: 62 };
  if (a.includes('year')) return { label: 'good', fill: 75 };
  if (a.includes('centur') && password) return { label: 'strong', fill: password.length < 16 ? 88 : 100 };
  return { label: 'very weak', fill: 25 };
}

/** One line for a reading: "zxcvbn: strong (centuries to crack)". */
export const zxcvbnLine = (r: Pick<ZxcvbnReading, 'label' | 'crackTime'>) => `zxcvbn: ${r.label} (${r.crackTime} to crack)`;

export const isZxcvbnLabel = (x: unknown): x is ZxcvbnLabel => (ZXCVBN_LABELS as readonly unknown[]).includes(x);
