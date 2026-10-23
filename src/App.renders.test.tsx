// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIUM, NARROW } from './components/useMediaQuery';

// Each memoised component is swapped for a copy whose inner function counts its renders. The memo and its
// comparison stay; only a render that gets past the memo is counted. Counts, never a clock.
const renders = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const counting = <M extends Record<string, unknown>>(name: string, module: M): M => {
    const exported = module[name] as { $$typeof?: symbol; type: (props: object) => unknown } | undefined;
    if (exported?.$$typeof !== Symbol.for('react.memo')) throw new Error(`${name} is not a memo component`);
    const inner = exported.type;
    const type = (props: object) => {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return inner(props);
    };
    return { ...module, [name]: { ...exported, type } };
  };
  return { counts, counting, count: (name: string) => counts.get(name) ?? 0 };
});
vi.mock('./components/SuggestionCard', async (original) => renders.counting('SuggestionCard', await original()));
vi.mock('./components/StrengthPanel', async (original) => renders.counting('StrengthPanel', await original()));
vi.mock('./components/RequirementsForm', async (original) => renders.counting('RequirementsForm', await original()));
vi.mock('./components/TwistsPanel', async (original) => renders.counting('TwistsPanel', await original()));
vi.mock('./components/SiteRules', async (original) => renders.counting('SiteRules', await original()));
vi.mock('./components/ListEntry', async (original) => renders.counting('ListEntry', await original()));

import { App } from './App';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = '';
});

const cards = () => screen.queryAllByRole('article');
const passwordOf = (card: HTMLElement) => within(card).getByText((_, el) => el?.classList.contains('password') === true).textContent!;
/** The first batch is on the page, nothing is working, and every zxcvbn reading is in (a reading renders its card). */
const settled = async () => {
  await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
  await waitFor(() => expect(screen.queryByText('Working…')).toBeNull(), { timeout: 10_000 });
  await waitFor(() => expect(screen.queryAllByRole('img', { name: 'zxcvbn: checking…' })).toHaveLength(0), { timeout: 10_000 });
};
const typeInMadeUpSentence = () => {
  const field = screen.getByLabelText('Generated sentence') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: `${field.value}x` } });
};

describe('App: what renders', () => {
  it('a keystroke in the made-up sentence renders no card, strength panel, requirements form, swaps panel or site rules', { timeout: 30_000 }, async () => {
    render(<App />);
    await settled();
    renders.counts.clear();
    typeInMadeUpSentence();
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy(); // the page did take the key
    for (const name of ['SuggestionCard', 'StrengthPanel', 'RequirementsForm', 'TwistsPanel', 'SiteRules']) expect([name, renders.count(name)]).toEqual([name, 0]);
  });

  it('starting a batch renders no card; the batch renders its own cards when it lands', { timeout: 30_000 }, async () => {
    render(<App />);
    await settled();
    const before = cards().map(passwordOf);
    renders.counts.clear();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByText('Working…')).toBeTruthy();
    expect(renders.count('SuggestionCard')).toBe(0);
    await waitFor(() => expect(screen.queryByText('Working…')).toBeNull(), { timeout: 10_000 });
    expect(cards().map(passwordOf)).not.toEqual(before);
    expect(renders.count('SuggestionCard')).toBeGreaterThanOrEqual(cards().length);
  });

  it('a card still renders when what it shows changes: Add marks it Added, a new typing mode rescores it', { timeout: 30_000 }, async () => {
    render(<App />);
    await settled();
    renders.counts.clear();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Add' }));
    expect(renders.count('SuggestionCard')).toBe(1);
    expect(within(cards()[0]!).getByRole('button', { name: 'Added' })).toBeTruthy();

    renders.counts.clear();
    fireEvent.click(within(screen.getByRole('region', { name: 'Mode' })).getByRole('button', { name: 'One-handed' }));
    expect(renders.count('SuggestionCard')).toBeGreaterThanOrEqual(cards().length);
    for (const c of cards()) expect(within(c).getByText(/^Difficulty \d+$/).getAttribute('aria-label')).toMatch(/\(one-handed\)$/);
  });

  it('in sentence mode the swaps follow the sentence as it is typed', { timeout: 30_000 }, async () => {
    render(<App />);
    await settled();
    fireEvent.click(screen.getByRole('tab', { name: 'Use my sentence' }));
    const sentence = screen.getByLabelText('Your sentence') as HTMLTextAreaElement;
    fireEvent.change(sentence, { target: { value: 'sally eats sweets' } });
    const ph = () => screen.getByRole('button', { name: 'ph→f' }) as HTMLButtonElement;
    expect(ph().disabled).toBe(true);
    fireEvent.change(sentence, { target: { value: 'sally eats sweets photo' } });
    expect(ph().disabled).toBe(false);
  });

  it('a keystroke in the made-up sentence renders no row of My list; a new typing mode renders every row', { timeout: 30_000 }, async () => {
    render(<App />);
    await settled();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Add' }));
    fireEvent.click(within(cards()[1]!).getByRole('button', { name: 'Add' }));
    const list = screen.getByRole('list', { name: 'My passwords' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await settled(); // the rows' readings are in
    renders.counts.clear();
    typeInMadeUpSentence();
    expect(renders.count('ListEntry')).toBe(0);
    fireEvent.click(within(screen.getByRole('region', { name: 'Mode' })).getByRole('button', { name: 'One-handed' }));
    expect(renders.count('ListEntry')).toBeGreaterThanOrEqual(2);
    for (const row of within(list).getAllByRole('listitem')) expect(within(row).getByText(/^Difficulty \d+$/).getAttribute('aria-label')).toMatch(/\(one-handed\)$/);
  });
});

describe('App: what renders when the window narrows', () => {
  // A window that starts wide enough for three columns and can be narrowed to one. As in a browser, only the
  // queries whose answer changes are told.
  const resizable = () => {
    let narrow = false;
    const narrows = (query: string) => query === NARROW || query === MEDIUM;
    const listeners = new Set<{ query: string; f: () => void }>();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        get matches() {
          return narrow && narrows(query);
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, f: () => void) => listeners.add({ query, f }),
        removeEventListener: (_: string, f: () => void) => listeners.forEach((l) => l.f === f && listeners.delete(l)),
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }),
    });
    return () => {
      narrow = true;
      act(() => listeners.forEach((l) => narrows(l.query) && l.f()));
    };
  };
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it('Practise on a card opens the Testing column when only one column fits, after the columns have changed', { timeout: 30_000 }, async () => {
    const narrowWindow = resizable();
    render(<App />);
    await settled();
    const main = document.querySelector('main')!;
    expect(main.className).toBe('columns');
    // The cards were last rendered with three columns open; the window narrows, and their props do not change.
    renders.counts.clear();
    narrowWindow();
    expect(main.className).toBe('columns narrow focus-suggestions');
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(main.className).toBe('columns narrow focus-options');
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
    expect(main.className).toBe('columns narrow focus-suggestions');
    expect(renders.count('SuggestionCard')).toBe(0);
    const password = passwordOf(cards()[0]!);
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Practise' }));
    expect(main.className).toBe('columns narrow focus-list');
    const result = document.querySelector('.typing-result')!;
    expect(result.textContent).toContain('Testing:');
    expect(result.textContent).toContain(password);
  });
});
