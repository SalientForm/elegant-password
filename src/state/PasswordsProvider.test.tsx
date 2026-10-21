// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inputsKey, runInputs, type GenerateRequest } from '../lib/engine';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import type { Generator } from './generator';
import { activeMappings } from '../lib/mappingSettings';
import { loadMappingSettings } from './mappingStore';
import { SELECTED_KEY } from './selectedStore';
import { loadSession, SESSION_KEY } from './sessionStore';
import { REQUIREMENTS_KEY, TYPING_MODE_KEY } from './settingsStore';
import type { ZxcvbnCheck } from './zxcvbnCheck';
import { memoryStore, type KeyValueStore } from './storage';
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
      <output data-testid="sentence">{p.generated?.words.join(' ') ?? ''}</output>
      <output data-testid="hints">{p.outcome?.ok ? [...new Set(p.outcome.suggestions.map((s) => s.hint))].join('|') : ''}</output>
      <output data-testid="error">{p.outcome && !p.outcome.ok ? p.outcome.error : ''}</output>
      <output data-testid="selected">{p.selected.map((e) => e.password).join('|')}</output>
      <output data-testid="problems">{p.problems.map((x) => x.message).join('|')}</output>
      <output data-testid="notice">{p.notice ?? ''}</output>
      <output data-testid="typing-mode">{p.typingMode}</output>
      <output data-testid="draft-comfort">{p.draft.req.comfort}</output>
      <output data-testid="applied-comfort">{p.applied.req.comfort}</output>
      <output data-testid="persisted">{String(p.secretsPersisted)}</output>
      <button onClick={() => p.setTypingMode('one-handed')}>one-handed</button>
      <button onClick={() => p.setReq({ ...p.draft.req, twists: 3 })}>twists3</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minLength: 40, maxLength: 20 })}>contradict</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minLength: 20 })}>fix</button>
      <button onClick={() => p.setReq({ ...p.draft.req, minLength: 4, maxLength: 8 })}>tight</button>
      <button onClick={() => p.setReq(DEFAULT_REQUIREMENTS)}>defaults</button>
      <button onClick={p.apply}>apply</button>
      <button onClick={p.discard}>discard</button>
      <button onClick={p.regenerate}>again</button>
      <button onClick={p.newSentence}>new-sentence</button>
      <button onClick={() => first && p.addSelected(first)}>add</button>
      <button onClick={() => p.selected[0] && p.removeSelected(p.selected[0].password)}>remove</button>
      <button onClick={() => p.setMode('sentence')}>sentence-mode</button>
      <button onClick={() => p.setMode('generated')}>generated-mode</button>
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
    expect(stored.generated?.words.join(' ')).toBe(text('sentence'));
    expect(stored.key).toBe(
      inputsKey({ mode: 'generated', req: DEFAULT_REQUIREMENTS, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: activeMappings(loadMappingSettings(local)), generated: stored.generated }),
    );
  });

  it('keeps the made-up sentence through Refresh, rule changes, an error and a reload; only "new sentence" draws another', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    const sentence = text('sentence')!;
    expect(sentence).not.toBe('');
    expect(text('hints')).toBe(sentence); // every card is built from it

    // Refresh: new passwords, the same sentence, one run.
    const first = text('first');
    fireEvent.click(screen.getByText('again'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    await settled();
    expect(text('first')).not.toBe(first);
    expect(text('sentence')).toBe(sentence);
    expect(text('hints')).toBe(sentence);
    expect(gen.runs[1]!.generated?.words.join(' ')).toBe(sentence);

    // An applied rule change rebuilds the cards from the same sentence.
    fireEvent.click(screen.getByText('twists3'));
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(gen.runs).toHaveLength(3));
    await settled();
    expect(text('sentence')).toBe(sentence);
    expect(text('hints')).toBe(sentence);

    // Rules it cannot fit give an error, and the sentence is still kept.
    fireEvent.click(screen.getByText('tight'));
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(text('error')).not.toBe(''));
    expect(text('sentence')).toBe(sentence);

    // A reload keeps it too.
    unmount();
    mount(countingGenerator(), local, session);
    await waitFor(() => expect(text('error')).not.toBe(''));
    expect(text('sentence')).toBe(sentence);

    // Only "new sentence" changes it (here after loosening the rules again).
    fireEvent.click(screen.getByText('defaults'));
    fireEvent.click(screen.getByText('apply'));
    await settled();
    expect(text('sentence')).toBe(sentence);
    expect(text('hints')).toBe(sentence);
    fireEvent.click(screen.getByText('new-sentence'));
    await waitFor(() => expect(text('sentence')).not.toBe(sentence));
    await settled();
    expect(text('hints')).toBe(text('sentence'));
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

  it('on a shared origin keeps the list and the batch in memory, removes a list an earlier version stored, and says so', async () => {
    const local = memoryStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'old;one', hint: 'old one', addedAt: '2026-10-15T00:00:00.000Z' }]));
    local.setItem(REQUIREMENTS_KEY, JSON.stringify({ ...DEFAULT_REQUIREMENTS, twists: 3 }));
    const session = memoryStore();
    render(
      <PasswordsProvider generator={countingGenerator()} local={local} session={session} debounceMs={0} persistSecrets={false}>
        <Probe />
      </PasswordsProvider>,
    );
    await settled();
    expect(local.getItem(SELECTED_KEY)).toBeNull(); // the exposed list is gone, and not read
    expect(text('selected')).toBe('');
    expect(text('applied')).toBe('3'); // settings are not secrets: still read and kept
    fireEvent.click(screen.getByText('add'));
    expect(text('selected')).toBe(text('first'));
    expect(local.getItem(SELECTED_KEY)).toBeNull(); // the list stays in memory
    expect(session.getItem(SESSION_KEY)).toBeNull(); // so does the batch
    expect(text('persisted')).toBe('false');
  });

  it('treats a typing mode as a draft that brings its options: nothing runs or is saved until applied, and Discard reverts both', async () => {
    const gen = countingGenerator();
    const { local, session, unmount } = mount(gen);
    await settled();
    fireEvent.click(screen.getByText('one-handed'));
    expect(text('typing-mode')).toBe('one-handed'); // previewed at once
    expect(text('dirty')).toBe('true');
    expect(text('draft-comfort')).toBe('strict');
    expect(text('applied-comfort')).toBe(DEFAULT_REQUIREMENTS.comfort);
    await new Promise((r) => setTimeout(r, 20));
    expect(gen.runs).toHaveLength(1);
    expect(JSON.parse(local.getItem(TYPING_MODE_KEY)!)).toBe('ten-finger');
    fireEvent.click(screen.getByText('discard'));
    expect(text('typing-mode')).toBe('ten-finger');
    expect(text('draft-comfort')).toBe(DEFAULT_REQUIREMENTS.comfort);
    const sentence = text('sentence');
    fireEvent.click(screen.getByText('one-handed'));
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    expect(gen.runs[1]!.req).toMatchObject({ comfort: 'strict', shiftReach: true, separator: ' ' });
    expect(gen.runs[1]!.generated).toBeNull(); // a new mode reshapes the sentence, so it draws a new one
    await settled();
    expect(text('sentence')).not.toBe(sentence);
    expect(JSON.parse(local.getItem(TYPING_MODE_KEY)!)).toBe('one-handed');
    expect(text('dirty')).toBe('false');
    unmount();
    mount(countingGenerator(), local, session);
    expect(text('typing-mode')).toBe('one-handed');
    expect(text('applied-comfort')).toBe('strict');
  });

  it('never applies a draft that contradicts itself: apply and Refresh are refused, and nothing runs, until it is fixed', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    const shown = text('first');
    fireEvent.click(screen.getByText('contradict'));
    expect(text('problems')).toBe('The minimum length (40) is above the maximum (20).');
    fireEvent.click(screen.getByText('apply'));
    fireEvent.click(screen.getByText('again'));
    await new Promise((r) => setTimeout(r, 20));
    expect(gen.runs).toHaveLength(1);
    expect(text('dirty')).toBe('true'); // still a draft
    expect(text('first')).toBe(shown); // the last good batch stays
    expect(text('stale')).toBe('false');
    fireEvent.click(screen.getByText('fix'));
    expect(text('problems')).toBe('');
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(gen.runs).toHaveLength(2));
    expect(gen.runs[1]!.req).toMatchObject({ minLength: 20, maxLength: 20 });
  });

  it('shows what only planning can find as a message, and marks a batch stale while new inputs are pending', async () => {
    const gen = countingGenerator();
    mount(gen);
    await settled();
    fireEvent.click(screen.getByText('tight')); // consistent, but no made-up sentence is 4-8 characters
    expect(text('problems')).toBe('');
    expect(text('stale')).toBe('false'); // a draft is not pending input; it is not applied
    fireEvent.click(screen.getByText('apply'));
    expect(text('stale')).toBe('true');
    await waitFor(() => expect(text('error')).toMatch(/No sentence fits between 4 and 8 characters/));
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

describe('PasswordsProvider: a request still in flight for inputs no longer wanted', () => {
  it('never lands on top of the batch the inputs went back to', async () => {
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
    await act(async () => resolvers[0]!(runInputs(requests[0]!)));
    const shown = text('first');
    expect(shown).not.toBe('');
    // To "Use my sentence" (an empty one: the engine says so) and straight back before the answer arrives.
    fireEvent.click(screen.getByText('sentence-mode'));
    await waitFor(() => expect(requests).toHaveLength(2));
    fireEvent.click(screen.getByText('generated-mode'));
    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(2); // the batch on screen was made from these inputs: nothing to run
    expect(text('busy')).toBe('false');
    await act(async () => resolvers[1]!(runInputs(requests[1]!))); // the late answer for the other inputs
    expect(text('first')).toBe(shown);
    expect(text('error')).toBe('');
    expect(text('stale')).toBe('false');
  });
});

describe('PasswordsProvider: a contradictory requirement set', () => {
  function Shown() {
    const p = usePasswords();
    return (
      <>
        <button onClick={() => p.apply()}>apply</button>
        <button onClick={() => p.setReq({ ...p.draft.req, twists: 1 })}>edit</button>
        <pre data-testid="applied">{JSON.stringify(p.applied.req)}</pre>
        <output data-testid="notice">{p.notice ?? ''}</output>
      </>
    );
  }
  it('saved before this check existed, is repaired on load, keeping every other setting, and says what was reset until the next submit', async () => {
    const local = memoryStore();
    local.setItem(REQUIREMENTS_KEY, JSON.stringify({ ...DEFAULT_REQUIREMENTS, version: 2, minLength: 40, maxLength: 32, twists: 3, allowSpaces: false, separator: ' ' }));
    const gen = countingGenerator();
    render(
      <PasswordsProvider generator={gen} local={local} session={memoryStore()} debounceMs={0}>
        <Shown />
      </PasswordsProvider>,
    );
    const applied = JSON.parse(screen.getByTestId('applied').textContent!);
    expect(applied).toMatchObject({ twists: 3, allowSpaces: false, maxLength: 32, minLength: DEFAULT_REQUIREMENTS.minLength, separator: 'auto' });
    expect(screen.getByTestId('notice').textContent).toBe('Some saved settings could not be used, so they are back to their defaults: minimum length, separator.');
    // It generates from the repaired set, never from the contradiction, and saves the repair.
    await waitFor(() => expect(gen.runs).toHaveLength(1));
    expect(gen.runs[0]!.req).toEqual(expect.objectContaining({ minLength: DEFAULT_REQUIREMENTS.minLength, separator: 'auto' }));
    await waitFor(() => expect(JSON.parse(local.getItem(REQUIREMENTS_KEY)!).minLength).toBe(DEFAULT_REQUIREMENTS.minLength));
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByText('apply'));
    expect(screen.getByTestId('notice').textContent).toBe('');
  });
});

/** A store whose writes can be made to fail, as a full or blocked storage does after a successful start. */
function failingStore() {
  const inner = memoryStore();
  const store = {
    fail: new Set<string>(),
    getItem: (key: string) => inner.getItem(key),
    setItem: (key: string, value: string) => {
      if (store.fail.has(key) || store.fail.has('*')) throw new DOMException('full', 'QuotaExceededError');
      inner.setItem(key, value);
    },
    removeItem: (key: string) => inner.removeItem(key),
  };
  return store;
}

const READING = { label: 'strong', crackTime: 'centuries', fill: 100, guessesLog10: 20, score: 4, estimator: 'zxcvbn 4.4.2, offline slow hashing (10^4 guesses/s)', checkedAt: '2026-10-20T00:00:00.000Z' } as const;

function StoreProbe() {
  const p = usePasswords();
  const first = p.outcome?.ok ? p.outcome.suggestions[0] : undefined;
  const [refused, setRefused] = useState('');
  return (
    <div>
      <output data-testid="busy">{String(p.busy)}</output>
      <output data-testid="first">{first?.password ?? ''}</output>
      <output data-testid="sentence">{p.generated?.words.join(' ') ?? ''}</output>
      <output data-testid="selected">{p.selected.map((e) => e.password).join('|')}</output>
      <output data-testid="readings">{p.selected.map((e) => e.zxcvbn?.label ?? '-').join('|')}</output>
      <output data-testid="list">{p.persistence.list}</output>
      <output data-testid="session">{p.persistence.session}</output>
      <output data-testid="settings">{p.persistence.settings}</output>
      <output data-testid="practice">{p.practice ? `${p.practice.password}/${p.practice.hint}` : ''}</output>
      <output data-testid="epoch">{p.sessionEpoch}</output>
      <output data-testid="refused">{refused}</output>
      <button onClick={() => first && p.addSelected(first)}>add</button>
      <button onClick={() => setRefused(p.addSelected({ password: 'dragon', hint: '' }).problem ?? '')}>add-common</button>
      <button onClick={() => p.selected[0] && p.removeSelected(p.selected[0].password)}>remove</button>
      <button onClick={() => p.setReq({ ...p.draft.req, twists: 3 })}>twists3</button>
      <button onClick={p.apply}>apply</button>
      <button onClick={p.retrySaving}>retry</button>
      <button onClick={p.forgetSession}>forget</button>
      <button onClick={() => first && p.practise(first)}>practise</button>
    </div>
  );
}

const mountStores = (local: KeyValueStore, session: KeyValueStore, extra: { zxcvbn?: ZxcvbnCheck; persistSecrets?: boolean } = {}) =>
  render(
    <PasswordsProvider generator={countingGenerator()} local={local} session={session} debounceMs={0} zxcvbn={extra.zxcvbn ?? (() => Promise.resolve({ ...READING }))} persistSecrets={extra.persistSecrets ?? true}>
      <StoreProbe />
    </PasswordsProvider>,
  );

describe('PasswordsProvider: what is kept, and saying so', () => {
  it('says My list failed to save when a write fails after a good start, keeps the entry in memory, and saves it on Try again', async () => {
    const local = failingStore();
    mountStores(local, memoryStore());
    await settled();
    expect(text('list')).toBe('saved');
    local.fail.add(SELECTED_KEY);
    fireEvent.click(screen.getByText('add'));
    expect(text('selected')).toBe(text('first')); // still on screen, to copy
    expect(text('list')).toBe('failed');
    expect(local.getItem(SELECTED_KEY)).toBeNull();
    local.fail.clear();
    fireEvent.click(screen.getByText('retry'));
    await waitFor(() => expect(text('list')).toBe('saved'));
    expect(JSON.parse(local.getItem(SELECTED_KEY)!).map((e: { password: string }) => e.password)).toEqual([text('first')]);
  });

  it('says a removal failed too, rather than letting the password come back on reload unannounced', async () => {
    const local = failingStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'kept;one', hint: 'kept one', addedAt: '2026-10-15T00:00:00.000Z', zxcvbn: READING }]));
    mountStores(local, memoryStore());
    await settled();
    local.fail.add(SELECTED_KEY);
    fireEvent.click(screen.getByText('remove'));
    expect(text('selected')).toBe('');
    expect(text('list')).toBe('failed');
  });

  it('says the settings and the session failed to save', async () => {
    const local = failingStore();
    const session = failingStore();
    mountStores(local, session);
    await settled();
    expect(text('settings')).toBe('saved');
    expect(text('session')).toBe('saved');
    local.fail.add(REQUIREMENTS_KEY);
    session.fail.add('*');
    fireEvent.click(screen.getByText('twists3'));
    fireEvent.click(screen.getByText('apply'));
    await waitFor(() => expect(text('settings')).toBe('failed'));
    await waitFor(() => expect(text('session')).toBe('failed'));
    local.fail.clear();
    session.fail.clear();
    fireEvent.click(screen.getByText('retry'));
    await waitFor(() => expect(text('settings')).toBe('saved'));
    await waitFor(() => expect(text('session')).toBe('saved'));
  });

  it('on a shared origin removes a session an earlier version stored, as well as the list', async () => {
    const local = memoryStore();
    const session = memoryStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'old;one', hint: 'old one', addedAt: '2026-10-15T00:00:00.000Z' }]));
    session.setItem(SESSION_KEY, JSON.stringify({ key: 'k', round: 0, sentence: 'my old secret sentence', outcome: null }));
    mountStores(local, session, { persistSecrets: false });
    await settled();
    expect(local.getItem(SELECTED_KEY)).toBeNull();
    expect(session.getItem(SESSION_KEY)).toBeNull();
    expect(text('list')).toBe('visit-only');
    expect(text('session')).toBe('visit-only');
  });

  it('makes each change to the list as stored, so two tabs adding at once both keep their entry', async () => {
    const local = memoryStore();
    mountStores(local, memoryStore());
    await settled();
    // Another tab adds an entry after this one loaded the list.
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'other;tab', hint: 'other tab', addedAt: '2026-10-15T00:00:00.000Z', zxcvbn: READING }]));
    fireEvent.click(screen.getByText('add'));
    const stored = JSON.parse(local.getItem(SELECTED_KEY)!).map((e: { password: string }) => e.password);
    expect(stored).toEqual(['other;tab', text('first')]);
    expect(text('selected')).toBe(`other;tab|${text('first')}`);
  });

  it("follows another tab's change to the list in this browser's localStorage", async () => {
    localStorage.clear();
    mountStores(localStorage, memoryStore());
    await settled();
    const value = JSON.stringify([{ password: 'from;elsewhere', hint: 'from elsewhere', addedAt: '2026-10-15T00:00:00.000Z', zxcvbn: READING }]);
    localStorage.setItem(SELECTED_KEY, value);
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: SELECTED_KEY, newValue: value, storageArea: localStorage })));
    expect(text('selected')).toBe('from;elsewhere');
    localStorage.clear();
  });

  it("keeps the zxcvbn reading with an entry when it is added, so a reload never works it out again", async () => {
    const local = memoryStore();
    const check = vi.fn(() => Promise.resolve({ ...READING }));
    const { unmount } = mountStores(local, memoryStore(), { zxcvbn: check });
    await settled();
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(text('readings')).toBe('strong'));
    expect(check).toHaveBeenCalledTimes(1);
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)[0].zxcvbn).toEqual(READING);
    unmount();
    const again = vi.fn(() => Promise.resolve({ ...READING }));
    mountStores(local, memoryStore(), { zxcvbn: again });
    await settled();
    expect(text('readings')).toBe('strong');
    expect(again).not.toHaveBeenCalled();
  });

  it('works out the reading once for an entry saved before readings existed', async () => {
    const local = memoryStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'old;one', hint: 'old one', addedAt: '2026-10-15T00:00:00.000Z' }]));
    const check = vi.fn(() => Promise.resolve({ ...READING, label: 'good' as const }));
    mountStores(local, memoryStore(), { zxcvbn: check });
    await waitFor(() => expect(text('readings')).toBe('good'));
    expect(check).toHaveBeenCalledWith('old;one');
    expect(JSON.parse(local.getItem(SELECTED_KEY)!)[0].zxcvbn.label).toBe('good');
  });

  it('refuses a common password for My list, with the reason', async () => {
    mountStores(memoryStore(), memoryStore());
    await settled();
    fireEvent.click(screen.getByText('add-common'));
    expect(text('refused')).toMatch(/^Not allowed: number \d+ of the 10,001 most common passwords/);
    expect(text('selected')).toBe('');
  });

  it('forgets the session: a new sentence and batch, the stored session replaced, the practice target dropped; the list stays', async () => {
    const local = memoryStore();
    const session = memoryStore();
    mountStores(local, session);
    await settled();
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('practise'));
    expect(text('practice')).not.toBe('');
    const before = text('sentence');
    const listed = text('selected');
    fireEvent.click(screen.getByText('forget'));
    expect(text('practice')).toBe('');
    expect(text('epoch')).toBe('1');
    await waitFor(() => expect(text('sentence')).not.toBe(''));
    await settled();
    expect(text('sentence')).not.toBe(before);
    expect(loadSession(session)?.generated?.words.join(' ')).toBe(text('sentence'));
    expect(text('selected')).toBe(listed);
  });
});
