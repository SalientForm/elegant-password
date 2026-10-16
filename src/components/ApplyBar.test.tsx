// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { syncGenerator } from '../lib/generator';
import { REQUIREMENTS_KEY } from '../lib/settingsStore';
import { memoryStore } from '../lib/storage';
import { PasswordsProvider, usePasswords } from '../state/PasswordsProvider';
import { ApplyBar } from './ApplyBar';

afterEach(cleanup);

function Probe() {
  const p = usePasswords();
  return (
    <>
      <button onClick={() => p.setReq({ ...p.draft.req, twists: 3 })}>edit</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minSymbols: 2, allowedSymbols: '' })}>contradict</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minLength: 40 })}>contradict more</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minSymbols: 0, minLength: 12 })}>fix</button>
      <output data-testid="applied">{p.applied.req.twists}</output>
      <output data-testid="applied-symbols">{p.applied.req.allowedSymbols}</output>
    </>
  );
}

function mount(onShowProblems?: () => void) {
  const local = memoryStore();
  render(
    <PasswordsProvider generator={syncGenerator()} local={local} session={memoryStore()} debounceMs={0}>
      <Probe />
      <ApplyBar onShowProblems={onShowProblems} />
    </PasswordsProvider>,
  );
  return local;
}
const bar = () => screen.queryByRole('region', { name: 'Unapplied changes' });

describe('ApplyBar', () => {
  it('appears only with a draft, submits on click or Ctrl+Enter, and discards', async () => {
    const local = mount();
    expect(bar()).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true }); // nothing to submit: nothing happens
    fireEvent.click(screen.getByText('edit'));
    expect(bar()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit changes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(bar()).toBeNull();
    expect(screen.getByTestId('applied').textContent).not.toBe('3');

    fireEvent.click(screen.getByText('edit'));
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(bar()).toBeNull();
    expect(screen.getByTestId('applied').textContent).toBe('3');
    await waitFor(() => expect(JSON.parse(local.getItem(REQUIREMENTS_KEY)!).twists).toBe(3));
  });

  it('submits on plain Enter or ⌘+Enter, discards on Escape, and leaves buttons, links and selects to their own Enter', () => {
    mount();
    fireEvent.click(screen.getByText('edit'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Discard' }), { key: 'Enter' }); // the button handles its own Enter
    expect(bar()).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(bar()).toBeNull();
    expect(screen.getByTestId('applied').textContent).not.toBe('3');
    fireEvent.click(screen.getByText('edit'));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(bar()).toBeNull();
    expect(screen.getByTestId('applied').textContent).toBe('3');
    fireEvent.click(screen.getByText('edit'));
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    expect(bar()).toBeNull();
  });

  it('disables Submit while the draft contradicts itself, says why above it, and refuses Enter and Ctrl+Enter until it is fixed', () => {
    const show = vi.fn();
    mount(show);
    fireEvent.click(screen.getByText('contradict'));
    const submit = screen.getByRole('button', { name: 'Submit changes' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const alert = within(bar()!).getByRole('alert');
    expect(alert.textContent).toMatch(/^Fix this to submit: 2 symbols are required, but no symbols are allowed\./);
    expect(submit.getAttribute('aria-describedby')).toBe(alert.id);
    fireEvent.click(screen.getByText('contradict more'));
    expect(within(bar()!).getByRole('alert').textContent).toMatch(/^Fix 2 problems to submit: The minimum length \(40\) is above the maximum \(32\)\./);
    for (const key of [{ key: 'Enter' }, { key: 'Enter', ctrlKey: true }, { key: 'Enter', metaKey: true }]) fireEvent.keyDown(window, key);
    fireEvent.click(submit);
    expect(bar()).toBeTruthy();
    expect(screen.getByTestId('applied-symbols').textContent).toBe(DEFAULT_REQUIREMENTS.allowedSymbols);
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Show' }));
    expect(show).toHaveBeenCalledOnce();
    // Discard still works, and once fixed, Submit does too.
    fireEvent.click(screen.getByText('fix'));
    expect(within(bar()!).queryByRole('alert')).toBeNull();
    expect((screen.getByRole('button', { name: 'Submit changes' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(bar()).toBeNull();
    expect(screen.getByTestId('applied-symbols').textContent).toBe('');
  });
});
