// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FRAMED_HEADING, FRAMED_LINK, FRAMED_TEXT, isFramed, refusesFrame, showFramedNotice } from './frameGuard';

afterEach(() => document.body.replaceChildren());

/** A window whose `top` is `top`, or whose `top` throws when read. */
const windowWith = (top: unknown): Window => {
  const win = {} as Window;
  Object.defineProperty(win, 'self', { value: win });
  Object.defineProperty(win, 'top', {
    get: () => {
      if (top === 'throws') throw new DOMException('Blocked a frame', 'SecurityError');
      return top === 'self' ? win : top;
    },
  });
  return win;
};

describe('the frame guard', () => {
  it('is not framed at the top of its own tab', () => {
    expect(isFramed(window)).toBe(false);
    expect(isFramed(windowWith('self'))).toBe(false);
  });

  it('is framed when the top window is another, or when reading it throws', () => {
    expect(isFramed(windowWith({}))).toBe(true);
    expect(isFramed(windowWith('throws'))).toBe(true);
  });

  it('refuses a frame only in the production build', () => {
    expect(refusesFrame(true, windowWith({}))).toBe(true);
    expect(refusesFrame(false, windowWith({}))).toBe(false);
    expect(refusesFrame(true, windowWith('self'))).toBe(false);
  });

  it('replaces the root with the notice: why, a link to a new tab, and the address', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'));
    document.body.append(root);
    const href = 'https://example.test/elegant-password/#scoring';
    showFramedNotice(root, href);
    expect(root.querySelector('span')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toBe(FRAMED_HEADING);
    expect(root.textContent).toContain(FRAMED_TEXT);
    const link = root.querySelector('a')!;
    expect(link.textContent).toBe(FRAMED_LINK);
    expect(link.href).toBe(href);
    expect(link.target).toBe('_blank');
    expect(link.rel.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    expect(root.querySelector('code')?.textContent).toBe(href);
    expect(root.querySelector('[style]')).toBeNull(); // no inline style: the CSP's style-src forbids it
  });
});
