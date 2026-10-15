// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstantTip, isTruncated, PasswordTip } from './PasswordTip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
  delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
});

/** jsdom has no layout; pretend every element has these widths. */
const widths = (scroll: number, client: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => client });
};

const mount = () =>
  render(
    <PasswordTip password="a-very-long-password">
      <code className="password">a-very-long-password</code>
    </PasswordTip>,
  );

describe('PasswordTip', () => {
  it('opens at once on hover or focus when the password is cut off, and closes on leave or Escape', () => {
    widths(400, 120);
    mount();
    const anchor = screen.getByText('a-very-long-password').parentElement!;
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(anchor);
    expect(screen.getByRole('tooltip').textContent).toBe('a-very-long-password');
    fireEvent.mouseLeave(anchor);
    act(() => vi.advanceTimersByTime(200)); // leaving waits a moment, so the pointer can reach the tip
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(anchor);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(anchor, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays open while the pointer is over it, lives at the document level, and closes on scroll', () => {
    render(
      <div style={{ overflow: 'hidden' }}>
        <InstantTip content="Difficulty 44, demanding">
          <span>D 44</span>
        </InstantTip>
      </div>,
    );
    const anchor = screen.getByText('D 44').parentElement!;
    fireEvent.mouseEnter(anchor);
    const tip = screen.getByRole('tooltip');
    expect(tip.parentElement).toBe(document.body); // a portal: no card or column can clip it
    expect(tip.textContent).toBe('Difficulty 44, demanding');
    fireEvent.mouseLeave(anchor);
    fireEvent.mouseEnter(tip); // the pointer reached the tip in time
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.mouseLeave(tip);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(anchor);
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does nothing when the password fits', () => {
    widths(120, 120);
    mount();
    const anchor = screen.getByText('a-very-long-password').parentElement!;
    fireEvent.mouseEnter(anchor);
    fireEvent.focus(anchor);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(isTruncated(anchor)).toBe(false);
    widths(121, 120);
    expect(isTruncated(anchor)).toBe(false); // one pixel of rounding is not an ellipsis
    widths(122, 120);
    expect(isTruncated(anchor)).toBe(true);
  });
});
