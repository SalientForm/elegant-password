// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../state/storage';
import { PasswordsProvider, usePasswords } from '../state/PasswordsProvider';
import { SessionControls } from './SessionControls';

afterEach(cleanup);

/** A store whose writes fail while `fail` is set, as a full or blocked storage does. */
function failingStore() {
  const inner = memoryStore();
  const store = {
    fail: true,
    getItem: (key: string) => inner.getItem(key),
    setItem: (key: string, value: string) => {
      if (store.fail) throw new DOMException('full', 'QuotaExceededError');
      inner.setItem(key, value);
    },
    removeItem: (key: string) => inner.removeItem(key),
  };
  return store;
}

function Probe() {
  const p = usePasswords();
  return (
    <>
      <output data-testid="sentence">{p.generated?.words.join(' ') ?? ''}</output>
      <output data-testid="epoch">{p.sessionEpoch}</output>
    </>
  );
}

function mount({ session = memoryStore(), persistSecrets = true }: { session?: KeyValueStore; persistSecrets?: boolean } = {}) {
  render(
    <PasswordsProvider local={memoryStore()} session={session} debounceMs={0} persistSecrets={persistSecrets}>
      <Probe />
      <SessionControls />
    </PasswordsProvider>,
  );
}

const panel = () => screen.getByRole('region', { name: 'This session' });
const hint = () => panel().querySelector('.hint')!.textContent;
const text = (id: string) => screen.getByTestId(id).textContent;
const forget = () => screen.getByRole('button', { name: /forget/i });
const status = () => within(panel()).getByRole('status').textContent;

describe('SessionControls', () => {
  it('says the session is kept through a reload on the app\'s own origin, and offers no retry', () => {
    mount();
    expect(hint()).toMatch(/^The passwords on screen and your sentences are kept through a reload of this tab, and gone when it closes\./);
    expect(hint()).toMatch(/Forgetting the session clears them and the password under test, and draws a new sentence; My list and your settings stay\.$/);
    expect(screen.queryByRole('button', { name: 'Try saving again' })).toBeNull();
  });

  it('says the session is in memory only on a shared origin', () => {
    mount({ persistSecrets: false });
    expect(hint()).toMatch(/^The passwords on screen and your sentences are kept in memory only, and gone when this tab reloads or closes\./);
    expect(screen.queryByRole('button', { name: 'Try saving again' })).toBeNull();
  });

  it('says when the session could not be saved, and Try saving again saves it once storage takes writes again', async () => {
    const session = failingStore();
    mount({ session });
    await waitFor(() => expect(hint()).toMatch(/could not be saved for a reload \(this browser’s storage is full or blocked\): a reload loses them\./));
    session.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    await waitFor(() => expect(hint()).toMatch(/are kept through a reload of this tab/));
    expect(screen.queryByRole('button', { name: 'Try saving again' })).toBeNull();
  });

  it('asks before forgetting: the first click only asks, the second forgets and says so', async () => {
    mount();
    await waitFor(() => expect(text('sentence')).not.toBe(''));
    expect(status()).toBe('');
    fireEvent.click(forget());
    expect(forget().textContent).toBe('Really forget?');
    expect(forget().className).toBe('danger');
    expect(text('epoch')).toBe('0'); // nothing forgotten yet
    fireEvent.click(forget());
    expect(text('epoch')).toBe('1');
    expect(forget().textContent).toBe('Forget this session');
    expect(forget().className).toBe('');
    expect(status()).toBe('Session forgotten: the passwords, sentences and password under test are cleared.');
  });

  it('drops the question when focus leaves the button, so a later click asks again', () => {
    mount();
    fireEvent.click(forget());
    expect(forget().textContent).toBe('Really forget?');
    fireEvent.blur(forget());
    expect(forget().textContent).toBe('Forget this session');
    fireEvent.click(forget());
    expect(forget().textContent).toBe('Really forget?');
    expect(text('epoch')).toBe('0');
    expect(status()).toBe('');
  });
});
