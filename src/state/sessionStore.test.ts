import { describe, expect, it } from 'vitest';
import { inputsKey, runInputs, type GenerateInputs } from '../lib/engine';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { clearSession, isOutcome, isSuggestion, loadSession, parseSession, saveSession } from './sessionStore';
import { memoryStore } from './storage';
import { BUILT_IN_MAPPINGS } from '../lib/twists';

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

  it('keeps an edit to the made-up sentence only alongside that sentence', () => {
    const generated = { slots: ['adj', 'noun'], words: ['sleepy', 'otters'] };
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: null, generated, edited: 'sleepy owls' })?.edited).toBe('sleepy owls');
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: null, edited: 'sleepy owls' })?.edited).toBeUndefined();
    expect(parseSession({ key: 'k', round: 0, sentence: '', outcome: null, generated, edited: 3 })?.edited).toBeUndefined();
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

  it('rejects swaps, criteria and words the "Why?" panel cannot read (a stored twists: [null] crashed it)', () => {
    const good = runInputs({ mode: 'generated', req: { ...DEFAULT_REQUIREMENTS, count: 1, twists: 1 }, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: BUILT_IN_MAPPINGS });
    if (!good.ok) throw new Error('unexpected');
    const s = good.suggestions[0]!;
    expect(isSuggestion(s)).toBe(true);
    const twist = { wordIndex: 0, before: 'otters', after: '0tters', mapping: { from: 'o', to: '0', kind: 'digit' } };
    expect(isSuggestion({ ...s, twists: [twist] })).toBe(true);
    expect(isSuggestion({ ...s, twists: [null] })).toBe(false);
    expect(isSuggestion({ ...s, twists: [{ ...twist, mapping: null }] })).toBe(false);
    expect(isSuggestion({ ...s, twists: [{ ...twist, mapping: { ...twist.mapping, kind: 'toString' } }] })).toBe(false);
    expect(isSuggestion({ ...s, difficulty: { ...s.difficulty, criteria: [null] } })).toBe(false);
    expect(isSuggestion({ ...s, difficulty: { ...s.difficulty, level: 9 } })).toBe(false);
    expect(isSuggestion({ ...s, difficulty: { ...s.difficulty, measurements: { ...s.difficulty.measurements, seconds: 'slow' } } })).toBe(false);
    expect(isSuggestion({ ...s, words: [{ text: 'x', original: 'x', slot: 'constructor' }] })).toBe(false);
  });

  it('removes a stored session that does not parse, so a reload starts clean', () => {
    const store = memoryStore();
    store.setItem('elegant-passwords:session:v1', JSON.stringify({ key: 'k', round: 0, sentence: '', outcome: { ok: true } }));
    expect(loadSession(store)).toBeUndefined();
    expect(store.getItem('elegant-passwords:session:v1')).toBeNull();
  });
});
