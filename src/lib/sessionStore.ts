// The current passwords survive a reload. They and the sentence they may
// have come from are secrets, so they live in sessionStorage: kept through
// a refresh, gone when the tab closes. The stored outcome carries the key
// of the inputs that made it, so on reload the app shows it again instead
// of rolling fresh passwords.

import type { Outcome } from './engine';
import type { Suggestion } from './generate';
import { isBoolean, isFiniteNumber, isRecord, isString, readJson, removeKey, writeJson, type KeyValueStore } from './storage';

export const SESSION_KEY = 'elegant-passwords:session:v1';

export interface StoredSession {
  /** inputsKey() of the inputs the outcome was made from. */
  key: string;
  /** How many times "New passwords" had been pressed for these inputs. */
  round: number;
  sentence: string;
  outcome: Outcome | null;
}

const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every(isString);

export function isSuggestion(x: unknown): x is Suggestion {
  if (!isRecord(x)) return false;
  return (
    isString(x.password) &&
    isString(x.hint) &&
    Array.isArray(x.words) &&
    x.words.every((w) => isRecord(w) && isString(w.text) && isString(w.original) && isString(w.slot)) &&
    isStringArray(x.steps) &&
    Array.isArray(x.twists) &&
    isFiniteNumber(x.twistBits) &&
    isFiniteNumber(x.twistOptions) &&
    isFiniteNumber(x.bits) &&
    isRecord(x.typing) &&
    isRecord(x.difficulty) &&
    isFiniteNumber(x.difficulty.score) &&
    Array.isArray(x.difficulty.criteria) &&
    isRecord(x.difficulty.measurements) &&
    Array.isArray(x.checks) &&
    x.checks.every((c) => isRecord(c) && isString(c.rule) && isBoolean(c.met) && isString(c.how))
  );
}

export function isOutcome(x: unknown): x is Outcome {
  if (!isRecord(x)) return false;
  if (x.ok === false) return isString(x.error);
  if (x.ok !== true) return false;
  return (
    (x.source === 'generated' || x.source === 'sentence') &&
    isString(x.separator) &&
    Array.isArray(x.suggestions) &&
    x.suggestions.every(isSuggestion) &&
    isStringArray(x.warnings) &&
    (x.plan === undefined || (isRecord(x.plan) && isFiniteNumber(x.plan.bits) && Array.isArray(x.plan.breakdown)))
  );
}

export function parseSession(raw: unknown): StoredSession | undefined {
  if (!isRecord(raw) || !isString(raw.key) || !isFiniteNumber(raw.round) || !isString(raw.sentence)) return undefined;
  if (raw.outcome !== null && !isOutcome(raw.outcome)) return undefined;
  return { key: raw.key, round: raw.round, sentence: raw.sentence, outcome: raw.outcome as Outcome | null };
}

export const loadSession = (store: KeyValueStore | undefined) => parseSession(readJson(store, SESSION_KEY));
export const saveSession = (store: KeyValueStore | undefined, session: StoredSession) => writeJson(store, SESSION_KEY, session);
export const clearSession = (store: KeyValueStore | undefined) => removeKey(store, SESSION_KEY);
