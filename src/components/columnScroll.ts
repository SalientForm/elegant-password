// Three sticky, independently scrolling columns under a header that scrolls
// away first. Browsers scroll the element under the pointer before the page,
// which would scroll a column while the header is still in view; this routes
// wheel-down to the page until the columns reach the top of the viewport.

import { useEffect, type RefObject } from 'react';

/** Pixels in a wheel "line", as Chromium counts it. */
export const LINE_PX = 40;

/**
 * A wheel step's vertical distance in pixels. Most wheels report pixels, but
 * some report lines (Firefox; a Windows setting) or whole screens (Windows set
 * to scroll "one screen at a time", as a Mac trackpad over Remote Desktop
 * arrives): taken as pixels, those would move the page a pixel or three.
 */
export function wheelPixels(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, pageHeight: number): number {
  if (e.deltaMode === 1) return e.deltaY * LINE_PX; // WheelEvent.DOM_DELTA_LINE
  if (e.deltaMode === 2) return e.deltaY * pageHeight; // WheelEvent.DOM_DELTA_PAGE
  return e.deltaY;
}

/**
 * How far the page itself should scroll for a wheel step, or undefined when
 * the wheel should act on the column as usual. `columnsTop` is the page
 * offset where the columns start (just under the header and tabs).
 */
export function pageScrollFor(deltaY: number, columnsTop: number, scrollY: number): number | undefined {
  if (deltaY <= 0) return undefined; // scrolling up: the column scrolls, and at its top the page follows
  const remaining = columnsTop - scrollY;
  if (remaining < 1) return undefined; // the header is gone (to the pixel): columns scroll on their own
  return Math.min(deltaY, remaining);
}

/** Attach the routing to the element holding the columns, for pointers with a wheel. */
export function usePageFirstWheel(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // pinch zoom and Ctrl+wheel are the browser's
      // The page stops where the columns stick, or wherever it can scroll no further, whichever comes first.
      const first = el.firstElementChild;
      const stickyTop = first ? parseFloat(getComputedStyle(first).top) || 0 : 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const stop = Math.min(el.getBoundingClientRect().top + window.scrollY - stickyTop, maxScroll);
      const step = pageScrollFor(wheelPixels(e, window.innerHeight), stop, window.scrollY);
      if (step === undefined) return;
      e.preventDefault();
      window.scrollBy({ top: step });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, enabled]);
}
