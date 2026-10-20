// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syncGenerator } from '../state/generator';
import { scoreCold } from '../lib/score';
import { strengthBits } from '../lib/strength';
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
    expect(code.getAttribute('title')).toBeNull(); // no browser tooltip at all
    expect(code.getAttribute('role')).toBeNull(); // it fits, so it is plain text: nothing to click (jsdom has no layout; widths are faked below)
    expect(first.queryByRole('button', { name: 'Copy' })).toBeNull(); // no Copy button where the pointer is fine: the text is selected like any text
    expect(first.getByText(ENTRIES[0]!.hint)).toBeTruthy();
    const score = scoreCold(ENTRIES[0]!.password, ENTRIES[0]!.hint);
    const s = first.getByText(`Strength ${Math.round(strengthBits(ENTRIES[0]!.password))}`);
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
    fireEvent.mouseEnter(first.getByText(`Memorability ${score.memorability.score}`).parentElement!);
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Memorability \d+ of 100/);
    expect(first.queryByText(/Added/)).toBeNull(); // stored, never displayed
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)[0].addedAt).toBe(ENTRIES[0]!.addedAt);
  });

  it('shows the whole of a password cut short by its column on a click, and folds it back on the next', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 120 });
    try {
      mount();
      const code = screen.getByRole('button', { name: ENTRIES[0]!.password });
      expect(code.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(code);
      expect(code.getAttribute('aria-expanded')).toBe('true');
      expect(code.className).toContain('revealed');
      fireEvent.click(code);
      expect(code.getAttribute('aria-expanded')).toBe('false');
    } finally {
      delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    }
  });

  it('offers a Copy button on a touch screen, where selecting text is hard', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: (q: string) => ({ matches: q === '(pointer: coarse)', addEventListener() {}, removeEventListener() {} }) });
    try {
      mount();
      const items = within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem');
      expect(within(items[0]!).getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
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
    expect(within(item).getByText(`Memorability ${score.memorability.score}`)).toBeTruthy();
  });
});
