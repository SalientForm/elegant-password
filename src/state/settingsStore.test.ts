import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS, SHRINK_FROM_RANGE, TARGET_LENGTH_RANGE } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { ruleProblems } from '../lib/validation';
import {
  loadMode,
  loadSort,
  parseSort,
  parseTypingMode,
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
  REQUIREMENTS_VERSION,
  readRequirements,
  resetNotice,
} from './settingsStore';
import { DEFAULT_SORT } from '../lib/sort';
import { memoryStore } from './storage';

/** Requirements as this version saves them. */
const SAVED = { ...DEFAULT_REQUIREMENTS, version: REQUIREMENTS_VERSION };

describe('settings store', () => {
  it('keeps valid fields and falls back per field for odd ones', () => {
    const parsed = parseRequirements({ ...SAVED, maxLength: 40, separator: 'nope', comfort: 'strict', glue: 'yes', twists: 3 });
    expect(parsed.maxLength).toBe(40);
    expect(parsed.separator).toBe(DEFAULT_REQUIREMENTS.separator);
    expect(parseRequirements({ ...SAVED, separator: '+', allowedSymbols: '+' }).separator).toBe('+');
    expect(parseRequirements({ ...SAVED, separator: 'x' }).separator).toBe(DEFAULT_REQUIREMENTS.separator);
    expect(parseRequirements({ ...SAVED, separator: '' }).separator).toBe('');
    expect(parsed.comfort).toBe('strict');
    expect(parsed.glue).toBe(DEFAULT_REQUIREMENTS.glue);
    expect(parsed.twists).toBe(3);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: true }).easeSwaps).toBe(true);
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: 'yes' }).easeSwaps).toBe(DEFAULT_REQUIREMENTS.easeSwaps);
  });

  it('gives settings saved before "Ease awkward words" existed the new default, on, and keeps a stored choice', () => {
    expect(DEFAULT_REQUIREMENTS.easeSwaps).toBe(true);
    // Saved before the option existed: no field. Every other field is kept; the option takes the default.
    // Before version 2 the default separator was ";" (now Automatic, which is ";" here).
    const older = { ...Object.fromEntries(Object.entries(DEFAULT_REQUIREMENTS).filter(([key]) => key !== 'easeSwaps')), separator: ';', maxLength: 40, comfort: 'strict' };
    expect(parseRequirements(older)).toEqual({ ...DEFAULT_REQUIREMENTS, maxLength: 40, comfort: 'strict', easeSwaps: true });
    // Saved since version 2: the stored value stands, off included.
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: false, version: REQUIREMENTS_VERSION }).easeSwaps).toBe(false);
    // Saved before version 2, when off was the default and nobody could have chosen it: the new default.
    expect(parseRequirements({ ...DEFAULT_REQUIREMENTS, easeSwaps: false }).easeSwaps).toBe(true);
    const store = memoryStore();
    store.setItem(REQUIREMENTS_KEY, JSON.stringify(older));
    expect(loadRequirements(store).easeSwaps).toBe(true);
  });

  it('returns the defaults for anything that does not validate', () => {
    expect(parseRequirements(null)).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements('x')).toBe(DEFAULT_REQUIREMENTS);
    expect(parseRequirements({ ...SAVED, minLength: 30, maxLength: 20 })).toEqual({ ...DEFAULT_REQUIREMENTS, maxLength: 20 }); // repaired, not discarded
    expect(parseRequirements({ ...SAVED, count: 99 })).toEqual(DEFAULT_REQUIREMENTS);
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
    // Each number is kept inside the range its field takes, ends included; outside it, the default (audit L5).
    const ranged = { shrinkFrom: SHRINK_FROM_RANGE, targetLength: TARGET_LENGTH_RANGE } as const;
    for (const [key, { min, max }] of Object.entries(ranged) as [keyof typeof ranged, { min: number; max: number }][]) {
      expect(parseSentenceOptions({ [key]: min })[key], `${key} ${min}`).toBe(min);
      expect(parseSentenceOptions({ [key]: max })[key], `${key} ${max}`).toBe(max);
      expect(parseSentenceOptions({ [key]: min - 1 })[key], `${key} ${min - 1}`).toBe(DEFAULT_SENTENCE_OPTIONS[key]);
      expect(parseSentenceOptions({ [key]: max + 1 })[key], `${key} ${max + 1}`).toBe(DEFAULT_SENTENCE_OPTIONS[key]);
      expect(parseSentenceOptions({ [key]: 1e9 })[key], `${key} 1e9`).toBe(DEFAULT_SENTENCE_OPTIONS[key]);
    }
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
    expect(parseTypingMode('one-handed')).toBe('one-handed');
    expect(parseTypingMode('two-finger')).toBe('two-finger');
    expect(parseTypingMode('one-hand')).toBe('ten-finger');
    expect(parseTypingMode(undefined)).toBe('ten-finger');
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
    const stored = { ...SAVED, minLength: 40, maxLength: 32, twists: 3, allowSpaces: false, initials: 2, separator: '-' };
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
    expect(parseRequirements({ ...SAVED, comfort: 'toString' }).comfort).toBe(DEFAULT_REQUIREMENTS.comfort);
    expect(parseRequirements({ ...SAVED, comfort: 'constructor' }).comfort).toBe(DEFAULT_REQUIREMENTS.comfort);
    expect(parseSort('toString')).toBe(DEFAULT_SORT);
    expect(parseSort('constructor')).toBe(DEFAULT_SORT);
    expect(parseSort('easiest')).toBe('difficulty'); // the real legacy names still map
  });
});

describe('stored requirements: contradictions, the reset report and older versions', () => {
  it('load every contradiction the form blocks as a set that validates, keeping what it can and naming what was reset', () => {
    const cases: [string, Record<string, unknown>, (keyof typeof DEFAULT_REQUIREMENTS)[]][] = [
      ['minimum above the maximum', { minLength: 40, maxLength: 32 }, ['minLength']],
      ['symbols required, none allowed', { minSymbols: 2, allowedSymbols: '' }, ['allowedSymbols']],
      ['required characters past the maximum', { minLength: 8, maxLength: 10, minUppercase: 8, minDigits: 4 }, ['maxLength']],
      ['separator not allowed', { separator: ';', allowedSymbols: '!@#' }, ['separator']],
      ['space separator, spaces not allowed', { separator: ' ', allowSpaces: false }, ['separator']],
      ['separator a letter', { separator: 'x' }, ['separator']],
      ['count out of range', { count: 99 }, ['count']],
      ['maximum past what the tool makes', { maxLength: 200 }, ['maxLength']],
      ['negative target', { targetBits: -5 }, ['targetBits']],
      ['too many initials', { initials: 7 }, ['initials']],
      ['a number field holding text', { maxLength: 'lots' }, ['maxLength']],
    ];
    for (const [label, fields, reset] of cases) {
      const loaded = readRequirements({ ...SAVED, twists: 3, comfort: 'strict', ...fields });
      expect(ruleProblems(loaded.req), label).toEqual([]);
      expect(loaded.reset, label).toEqual(reset);
      expect(loaded.req.twists, label).toBe(3); // everything else is kept
      expect(loaded.req.comfort, label).toBe('strict');
    }
  });

  it('put a separator the rules forbid back to Automatic rather than loosen the rules', () => {
    const loaded = readRequirements({ ...SAVED, separator: ' ', allowSpaces: false, allowedSymbols: '!' });
    expect(loaded.req).toMatchObject({ separator: 'auto', allowSpaces: false, allowedSymbols: '!' });
    expect(loaded.reset).toEqual(['separator']);
  });

  it('report nothing for a clean record, for no record, or for fields saved before they existed', () => {
    expect(readRequirements(SAVED).reset).toEqual([]);
    expect(readRequirements(undefined)).toEqual({ req: DEFAULT_REQUIREMENTS, reset: [] });
    const { easeSwaps: _gone, ...older } = SAVED;
    expect(readRequirements(older).reset).toEqual([]);
  });

  it('say which saved settings were reset, in words, or nothing at all', () => {
    expect(resetNotice([])).toBeNull();
    expect(resetNotice(['minLength', 'separator'])).toBe('Some saved settings could not be used, so they are back to their defaults: minimum length, separator.');
  });

  it('read an older ";" (the old default) as Automatic, and an older "auto" (a space first) as a space where spaces are allowed, so no passwords change', () => {
    const { version: _v, ...legacy } = SAVED;
    expect(parseRequirements({ ...legacy, separator: ';' }).separator).toBe('auto');
    expect(readRequirements({ ...legacy, separator: ';', allowedSymbols: '!@#' })).toMatchObject({ req: { separator: 'auto' }, reset: [] }); // was a contradiction; now simply Automatic
    expect(parseRequirements({ ...legacy, separator: 'auto', allowSpaces: true }).separator).toBe(' ');
    expect(parseRequirements({ ...legacy, separator: 'auto', allowSpaces: false }).separator).toBe('auto'); // it already meant ";" first there
    expect(parseRequirements({ ...legacy, separator: '-' }).separator).toBe('-');
    expect(parseRequirements({ ...SAVED, separator: ';' }).separator).toBe(';'); // chosen since Automatic existed: kept
    expect(parseRequirements({ ...SAVED, separator: 'auto', allowSpaces: true }).separator).toBe('auto');
    const store = memoryStore();
    saveRequirements(store, DEFAULT_REQUIREMENTS);
    expect(JSON.parse(store.getItem(REQUIREMENTS_KEY)!).version).toBe(REQUIREMENTS_VERSION);
    expect(loadRequirements(store)).toEqual(DEFAULT_REQUIREMENTS);
  });
});
