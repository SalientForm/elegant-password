import { useEffect, useState } from 'react';

/** At this width and below there is no room for three columns: two stay open (Suggestions and one outer column) and the third shrinks to a button. */
export const MEDIUM = '(max-width: 1100px)';
/** At this width and below only one column stays open; the other two shrink to a button each. */
export const NARROW = '(max-width: 800px)';
/** At this width and below (phones) the open column takes the whole width under a bar of tabs. */
export const PHONE = '(max-width: 600px)';

/** Whether a media query matches, kept up to date. False where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
