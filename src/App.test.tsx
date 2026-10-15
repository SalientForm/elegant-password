// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

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
    fireEvent.click(within(card).getByRole('button', { name: 'Add to my list' }));
    const list = screen.getByRole('list', { name: 'My passwords' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toContain(password);
    expect(list.textContent).toMatch(/Hint:/);
    expect(within(card).getByRole('button', { name: 'In my list' })).toBeTruthy();
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
    // The first card's "Why?" is open and shows the hint: the sentence itself.
    await waitFor(() => expect(within(cards()[0]!).getByText(/Sally eats sweets on Sundays/)).toBeTruthy(), { timeout: 10_000 });
    const shown = passwordsShown();
    first.unmount();
    render(<App />);
    await waitFor(() => expect(cards().length).toBe(shown.length));
    expect(passwordsShown()).toEqual(shown);
    expect((screen.getByLabelText('Your sentence') as HTMLTextAreaElement).value).toBe('Sally eats sweets on Sundays');
  });
});

describe('App: order and pages', () => {
  const scores = () => cards().map((c) => Number(within(c).getByText(/^Difficulty \d+/).textContent!.match(/\d+/)![0]));
  const bits = () => cards().map((c) => Number(within(c).getByText(/bits$/).textContent!.match(/\d+/)![0]));

  it('shows suggestions easiest first by default and strongest first on request', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const easy = scores();
    expect([...easy].sort((a, b) => a - b)).toEqual(easy);
    expect(screen.getByRole('button', { name: 'Easiest first' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Strongest first' }));
    const strong = bits();
    expect([...strong].sort((a, b) => b - a)).toEqual(strong);
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:sort:v1')!)).toBe('strongest');
  });

  it('has a Scoring page with the rubric and the bits explanation, and keeps the typing test and list in the right column', async () => {
    render(<App />);
    expect(screen.getByLabelText('Password to test')).toBeTruthy();
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
    expect(screen.getByText('brought to you by SalientForm')).toBeTruthy();
    expect(screen.getByText(/read like a sentence/)).toBeTruthy();
  });
});
