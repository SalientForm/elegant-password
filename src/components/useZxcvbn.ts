import { useEffect, useState } from 'react';
import type { ZxcvbnReading } from '../lib/zxcvbnReading';
import { checkWithZxcvbn } from '../state/zxcvbnCheck';

/** A zxcvbn reading as a badge shows it: the reading, still being worked out, or not available. */
export type ZxcvbnState = ZxcvbnReading | 'pending' | 'failed';

// Readings of passwords on screen (cards, the typing test), kept for the visit so a card shown again is not
// worked out again. My list keeps its own readings in storage. Cleared at a size, like the scoring caches.
const CACHE_LIMIT = 500;
const cache = new Map<string, Promise<ZxcvbnReading>>();

function readingOf(password: string): Promise<ZxcvbnReading> {
  let reading = cache.get(password);
  if (!reading) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    reading = checkWithZxcvbn(password);
    reading.catch(() => cache.delete(password)); // a failed load is tried again next time
    cache.set(password, reading);
  }
  return reading;
}

/**
 * What the zxcvbn library says about a password, worked out in this browser
 * (src/state/zxcvbnCheck.ts). A reading already kept with the password
 * (a My list entry) is used as it is.
 */
export function useZxcvbn(password: string | undefined, kept?: ZxcvbnReading): ZxcvbnState | undefined {
  const [state, setState] = useState<{ password: string; reading: ZxcvbnState } | undefined>();
  useEffect(() => {
    if (password === undefined || kept) return undefined;
    let live = true;
    readingOf(password).then(
      (reading) => live && setState({ password, reading }),
      () => live && setState({ password, reading: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [password, kept]);
  if (password === undefined) return undefined;
  if (kept) return kept;
  return state?.password === password ? state.reading : 'pending';
}
