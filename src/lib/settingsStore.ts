// Settings that survive a reload: the site requirements, the sentence-mode
// options and which mode is open. None of these is a secret, so they live
// in localStorage. Anything malformed falls back to the default.

import { MODES, type Mode } from './engine';
import { DEFAULT_SENTENCE_OPTIONS, type SentenceOptions, type ShrinkStyle } from './fromSentence';
import { DEFAULT_REQUIREMENTS, validate, type Requirements, type Separator } from './generate';
import { COMFORT_SHARE, type Comfort } from './grammar';
import { isBoolean, isFiniteNumber, isRecord, isString, readJson, writeJson, type KeyValueStore } from './storage';

export const REQUIREMENTS_KEY = 'elegant-passwords:requirements:v1';
export const SENTENCE_OPTIONS_KEY = 'elegant-passwords:sentence-options:v1';
export const MODE_KEY = 'elegant-passwords:mode:v1';

const SEPARATORS: readonly Separator[] = ['auto', ' ', ';', '-', '.', '_', ',', ''];
const SHRINK_STYLES: readonly ShrinkStyle[] = ['none', 'vowels', 'ends'];

/** The stored requirements, field by field, falling back to the defaults for anything odd. */
export function parseRequirements(raw: unknown): Requirements {
  if (!isRecord(raw)) return DEFAULT_REQUIREMENTS;
  const out: Record<string, unknown> = { ...DEFAULT_REQUIREMENTS };
  for (const key of Object.keys(DEFAULT_REQUIREMENTS) as (keyof Requirements)[]) {
    const value = raw[key];
    const fallback = DEFAULT_REQUIREMENTS[key];
    if (key === 'separator') {
      if (isString(value) && SEPARATORS.includes(value as Separator)) out.separator = value;
    } else if (key === 'comfort') {
      if (isString(value) && value in COMFORT_SHARE) out.comfort = value as Comfort;
    } else if (typeof fallback === 'number') {
      if (isFiniteNumber(value)) out[key] = value;
    } else if (typeof fallback === 'boolean') {
      if (isBoolean(value)) out[key] = value;
    } else if (isString(value)) {
      out[key] = value;
    }
  }
  const req = out as unknown as Requirements;
  try {
    validate(req);
    return req;
  } catch {
    return DEFAULT_REQUIREMENTS;
  }
}

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
  };
}

export function parseMode(raw: unknown): Mode {
  return isString(raw) && MODES.includes(raw as Mode) ? (raw as Mode) : 'generated';
}

export const loadRequirements = (store: KeyValueStore | undefined) => parseRequirements(readJson(store, REQUIREMENTS_KEY));
export const saveRequirements = (store: KeyValueStore | undefined, req: Requirements) => writeJson(store, REQUIREMENTS_KEY, req);
export const loadSentenceOptions = (store: KeyValueStore | undefined) => parseSentenceOptions(readJson(store, SENTENCE_OPTIONS_KEY));
export const saveSentenceOptions = (store: KeyValueStore | undefined, opts: SentenceOptions) => writeJson(store, SENTENCE_OPTIONS_KEY, opts);
export const loadMode = (store: KeyValueStore | undefined) => parseMode(readJson(store, MODE_KEY));
export const saveMode = (store: KeyValueStore | undefined, mode: Mode) => writeJson(store, MODE_KEY, mode);
