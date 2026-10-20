// Which swap mappings are on: the built-in ones the user switched off and
// the user's own. Shared by every front end; the web app keeps them in
// localStorage (src/state/mappingStore.ts), the CLI in its config file.

import { BUILT_IN_MAPPINGS, mappingKey, validateMapping, type Mapping } from './twists';

export interface MappingSettings {
  /** Keys (see mappingKey) of built-in mappings the user switched off. */
  disabled: string[];
  custom: { from: string; to: string }[];
}

export const DEFAULT_MAPPING_SETTINGS: MappingSettings = { disabled: [], custom: [] };

/** True when `key` ("a>@") names a built-in mapping. */
export const isBuiltInKey = (key: string): boolean => BUILT_IN_MAPPINGS.some((m) => mappingKey(m) === key);

export interface MappingProblem {
  /** Where in the settings: ['disabled', 2] or ['custom', 0]. */
  path: ['disabled' | 'custom', number];
  message: string;
  /** For a custom mapping listed twice, the index of its first listing. */
  duplicateOf?: number;
}

/**
 * Everything wrong with mapping settings from an untrusted source, each
 * with where it is. Empty when every entry can be used. The web app drops
 * bad entries on load; a config file reports them instead.
 */
export function mappingSettingsProblems(settings: MappingSettings): MappingProblem[] {
  const out: MappingProblem[] = [];
  settings.disabled.forEach((key, i) => {
    if (!isBuiltInKey(key)) out.push({ path: ['disabled', i], message: `"${key}" is not a built-in swap. Built-in swaps are written "from>to", such as "a>@" or "ph>f".` });
  });
  const seen = new Map<string, number>();
  settings.custom.forEach((m, i) => {
    const problem = validateMapping(m.from, m.to);
    if (problem) out.push({ path: ['custom', i], message: `${m.from}>${m.to}: ${problem}` });
    const key = mappingKey(m);
    const first = seen.get(key);
    if (first !== undefined) out.push({ path: ['custom', i], message: `${key} is listed twice.`, duplicateOf: first });
    else seen.set(key, i);
  });
  return out;
}

/** Every mapping currently switched on, built-in first. */
export function activeMappings(settings: MappingSettings): Mapping[] {
  const off = new Set(settings.disabled);
  return [
    ...BUILT_IN_MAPPINGS.filter((m) => !off.has(mappingKey(m))),
    ...settings.custom.map((m) => ({ ...m, kind: 'custom' as const })),
  ];
}
