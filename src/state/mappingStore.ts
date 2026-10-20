// Persists which built-in mappings are switched off and the user's own
// mappings in localStorage. What the settings mean is shared core
// (src/lib/mappingSettings.ts); only the storage is the web app's.

import { DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../lib/mappingSettings';
import { BUILT_IN_MAPPINGS, mappingKey, validateMapping } from '../lib/twists';

export const STORAGE_KEY = 'elegant-passwords:mappings:v1';

/** Parse stored settings, dropping anything malformed rather than failing. */
export function parseMappingSettings(raw: string | null): MappingSettings {
  if (!raw) return DEFAULT_MAPPING_SETTINGS;
  try {
    const data = JSON.parse(raw) as Partial<MappingSettings>;
    const builtIn = new Set(BUILT_IN_MAPPINGS.map(mappingKey));
    const disabled = Array.isArray(data.disabled)
      ? data.disabled.filter((k): k is string => typeof k === 'string' && builtIn.has(k))
      : [];
    const custom = Array.isArray(data.custom)
      ? data.custom.filter(
          (m): m is { from: string; to: string } =>
            typeof m?.from === 'string' && typeof m?.to === 'string' && !validateMapping(m.from, m.to),
        )
      : [];
    return { disabled, custom };
  } catch {
    return DEFAULT_MAPPING_SETTINGS;
  }
}

export function loadMappingSettings(storage: Pick<Storage, 'getItem'> | undefined): MappingSettings {
  try {
    return parseMappingSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_MAPPING_SETTINGS; // storage blocked, e.g. private mode
  }
}

export function saveMappingSettings(
  settings: MappingSettings,
  storage: Pick<Storage, 'setItem'> | undefined,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings simply will not persist.
  }
}
