// The package's second entry, @salientform/elegant-passwords/zxcvbn: the
// zxcvbn badge's reading of a password, with the library (about 400 KB
// gzipped) loaded on first use, so a caller that never shows the badge
// never loads it. The web app runs the same reading (src/state/zxcvbnCheck.ts).

import { readingOf, type ZxcvbnReading } from './zxcvbnReading';

export type { ZxcvbnLabel, ZxcvbnReading } from './zxcvbnReading';

/** zxcvbn's word for a password and its crack time for an offline attack on a slow hash. */
export async function zxcvbnReading(password: string): Promise<ZxcvbnReading> {
  const { default: zxcvbn } = await import('zxcvbn');
  return readingOf(zxcvbn(password), password);
}
