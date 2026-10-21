// The user's own list of chosen passwords: each entry is the password and
// its hint, and what the zxcvbn library said about it when it was added.
// Everything else shown about an entry is scored cold from those two
// strings, so an entry reads the same today and in a year; the zxcvbn
// reading is kept so it is never worked out again. Stored in localStorage,
// in this browser only.
//
// Each change is made to the list as stored, read again just before the
// write, so two tabs adding at once both keep their entry (changeSelected).

import { ZXCVBN_ESTIMATOR, isZxcvbnLabel, type ZxcvbnReading } from '../lib/zxcvbnReading';
import { isFiniteNumber, isRecord, isString, readJson, writeJson, type KeyValueStore } from './storage';

export const SELECTED_KEY = 'elegant-passwords:selected:v1';

export interface SelectedEntry {
  password: string;
  hint: string;
  /** ISO timestamp of when it was added. Display only; never part of the score. */
  addedAt: string;
  /** What zxcvbn says (src/lib/zxcvbnReading.ts), worked out once when the entry was added. Absent until then. */
  zxcvbn?: ZxcvbnReading;
}

const parseZxcvbn = (x: unknown): ZxcvbnReading | undefined =>
  isRecord(x) &&
  isZxcvbnLabel(x.label) &&
  isString(x.crackTime) &&
  isFiniteNumber(x.fill) &&
  isFiniteNumber(x.guessesLog10) &&
  isFiniteNumber(x.score) &&
  isString(x.estimator) &&
  isString(x.checkedAt) &&
  x.estimator === ZXCVBN_ESTIMATOR // a reading by another estimator is worked out again
    ? { label: x.label, crackTime: x.crackTime, fill: x.fill, guessesLog10: x.guessesLog10, score: x.score, estimator: x.estimator, checkedAt: x.checkedAt }
    : undefined;

const validDate = (x: unknown): x is string => isString(x) && !Number.isNaN(Date.parse(x));

/** The stored list, dropping anything malformed and any repeated password. */
export function parseSelected(raw: unknown): SelectedEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SelectedEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || !isString(item.password) || item.password === '' || !isString(item.hint)) continue;
    if (seen.has(item.password)) continue;
    seen.add(item.password);
    const zxcvbn = parseZxcvbn(item.zxcvbn);
    out.push({ password: item.password, hint: item.hint, addedAt: validDate(item.addedAt) ? item.addedAt : new Date(0).toISOString(), ...(zxcvbn ? { zxcvbn } : {}) });
  }
  return out;
}

/** The list with an entry added at the end; a password already listed is left as it was. */
export function withEntry(list: readonly SelectedEntry[], entry: SelectedEntry): SelectedEntry[] {
  return list.some((e) => e.password === entry.password) ? [...list] : [...list, entry];
}

export function withoutEntry(list: readonly SelectedEntry[], password: string): SelectedEntry[] {
  return list.filter((e) => e.password !== password);
}

/** The list with a zxcvbn reading kept on the entry for that password, if it is still listed. */
export function withReading(list: readonly SelectedEntry[], password: string, zxcvbn: ZxcvbnReading): SelectedEntry[] {
  return list.map((e) => (e.password === password ? { ...e, zxcvbn } : e));
}

export const loadSelected = (store: KeyValueStore | undefined) => parseSelected(readJson(store, SELECTED_KEY));
export const saveSelected = (store: KeyValueStore | undefined, list: readonly SelectedEntry[]) => writeJson(store, SELECTED_KEY, list);

/**
 * Make one change to the stored list: read it again, change it, write it
 * back. `base` is the list in memory, used instead of the stored one when the
 * last write failed (memory then holds entries storage does not) or the
 * store cannot be read. Returns the changed list and whether it was saved.
 */
export function changeSelected(
  store: KeyValueStore | undefined,
  base: readonly SelectedEntry[],
  trustStored: boolean,
  change: (list: readonly SelectedEntry[]) => SelectedEntry[],
): { list: SelectedEntry[]; saved: boolean } {
  const stored = trustStored && store ? readJson(store, SELECTED_KEY) : undefined;
  const list = change(stored === undefined ? base : parseSelected(stored));
  return { list, saved: saveSelected(store, list) };
}

