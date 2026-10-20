// Settings that survive a reload: the site requirements, the sentence-mode
// options, which mode is open and the typing mode difficulty is scored for. None of these is a secret, so they live
// in localStorage. Anything malformed falls back to the default.

import { LENGTH_TAG_CHOICES, SHRINK_CHOICES } from '../lib/choices';
import { DEFAULT_TYPING_MODE, TYPING_MODE_IDS, type TypingMode } from '../lib/difficulty';
import { MODES, type Mode } from '../lib/engine';
import type { LengthTag } from '../lib/fluff';
import { DEFAULT_SENTENCE_OPTIONS, type SentenceOptions, type ShrinkStyle } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { COMFORT_SHARE } from '../lib/grammar';
import { DEFAULT_SORT, SORT_ORDERS, type SortOrder } from '../lib/sort';
import { isBoolean, isFiniteNumber, isRecord, isString, readJson, writeJson, type KeyValueStore } from './storage';
import { FIELD_LABELS, ruleProblems } from '../lib/validation';

export const REQUIREMENTS_KEY = 'elegant-passwords:requirements:v1';
export const SENTENCE_OPTIONS_KEY = 'elegant-passwords:sentence-options:v1';
export const MODE_KEY = 'elegant-passwords:mode:v1';
export const SORT_KEY = 'elegant-passwords:sort:v1';
export const TYPING_MODE_KEY = 'elegant-passwords:typing-mode:v1';

const SHRINK_STYLES: readonly ShrinkStyle[] = SHRINK_CHOICES.map((c) => c.value);
const LENGTH_TAGS: readonly LengthTag[] = LENGTH_TAG_CHOICES.map((c) => c.value);

/**
 * Saved with the requirements. Before version 2 there was no Automatic
 * separator to default to: ";" was the default, so nearly every saved ";"
 * is the default rather than a choice, and loads as Automatic, which is ";"
 * wherever ";" is allowed (the same passwords) and something allowed where
 * it is not. And 'auto' meant "a space where allowed, else ; . - , _", so
 * an older 'auto' with spaces allowed loads as a space, and its passwords
 * do not change either. "Ease awkward words" was off by default before
 * version 2 and is on now; an older saved "off" was that default, not a
 * choice, so it loads as the new default too.
 */
export const REQUIREMENTS_VERSION = 2;

export interface LoadedRequirements {
  req: Requirements;
  /** Saved fields that could not be used and are back to their defaults. */
  reset: (keyof Requirements)[];
}

/** The stored requirements, field by field, falling back to the defaults for anything odd. */
export const parseRequirements = (raw: unknown): Requirements => readRequirements(raw).req;

/**
 * The stored requirements, and which saved fields had to go back to their
 * defaults: odd values field by field, then any contradiction (a minimum
 * above the maximum, symbols required and none allowed) repaired by
 * resetting as few fields as will do, never by discarding the rest.
 */
export function readRequirements(raw: unknown): LoadedRequirements {
  if (!isRecord(raw)) return { req: DEFAULT_REQUIREMENTS, reset: [] };
  const out: Record<string, unknown> = { ...DEFAULT_REQUIREMENTS };
  const reset = new Set<keyof Requirements>();
  for (const key of KEYS) {
    if (!own(raw, key)) continue; // saved before the field existed: the default, and nothing to report
    const value = raw[key];
    const fallback = DEFAULT_REQUIREMENTS[key];
    const ok =
      key === 'comfort'
        ? isString(value) && own(COMFORT_SHARE, value)
        : typeof fallback === 'number'
          ? isFiniteNumber(value)
          : typeof fallback === 'boolean'
            ? isBoolean(value)
            : isString(value);
    if (ok) out[key] = value;
    else reset.add(key);
  }
  if (raw.version !== REQUIREMENTS_VERSION) {
    if (out.separator === ';') out.separator = 'auto';
    else if (out.separator === 'auto' && out.allowSpaces === true) out.separator = ' ';
    if (out.easeSwaps === false) out.easeSwaps = DEFAULT_REQUIREMENTS.easeSwaps;
  }
  const req = out as unknown as Requirements;
  const fixed = repair(req);
  for (const key of KEYS) if (fixed[key] !== req[key]) reset.add(key);
  return { req: fixed, reset: KEYS.filter((k) => reset.has(k)) };
}

const KEYS = Object.keys(DEFAULT_REQUIREMENTS) as (keyof Requirements)[];
// Style before rules: a separator the rules forbid goes back to Automatic rather than the rules being loosened.
const REPAIR_ORDER: (keyof Requirements)[] = ['separator', ...KEYS.filter((k) => k !== 'separator')];
const valid = (req: Requirements) => ruleProblems(req).length === 0;

function repair(req: Requirements): Requirements {
  if (valid(req)) return req;
  const reset = (base: Requirements, ...which: (keyof Requirements)[]) => Object.assign({ ...base }, ...which.map((k) => ({ [k]: DEFAULT_REQUIREMENTS[k] }))) as Requirements;
  for (const key of REPAIR_ORDER) {
    const fixed = reset(req, key);
    if (valid(fixed)) return fixed;
  }
  for (const a of REPAIR_ORDER) {
    for (const b of REPAIR_ORDER) {
      if (a === b) continue;
      const fixed = reset(req, a, b);
      if (valid(fixed)) return fixed;
    }
  }
  let fixed = req;
  for (const key of REPAIR_ORDER) {
    fixed = reset(fixed, key);
    if (valid(fixed)) return fixed;
  }
  return DEFAULT_REQUIREMENTS;
}

/** One line for the options column when saved settings had to be repaired on load, else null. */
export function resetNotice(reset: readonly (keyof Requirements)[]): string | null {
  if (!reset.length) return null;
  return `Some saved settings could not be used, so they are back to their defaults: ${reset.map((k) => FIELD_LABELS[k]).join(', ')}.`;
}

const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key); // never a prototype key such as "toString"

export function parseSentenceOptions(raw: unknown): SentenceOptions {
  if (!isRecord(raw)) return DEFAULT_SENTENCE_OPTIONS;
  const d = DEFAULT_SENTENCE_OPTIONS;
  const shrinkFrom = isFiniteNumber(raw.shrinkFrom) && Number.isInteger(raw.shrinkFrom) && raw.shrinkFrom >= 2 ? raw.shrinkFrom : d.shrinkFrom;
  const targetLength =
    raw.targetLength === null ? null : isFiniteNumber(raw.targetLength) && Number.isInteger(raw.targetLength) && raw.targetLength >= 1 ? raw.targetLength : d.targetLength;
  return {
    shrink: isString(raw.shrink) && SHRINK_STYLES.includes(raw.shrink as ShrinkStyle) ? (raw.shrink as ShrinkStyle) : d.shrink,
    shrinkFrom,
    allowDropping: isBoolean(raw.allowDropping) ? raw.allowDropping : d.allowDropping,
    smallWordInitials: isBoolean(raw.smallWordInitials) ? raw.smallWordInitials : d.smallWordInitials,
    targetLength,
    padding: isBoolean(raw.padding) ? raw.padding : d.padding,
    lengthTag: isString(raw.lengthTag) && LENGTH_TAGS.includes(raw.lengthTag as LengthTag) ? (raw.lengthTag as LengthTag) : d.lengthTag,
  };
}

export function parseMode(raw: unknown): Mode {
  return isString(raw) && MODES.includes(raw as Mode) ? (raw as Mode) : 'generated';
}

export const loadRequirements = (store: KeyValueStore | undefined) => parseRequirements(readJson(store, REQUIREMENTS_KEY));
export const loadRequirementsReport = (store: KeyValueStore | undefined) => readRequirements(readJson(store, REQUIREMENTS_KEY));
export const saveRequirements = (store: KeyValueStore | undefined, req: Requirements) => writeJson(store, REQUIREMENTS_KEY, { ...req, version: REQUIREMENTS_VERSION });
export const loadSentenceOptions = (store: KeyValueStore | undefined) => parseSentenceOptions(readJson(store, SENTENCE_OPTIONS_KEY));
export const saveSentenceOptions = (store: KeyValueStore | undefined, opts: SentenceOptions) => writeJson(store, SENTENCE_OPTIONS_KEY, opts);
export function parseSort(raw: unknown): SortOrder {
  // Earlier versions stored 'easiest' and 'strongest'.
  const legacy: Record<string, SortOrder> = { easiest: 'difficulty', strongest: 'strength' };
  if (isString(raw) && own(legacy, raw)) return legacy[raw]!;
  return isString(raw) && SORT_ORDERS.includes(raw as SortOrder) ? (raw as SortOrder) : DEFAULT_SORT;
}

export const loadSort = (store: KeyValueStore | undefined) => parseSort(readJson(store, SORT_KEY));
export const saveSort = (store: KeyValueStore | undefined, sort: SortOrder) => writeJson(store, SORT_KEY, sort);
export const loadMode = (store: KeyValueStore | undefined) => parseMode(readJson(store, MODE_KEY));
export const saveMode = (store: KeyValueStore | undefined, mode: Mode) => writeJson(store, MODE_KEY, mode);

export function parseTypingMode(raw: unknown): TypingMode {
  return isString(raw) && TYPING_MODE_IDS.includes(raw as TypingMode) ? (raw as TypingMode) : DEFAULT_TYPING_MODE;
}
export const loadTypingMode = (store: KeyValueStore | undefined) => parseTypingMode(readJson(store, TYPING_MODE_KEY));
export const saveTypingMode = (store: KeyValueStore | undefined, mode: TypingMode) => writeJson(store, TYPING_MODE_KEY, mode);
