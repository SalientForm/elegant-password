/**
 * One ResizeObserver for the whole app. Every card in a batch wants to know
 * when its width changes, and a window drag resizes them all at once; one
 * observer delivers that in a single callback instead of one per card.
 * Where ResizeObserver does not exist (jsdom), nothing is observed.
 */
const callbacks = new Map<Element, () => void>();
let observer: ResizeObserver | undefined;

/** Call `onResize` whenever `el` changes size; returns the function that stops watching. */
export function observeResize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) callbacks.get(entry.target)?.();
  });
  callbacks.set(el, onResize);
  observer.observe(el);
  return () => {
    callbacks.delete(el);
    observer?.unobserve(el);
  };
}

/** How many elements are being watched (for tests). */
export const watchedCount = () => callbacks.size;
