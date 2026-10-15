// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syncGenerator } from '../lib/generator';
import { scoreCold } from '../lib/score';
import { SELECTED_KEY } from '../lib/selectedStore';
import { memoryStore } from '../lib/storage';
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
  it('shows each entry with its hint, its cold score and when it was added', () => {
    mount();
    const items = within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = within(items[0]!);
    const code = first.getByText(ENTRIES[0]!.password);
    expect(code.getAttribute('title')).toBe(ENTRIES[0]!.password); // the full password shows on hover when it is cut short
    expect(first.getByText(ENTRIES[0]!.hint)).toBeTruthy();
    const score = scoreCold(ENTRIES[0]!.password, ENTRIES[0]!.hint);
    expect(first.getByText(`≈${score.bits.toFixed(0)} bits`)).toBeTruthy();
    expect(first.getByText(new RegExp(`Difficulty ${score.difficulty.score}`))).toBeTruthy();
    expect(first.getByText(/Added/)).toBeTruthy();
    expect(within(items[1]!).queryByText(/Added/)).toBeNull(); // the epoch placeholder is not a date worth showing
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
