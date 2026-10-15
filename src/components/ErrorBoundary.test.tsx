// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  it('shows the error and a way out instead of a blank page', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(
      <ErrorBoundary onReset={reset}>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('kaboom');
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reset).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });
});
