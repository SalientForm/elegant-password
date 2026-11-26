// Runs the zxcvbn library on a password, here in this browser, and reads
// the result (src/lib/zxcvbnReading.ts). zxcvbn and its word lists are about 800 kB, so they load
// only when the first password needs a reading.

import { readingOf, type ZxcvbnReading } from '../lib/zxcvbnReading';
import { timed } from './slow';

export type ZxcvbnCheck = (password: string) => Promise<ZxcvbnReading>;

export const checkWithZxcvbn: ZxcvbnCheck = async (password) => {
  const { default: zxcvbn } = await import('zxcvbn');
  const result = timed("zxcvbn's reading", () => zxcvbn(password)); // the library call alone, not its lazy load
  return readingOf(result, password);
};
