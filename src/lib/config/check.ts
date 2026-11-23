// Checking a configuration given as plain data, its JSON form: which keys
// may be where (a zod schema), each value in the engine's terms (the field
// table), and every problem at once, each at the key path it is about. The
// YAML reader (yaml.ts) turns those paths into lines. A front end with
// sections of its own (tep's output) passes their fields, and they are
// checked as the core's own are.

import { z } from 'zod';
import { mappingSettingsProblems, type MappingSettings } from '../mappingSettings';
import { fieldsIn, parseValue, shownValue, type FieldGroup, type FieldOf } from './fields';
import { emptyModel, type ConfigModel } from './model';
import { APP_MODE_NAMES, closest, lookup, MODE_NAMES, SITE_NAMES, type Named } from './names';
import { CONFIG_VERSION, READ_VERSIONS, VERSIONS_READ } from './version';

/** Where a problem is: ["rules", "max-length"], ["swaps", "custom", 1, "to"]; [] for the configuration as a whole. */
export type KeyPath = readonly (string | number)[];

/**
 * A problem a front end may word its own way, with what its wording needs.
 * Each still has a message, worded for no front end in particular.
 */
export type CheckCode = { code: 'empty' } | { code: 'newer-version'; version: number };

export type CheckProblem = {
  path: KeyPath;
  /** The key itself is the problem (one that is not known there), not its value. */
  key?: boolean;
  /** The setting whose value is wrong, when the problem is a value. */
  field?: FieldOf;
  message: string;
} & (CheckCode | { code?: undefined });

/** A front end's own sections (tep's output), by name, each with its fields. They come after the core's sections. */
export type ExtraSections<G extends string> = { readonly [K in G]: readonly FieldOf[] };

/** The model, with a front end's own sections when it passed any. */
export type CheckedModel<G extends string> = ConfigModel & Record<G, Record<string, unknown>>;

export type Checked<G extends string = never> = { ok: true; config: CheckedModel<G> } | { ok: false; problems: CheckProblem[] };

/** The core's sections of settings. */
const CORE_SECTIONS: readonly FieldGroup[] = ['rules', 'options', 'sentence'];
const SWAP_KEYS = ['off', 'custom'];

/**
 * Check a configuration's plain data (the JSON form of a tep.yml) and give
 * its model in the engine's terms, or every problem with its key path.
 * Nothing is fixed to fit.
 */
export function checkConfig<G extends string = never>(input: unknown, extra?: ExtraSections<G>): Checked<G> {
  const extras = (extra ?? {}) as Record<string, readonly FieldOf[]>;
  const fieldsOf = (section: string): readonly FieldOf[] => extras[section] ?? ((CORE_SECTIONS as readonly string[]).includes(section) ? fieldsIn(section as FieldGroup) : []);
  const problems: CheckProblem[] = [];
  const add = (path: KeyPath, message: string, more: { key?: true; field?: FieldOf } | CheckCode = {}) => problems.push({ path, message, ...more });
  const failed = (): Checked<G> => ({ ok: false, problems });

  if (input === undefined || input === null || input === '') {
    add([], `the configuration is empty. It starts with "version: ${CONFIG_VERSION}".`, { code: 'empty' });
    return failed();
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    add([], `the file must be a map of keys (version: ${CONFIG_VERSION}, typing-mode: ..., rules: ...), not ${described(input)}`);
    return failed();
  }
  const data = input as Record<string, unknown>;
  const version = data.version;

  // The keys are those of the version the configuration states; with none, or one this release does not read, this
  // release's. A key of the other version is named as such, not as an unknown key.
  const v1 = version === 1;
  const modeKeys = v1 ? ['mode'] : ['app-mode', 'typing-mode'];
  const otherVersion: Record<string, string> = v1
    ? {
        'app-mode': `"app-mode" is a version 2 key, and this configuration is version 1. Write "version: 2" to use it.`,
        'typing-mode': `"typing-mode" is a version 2 key, and this configuration is version 1, where the typing mode is "mode". Write "version: 2" to use it.`,
      }
    : { mode: `"mode" is version 1's name for the typing mode; version ${CONFIG_VERSION} calls it typing-mode.` };
  const shaped = { ...data };
  // Said after the version, which decides them, or before the shape's problems when those stop the check.
  const renamed: CheckProblem[] = [];
  for (const [key, message] of Object.entries(otherVersion)) {
    if (!(key in data)) continue;
    renamed.push({ path: [key], key: true, message });
    delete shaped[key];
  }

  // The shape, with zod: which keys may be where, and which must be maps.
  const section = (fields: readonly FieldOf[]) => z.strictObject(Object.fromEntries(fields.map((f) => [f.name, z.unknown().optional()]))).nullable();
  const shape = z.strictObject({
    version: z.unknown().optional(),
    ...Object.fromEntries(modeKeys.map((key) => [key, z.unknown().optional()])),
    site: z.unknown().optional(),
    rules: section(fieldsIn('rules')).optional(),
    options: z.unknown().optional(),
    sentence: section(fieldsIn('sentence')).optional(),
    swaps: z.strictObject({ off: z.array(z.unknown()).nullable().optional(), custom: z.array(z.unknown()).nullable().optional() }).nullable().optional(),
    ...Object.fromEntries(Object.entries(extras).map(([name, fields]) => [name, section(fields).optional()])),
  });
  const topKeys = [...Object.keys(shape.shape)];
  const checked = shape.safeParse(shaped);
  if (!checked.success) {
    problems.push(...renamed);
    for (const issue of checked.error.issues) {
      const path = issue.path as (string | number)[];
      if (issue.code === 'unrecognized_keys') {
        const where = path.length ? path.join('.') : 'the top level';
        const allowed = path.length === 0 ? topKeys : path[0] === 'swaps' ? SWAP_KEYS : fieldsOf(String(path[0])).map((f) => f.name);
        for (const key of issue.keys) add([...path, key], unknownKey(key, where, allowed), { key: true });
      } else if (issue.code === 'invalid_type') {
        const expected = issue.expected === 'object' ? 'a map of keys' : issue.expected === 'array' ? 'a list' : issue.expected;
        add(path, `${path.join('.')} must be ${expected}; found ${described(valueAt(data, path))}.`);
      } else {
        add(path, `${path.join('.') || 'the file'}: ${issue.message}`);
      }
    }
    return failed();
  }

  const model = { ...emptyModel(), ...Object.fromEntries(Object.keys(extras).map((name) => [name, {}])) } as CheckedModel<G>;

  // version: required, and one this release reads.
  if (version === undefined) add(['version'], `the file has no version. Add "version: ${CONFIG_VERSION}" as its first line.`);
  else if (typeof version === 'number' && Number.isInteger(version) && version > CONFIG_VERSION) {
    add(['version'], `version ${version} was written by a newer release; this one reads ${VERSIONS_READ}.`, { code: 'newer-version', version });
  } else if (!READ_VERSIONS.includes(version as number)) add(['version'], `version must be ${READ_VERSIONS.join(' or ')}; found ${described(version)}.`);
  problems.push(...renamed);

  /** A named value (a mode, a site preset) at a top-level key: its entry, or a problem there. */
  const named = <T>(key: string, what: string, names: readonly Named<T>[]) => {
    const value = data[key];
    if (value === undefined || value === null) return undefined;
    const r = typeof value === 'string' ? lookup(what, names, value) : { ok: false as const, error: `the ${what} must be one of ${names.map((n) => n.name).join(', ')}` };
    if (r.ok) return r;
    add([key], `${key}: ${r.error}`);
    return undefined;
  };
  // Version 1's mode is version 2's typing-mode, and its app mode is the only one there was: left unstated.
  const typingMode = named(v1 ? 'mode' : 'typing-mode', 'typing mode', MODE_NAMES);
  if (typingMode) model.typingMode = typingMode.value;
  const appMode = v1 ? undefined : named('app-mode', 'app mode', APP_MODE_NAMES);
  if (appMode) model.appMode = appMode.value;
  const site = named('site', 'site preset', SITE_NAMES);
  if (site) model.site = site.name;

  const readSection = (name: string, into: Record<string, unknown>) => {
    const values = data[name] as Record<string, unknown> | null | undefined;
    if (!values) return;
    for (const f of fieldsOf(name)) {
      if (!(f.name in values)) continue;
      const r = parseValue(f, values[f.name]);
      if (r.ok) into[f.name] = r.value;
      else add([name, f.name], `${name}.${f.name} ${r.error}.`, { field: f });
    }
  };
  readSection('rules', model.rules);
  readSection('sentence', model.sentence);
  for (const name of Object.keys(extras)) readSection(name, (model as Record<string, Record<string, unknown>>)[name]!);

  // options: "preset", or a map of option values.
  const options = data.options;
  if (options === undefined || options === null || options === 'preset') {
    model.options = 'preset';
  } else if (typeof options === 'object' && !Array.isArray(options)) {
    const allowed = fieldsIn('options').map((f) => f.name);
    for (const key of Object.keys(options)) {
      if (!allowed.includes(key)) add(['options', key], unknownKey(key, 'options', allowed), { key: true });
    }
    model.options = {};
    readSection('options', model.options);
  } else {
    add(['options'], `options must be "preset" (the typing mode's own options) or a map of option values; found ${described(options)}.`);
  }

  // swaps: built-in swaps switched off, and the user's own.
  const swaps = data.swaps as { off?: unknown[] | null; custom?: unknown[] | null } | null | undefined;
  if (swaps) {
    const settings: MappingSettings = { disabled: [], custom: [] };
    // Where each kept entry is in the list, since malformed ones are left out of the settings.
    const at = { disabled: [] as number[], custom: [] as number[] };
    (swaps.off ?? []).forEach((key, i) => {
      if (typeof key === 'string') {
        settings.disabled.push(key);
        at.disabled.push(i);
      } else add(['swaps', 'off', i], `swaps.off entry ${i + 1} must be a built-in swap written "from>to", such as "a>@"; found ${described(key)}.`);
    });
    (swaps.custom ?? []).forEach((entry, i) => {
      const e = entry as Record<string, unknown> | null;
      const keys = e && typeof e === 'object' ? Object.keys(e) : [];
      if (!e || typeof e !== 'object' || Array.isArray(e) || keys.some((k) => k !== 'from' && k !== 'to')) {
        add(['swaps', 'custom', i], `swaps.custom entry ${i + 1} must be a map with "from" and "to", such as { from: ph, to: f }; found ${described(entry)}.`);
      } else if (typeof e.from !== 'string' || typeof e.to !== 'string') {
        // A swap to a digit written bare reads as a number: say so, with the quoting that fixes it.
        const [k, v] = typeof e.from !== 'string' ? ['from', e.from] : ['to', e.to];
        add(['swaps', 'custom', i, k], `swaps.custom entry ${i + 1}: "${k}" must be text; found ${v === undefined ? 'nothing' : JSON.stringify(v)}. Put it in double quotes, as in ${k}: "${v ?? ''}".`);
      } else {
        settings.custom.push({ from: e.from, to: e.to });
        at.custom.push(i);
      }
    });
    for (const p of mappingSettingsProblems(settings)) {
      const [list, kept] = p.path;
      const i = at[list][kept]!;
      const name = list === 'disabled' ? 'off' : 'custom';
      const also = p.duplicateOf === undefined ? '' : ` (also entry ${at.custom[p.duplicateOf]! + 1})`;
      add(['swaps', name, i], `swaps.${name} entry ${i + 1}: ${p.message.replace(/\.$/, '')}${also}.`);
    }
    model.swaps = settings;
  }

  return problems.length ? failed() : { ok: true, config: model };
}

/** The value at a key path in plain data, or undefined when there is none. */
export function valueAt(data: unknown, path: KeyPath): unknown {
  let value = data;
  for (const step of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string | number, unknown>)[step];
  }
  return value;
}

const unknownKey = (key: string, where: string, allowed: readonly string[]) => {
  const near = closest(key, allowed);
  return `unknown key "${key}" in ${where}.${near ? ` Did you mean ${near}?` : ''} The keys there are: ${allowed.join(', ')}.`;
};

/** What was found, as a message says it: "a list", "the text "one"", "12", "nothing". */
function described(value: unknown): string {
  if (value === undefined || value === null) return 'nothing';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'a map';
  return typeof value === 'string' ? `the text ${shownValue(value)}` : shownValue(value);
}
