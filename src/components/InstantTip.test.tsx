// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstantTip, TipGroup } from './InstantTip';

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

const tree = (labels: string[]) => (
  <>
    <button type="button">Before</button>
    <TipGroup label="Scores">
      {labels.map((l) => (
        <InstantTip key={l} content={`${l}, in full`}>
          <span>{l}</span>
        </InstantTip>
      ))}
    </TipGroup>
    <button type="button">After</button>
  </>
);
const row = (labels: string[]) => render(tree(labels));
const stops = () => [...document.querySelectorAll('.pw-tip-anchor')].map((a) => a.getAttribute('tabindex'));
const anchorOf = (label: string) => screen.getByText(label).parentElement!;

describe('TipGroup', () => {
  it('is one tab stop, the first anchor, named as a group', () => {
    row(['Strength', 'Raw', 'Difficulty']);
    expect(screen.getByRole('group', { name: 'Scores' })).toBeTruthy();
    expect(stops()).toEqual(['0', '-1', '-1']);
  });

  it('moves with the arrow keys, wraps, jumps with Home and End, and opens each tip on the way', () => {
    row(['Strength', 'Raw', 'Difficulty']);
    anchorOf('Strength').focus();
    fireEvent.keyDown(anchorOf('Strength'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(anchorOf('Raw'));
    expect(screen.getByRole('tooltip').textContent).toBe('Raw, in full');
    expect(stops()).toEqual(['-1', '0', '-1']); // Tab comes back to the last one focused
    fireEvent.keyDown(anchorOf('Raw'), { key: 'End' });
    expect(document.activeElement).toBe(anchorOf('Difficulty'));
    fireEvent.keyDown(anchorOf('Difficulty'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(anchorOf('Strength'));
    fireEvent.keyDown(anchorOf('Strength'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(anchorOf('Difficulty'));
    fireEvent.keyDown(anchorOf('Difficulty'), { key: 'Home' });
    expect(document.activeElement).toBe(anchorOf('Strength'));
    expect(screen.getAllByRole('tooltip').map((t) => t.textContent)).toEqual(['Strength, in full']);
  });

  it('leaves other keys alone and keeps one stop when an anchor joins or leaves', () => {
    const { rerender } = row(['Strength', 'Raw']);
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    anchorOf('Strength').dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false); // the page still scrolls
    anchorOf('Raw').focus();
    rerender(tree(['Strength', 'zxcvbn', 'Raw']));
    expect(stops()).toEqual(['-1', '-1', '0']); // the newcomer is reachable by arrow, not a second stop
    rerender(tree(['Strength', 'zxcvbn']));
    expect(stops()).toEqual(['0', '-1']); // the stop left, so the first takes over
  });
});
