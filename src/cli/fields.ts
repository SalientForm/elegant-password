// Every setting tep can take, once: its flag, its key in a config file, its
// label, what values it accepts, and how a value reads back. Flags, the
// config schema, help, error messages, the wizard and the Fun page's CLI
// prompt all read this table, so none of them can disagree with another.
// Labels, ranges and choice lists come from the shared core (src/lib).

import { COMFORT_CHOICES, LENGTH_TAG_CHOICES, SEPARATOR_KINDS, SHRINK_CHOICES, SORT_CHOICES, type Choice } from '../lib/choices';
import { SHRINK_FROM_RANGE, TARGET_LENGTH_RANGE, type SentenceOptions } from '../lib/fromSentence';
import { SEPARATOR_PREFERENCE, STRENGTH_PRESETS, type Requirements } from '../lib/generate';
import { lookupKey } from '../lib/keyboard';
import { PROFILE_LABELS } from '../lib/modeProfiles';
import { DEFAULT_SORT } from '../lib/sort';
import { FIELD_LABELS, isSymbol, MIN_COUNT, MIN_LENGTH, MAX_COUNT, MAX_DIGITS, MAX_INITIALS, MAX_LENGTH, MAX_MADE_UP, MAX_SHORTHAND, MAX_SYMBOLS, MAX_TARGET_BITS, MAX_TWISTS, MAX_LOWERCASE, MAX_UPPERCASE } from '../lib/validation';
import { closest, slugOf } from './names';

/** Where a setting lives in a config file. */
export type FieldGroup = 'rules' | 'options' | 'sentence' | 'output';

/** What a setting holds in the engine's terms. */
export type FieldTarget =
  | { kind: 'req'; key: Exclude<keyof Requirements, 'count'> }
  | { kind: 'sentence'; key: keyof SentenceOptions }
  | { kind: 'output'; key: 'count' | 'sort' };

export type FieldKind =
  | { type: 'int'; min: number; max: number }
  | { type: 'bool' }
  | { type: 'choice'; choices: readonly Choice<string>[] }
  /** Allowed symbols: printable keyboard symbols, each once; '' for none. */
  | { type: 'symbols' }
  /** auto, space, none, or one keyboard symbol. */
  | { type: 'separator' }
  /** A strength preset's name or a number of bits. */
  | { type: 'strength' }
  /** A number of characters, or none. */
  | { type: 'target-length' };

export interface CliField {
  /** The flag without its dashes and the config key without its group: "max-length". */
  name: string;
  group: FieldGroup;
  target: FieldTarget;
  /** How messages name it: "maximum length". */
  label: string;
  /** One line for help. */
  description: string;
  kind: FieldKind;
}

/** How many passwords tep g makes when the count is not set: at a terminal, and when its output is piped. */
export const COUNT_AT_TERMINAL = 5;
export const COUNT_PIPED = 1;

const int = (min: number, max: number): FieldKind => ({ type: 'int', min, max });
const bool: FieldKind = { type: 'bool' };
const req = (key: Exclude<keyof Requirements, 'count'>): FieldTarget => ({ kind: 'req', key });
const sentence = (key: keyof SentenceOptions): FieldTarget => ({ kind: 'sentence', key });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: readonly string[], last = 'or') => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`);

/** The separators that are not one symbol, by the names tep takes: the core's labels as names (auto, space, none). */
export const SEPARATOR_NAMES: readonly { name: string; value: string }[] = SEPARATOR_KINDS.map((c) => ({ name: slugOf(c.label), value: c.value }));
const separatorNames = SEPARATOR_NAMES.map((s) => s.name);

/** The shrink style that keeps words whole, also taken by its label's name ("keep"), the web form's word for it. */
const KEEP = SHRINK_CHOICES.find((c) => c.value === 'none')!;
const KEEP_NAME = slugOf(KEEP.label);

/** The orders, the default first, each with what it puts first: "difficulty (easiest to type first)". */
const SORT_ORDERS = [...SORT_CHOICES].sort((a, b) => Number(b.value === DEFAULT_SORT) - Number(a.value === DEFAULT_SORT));
/** What the default order puts first, as a phrase: "easiest to type first". */
export const DEFAULT_SORT_HINT = lower(SORT_CHOICES.find((c) => c.value === DEFAULT_SORT)!.hint);

export const FIELDS: readonly CliField[] = [
  // The site's rules.
  { name: 'min-length', group: 'rules', target: req('minLength'), label: FIELD_LABELS.minLength, description: 'Shortest password the site accepts', kind: int(MIN_LENGTH, MAX_LENGTH) },
  { name: 'max-length', group: 'rules', target: req('maxLength'), label: FIELD_LABELS.maxLength, description: 'Longest password the site accepts', kind: int(MIN_LENGTH, MAX_LENGTH) },
  { name: 'min-uppercase', group: 'rules', target: req('minUppercase'), label: `required ${FIELD_LABELS.minUppercase}`, description: 'Uppercase letters the site requires', kind: int(0, MAX_UPPERCASE) },
  { name: 'min-lowercase', group: 'rules', target: req('minLowercase'), label: `required ${FIELD_LABELS.minLowercase}`, description: 'Lowercase letters the site requires', kind: int(0, MAX_LOWERCASE) },
  { name: 'min-digits', group: 'rules', target: req('minDigits'), label: `required ${FIELD_LABELS.minDigits}`, description: 'Digits the site requires', kind: int(0, MAX_DIGITS) },
  { name: 'min-symbols', group: 'rules', target: req('minSymbols'), label: `required ${FIELD_LABELS.minSymbols}`, description: 'Symbols the site requires', kind: int(0, MAX_SYMBOLS) },
  { name: 'symbols', group: 'rules', target: req('allowedSymbols'), label: FIELD_LABELS.allowedSymbols, description: 'Symbols the site accepts, as one string; empty for none', kind: { type: 'symbols' } },
  { name: 'spaces', group: 'rules', target: req('allowSpaces'), label: FIELD_LABELS.allowSpaces, description: 'Whether the site accepts spaces', kind: bool },
  // How the user likes passwords made: what a typing mode fills in.
  { name: 'strength', group: 'options', target: req('targetBits'), label: lower(PROFILE_LABELS.targetBits), description: `Target strength: ${STRENGTH_PRESETS.map((p) => slugOf(p.label)).join(', ')}, or bits (0-${MAX_TARGET_BITS})`, kind: { type: 'strength' } },
  { name: 'shortest', group: 'options', target: req('shortest'), label: lower(PROFILE_LABELS.shortest), description: PROFILE_LABELS.shortest, kind: bool },
  { name: 'comfort', group: 'options', target: req('comfort'), label: lower(PROFILE_LABELS.comfort), description: 'Typing comfort: which share of words to use', kind: { type: 'choice', choices: COMFORT_CHOICES } },
  { name: 'avoid-pinky', group: 'options', target: req('avoidPinkyStretch'), label: lower(PROFILE_LABELS.avoidPinkyStretch), description: PROFILE_LABELS.avoidPinkyStretch, kind: bool },
  { name: 'shift-reach', group: 'options', target: req('shiftReach'), label: PROFILE_LABELS.shiftReach.replace(/^Keep/, 'keep'), description: PROFILE_LABELS.shiftReach, kind: bool },
  { name: 'ease-swaps', group: 'options', target: req('easeSwaps'), label: lower(PROFILE_LABELS.easeSwaps), description: PROFILE_LABELS.easeSwaps, kind: bool },
  { name: 'separator', group: 'options', target: req('separator'), label: lower(PROFILE_LABELS.separator), description: `Between words: ${separatorNames.join(', ')}, or one allowed symbol`, kind: { type: 'separator' } },
  { name: 'number', group: 'options', target: req('includeNumber'), label: lower(PROFILE_LABELS.includeNumber), description: `${PROFILE_LABELS.includeNumber} even when digits are not required`, kind: bool },
  { name: 'swaps', group: 'options', target: req('twists'), label: lower(PROFILE_LABELS.twists), description: `${PROFILE_LABELS.twists} per password`, kind: int(0, MAX_TWISTS) },
  { name: 'initials', group: 'options', target: req('initials'), label: lower(PROFILE_LABELS.initials), description: 'Words typed as one capital letter', kind: int(0, MAX_INITIALS) },
  { name: 'two-letter', group: 'options', target: req('shorthand'), label: lower(PROFILE_LABELS.shorthand), description: 'Words typed as two letters', kind: int(0, MAX_SHORTHAND) },
  { name: 'made-up', group: 'options', target: req('madeUp'), label: lower(PROFILE_LABELS.madeUp), description: 'Nouns replaced by made-up key rolls', kind: int(0, MAX_MADE_UP) },
  { name: 'glue', group: 'options', target: req('glue'), label: lower(PROFILE_LABELS.glue), description: 'Attach numbers and small-word initials to the next word', kind: bool },
  // "Use my sentence" (--sentence).
  { name: 'shrink', group: 'sentence', target: sentence('shrink'), label: 'shrink style', description: `How long words are shrunk: ${SHRINK_CHOICES.map((c) => (c === KEEP ? `${c.value} (or ${KEEP_NAME}: ${lower(c.hint).replace(/\.$/, '')})` : c.value)).join(', ')}`, kind: { type: 'choice', choices: SHRINK_CHOICES } },
  { name: 'shrink-from', group: 'sentence', target: sentence('shrinkFrom'), label: 'shrink words from', description: 'Shrink words of this many letters or more', kind: int(SHRINK_FROM_RANGE.min, SHRINK_FROM_RANGE.max) },
  { name: 'target-length', group: 'sentence', target: sentence('targetLength'), label: 'target length', description: 'Compress toward this many characters, or none (or max): toward the maximum length', kind: { type: 'target-length' } },
  { name: 'drop', group: 'sentence', target: sentence('allowDropping'), label: 'dropping words', description: 'Words may be dropped to fit', kind: bool },
  { name: 'small-initials', group: 'sentence', target: sentence('smallWordInitials'), label: 'small-word initials', description: 'Small words ("for", "the") become one capital letter', kind: bool },
  { name: 'padding', group: 'sentence', target: sentence('padding'), label: 'padding', description: 'Pad a sentence under the minimum length', kind: bool },
  { name: 'length-tag', group: 'sentence', target: sentence('lengthTag'), label: 'length tag', description: 'The tag that ends padding', kind: { type: 'choice', choices: LENGTH_TAG_CHOICES } },
  // Output.
  { name: 'count', group: 'output', target: { kind: 'output', key: 'count' }, label: FIELD_LABELS.count, description: `How many passwords (${MIN_COUNT}-${MAX_COUNT}); ${COUNT_AT_TERMINAL} at a terminal, ${COUNT_PIPED} when piped`, kind: int(MIN_COUNT, MAX_COUNT) },
  { name: 'sort', group: 'output', target: { kind: 'output', key: 'sort' }, label: 'order', description: `Order: ${list(SORT_ORDERS.map((c) => `${c.value} (${lower(c.hint)})`))}`, kind: { type: 'choice', choices: SORT_CHOICES } },
];

export const fieldNamed = (name: string) => FIELDS.find((f) => f.name === name);
export const reqField = (key: keyof Requirements) => FIELDS.find((f) => f.target.kind === 'req' && f.target.key === key);
export const fieldsIn = (group: FieldGroup) => FIELDS.filter((f) => f.group === group);

/** The config key path of a field: "rules.max-length". */
export const keyPath = (f: CliField) => `${f.group}.${f.name}`;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The strength presets by name, with the bits each stands for. */
export const STRENGTH_NAMES = STRENGTH_PRESETS.map((p) => ({ name: slugOf(p.label), bits: p.bits, label: p.label }));
/** The strongest preset is also taken by its name's first word ("master"): short enough to type, and it cannot be mistaken. */
const STRONGEST = STRENGTH_NAMES.reduce((a, b) => (b.bits > a.bits ? b : a));
const STRONGEST_SHORT = STRONGEST.name.split('-')[0]!;
const STRENGTH_ALIASES = new Map<string, number>(STRONGEST_SHORT !== STRONGEST.name && !STRENGTH_NAMES.some((s) => s.name === STRONGEST_SHORT) ? [[STRONGEST_SHORT, STRONGEST.bits]] : []);
/** Every name a strength preset is taken by, the aliases last. */
export const STRENGTH_INPUTS: readonly string[] = [...STRENGTH_NAMES.map((s) => s.name), ...STRENGTH_ALIASES.keys()];

const describeChar = (c: string) => (c === ' ' ? 'a space' : /[A-Za-z]/.test(c) ? `the letter "${c}"` : /\d/.test(c) ? `the digit "${c}"` : `"${c}"`);

/** Why `c` cannot be an allowed symbol or a separator symbol, or undefined when it can. */
export function symbolProblem(c: string): string | undefined {
  if (c === ' ') return 'a space is not a symbol; spaces are allowed with --spaces (spaces: true)';
  if (!isSymbol(c)) return `${describeChar(c)} is not a symbol; letters and digits are always allowed, so list only symbols`;
  if (!lookupKey(c)) return `"${c}" is not on a standard keyboard`;
  return undefined;
}

/** The longest a value is quoted in a message; past it the rest is cut to "...". */
const MAX_SHOWN = 60;

/**
 * A value as a message quotes it: text in double quotes, anything else as
 * JSON. Never throws: a value that refers to itself is shown as "[circular]"
 * where it does, and a long one is cut short.
 */
export function shownValue(raw: unknown): string {
  let text: string;
  if (typeof raw === 'string') text = `"${raw}"`;
  else {
    const seen = new WeakSet<object>();
    try {
      text =
        JSON.stringify(raw, (_key, value: unknown) => {
          if (typeof value !== 'object' || value === null) return typeof value === 'bigint' ? String(value) : value;
          if (seen.has(value)) return '[circular]';
          seen.add(value);
          return value;
        }) ?? String(raw);
    } catch {
      text = Object.prototype.toString.call(raw);
    }
  }
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN - 3)}...` : text;
}

/**
 * A value as written (a flag's text, or a YAML scalar) in the engine's
 * terms, or why it cannot be one. Messages say what was found and what is
 * expected, without the flag or key: the caller adds where it came from.
 */
export function parseValue(f: CliField, raw: unknown): Parsed<unknown> {
  const shown = shownValue(raw);
  const k = f.kind;
  switch (k.type) {
    case 'int': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^-?\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
      if (!Number.isInteger(n)) return { ok: false, error: `must be a whole number from ${k.min} to ${k.max}; found ${shown}` };
      if (n < k.min || n > k.max) return { ok: false, error: `must be from ${k.min} to ${k.max}; found ${n}` };
      return { ok: true, value: n };
    }
    case 'bool':
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      return { ok: false, error: `must be true or false; found ${shown}` };
    case 'choice': {
      const values = k.choices.map((c) => c.value);
      const typed = typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
      if (typed !== undefined && values.includes(typed)) return { ok: true, value: typed };
      if (typed !== undefined && f.name === 'shrink' && typed === KEEP_NAME) return { ok: true, value: KEEP.value }; // the app's word for it
      const near = typed !== undefined ? closest(typed, values) : undefined;
      return { ok: false, error: `must be one of ${values.join(', ')}; found ${shown}${near ? `. Did you mean ${near}?` : ''}` };
    }
    case 'symbols': {
      if (typeof raw !== 'string') return { ok: false, error: `must be a string of symbols, such as "!@#$%"; found ${shown}` };
      const seen = new Set<string>();
      for (const c of raw) {
        const problem = symbolProblem(c);
        if (problem) return { ok: false, error: `cannot include ${describeChar(c)}: ${problem}` };
        if (seen.has(c)) return { ok: false, error: `lists "${c}" twice` };
        seen.add(c);
      }
      return { ok: true, value: raw };
    }
    case 'separator': {
      const named = SEPARATOR_NAMES.find((s) => s.name === raw);
      if (named) return { ok: true, value: named.value };
      if (typeof raw !== 'string' || [...raw].length !== 1) {
        const near = typeof raw === 'string' ? closest(raw, separatorNames) : undefined;
        return { ok: false, error: `must be ${separatorNames.join(', ')}, or one symbol such as "${SEPARATOR_PREFERENCE[0]}"; found ${shown}${near ? `. Did you mean ${near}?` : ''}` };
      }
      const problem = symbolProblem(raw);
      if (problem) return { ok: false, error: `must be ${separatorNames.join(', ')}, or one symbol; ${problem}` };
      return { ok: true, value: raw };
    }
    case 'strength': {
      const names = STRENGTH_NAMES.map((s) => s.name);
      if (typeof raw === 'string') {
        const named = STRENGTH_NAMES.find((s) => s.name === raw)?.bits ?? STRENGTH_ALIASES.get(raw);
        if (named !== undefined) return { ok: true, value: named };
        if (!/^\d+(\.\d+)?$/.test(raw.trim())) {
          const near = closest(raw, STRENGTH_INPUTS);
          return { ok: false, error: `must be ${names.join(', ')}, or a number of bits from 0 to ${MAX_TARGET_BITS}; found ${shown}${near ? `. Did you mean ${near}?` : ''}` };
        }
      }
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
      if (!Number.isFinite(n)) return { ok: false, error: `must be ${names.join(', ')}, or a number of bits from 0 to ${MAX_TARGET_BITS}; found ${shown}` };
      if (n < 0 || n > MAX_TARGET_BITS) return { ok: false, error: `must be from 0 to ${MAX_TARGET_BITS} bits; found ${n}` };
      return { ok: true, value: n };
    }
    case 'target-length': {
      if (raw === 'none' || raw === 'max' || raw === null) return { ok: true, value: null }; // none: toward the maximum length, as the app's "max" says
      const { min, max } = TARGET_LENGTH_RANGE;
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
      if (!Number.isInteger(n) || n < min || n > max) return { ok: false, error: `must be none or a whole number from ${min} to ${max}; found ${shown}` };
      return { ok: true, value: n };
    }
  }
}

/** A value in the engine's terms as it is written in a config file or on the command line. */
export function formatValue(f: CliField, value: unknown): string | number | boolean {
  switch (f.kind.type) {
    case 'separator':
      return SEPARATOR_NAMES.find((s) => s.value === value)?.name ?? String(value);
    case 'strength': {
      const preset = STRENGTH_NAMES.find((s) => s.bits === value);
      return preset ? preset.name : (value as number);
    }
    case 'target-length':
      return value === null ? 'none' : (value as number);
    default:
      return value as string | number | boolean;
  }
}

/** A value as a phrase for messages: `12`, `a space`, `"!@#"`, `Everyday (40 bits)`, `on`. */
export function describeValue(f: CliField, value: unknown): string {
  switch (f.kind.type) {
    case 'bool':
      if (f.name === 'spaces') return value ? 'allowed' : 'not allowed';
      return value ? 'on' : 'off';
    case 'separator':
      return value === 'auto' ? 'Auto' : value === ' ' ? 'a space' : value === '' ? 'none' : `"${value}"`;
    case 'symbols':
      return value === '' ? 'none' : `"${value}"`;
    case 'strength': {
      const preset = STRENGTH_NAMES.find((s) => s.bits === value);
      return preset ? `${preset.label} (${value} bits)` : `${value} bits`;
    }
    case 'target-length':
      return value === null ? 'none' : String(value);
    case 'choice':
      return f.kind.choices.find((c) => c.value === value)?.label ?? String(value);
    default:
      return String(value);
  }
}

