// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstantTip } from './InstantTip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = (when?: () => boolean) =>
  render(
    <div style={{ overflow: 'hidden' }}>
      <InstantTip content="Difficulty 44, demanding" when={when}>
        <span>Difficulty 44</span>
      </InstantTip>
    </div>,
  );

describe('InstantTip', () => {
  it('opens at once on hover or focus, and closes on leave or Escape', () => {
    mount();
    const anchor = screen.getByText('Difficulty 44').parentElement!;
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(anchor);
    expect(screen.getByRole('tooltip').textContent).toBe('Difficulty 44, demanding');
    fireEvent.mouseLeave(anchor);
    act(() => vi.advanceTimersByTime(200)); // leaving waits a moment, so the pointer can reach the tip
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(anchor);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(anchor, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays open while the pointer is over it, lives at the document level, and closes on scroll', () => {
    mount();
    const anchor = screen.getByText('Difficulty 44').parentElement!;
    fireEvent.mouseEnter(anchor);
    const tip = screen.getByRole('tooltip');
    expect(tip.parentElement).toBe(document.body); // a portal: no card or column can clip it
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

  it('does nothing when its condition says there is nothing to show', () => {
    mount(() => false);
    const anchor = screen.getByText('Difficulty 44').parentElement!;
    fireEvent.mouseEnter(anchor);
    fireEvent.focus(anchor);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
