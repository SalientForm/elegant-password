import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS } from './generate';
import {
  loadMode,
  loadRequirements,
  loadSentenceOptions,
  parseMode,
  parseRequirements,
  parseSentenceOptions,
  saveMode,
  saveRequirements,
  saveSentenceOptions,
} from './settingsStore';
import { memoryStore } from './storage';

describe('settings store', () => {
  it('keeps valid fields and falls back per field for odd ones', () => {
    const parsed = parseRequirements({ ...DEFAULT_REQUIREMENTS, maxLength: 40, separator: 'nope', comfort: 'strict', glue: 'yes', twists: 3 });
    expect(parsed.maxLength).toBe(40);
    expect(parsed.separator).toBe(DEFAULT_REQUIREMENTS.separator);
    expect(parsed.comfort).toBe('strict');
    expect(parsed.glue).toBe(DEFAULT_REQUIREMENTS.glue);
    expect(parsed.twists).toBe(3);
  });

  it('returns the defaults for anything that does not validate', () => {
    expect(parseRequirements(null)).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements('x')).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, minLength: 30, maxLength: 20 })).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, count: 99 })).toBe(DEFAULT_REQUIREMENTS);
  });

  it('parses sentence options and the mode', () => {
    expect(parseSentenceOptions(null)).toBe(DEFAULT_SENTENCE_OPTIONS);
    expect(parseSentenceOptions({ shrink: 'ends', shrinkFrom: 4, targetLength: 12, allowDropping: false })).toEqual({
      ...DEFAULT_SENTENCE_OPTIONS,
      shrink: 'ends',
      shrinkFrom: 4,
      targetLength: 12,
      allowDropping: false,
    });
    expect(parseSentenceOptions({ shrink: 'wat', shrinkFrom: 1, targetLength: 'x' })).toEqual(DEFAULT_SENTENCE_OPTIONS);
    expect(parseSentenceOptions({ targetLength: null })).toEqual(DEFAULT_SENTENCE_OPTIONS);
    expect(parseMode('sentence')).toBe('sentence');
    expect(parseMode('other')).toBe('generated');
    expect(parseMode(undefined)).toBe('generated');
  });

  it('round-trips through a store and survives a missing store', () => {
    const store = memoryStore();
    const req = { ...DEFAULT_REQUIREMENTS, targetBits: 60, separator: ' ' as const };
    saveRequirements(store, req);
    saveSentenceOptions(store, { ...DEFAULT_SENTENCE_OPTIONS, targetLength: 16 });
    saveMode(store, 'sentence');
    expect(loadRequirements(store)).toEqual(req);
    expect(loadSentenceOptions(store).targetLength).toBe(16);
    expect(loadMode(store)).toBe('sentence');
    expect(loadRequirements(undefined)).toBe(DEFAULT_REQUIREMENTS);
    expect(loadMode(undefined)).toBe('generated');
  });
});
