// Runs the zxcvbn library on a password, here in this browser, and reads
// the result (src/lib/zxcvbnReading.ts). zxcvbn and its word lists are about 800 kB, so they load
// only when the first password needs a reading.

import { ZXCVBN_ESTIMATOR, zxcvbnBand, type ZxcvbnReading } from '../lib/zxcvbnReading';

export type ZxcvbnCheck = (password: string) => Promise<ZxcvbnReading>;

export const checkWithZxcvbn: ZxcvbnCheck = async (password) => {
  const { default: zxcvbn } = await import('zxcvbn');
  const result = zxcvbn(password);
  const crackTime = String(result.crack_times_display.offline_slow_hashing_1e4_per_second);
  return {
    ...zxcvbnBand(crackTime, password),
    crackTime,
    guessesLog10: result.guesses_log10,
    score: result.score,
    estimator: ZXCVBN_ESTIMATOR,
    checkedAt: new Date().toISOString(),
  };
};
