// The user's own list of chosen passwords: each entry is the password and
// its hint, nothing else. Everything shown about an entry is scored cold
// from those two strings, so an entry reads the same today and in a year.
// Stored in localStorage, in this browser only.

import { isRecord, isString, readJson, writeJson, type KeyValueStore } from './storage';

export const SELECTED_KEY = 'elegant-passwords:selected:v1';

export interface SelectedEntry {
  password: string;
  hint: string;
  /** ISO timestamp of when it was added. Display only; never part of the score. */
  addedAt: string;
}

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
    out.push({ password: item.password, hint: item.hint, addedAt: validDate(item.addedAt) ? item.addedAt : new Date(0).toISOString() });
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

export const loadSelected = (store: KeyValueStore | undefined) => parseSelected(readJson(store, SELECTED_KEY));
export const saveSelected = (store: KeyValueStore | undefined, list: readonly SelectedEntry[]) => writeJson(store, SELECTED_KEY, list);
