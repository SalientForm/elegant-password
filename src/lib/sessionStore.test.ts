import { describe, expect, it } from 'vitest';
import { inputsKey, runInputs, type GenerateInputs } from './engine';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS } from './generate';
import { clearSession, isOutcome, isSuggestion, loadSession, parseSession, saveSession } from './sessionStore';
import { memoryStore } from './storage';
import { BUILT_IN_MAPPINGS } from './twists';

const inputs: GenerateInputs = { mode: 'generated', req: DEFAULT_REQUIREMENTS, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: BUILT_IN_MAPPINGS };

describe('session store', () => {
  it('round-trips a real outcome so the current passwords survive a reload', () => {
    const outcome = runInputs(inputs);
    expect(outcome.ok).toBe(true);
    const store = memoryStore();
    const session = { key: inputsKey(inputs), round: 2, sentence: 'my secret sentence', outcome };
    saveSession(store, session);
    const back = loadSession(store);
    expect(back).toEqual(JSON.parse(JSON.stringify(session)));
    expect(back?.outcome && back.outcome.ok && back.outcome.suggestions[0]!.password).toBe(outcome.ok ? outcome.suggestions[0]!.password : '');
    clearSession(store);
    expect(loadSession(store)).toBeUndefined();
  });

  it('keeps a stored error outcome and an empty outcome', () => {
    const bad = runInputs({ ...inputs, req: { ...DEFAULT_REQUIREMENTS, minLength: 30, maxLength: 20 } });
    expect(bad.ok).toBe(false);
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: bad })).toEqual({ key: 'k', round: 0, sentence: '', outcome: bad });
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: null })?.outcome).toBeNull();
  });

  it('keeps the made-up sentence, and drops only that when it is malformed', () => {
    const generated = { slots: ['adj', 'noun'], words: ['sleepy', 'otters'] };
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: null, generated })?.generated).toEqual(generated);
    for (const bad of [{ slots: ['adj'], words: ['a', 'b'] }, { slots: ['toString'], words: ['x'] }, { slots: [], words: [] }, 'sleepy otters']) {
      const back = parseSession({ key: 'k', round: 0, sentence: '', outcome: null, generated: bad });
      expect(back).toBeDefined();
      expect(back?.generated).toBeUndefined();
    }
  });

  it('rejects anything malformed rather than trusting it', () => {
    expect(parseSession(null)).toBeUndefined();
    expect(parseSession({ key: 'k' })).toBeUndefined();
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: { ok: true } })).toBeUndefined();
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: { ok: true, source: 'generated', separator: ';', suggestions: [{ password: 1 }], warnings: [] } })).toBeUndefined();
    expect(isSuggestion({ password: 'x' })).toBe(false);
    expect(isOutcome({ ok: false })).toBe(false);
    expect(isOutcome({ ok: false, error: 'why' })).toBe(true);
  });
});

describe('session records the cards cannot read', () => {
  it('rejects a suggestion whose typing profile or plan breakdown lacks the fields a card reads, instead of crashing a render', () => {
    const good = runInputs({ mode: 'generated', req: { ...DEFAULT_REQUIREMENTS, count: 1 }, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: BUILT_IN_MAPPINGS });
    expect(isOutcome(good)).toBe(true);
    if (!good.ok) throw new Error('unexpected');
    const s = good.suggestions[0]!;
    expect(isSuggestion({ ...s, typing: {} })).toBe(false);
    expect(isSuggestion({ ...s, typing: { ...s.typing, rowsUsed: 'none' } })).toBe(false);
    expect(isSuggestion({ ...s, typing: { ...s.typing, shiftPresses: undefined } })).toBe(false);
    expect(isOutcome({ ...good, plan: { ...good.plan, breakdown: [{ label: 'x' }] } })).toBe(false);
    expect(isOutcome({ ...good, plan: { ...good.plan, breakdown: [{ label: 'x', poolSize: 3, bits: 1.5 }] } })).toBe(true);
  });
});
