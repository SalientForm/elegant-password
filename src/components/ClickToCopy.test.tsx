// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickToCopy } from './ClickToCopy';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

const setClipboard = (impl: (() => Promise<void>) | undefined) =>
  Object.defineProperty(navigator, 'clipboard', { value: impl ? { writeText: impl } : undefined, configurable: true });

describe('ClickToCopy', () => {
  it('copies on click and shows "Copied!" next to the cursor for two seconds', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard(write);
    render(<ClickToCopy text="secret-pw">secret-pw</ClickToCopy>);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy secret-pw' }), { clientX: 100, clientY: 50 });
    });
    expect(write).toHaveBeenCalledWith('secret-pw');
    const bubble = screen.getByRole('status');
    expect(bubble.textContent).toBe('Copied!');
    expect(bubble.style.left).toBe('112px');
    expect(bubble.style.top).toBe('42px');
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByRole('status')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('works from the keyboard and explains itself when the clipboard is unavailable', async () => {
    setClipboard(undefined);
    render(<ClickToCopy text="pw">pw</ClickToCopy>);
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Copy pw' }), { key: 'Enter' });
    });
    expect(screen.getByRole('status').textContent).toMatch(/Selected/);
    expect(window.getSelection()?.toString()).toBe('pw');
  });
});
