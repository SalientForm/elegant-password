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
 * Why a custom swap cannot join the ones listed before it, or undefined when
 * it can: the swap itself (validateMapping), a copy of a built-in swap, or
 * one already listed. The swaps panel, the stored settings and a config file
 * all ask this, so they keep and refuse the same swaps.
 */
export function customMappingProblem(
  m: { from: string; to: string },
  earlier: readonly { from: string; to: string }[],
): { kind: 'invalid' | 'built-in' | 'duplicate'; message: string; duplicateOf?: number } | undefined {
  const problem = validateMapping(m.from, m.to);
  if (problem) return { kind: 'invalid', message: problem };
  const key = mappingKey(m);
  if (isBuiltInKey(key)) return { kind: 'built-in', message: `${key} is a built-in swap already, so it needs no custom entry.` };
  const first = earlier.findIndex((e) => mappingKey(e) === key);
  if (first >= 0) return { kind: 'duplicate', message: `${key} is listed twice.`, duplicateOf: first };
  return undefined;
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
  settings.custom.forEach((m, i) => {
    const problem = customMappingProblem(m, settings.custom.slice(0, i));
    if (!problem) return;
    const message = problem.kind === 'invalid' ? `${m.from}>${m.to}: ${problem.message}` : problem.message;
    out.push({ path: ['custom', i], message, ...(problem.duplicateOf !== undefined ? { duplicateOf: problem.duplicateOf } : {}) });
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
