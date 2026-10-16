import { describe, expect, it } from 'vitest';
import { inputsKey, runInputs, type GenerateInputs } from './engine';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS } from './generate';
import { BUILT_IN_MAPPINGS } from './twists';

const base: GenerateInputs = { mode: 'generated', req: DEFAULT_REQUIREMENTS, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappings: BUILT_IN_MAPPINGS };

describe('engine', () => {
  it('runs both modes and returns plain data', () => {
    const g = runInputs(base);
    expect(g.ok && g.source === 'generated' && g.suggestions.length === DEFAULT_REQUIREMENTS.count && !!g.plan).toBe(true);
    const s = runInputs({ ...base, mode: 'sentence', sentence: 'Sally eats sweets on Sundays' });
    expect(s.ok && s.source === 'sentence' && s.suggestions.length > 0 && s.plan === undefined).toBe(true);
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
  });

  it('turns requirement problems into messages and bugs into flagged messages, never throws', () => {
    const bad = runInputs({ ...base, req: { ...DEFAULT_REQUIREMENTS, minLength: 30, maxLength: 20 } });
    expect(bad).toEqual({ ok: false, error: 'The minimum length (30) is above the maximum (20).' });
    const tight = runInputs({ ...base, req: { ...DEFAULT_REQUIREMENTS, minLength: 4, maxLength: 8 } }); // consistent, but no made-up sentence is that short
    expect(tight.ok === false && tight.error).toMatch(/No sentence fits between 4 and 8 characters/);
    const empty = runInputs({ ...base, mode: 'sentence', sentence: '' });
    expect(empty.ok).toBe(false);
    const broken = runInputs({ ...base, mode: 'sentence', sentence: 'hello there', sentenceOptions: null as unknown as GenerateInputs['sentenceOptions'] });
    expect(broken.ok).toBe(false);
    expect(!broken.ok && broken.unexpected).toBe(true);
  });

  it('keys the inputs that matter and ignores the sentence while making one up', () => {
    const k = inputsKey(base);
    expect(inputsKey({ ...base, sentence: 'typed something' })).toBe(k);
    expect(inputsKey({ ...base, req: { ...DEFAULT_REQUIREMENTS, twists: 3 } })).not.toBe(k);
    expect(inputsKey({ ...base, mappings: BUILT_IN_MAPPINGS.slice(1) })).not.toBe(k);
    const reordered = Object.fromEntries(Object.entries(DEFAULT_REQUIREMENTS).reverse()) as typeof DEFAULT_REQUIREMENTS;
    expect(inputsKey({ ...base, req: reordered })).toBe(k);
    const s = inputsKey({ ...base, mode: 'sentence', sentence: 'a' });
    expect(inputsKey({ ...base, mode: 'sentence', sentence: 'b' })).not.toBe(s);
    expect(inputsKey({ ...base, mode: 'sentence', sentence: 'a', sentenceOptions: { ...DEFAULT_SENTENCE_OPTIONS, targetLength: 12 } })).not.toBe(s);
  });
});
