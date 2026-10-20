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
  it('can be an icon with the label as its accessible name', async () => {
    setClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton text="x" icon />);
    const button = screen.getByRole('button', { name: 'Copy' });
    expect(button.textContent).toBe(''); // icon only
    expect(button.querySelector('svg')).toBeTruthy();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('reports success when the clipboard works', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard(write);
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(write).toHaveBeenCalledWith('secret-pw');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Copied'); // announced to assistive technology, visually hidden
    expect(screen.getByRole('status').className).toContain('sr-only');
  });

  it('selects the text and says so when the clipboard is unavailable', async () => {
    setClipboard(undefined);
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('status').textContent).toMatch(/^Could not copy\. The text is selected: copy it from the selection\.$/);
    expect(window.getSelection()?.toString()).toBe('secret-pw');
  });

  it('also handles a rejecting clipboard, as in an unfocused or insecure page', async () => {
    setClipboard(vi.fn().mockRejectedValue(new DOMException('NotAllowedError')));
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('status').textContent).toMatch(/^Could not copy\. The text is selected: copy it from the selection\.$/);
  });
});
