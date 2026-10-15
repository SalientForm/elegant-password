// Three sticky, independently scrolling columns under a header that scrolls
// away first. Browsers scroll the element under the pointer before the page,
// which would scroll a column while the header is still in view; this routes
// wheel-down to the page until the columns reach the top of the viewport.

import { useEffect, type RefObject } from 'react';

/**
 * How far the page itself should scroll for a wheel step, or undefined when
 * the wheel should act on the column as usual. `columnsTop` is the page
 * offset where the columns start (just under the header and tabs).
 */
export function pageScrollFor(deltaY: number, columnsTop: number, scrollY: number): number | undefined {
  if (deltaY <= 0) return undefined; // scrolling up: the column scrolls, and at its top the page follows
  const remaining = columnsTop - scrollY;
  if (remaining <= 0) return undefined; // the header is gone: columns scroll on their own
  return Math.min(deltaY, remaining);
}

/** Attach the routing to the element holding the columns, for pointers with a wheel. */
export function usePageFirstWheel(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const onWheel = (e: WheelEvent) => {
      // The columns stick a little below the top of the viewport; the page stops when they get there.
      const first = el.firstElementChild;
      const stickyTop = first ? parseFloat(getComputedStyle(first).top) || 0 : 0;
      const step = pageScrollFor(e.deltaY, el.getBoundingClientRect().top + window.scrollY - stickyTop, window.scrollY);
      if (step === undefined) return;
      e.preventDefault();
      window.scrollBy({ top: step });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, enabled]);
}
