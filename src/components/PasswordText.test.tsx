// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordText } from './PasswordText';

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

const PW = '63;Rqmote;thiqves;chip;fqrns';

describe('PasswordText', () => {
  it('is plain text when the password fits: no button, no tab stop, nothing to click', () => {
    widths(120, 120);
    render(<PasswordText password={PW} />);
    const code = screen.getByText(PW);
    expect(code.getAttribute('role')).toBeNull();
    expect(code.getAttribute('tabindex')).toBeNull();
    expect(code.className).toBe('password');
    fireEvent.click(code);
    expect(code.className).toBe('password');
    widths(121, 120);
    cleanup();
    render(<PasswordText password={PW} />);
    expect(screen.getByText(PW).getAttribute('role')).toBeNull(); // one pixel of rounding is not an ellipsis
  });

  it('cut short, is a button that shows the whole password on click and folds it back on the next', () => {
    widths(400, 120);
    render(<PasswordText password={PW} />);
    const code = screen.getByRole('button', { name: PW });
    expect(code.getAttribute('aria-expanded')).toBe('false');
    expect(code.getAttribute('title')).toBe('Show the whole password');
    expect(code.className).toBe('password can-reveal');
    fireEvent.click(code);
    expect(code.getAttribute('aria-expanded')).toBe('true');
    expect(code.getAttribute('title')).toBe('Show less');
    expect(code.className).toBe('password revealed can-reveal');
    fireEvent.click(code);
    expect(code.getAttribute('aria-expanded')).toBe('false');
    expect(code.className).toBe('password can-reveal');
  });

  it('works from the keyboard, and keeps Enter and Space to itself', () => {
    widths(400, 120);
    render(<PasswordText password={PW} />);
    const code = screen.getByRole('button', { name: PW });
    expect(code.getAttribute('tabindex')).toBe('0');
    let bubbled = 0;
    window.addEventListener('keydown', () => bubbled++);
    fireEvent.keyDown(code, { key: 'Enter' });
    expect(code.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(code, { key: ' ' });
    expect(code.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(code, { key: 'x' });
    expect(bubbled).toBe(1); // Enter and Space never reach the page's own shortcuts; other keys do
  });

  it('never copies: there is no copy bubble and no clipboard call', () => {
    widths(400, 120);
    let writes = 0;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => void writes++ }, configurable: true });
    render(<PasswordText password={PW} />);
    fireEvent.click(screen.getByRole('button', { name: PW }));
    expect(writes).toBe(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('starts folded again when the password changes', () => {
    widths(400, 120);
    const { rerender } = render(<PasswordText password={PW} />);
    fireEvent.click(screen.getByRole('button', { name: PW }));
    expect(screen.getByRole('button', { name: PW }).getAttribute('aria-expanded')).toBe('true');
    rerender(<PasswordText password="another;one" />);
    expect(screen.getByRole('button', { name: 'another;one' }).getAttribute('aria-expanded')).toBe('false');
  });
});
