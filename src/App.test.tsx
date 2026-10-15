// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { NARROW } from './components/useMediaQuery';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = '';
});

const cards = () => screen.getAllByRole('article');

describe('App', () => {
  it('shows suggestions, lets one be added to the list, and keeps both across a reload', { timeout: 30_000 }, async () => {
    const first = render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const card = cards()[0]!;
    const password = within(card).getByText((_, el) => el?.classList.contains('password') === true).textContent!;
    fireEvent.click(within(card).getByRole('button', { name: 'Add' }));
    const list = screen.getByRole('list', { name: 'My passwords' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toContain(password);
    expect(list.textContent).toMatch(/Hint:/);
    expect(within(card).getByRole('button', { name: 'Added' })).toBeTruthy();
    const passwords = cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);

    first.unmount();
    render(<App />);
    await waitFor(() => expect(cards().length).toBe(passwords.length));
    const again = cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);
    expect(again).toEqual(passwords);
    expect(within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('has accessible mode tabs and a status while working', async () => {
    render(<App />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tablist', { name: /sentence/i })).toBeTruthy();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByLabelText('Your sentence')).toBeTruthy();
  });
});

describe('App: apply changes', () => {
  const passwordsShown = () => cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);

  it('floats an apply bar only while there are unapplied changes, and applies on request', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull();
    const before = passwordsShown();

    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    const bar = screen.getByRole('region', { name: 'Unapplied changes' });
    expect(bar).toBeTruthy();
    // Nothing applied yet: same passwords, nothing saved.
    expect(passwordsShown()).toEqual(before);
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:requirements:v1')!).comfort).toBe('balanced');

    fireEvent.click(within(bar).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Strict' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull());
    await waitFor(() => expect(passwordsShown()).not.toEqual(before), { timeout: 10_000 });
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:requirements:v1')!).comfort).toBe('strict');
  });

  it('turns a typed sentence into passwords when applied, and keeps them across a reload', { timeout: 30_000 }, async () => {
    const first = render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.keyDown(screen.getAllByRole('tab')[0]!, { key: 'ArrowRight' });
    fireEvent.change(screen.getByLabelText('Your sentence'), { target: { value: 'Sally eats sweets on Sundays' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    // Open the first card's "Why?": it shows the hint, the sentence itself.
    await waitFor(() => {
      const c = cards()[0]!;
      const why = within(c).queryByRole('button', { name: 'Why?' });
      if (why) fireEvent.click(why);
      expect(within(c).getByText(/Sally eats sweets on Sundays/)).toBeTruthy();
    }, { timeout: 10_000 });
    const shown = passwordsShown();
    first.unmount();
    render(<App />);
    await waitFor(() => expect(cards().length).toBe(shown.length));
    expect(passwordsShown()).toEqual(shown);
    expect((screen.getByLabelText('Your sentence') as HTMLTextAreaElement).value).toBe('Sally eats sweets on Sundays');
  });
});

describe('App: order and pages', () => {
  const scores = () => cards().map((c) => Number(within(c).getByText(/^D \d+$/).textContent!.match(/\d+/)![0]));
  const bits = () => cards().map((c) => Number(within(c).getByText(/^S \d+$/).textContent!.match(/\d+/)![0]));

  it('orders by difficulty by default, and by strength or memorability on request', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const easy = scores();
    expect([...easy].sort((a, b) => a - b)).toEqual(easy);
    expect(screen.getByRole('button', { name: 'Difficulty' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    const strong = bits();
    expect([...strong].sort((a, b) => b - a)).toEqual(strong);
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:sort:v1')!)).toBe('strength');
    fireEvent.click(screen.getByRole('button', { name: 'Memorability' }));
    const memo = cards().map((c) => Number(within(c).getByText(/^M \d+$/).textContent!.match(/\d+/)![0]));
    expect([...memo].sort((a, b) => b - a)).toEqual(memo);
  });

  it('shows the first suggestion\'s sentence under the mode tabs while making one up', async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const shown = screen.getByTestId('generated-sentence').textContent;
    expect(screen.queryByText('Fast to type')).toBeNull(); // every "Why?" starts closed
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Why?' }));
    const firstHint = within(cards()[0]!).getByText((_, el) => el?.classList.contains('hint-line') === true).textContent!.replace('Hint: ', '');
    expect(shown).toBe(firstHint);
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    const top = within(cards()[0]!);
    const why = top.queryByRole('button', { name: 'Why?' });
    if (why) fireEvent.click(why); // a card keeps its own open state when the order changes
    const newFirst = top.getByText((_, el) => el?.classList.contains('hint-line') === true).textContent!.replace('Hint: ', '');
    expect(screen.getByTestId('generated-sentence').textContent).toBe(newFirst); // follows the order
  });

  it('has a Scoring page with the rubric and the bits explanation, and keeps the typing test and list in the right column', async () => {
    render(<App />);
    expect(screen.getByLabelText('Test and practice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My list' })).toBeTruthy();
    expect(screen.queryByText('How difficulty is scored')).toBeNull();
    window.location.hash = '#/scoring';
    fireEvent(window, new Event('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Strength, in bits' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeTruthy();
    expect(screen.getByText('Finger rolls')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Scoring' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows the title above the tabs with the description beside it and the SalientForm credit', () => {
    render(<App />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('The Elegant Password');
    const nav = screen.getByRole('navigation', { name: 'Pages' });
    expect(title.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // title first, tabs after
    const credit = screen.getByText((_, el) => el?.classList.contains('brand') === true);
    expect(credit.textContent?.replace(/\s+/g, ' ').trim()).toBe('brought to you by SalientForm');
    expect(credit.querySelector('strong')?.textContent).toBe('SalientForm'); // only the name is bold
    expect(screen.getByText(/read like a sentence/)).toBeTruthy();
  });
});

describe('App on a phone', () => {
  const narrowScreen = () =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === NARROW, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it('collapses the columns into Options, Suggestions and My list tabs with every feature reachable', { timeout: 30_000 }, async () => {
    narrowScreen();
    render(<App />);
    const sections = within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab');
    expect(sections.map((t) => t.textContent)).toEqual(['Options', 'Suggestions', 'My list']);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(screen.queryByText('Site requirements')).toBeNull(); // options live in their own tab
    expect(screen.queryByLabelText('Test and practice')).toBeNull(); // so do the tester and the list

    fireEvent.click(screen.getByRole('tab', { name: 'Options' }));
    expect(screen.getByText('Site requirements')).toBeTruthy();
    expect(screen.getByText('Swaps')).toBeTruthy();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'My list' }));
    expect(screen.getByLabelText('Test and practice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My list' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy(); // the floating buttons follow every tab

    fireEvent.click(screen.getByRole('tab', { name: 'Suggestions' }));
    expect(screen.getByRole('tablist', { name: 'How to make the sentence' })).toBeTruthy();
    expect(cards().length).toBeGreaterThan(0);
  });
});
