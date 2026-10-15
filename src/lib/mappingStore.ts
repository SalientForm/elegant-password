// Persists which built-in mappings are switched off and the user's own
// mappings in localStorage.

import { BUILT_IN_MAPPINGS, mappingKey, validateMapping, type Mapping } from './twists';

export const STORAGE_KEY = 'elegant-passwords:mappings:v1';

export interface MappingSettings {
  /** Keys (see mappingKey) of built-in mappings the user switched off. */
  disabled: string[];
  custom: { from: string; to: string }[];
}

export const DEFAULT_MAPPING_SETTINGS: MappingSettings = { disabled: [], custom: [] };

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

export function loadMappingSettings(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): MappingSettings {
  try {
    return parseMappingSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_MAPPING_SETTINGS; // storage blocked, e.g. private mode
  }
}

export function saveMappingSettings(
  settings: MappingSettings,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings simply will not persist.
  }
}

/** Every mapping currently switched on, built-in first. */
export function activeMappings(settings: MappingSettings): Mapping[] {
  const off = new Set(settings.disabled);
  return [
    ...BUILT_IN_MAPPINGS.filter((m) => !off.has(mappingKey(m))),
    ...settings.custom.map((m) => ({ ...m, kind: 'custom' as const })),
  ];
}
