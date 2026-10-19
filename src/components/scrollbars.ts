// Scroll bars like macOS with "show scroll bars automatically": a thin
// rounded handle, no arrow buttons and no track, shown only while the pointer
// is over the scrolling area or it is scrolling. Only where scroll bars take
// up room (Windows, or a Mac set to always show them); overlay scroll bars
// (macOS, phones) are already like this and are left alone. The look lives
// in styles.css under `html.classic-scrollbars`.
//
// Whether a bar shows is a class this module sets, not `:hover` in CSS:
// Chromium repaints a styled scroll bar only when its area scrolls, so a bar
// shown or hidden by hover alone would appear late and linger. When the class
// changes without a scroll, the bar is redrawn by scrolling it a pixel and
// back (see `repaint`): no layout changes, so no column loses its place or
// its scroll in progress.

/** How long a scroll bar stays shown after its area stops scrolling. */
export const SHOWN_AFTER_SCROLL_MS = 900;
/** The class on an area whose scroll bar is shown. */
export const SHOWN = 'scrollbar-shown';

/** True when the browser's scroll bars take up room beside the content, rather than floating over it. */
export function hasClassicScrollbars(doc: Document = document): boolean {
  const probe = doc.createElement('div');
  probe.style.position = 'absolute';
  probe.style.top = '-200px';
  probe.style.width = '100px';
  probe.style.height = '100px';
  probe.style.overflow = 'scroll';
  doc.body.append(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width > 0;
}

const SCROLLS = /auto|scroll/;

/** The areas with a scroll bar the pointer is over at `target`, innermost first. The page's own bar is left out: it shows while the page scrolls. */
export function scrollersAround(target: EventTarget | null, doc: Document = document): Element[] {
  const out: Element[] = [];
  for (let el = target instanceof Element ? target : null; el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const y = SCROLLS.test(style.overflowY) && el.scrollHeight > el.clientHeight;
    const x = SCROLLS.test(style.overflowX) && el.scrollWidth > el.clientWidth;
    if (x || y) out.push(el);
  }
  return out;
}

/** Redraw an area's scroll bar with its current style: scroll it a pixel and straight back, before anything is drawn. Returns where it is scrolled to, or undefined when it cannot scroll. */
export function repaint(el: Element): readonly [number, number] | undefined {
  const vertical = el.scrollHeight - el.clientHeight >= 1;
  if (!vertical && el.scrollWidth - el.clientWidth < 1) return undefined;
  const at = vertical ? el.scrollTop : el.scrollLeft;
  const nudge = (to: number) => (vertical ? (el.scrollTop = to) : (el.scrollLeft = to));
  nudge(at >= 1 ? at - 1 : at + 1);
  nudge(at);
  return [el.scrollTop, el.scrollLeft];
}

/**
 * Mark the page when its scroll bars take up room, and show each area's bar
 * while the pointer is over it or it scrolls. Returns a function that undoes
 * it.
 */
export function installScrollbars(doc: Document = document): () => void {
  if (!hasClassicScrollbars(doc)) return () => {};
  const root = doc.documentElement;
  root.classList.add('classic-scrollbars');
  let hovered = new Set<Element>();
  const scrolling = new Map<Element, ReturnType<typeof setTimeout>>();
  /** Where each redrawn area was left: the scroll event from the nudge is not the user scrolling. */
  const nudged = new Map<Element, readonly [number, number]>();
  const redraw = (el: Element) => {
    const at = repaint(el);
    if (at) nudged.set(el, at);
  };
  /** Set the class from the state; true when it changed. */
  const update = (el: Element) => {
    const show = hovered.has(el) || scrolling.has(el);
    if (el.classList.contains(SHOWN) === show) return false;
    el.classList.toggle(SHOWN, show);
    return true;
  };
  const hover = (next: Set<Element>) => {
    const changed = [...hovered, ...next].filter((el) => hovered.has(el) !== next.has(el));
    hovered = next;
    for (const el of changed) if (update(el)) redraw(el);
  };
  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') hover(new Set(scrollersAround(e.target, doc)));
  };
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) hover(new Set()); // left the window
  };
  const onScroll = (e: Event) => {
    const el = e.target === doc ? root : e.target;
    if (!(el instanceof Element)) return;
    const at = nudged.get(el);
    nudged.delete(el);
    if (at && at[0] === el.scrollTop && at[1] === el.scrollLeft) return;
    clearTimeout(scrolling.get(el));
    scrolling.set(
      el,
      setTimeout(() => {
        scrolling.delete(el);
        if (update(el)) redraw(el);
      }, SHOWN_AFTER_SCROLL_MS),
    );
    update(el); // no redraw: the scroll itself redraws the bar
  };
  doc.addEventListener('pointerover', onOver, { passive: true });
  doc.addEventListener('pointerout', onOut, { passive: true });
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => {
    doc.removeEventListener('pointerover', onOver);
    doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('scroll', onScroll, { capture: true });
    for (const timer of scrolling.values()) clearTimeout(timer);
    for (const el of [...hovered, ...scrolling.keys()]) el.classList.remove(SHOWN);
    root.classList.remove('classic-scrollbars');
  };
}
