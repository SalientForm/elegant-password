// The package's choices, to build a form (spec §5.1): the modes, the
// presets and every setting, in the configuration's own vocabulary
// (kebab-case keys, named values), never the engine's. Derived from the
// lists the web app and tep show, so none can disagree with them. Plain,
// frozen data.

import { APP_MODES as APP_MODE_LIST } from '../appModes';
import { SEPARATOR_KINDS } from '../choices';
import { fieldsIn, FIELDS as CONFIG_FIELDS, formatValue, SEPARATOR_NAMES, STRENGTH_NAMES, type ConfigField } from '../config/fields';
import { configToJson, type Config, type ConfigValue } from '../config/json';
import { APP_MODE_NAMES, MODE_NAMES, SITE_NAMES, slugOf } from '../config/names';
import { emptyLayer, layerSettings } from '../config/resolve';
import { CONFIG_VERSION } from '../config/version';
import { TYPING_MODES as TYPING_MODE_LIST } from '../difficulty';
import { TARGET_LENGTH_RANGE } from '../fromSentence';
import { STRENGTH_PRESETS as STRENGTH_PRESET_LIST } from '../generate';
import { capitalise } from '../text';
import { MAX_TARGET_BITS } from '../validation';

export { CONFIG_VERSION };

/** Freeze plain data all the way down: a caller cannot change the package's lists by accident. */
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
}

/** An app mode or a typing mode: its name in a configuration, its label, and a sentence about it. */
export interface ModeChoice {
  name: string;
  label: string;
  description: string;
}

export const APP_MODES: readonly ModeChoice[] = frozen(
  APP_MODE_NAMES.map((m) => ({ name: m.name, label: m.label, description: APP_MODE_LIST.find((a) => a.id === m.value)!.hint })),
);

export const TYPING_MODES: readonly ModeChoice[] = frozen(
  MODE_NAMES.map((m) => ({ name: m.name, label: m.label, description: TYPING_MODE_LIST.find((t) => t.id === m.value)!.hint })),
);

export interface SitePresetChoice {
  name: string;
  label: string;
  /** A few words under the label: "8-16, !@#$%&*". */
  note: string;
  /** Every rule's value, by key, as a configuration's `rules` states it. */
  rules: Record<string, ConfigValue>;
}

export const SITE_PRESETS: readonly SitePresetChoice[] = frozen(
  SITE_NAMES.map((s) => ({
    name: s.name,
    label: s.label,
    note: s.value.note,
    rules: Object.fromEntries(fieldsIn('rules').map((f) => [f.name, formatValue(f, s.value.rules[f.target.key as keyof typeof s.value.rules])])),
  })),
);

export interface StrengthPresetChoice {
  /** Its name as `options.strength` takes it: "very-strong". */
  name: string;
  label: string;
  bits: number;
  /** What it suits. */
  hint: string;
}

export const STRENGTH_PRESETS: readonly StrengthPresetChoice[] = frozen(
  STRENGTH_PRESET_LIST.map((p) => ({ name: slugOf(p.label), label: p.label, bits: p.bits, hint: p.hint })),
);

/** One value a setting may take from a list: its name in a configuration, its label, and a sentence about it. */
export interface ValueChoice {
  value: string;
  label: string;
  hint: string;
}

/** A setting a configuration can hold. */
export interface Field {
  /** Its key path: "rules.max-length". */
  key: string;
  section: 'rules' | 'options' | 'sentence';
  /** Its key within the section: "max-length". */
  name: string;
  /** How a form names it: "Maximum length". */
  label: string;
  /** One line about it. */
  description: string;
  /**
   * What it holds. int: a whole number from `min` to `max`. bool: true or
   * false. choice: one of `choices`. symbols: keyboard symbols as one
   * string, each once, "" for none. separator: one of `choices`, or one
   * symbol. strength: one of `choices`, or bits from `min` to `max`.
   * target-length: one of `choices` ("none"), or a whole number from `min`
   * to `max`.
   */
  kind: 'int' | 'bool' | 'choice' | 'symbols' | 'separator' | 'strength' | 'target-length';
  min?: number;
  max?: number;
  choices?: ValueChoice[];
  /** The value when a configuration leaves it out (the default typing mode's, for an option). */
  default: ConfigValue;
}

/** Every setting with nothing stated: the defaults, the default typing mode's options among them. */
const DEFAULTS = (() => {
  const layered = layerSettings(undefined, emptyLayer());
  if (!layered.ok) throw new Error('the defaults cannot be layered');
  return { ...layered.req, ...layered.sentenceOptions } as unknown as Record<string, unknown>;
})();

function fieldOf(f: ConfigField): Field {
  const k = f.kind;
  const range = (min: number, max: number) => ({ min, max });
  const shape: Pick<Field, 'kind' | 'min' | 'max' | 'choices'> =
    k.type === 'int'
      ? { kind: 'int', ...range(k.min, k.max) }
      : k.type === 'choice'
        ? { kind: 'choice', choices: k.choices.map((c) => ({ value: c.value, label: c.label, hint: c.hint })) }
        : k.type === 'separator'
          ? { kind: 'separator', choices: SEPARATOR_NAMES.map((s) => ({ value: s.name, label: SEPARATOR_KINDS.find((c) => c.value === s.value)!.label, hint: SEPARATOR_KINDS.find((c) => c.value === s.value)!.hint })) }
          : k.type === 'strength'
            ? { kind: 'strength', ...range(0, MAX_TARGET_BITS), choices: STRENGTH_NAMES.map((s) => ({ value: s.name, label: s.label, hint: STRENGTH_PRESET_LIST.find((p) => p.label === s.label)!.hint })) }
            : k.type === 'target-length'
              ? { kind: 'target-length', ...range(TARGET_LENGTH_RANGE.min, TARGET_LENGTH_RANGE.max), choices: [{ value: 'none', label: 'None', hint: 'Toward the maximum length' }] }
              : { kind: k.type };
  return {
    key: `${f.group}.${f.name}`,
    section: f.group,
    name: f.name,
    label: capitalise(f.label),
    description: f.description,
    ...shape,
    default: formatValue(f, DEFAULTS[f.target.key]),
  };
}

export const FIELDS: readonly Field[] = frozen(CONFIG_FIELDS.map(fieldOf));

/** The configuration that states nothing but its version: every setting takes its default. */
export const DEFAULT_CONFIG: Readonly<Config> = frozen(configToJson({ rules: {}, options: 'preset', sentence: {} }));
