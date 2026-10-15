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
  it('shows suggestions, lets one be added to the list, and keeps both across a reload', async () => {
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
