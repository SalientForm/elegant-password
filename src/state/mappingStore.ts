// Persists which built-in mappings are switched off and the user's own
// mappings in localStorage. What the settings mean is shared core
// (src/lib/mappingSettings.ts); only the storage is the web app's.

import { customMappingProblem, DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../lib/mappingSettings';
import { BUILT_IN_MAPPINGS, mappingKey } from '../lib/twists';
import { isRecord, isString, readJson, writeJson, type KeyValueStore } from './storage';

export const STORAGE_KEY = 'elegant-passwords:mappings:v1';

/** Stored settings as parsed JSON, dropping anything malformed rather than failing. */
export function parseMappingSettings(raw: unknown): MappingSettings {
  if (!isRecord(raw)) return DEFAULT_MAPPING_SETTINGS;
  const builtIn = new Set(BUILT_IN_MAPPINGS.map(mappingKey));
  const disabled = Array.isArray(raw.disabled) ? raw.disabled.filter((k): k is string => isString(k) && builtIn.has(k)) : [];
  // A custom swap is kept only if the swaps panel would have added it: the core's one rule (customMappingProblem).
  const custom: { from: string; to: string }[] = [];
  if (Array.isArray(raw.custom)) {
    for (const m of raw.custom) {
      if (isRecord(m) && isString(m.from) && isString(m.to) && !customMappingProblem(m as { from: string; to: string }, custom)) custom.push({ from: m.from, to: m.to });
    }
  }
  return { disabled, custom };
}

export const loadMappingSettings = (store: KeyValueStore | undefined): MappingSettings => parseMappingSettings(readJson(store, STORAGE_KEY));

/** Write the settings; false when storage is blocked or full. */
export const saveMappingSettings = (settings: MappingSettings, store: KeyValueStore | undefined): boolean => writeJson(store, STORAGE_KEY, settings);
