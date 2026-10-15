// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
      <output data-testid="applied">{p.applied.req.twists}</output>
    </>
  );
}

function mount() {
  const local = memoryStore();
  render(
    <PasswordsProvider generator={syncGenerator()} local={local} session={memoryStore()} debounceMs={0}>
      <Probe />
      <ApplyBar />
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
});
