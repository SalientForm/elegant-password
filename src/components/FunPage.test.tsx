// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadText, FunPage, REVOKE_DELAY_MS } from './FunPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:fake'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

describe('Fun page download', () => {
  it('does not revoke the download URL until the browser has had time to start the download', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadText('# hello', 'spec.md');
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_DELAY_MS - 1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('renders the spec with copy and download controls', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<FunPage />);
    expect(screen.getByText(/Build "Elegant Passwords"/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Download/ }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
  });
});

describe('Fun page development stats', () => {
  it('shows tokens, models, lines of code, time in development and commits', () => {
    render(<FunPage />);
    const stats = screen.getByRole('region', { name: 'How this app was made' });
    for (const label of ['Estimated tokens used', /LLM models? used/, 'Lines of code', 'Time in development', 'Commits']) {
      expect(within(stats).getByText(label)).toBeTruthy();
    }
    expect(within(stats).getByText(/Claude/, { selector: 'dd:not(.hint)' })).toBeTruthy();
  });
});
