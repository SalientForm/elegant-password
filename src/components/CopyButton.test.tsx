// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { CopyButton } from './CopyButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ text = 'secret-pw' }) {
  const code = useRef<HTMLElement>(null);
  return (
    <>
      <code ref={code}>{text}</code>
      <CopyButton text={text} fallback={code} />
    </>
  );
}

const setClipboard = (impl: (() => Promise<void>) | undefined) =>
  Object.defineProperty(navigator, 'clipboard', { value: impl ? { writeText: impl } : undefined, configurable: true });

describe('CopyButton', () => {
  it('reports success when the clipboard works', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard(write);
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(write).toHaveBeenCalledWith('secret-pw');
    expect(screen.getByRole('button').textContent).toBe('Copied');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('selects the text and says so when the clipboard is unavailable', async () => {
    setClipboard(undefined);
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('status').textContent).toMatch(/Copy failed/);
    expect(window.getSelection()?.toString()).toBe('secret-pw');
  });

  it('also handles a rejecting clipboard, as in an unfocused or insecure page', async () => {
    setClipboard(vi.fn().mockRejectedValue(new DOMException('NotAllowedError')));
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('status').textContent).toMatch(/Copy failed/);
  });
});
