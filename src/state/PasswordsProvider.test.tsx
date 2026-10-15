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
      <output data-testid="dirty">{String(p.dirty)}</output>
      <output data-testid="draft">{p.draft.req.twists}</output>
      <output data-testid="applied">{p.applied.req.twists}</output>
      <output data-testid="first">{first?.password ?? ''}</output>
      <output data-testid="error">{p.outcome && !p.outcome.ok ? p.outcome.error : ''}</output>
      <output data-testid="selected">{p.selected.map((e) => e.password).join('|')}</output>
      <button onClick={() => p.setReq({ ...p.draft.req, twists: 3 })}>twists3</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minLength: 40, maxLength: 20 })}>contradict</button>
      <button onClick={p.apply}>apply</button>
      <button onClick={p.discard}>discard</button>
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

const text = (id: string) => screen.getByTestId(id).textContent;
const settled = async () => {
  await waitFor(() => expect(text('busy')).toBe('false'));
  await waitFor(() => expect(text('first')).not.toBe(''));
};

describe('PasswordsProvider', () => {
  it('generates on mount, and again only when changes are applied or a new batch is asked for', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    expect(gen.runs).toHaveLength(1);
    expect(text('dirty')).toBe('false');

    // Editing makes a draft; nothing runs and nothing is applied.
    fireEvent.click(screen.getByText('twists3'));
    expect(text('dirty')).toBe('true');
    expect(text('draft')).toBe('3');
    expect(text('applied')).toBe(String(DEFAULT_REQUIREMENTS.twists));
    await new Promise((r) => setTimeout(r, 20));
    expect(gen.runs).toHaveLength(1);

    // Applying regenerates with the draft.
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    expect(gen.runs[1]!.req.twists).toBe(3);
    expect(text('dirty')).toBe('false');
    expect(text('applied')).toBe('3');

    // A new batch with the same inputs.
    const before = text('first');
    await settled();
    fireEvent.click(screen.getByText('again'));
    await waitFor(() => expect(gen.runs).toHaveLength(3));
    await settled();
    expect(text('first')).not.toBe(before);

    // Typing a sentence while making one up is a draft that changes nothing, even when applied.
    fireEvent.click(screen.getByText('type'));
    fireEvent.click(screen.getByText('apply'));
    await new Promise((r) => setTimeout(r, 20));
    expect(gen.runs).toHaveLength(3);
    expect(text('dirty')).toBe('false');
  });

  it('discards a draft, and "Refresh" applies one', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    fireEvent.click(screen.getByText('twists3'));
    fireEvent.click(screen.getByText('discard'));
    expect(text('dirty')).toBe('false');
    expect(text('draft')).toBe(String(DEFAULT_REQUIREMENTS.twists));
    fireEvent.click(screen.getByText('twists3'));
    fireEvent.click(screen.getByText('again'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    expect(gen.runs[1]!.req.twists).toBe(3);
    expect(text('dirty')).toBe('false');
  });

  it('keeps the current passwords across a reload without rolling new ones', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    const shown = text('first');
    expect(loadSession(session)?.outcome).toBeTruthy();
    unmount();
    // A fresh mount with the same stores is what a reload is.
    const gen2 = countingGenerator();
    mount(gen2, local, session);
    await settled();
    expect(text('first')).toBe(shown);
    expect(gen2.runs).toHaveLength(0);
    const stored = loadSession(session)!;
    expect(stored.key).toBe(
      inputsKey({ mode: 'generated', req: DEFAULT_REQUIREMENTS, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: activeMappings(loadMappingSettings(local)) }),
    );
  });

  it('persists applied settings, the mode, the applied sentence and the list; drafts are not persisted', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    fireEvent.click(screen.getByText('twists3'));
    expect(JSON.parse(local.getItem(REQUIREMENTS_KEY)!).twists).toBe(DEFAULT_REQUIREMENTS.twists);
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(JSON.parse(local.getItem(REQUIREMENTS_KEY)!).twists).toBe(3));
    await settled(); // let the regenerated batch land before adding from it

    fireEvent.click(screen.getByText('add'));
    const added = text('first')!;
    expect(text('selected')).toBe(added);
    fireEvent.click(screen.getByText('add')); // adding twice keeps one
    expect(text('selected')).toBe(added);
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toEqual([expect.objectContaining({ password: added, hint: expect.any(String) })]);

    fireEvent.click(screen.getByText('sentence-mode'));
    fireEvent.click(screen.getByText('type'));
    await new Promise((r) => setTimeout(r, 20));
    expect(JSON.parse(session.getItem(SESSION_KEY)!).sentence).toBe('');
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(JSON.parse(session.getItem(SESSION_KEY)!).sentence).toBe('Sally eats sweets on Sundays'));
    unmount();

    mount(countingGenerator(), local, session);
    expect(text('selected')).toBe(added);
    expect(text('applied')).toBe('3');
    expect(text('dirty')).toBe('false');
    fireEvent.click(screen.getByText('remove'));
    await waitFor(() => expect(text('selected')).toBe(''));
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)).toEqual([]);
  });

  it('shows requirement problems as messages and marks a batch stale while new inputs are pending', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    fireEvent.click(screen.getByText('contradict'));
    expect(text('stale')).toBe('false'); // a draft is not pending input; it is not applied
    fireEvent.click(screen.getByText('apply'));
    expect(text('stale')).toBe('true');
    await waitFor(() => expect(text('error')).toMatch(/Maximum length/));
    expect(text('stale')).toBe('false');
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
    expect(text('first')).toBe(fresh.ok ? fresh.suggestions[0]!.password : '');
  });
});
