import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS } from './generate';
import {
  loadMode,
  loadSort,
  parseSort,
  saveSort,
  loadRequirements,
  loadSentenceOptions,
  parseMode,
  parseRequirements,
  parseSentenceOptions,
  REQUIREMENTS_KEY,
  saveMode,
  saveRequirements,
  saveSentenceOptions,
} from './settingsStore';
import { DEFAULT_SORT } from './sort';
import { memoryStore } from './storage';

describe('settings store', () => {
  it('keeps valid fields and falls back per field for odd ones', () => {
    const parsed = parseRequirements({ ...DEFAULT_REQUIREMENTS, maxLength: 40, separator: 'nope', comfort: 'strict', glue: 'yes', twists: 3 });
    expect(parsed.maxLength).toBe(40);
    expect(parsed.separator).toBe(DEFAULT_REQUIREMENTS.separator);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, separator: '+', allowedSymbols: '+' }).separator).toBe('+');
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, separator: 'x' }).separator).toBe(DEFAULT_REQUIREMENTS.separator);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, separator: '' }).separator).toBe('');
    expect(parsed.comfort).toBe('strict');
    expect(parsed.glue).toBe(DEFAULT_REQUIREMENTS.glue);
    expect(parsed.twists).toBe(3);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: true }).easeSwaps).toBe(true);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: 'yes' }).easeSwaps).toBe(DEFAULT_REQUIREMENTS.easeSwaps);
  });

  it('gives settings saved before "Ease awkward words" existed the new default, on, and keeps a stored choice', () => {
    expect(DEFAULT_REQUIREMENTS.easeSwaps).toBe(true);
    // Saved before the option existed: no field. Every other field is kept; the option takes the default.
    const older = { ...Object.fromEntries(Object.entries(DEFAULT_REQUIREMENTS).filter(([key]) => key !== 'easeSwaps')), maxLength: 40, comfort: 'strict' };
    expect(parseRequirements(older)).toEqual({ ...DEFAULT_REQUIREMENTS, maxLength: 40, comfort: 'strict', easeSwaps: true });
    // Saved with the option: the stored value stands, off included.
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: false }).easeSwaps).toBe(false);
    const store = memoryStore();
    store.setItem(REQUIREMENTS_KEY, JSON.stringify(older));
    expect(loadRequirements(store).easeSwaps).toBe(true);
  });

  it('returns the defaults for anything that does not validate', () => {
    expect(parseRequirements(null)).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements('x')).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, minLength: 30, maxLength: 20 })).toEqual({ ...DEFAULT_REQUIREMENTS, maxLength: 20 }); // repaired, not discarded
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, count: 99 })).toEqual(DEFAULT_REQUIREMENTS);
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
    expect(parseSentenceOptions({ padding: false, lengthTag: 'factor' })).toMatchObject({ padding: false, lengthTag: 'factor' });
    expect(parseSentenceOptions({ padding: 'no', lengthTag: 'percent' })).toMatchObject({ padding: true, lengthTag: 'total' });
    expect(parseMode('sentence')).toBe('sentence');
    expect(parseMode('other')).toBe('generated');
    expect(parseMode(undefined)).toBe('generated');
    expect(parseSort('strength')).toBe('strength');
    expect(parseSort('memorability')).toBe('memorability');
    expect(parseSort('strongest')).toBe('strength'); // what an earlier version stored
    expect(parseSort('easiest')).toBe('difficulty');
    expect(parseSort('weakest')).toBe('difficulty');
    const store = memoryStore();
    saveSort(store, 'strength');
    expect(loadSort(store)).toBe('strength');
    expect(loadSort(undefined)).toBe('difficulty');
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

describe('stored requirements that fail validation as a whole', () => {
  it('are repaired field by field, so a minimum above the maximum never wipes every other setting on reload', () => {
    const stored = { ...DEFAULT_REQUIREMENTS, minLength: 40, maxLength: 32, twists: 3, allowSpaces: false, initials: 2, separator: '-' };
    const parsed = parseRequirements(stored);
    expect(parsed.twists).toBe(3);
    expect(parsed.allowSpaces).toBe(false);
    expect(parsed.initials).toBe(2);
    expect(parsed.separator).toBe('-');
    expect(parsed.minLength).toBeLessThanOrEqual(parsed.maxLength);
    expect(parsed.maxLength).toBe(32);
    // Two bad fields at once still keep the rest.
    const twice = parseRequirements({ ...stored, count: 99 });
    expect(twice.twists).toBe(3);
    expect(twice.count).toBe(DEFAULT_REQUIREMENTS.count);
  });

  it('treats prototype keys as odd data: a stored "toString" is neither a comfort level nor an order', () => {
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, comfort: 'toString' }).comfort).toBe(DEFAULT_REQUIREMENTS.comfort);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, comfort: 'constructor' }).comfort).toBe(DEFAULT_REQUIREMENTS.comfort);
    expect(parseSort('toString')).toBe(DEFAULT_SORT);
    expect(parseSort('constructor')).toBe(DEFAULT_SORT);
    expect(parseSort('easiest')).toBe('difficulty'); // the real legacy names still map
  });
});
