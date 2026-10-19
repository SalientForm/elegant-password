// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasClassicScrollbars, installScrollbars, scrollersAround, SHOWN, SHOWN_AFTER_SCROLL_MS } from './scrollbars';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.className = '';
  document.body.replaceChildren();
});

/** Pretend the browser's scroll bars are `width` pixels wide and every element has more content than room (jsdom lays nothing out). */
const layout = (width: number) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100 - width);
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(500);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(100);
};

/** A scrolling column holding a card. */
const column = () => {
  const col = document.body.appendChild(document.createElement('div'));
  col.style.overflowY = 'auto';
  const card = col.appendChild(document.createElement('p'));
  return { col, card };
};

const pointer = (type: string, target: EventTarget, relatedTarget: EventTarget | null = null) =>
  target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: 'mouse', relatedTarget }));

describe('scroll bars', () => {
  it('leaves overlay scroll bars alone', () => {
    layout(0);
    expect(hasClassicScrollbars()).toBe(false);
    installScrollbars();
    expect(document.documentElement.classList.contains('classic-scrollbars')).toBe(false);
    expect(document.body.children).toHaveLength(0); // the probe is gone
  });

  it('finds the scrolling areas under the pointer, not the page', () => {
    layout(17);
    const { col, card } = column();
    expect(scrollersAround(card)).toEqual([col]);
    expect(scrollersAround(document.body)).toEqual([]);
  });

  it('shows an area’s bar while the pointer is over it, and the page’s while it scrolls', () => {
    vi.useFakeTimers();
    layout(17);
    const undo = installScrollbars();
    const root = document.documentElement;
    expect(root.classList.contains('classic-scrollbars')).toBe(true);
    const { col, card } = column();

    pointer('pointerover', card);
    expect(col.classList.contains(SHOWN)).toBe(true);
    pointer('pointerover', document.body);
    expect(col.classList.contains(SHOWN)).toBe(false);
    col.dispatchEvent(new Event('scroll')); // the redraw's own scroll, nowhere new: not the user scrolling
    expect(col.classList.contains(SHOWN)).toBe(false);

    col.dispatchEvent(new Event('scroll')); // scroll does not bubble: caught on the way down
    document.dispatchEvent(new Event('scroll'));
    expect(col.classList.contains(SHOWN)).toBe(true);
    expect(root.classList.contains(SHOWN)).toBe(true);
    vi.advanceTimersByTime(SHOWN_AFTER_SCROLL_MS);
    expect(col.classList.contains(SHOWN)).toBe(false);
    expect(root.classList.contains(SHOWN)).toBe(false);

    pointer('pointerover', card);
    pointer('pointerout', card, null); // left the window
    expect(col.classList.contains(SHOWN)).toBe(false);
    expect(col.style.overflow).toBe(''); // redrawn by a scroll, not by a layout change
    col.dispatchEvent(new Event('scroll'));
    expect(col.classList.contains(SHOWN)).toBe(false);
    col.dispatchEvent(new Event('scroll')); // the next one is the user's
    expect(col.classList.contains(SHOWN)).toBe(true);

    undo();
    expect(root.classList.contains('classic-scrollbars')).toBe(false);
  });
});
