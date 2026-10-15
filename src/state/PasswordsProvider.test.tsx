// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inputsKey, runInputs, type GenerateRequest } from '../lib/engine';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import type { Generator } from '../lib/generator';
import { activeMappings, loadMappingSettings } from '../lib/mappingStore';
import { SELECTED_KEY } from '../lib/selectedStore';
import { loadSession, SESSION_KEY } from '../lib/sessionStore';
import { REQUIREMENTS_KEY } from '../lib/settingsStore';
import { memoryStore } from '../lib/storage';
import { PasswordsProvider, usePasswords } from './PasswordsProvider';

afterEach(cleanup);

/** An inline generator that counts its runs. */
function countingGenerator(): Generator & { runs: GenerateRequest[] } {
  const runs: GenerateRequest[] = [];
  return {
    runs,
    run: (request) => {
      runs.push(request);
      return Promise.resolve(runInputs(request));
    },
    dispose: () => {},
  };
}

function Probe() {
  const p = usePasswords();
  const first = p.outcome?.ok ? p.outcome.suggestions[0] : undefined;
  return (
    <div>
      <output data-testid="busy">{String(p.busy)}</output>
      <output data-testid="stale">{String(p.stale)}</output>
      <output data-testid="first">{first?.password ?? ''}</output>
      <output data-testid="error">{p.outcome && !p.outcome.ok ? p.outcome.error : ''}</output>
      <output data-testid="selected">{p.selected.map((e) => e.password).join('|')}</output>
      <button onClick={() => p.setReq({ ...p.req, twists: 3 })}>twists3</button>
      <button onClick={() => p.setReq({ ...p.req, minLength: 40, maxLength: 20 })}>contradict</button>
      <button onClick={p.regenerate}>again</button>
      <button onClick={() => first && p.addSelected(first)}>add</button>
      <button onClick={() => p.selected[0] && p.removeSelected(p.selected[0].password)}>remove</button>
      <button onClick={() => p.setMode('sentence')}>sentence-mode</button>
      <button onClick={() => p.setSentence('Sally eats sweets on Sundays')}>type</button>
    </div>
  );
}

const mount = (gen: Generator, local = memoryStore(), session = memoryStore()) => {
  const utils = render(
    <PasswordsProvider generator={gen} local={local} session={session} debounceMs={0}>
      <Probe />
    </PasswordsProvider>,
  );
  return { ...utils, local, session };
};

const settled = async () => {
  await waitFor(() => expect(screen.getByTestId('busy').textContent).toBe('false'));
  await waitFor(() => expect(screen.getByTestId('first').textContent).not.toBe(''));
};

describe('PasswordsProvider', () => {
  it('generates on mount, regenerates when inputs change or on request, and ignores no-op changes', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    expect(gen.runs).toHaveLength(1);
    const before = screen.getByTestId('first').textContent;
    fireEvent.click(screen.getByText('again'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    await settled();
    expect(screen.getByTestId('first').textContent).not.toBe(before);
    fireEvent.click(screen.getByText('twists3'));
    await waitFor(() => expect(gen.runs).toHaveLength(3));
    expect(gen.runs[2]!.req.twists).toBe(3);
    // Typing a sentence while making one up changes nothing.
    fireEvent.click(screen.getByText('type'));
    await settled();
    expect(gen.runs).toHaveLength(3);
  });

  it('keeps the current passwords across a reload without rolling new ones', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    const shown = screen.getByTestId('first').textContent;
    expect(loadSession(session)?.outcome).toBeTruthy();
    unmount();
    // A fresh mount with the same stores is what a reload is.
    const gen2 = countingGenerator();
    mount(gen2, local, session);
    await settled();
    expect(screen.getByTestId('first').textContent).toBe(shown);
    expect(gen2.runs).toHaveLength(0);
    // The stored key really is the key of the restored inputs.
    const stored = loadSession(session)!;
    expect(stored.key).toBe(
      inputsKey({ mode: 'generated', req: DEFAULT_REQUIREMENTS, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: activeMappings(loadMappingSettings(local)) }),
    );
  });

  it('persists settings, the mode, the sentence and the selected list', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    fireEvent.click(screen.getByText('twists3'));
    fireEvent.click(screen.getByText('add'));
    const added = screen.getByTestId('first').textContent!;
    expect(screen.getByTestId('selected').textContent).toBe(added);
    fireEvent.click(screen.getByText('add')); // adding twice keeps one
    expect(screen.getByTestId('selected').textContent).toBe(added);
    expect(JSON.parse(local.getItem(REQUIREMENTS_KEY)!).twists).toBe(3);
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toEqual([expect.objectContaining({ password: added, hint: expect.any(String) })]);
    fireEvent.click(screen.getByText('sentence-mode'));
    fireEvent.click(screen.getByText('type'));
    await waitFor(() => expect(JSON.parse(session.getItem(SESSION_KEY)!).sentence).toBe('Sally eats sweets on Sundays'));
    unmount();
    mount(countingGenerator(), local, session);
    expect(screen.getByTestId('selected').textContent).toBe(added);
    fireEvent.click(screen.getByText('remove'));
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe(''));
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toEqual([]);
  });

  it('shows requirement problems as messages and marks a batch stale while new inputs are pending', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    fireEvent.click(screen.getByText('contradict'));
    expect(screen.getByTestId('stale').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('error').textContent).toMatch(/Maximum length/));
    expect(screen.getByTestId('stale').textContent).toBe('false');
  });

  it('drops answers to superseded requests', async () => {
    const resolvers: ((o: ReturnType<typeof runInputs>) => void)[] = [];
    const requests: GenerateRequest[] = [];
    const slow: Generator = {
      run: (request) => {
        requests.push(request);
        return new Promise((resolve) => resolvers.push(resolve));
      },
      dispose: vi.fn(),
    };
    mount(slow);
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.click(screen.getByText('again'));
    await waitFor(() => expect(requests).toHaveLength(2));
    const { id: _id, ...second } = requests[1]!;
    const late = runInputs(requests[0]!);
    const fresh = runInputs(second);
    await act(async () => resolvers[1]!(fresh));
    await act(async () => resolvers[0]!(late));
    expect(screen.getByTestId('first').textContent).toBe(fresh.ok ? fresh.suggestions[0]!.password : '');
  });
});
