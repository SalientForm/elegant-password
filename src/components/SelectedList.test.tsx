// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syncGenerator } from '../state/generator';
import { scoreCold } from '../lib/score';
import { SELECTED_KEY } from '../state/selectedStore';
import { memoryStore } from '../state/storage';
import { PasswordsProvider } from '../state/PasswordsProvider';
import { SelectedList } from './SelectedList';

afterEach(cleanup);

const ENTRIES = [
  { password: '13;Worthy;storks;openly;pet;twisty;toys', hint: '13 worthy storks openly pet twisty toys', addedAt: '2026-10-15T12:00:00.000Z' },
  { password: 'jr;B;5ls;Fpc', hint: 'jupiter brings 5 leds for piece', addedAt: '1970-01-01T00:00:00.000Z' },
];

function mount(entries = ENTRIES) {
  const local = memoryStore();
  local.setItem(SELECTED_KEY, JSON.stringify(entries));
  render(
    <PasswordsProvider generator={syncGenerator()} local={local} session={memoryStore()} debounceMs={0}>
      <SelectedList />
    </PasswordsProvider>,
  );
  return local;
}

describe('SelectedList', () => {
  it('shows each entry with its hint and its cold score, and keeps the date out of sight', async () => {
    const local = mount();
    const items = within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = within(items[0]!);
    const code = first.getByText(ENTRIES[0]!.password);
    expect(code.getAttribute('title')).toBeNull(); // no browser tooltip at all: it is slow and cannot be copied
    expect(code.getAttribute('role')).toBe('button'); // clicking the password copies it
    // The tip exists only for a password that is cut off; one that fits has no rollover (jsdom has no layout, so widths are faked).
    fireEvent.mouseEnter(code.parentElement!);
    expect(screen.queryByRole('tooltip')).toBeNull();
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 120 });
    fireEvent.mouseEnter(code.parentElement!);
    expect(screen.getByRole('tooltip').textContent).toBe(ENTRIES[0]!.password); // immediate, real text that can be selected
    fireEvent.mouseLeave(code.parentElement!);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull()); // leaving waits a moment so the pointer can reach the tip
    delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    expect(first.getByText(ENTRIES[0]!.hint)).toBeTruthy();
    const score = scoreCold(ENTRIES[0]!.password, ENTRIES[0]!.hint);
    const s = first.getByText(`Strength ${score.bits.toFixed(0)}`);
    expect(s.getAttribute('title')).toBeNull(); // the app's instant tip, not the browser's
    fireEvent.mouseEnter(s.parentElement!);
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Strength \d+ bits, (master password|very strong|strong|everyday|weak)/);
    fireEvent.mouseLeave(s.parentElement!);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    const d = first.getByText(`Difficulty ${score.difficulty.score}`);
    fireEvent.mouseEnter(d.parentElement!);
    expect(screen.getByRole('tooltip').textContent).toBe(`Difficulty ${score.difficulty.score}, ${score.difficulty.label.toLowerCase()} (ten-finger)`); // the full reading, at once, for the typing mode
    fireEvent.mouseLeave(d.parentElement!);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    fireEvent.mouseEnter(first.getByText(`Memory ${score.memorability.score}`).parentElement!);
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Memorability \d+ of 100/);
    expect(first.queryByText(/Added/)).toBeNull(); // stored, never displayed
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)[0].addedAt).toBe(ENTRIES[0]!.addedAt);
  });

  it('removes one entry, and removes all only on a second click', () => {
    const local = mount();
    fireEvent.click(screen.getByRole('button', { name: `Remove ${ENTRIES[1]!.password} from my list` }));
    expect(within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem')).toHaveLength(1);
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toHaveLength(1);
    const removeAll = screen.getByRole('button', { name: 'Remove all' });
    fireEvent.click(removeAll);
    expect(removeAll.textContent).toBe('Really remove all?');
    expect(screen.getByRole('list', { name: 'My passwords' })).toBeTruthy(); // still there
    fireEvent.blur(removeAll);
    expect(removeAll.textContent).toBe('Remove all'); // asking again next time
    fireEvent.click(removeAll);
    fireEvent.click(removeAll);
    expect(screen.queryByRole('list', { name: 'My passwords' })).toBeNull();
    expect(screen.getByText('Nothing yet. Use “Add” on a suggestion.')).toBeTruthy();
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toEqual([]);
  });
});

describe('SelectedList with characters off the US keyboard', () => {
  it('shows an entry such as “naïve;otters” restored from storage, scored, instead of crashing the page', () => {
    mount([{ password: 'naïve;otters', hint: 'naive otters', addedAt: '2026-10-15T12:00:00.000Z' }]);
    const item = within(screen.getByRole('list', { name: 'My passwords' })).getByRole('listitem');
    expect(within(item).getByText('naïve;otters')).toBeTruthy();
    const score = scoreCold('naïve;otters', 'naive otters');
    expect(within(item).getByText(`Difficulty ${score.difficulty.score}`)).toBeTruthy();
    expect(within(item).getByText(`Memory ${score.memorability.score}`)).toBeTruthy();
  });
});
