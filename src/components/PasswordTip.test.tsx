// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isTruncated, PasswordTip } from './PasswordTip';

afterEach(() => {
  cleanup();
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
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(anchor);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(anchor, { key: 'Escape' });
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
