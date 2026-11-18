// Every setting tep can take, once: the core's configuration settings
// (src/lib/config/fields.ts) and tep's own output settings, each with its
// flag, its key in a config file, its label, what values it accepts, and how
// a value reads back. Flags, the config schema, help, error messages, the
// wizard and the Fun page's CLI prompt all read this table, so none of them
// can disagree with another.

import { SORT_CHOICES } from '../lib/choices';
import {
  FIELDS as CONFIG_FIELDS,
  int,
  type ConfigField,
  type FieldGroup as ConfigGroup,
  type FieldTarget as ConfigTarget,
} from '../lib/config/fields';
import type { Requirements } from '../lib/generate';
import { DEFAULT_SORT } from '../lib/sort';
import { lowerFirst } from '../lib/text';
import { FIELD_LABELS, MAX_COUNT, MIN_COUNT } from '../lib/validation';

export {
  describeValue,
  formatValue,
  keyPath,
  parseValue,
  SEPARATOR_NAMES,
  shownValue,
  STRENGTH_INPUTS,
  STRENGTH_NAMES,
  symbolProblem,
  type FieldKind,
  type Parsed,
} from '../lib/config/fields';

/** Where a setting lives in a config file: the core's sections and tep's output. */
export type FieldGroup = ConfigGroup | 'output';

/** What a setting holds in the engine's terms, or in tep's output. */
export type FieldTarget = ConfigTarget | { kind: 'output'; key: 'count' | 'sort' };

export type CliField = ConfigField<FieldGroup, FieldTarget>;

/** How many passwords tep g makes when the count is not set: at a terminal, and when its output is piped. */
export const COUNT_AT_TERMINAL = 5;
export const COUNT_PIPED = 1;

const list = (items: readonly string[], last = 'or') => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`);

/** The orders, the default first, each with what it puts first: "difficulty (easiest to type first)". */
const SORT_ORDERS = [...SORT_CHOICES].sort((a, b) => Number(b.value === DEFAULT_SORT) - Number(a.value === DEFAULT_SORT));
/** What the default order puts first, as a phrase: "easiest to type first". */
export const DEFAULT_SORT_HINT = lowerFirst(SORT_CHOICES.find((c) => c.value === DEFAULT_SORT)!.hint);

export const FIELDS: readonly CliField[] = [
  ...CONFIG_FIELDS,
  // Output.
  { name: 'count', group: 'output', target: { kind: 'output', key: 'count' }, label: FIELD_LABELS.count, description: `How many passwords (${MIN_COUNT}-${MAX_COUNT}); ${COUNT_AT_TERMINAL} at a terminal, ${COUNT_PIPED} when piped`, kind: int(MIN_COUNT, MAX_COUNT) },
  { name: 'sort', group: 'output', target: { kind: 'output', key: 'sort' }, label: 'order', description: `Order: ${list(SORT_ORDERS.map((c) => `${c.value} (${lowerFirst(c.hint)})`))}`, kind: { type: 'choice', choices: SORT_CHOICES } },
];

export const fieldNamed = (name: string) => FIELDS.find((f) => f.name === name);
export const reqField = (key: keyof Requirements) => FIELDS.find((f) => f.target.kind === 'req' && f.target.key === key);
export const fieldsIn = (group: FieldGroup) => FIELDS.filter((f) => f.group === group);
