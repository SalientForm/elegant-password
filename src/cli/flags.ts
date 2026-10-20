// tep g's command line: every setting in the field table is a flag
// (--max-length 20, --spaces / --no-spaces), plus the flags that are not
// settings (-c, --mode, --site, --format...). Each refusal says which flag,
// what was wrong with it, and what it takes; Node's own parser errors are
// reworded in those terms.

import { parseArgs } from 'node:util';
import type { TypingMode } from '../lib/difficulty';
import { usageError } from './errors';
import { FIELDS, fieldNamed, fieldsIn, parseValue } from './fields';
import { FORMATS, META_FLAGS, type Format } from './flagList';
import { closest, lookup, MODE_NAMES, SITE_NAMES } from './names';
import { emptyLayer, type Layer } from './resolve';
import type { Source } from './sources';

/** Short forms of settings. */
const SHORT: Record<string, string> = { count: 'n' };

export interface GenerateFlags {
  layer: Layer;
  /** -c: a config file to read instead of ./tep.yml. */
  config?: string;
  noConfig: boolean;
  /** --sentence - was given. */
  sentence: boolean;
  format?: Format;
  copy: boolean;
  explain: boolean;
  color: boolean;
  quiet: boolean;
  help: boolean;
}

type Options = NonNullable<Parameters<typeof parseArgs>[0]>['options'];

function options(): Options {
  const out: Record<string, { type: 'string' | 'boolean'; short?: string }> = {};
  for (const f of FIELDS) out[f.name] = { type: f.kind.type === 'bool' ? 'boolean' : 'string', ...(SHORT[f.name] ? { short: SHORT[f.name] } : {}) };
  for (const m of META_FLAGS) {
    if (m.name === 'no-config' || m.name === 'no-color') continue; // read before parsing, below
    out[m.name] = { type: m.value ? 'string' : 'boolean', ...('short' in m ? { short: m.short } : {}) };
  }
  return out;
}

/** Every flag tep g takes, as typed, for "did you mean". */
export const ALL_FLAGS = [...FIELDS.flatMap((f) => (f.kind.type === 'bool' ? [`--${f.name}`, `--no-${f.name}`] : [`--${f.name}`])), ...META_FLAGS.map((m) => `--${m.name}`)];

/** An example of a flag with a value, for messages. */
function example(name: string): string {
  const f = fieldNamed(name);
  if (!f) {
    const m = META_FLAGS.find((x) => x.name === name);
    return m?.value ? `--${name} ${m.value === '<file>' ? 'bank.yml' : m.value === '<mode>' ? 'two-finger' : m.value === '<preset>' ? 'typical-site' : m.value === '<format>' ? 'json' : m.value === '-' ? '-' : '"8-20 characters"'}` : `--${name}`;
  }
  switch (f.kind.type) {
    case 'int':
      return `--${name} ${Math.min(f.kind.max, Math.max(f.kind.min, 12))}`;
    case 'choice':
      return `--${name} ${f.kind.choices[0]!.value}`;
    case 'symbols':
      return `--${name} '!@#$%'`;
    case 'separator':
      return `--${name} space`;
    case 'strength':
      return `--${name} strong`;
    case 'target-length':
      return `--${name} 16`;
    default:
      return `--${name}`;
  }
}

/** Node's parser errors, in tep's terms. */
function reword(e: unknown, args: string[]): never {
  const err = e as { code?: string; message: string };
  const message = err.message ?? String(e);
  const named = message.match(/Option '(-{1,2}[^' ]+)/)?.[1] ?? message.match(/Unknown option '([^']+)'/)?.[1];
  switch (err.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION': {
      const flag = named ?? '?';
      const near = closest(flag, ALL_FLAGS);
      throw usageError(`unknown flag ${flag}.${near ? ` Did you mean ${near}?` : ''}`, 'Run "tep help g" for every flag.');
    }
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE': {
      const flag = named ?? '?';
      const name = flag.replace(/^-+/, '');
      const long = name.length === 1 ? (Object.entries(SHORT).find(([, s]) => s === name)?.[0] ?? META_FLAGS.find((m) => 'short' in m && m.short === name)?.name ?? name) : name;
      if (/does not take an argument/.test(message)) {
        const f = fieldNamed(long);
        throw usageError(
          `${flag} takes no value.`,
          f?.kind.type === 'bool' ? `It is on or off: write --${long} for on, --no-${long} for off.` : `Write ${flag} on its own.`,
        );
      }
      if (/ambiguous/.test(message)) {
        const i = args.findIndex((a) => a === flag);
        const value = i >= 0 ? args[i + 1] : undefined;
        throw usageError(
          `the value after ${flag}${value ? `, "${value}",` : ''} starts with a dash, so it reads as another flag.`,
          value ? `If it is the value, join them with "=": ${flag}=${value}` : `Give ${flag} a value, as in ${example(long)}.`,
        );
      }
      throw usageError(`${flag} needs a value, as in ${example(long)}.`);
    }
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL': {
      const arg = message.match(/Unexpected argument '([^']*)'/)?.[1] ?? '';
      const kv = arg.match(/^([a-z-]+)=(.*)$/);
      throw usageError(
        `"${arg}" is not a flag: tep g takes only flags.`,
        kv ? `Flags start with two dashes: --${kv[1]} ${kv[2]}` : 'Run "tep help g" for every flag.',
      );
    }
    default:
      throw usageError(`${message}`);
  }
}

/** Parse tep g's arguments. Throws a usage error (exit 2) that names the flag at fault. */
export function parseGenerateArgs(argv: string[]): GenerateFlags {
  const noConfig = argv.includes('--no-config');
  const noColor = argv.includes('--no-color');
  const args = argv.filter((a) => a !== '--no-config' && a !== '--no-color');
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args, options: options(), strict: true, allowPositionals: false, allowNegative: true, tokens: true });
  } catch (e) {
    reword(e, args);
  }
  const values = parsed.values as Record<string, string | boolean | undefined>;

  // A flag given twice, or on and off, is a contradiction on the command line itself.
  const seen = new Map<string, string[]>();
  for (const t of parsed.tokens ?? []) {
    if (t.kind !== 'option') continue;
    const forms = seen.get(t.name) ?? [];
    forms.push(t.value !== undefined ? `${t.rawName} ${t.value}` : t.rawName);
    seen.set(t.name, forms);
  }
  for (const [name, forms] of seen) {
    if (forms.length < 2) continue;
    const bool = fieldNamed(name)?.kind.type === 'bool';
    const both = bool && new Set(forms.map((f) => f.startsWith('--no-'))).size === 2;
    throw usageError(
      both ? `--${name} and --no-${name} are both given; they contradict each other.` : `--${name} is given ${forms.length} times (${forms.join(', ')}).`,
      both ? `Keep one: --${name} for on, --no-${name} for off.` : 'Give it once, with the value you mean.',
    );
  }
  if (noConfig && values.config !== undefined) {
    throw usageError('-c and --no-config contradict each other: one names a config file, the other says to read none.', 'Keep one.');
  }

  const layer = emptyLayer();
  const flagSource = (name: string): Source => {
    const t = (parsed.tokens ?? []).find((x) => x.kind === 'option' && x.name === name);
    return { kind: 'flag', flag: t && t.kind === 'option' ? (t.rawName.startsWith('--') ? t.rawName : `${t.rawName} (--${name})`) : `--${name}` };
  };

  for (const f of FIELDS) {
    const raw = values[f.name];
    if (raw === undefined) continue;
    const r = parseValue(f, raw);
    if (!r.ok) throw usageError(`--${f.name} ${r.error}.`, `For example: ${example(f.name)}`);
    layer.values[f.name] = { value: r.value, source: flagSource(f.name) };
  }

  if (typeof values.mode === 'string') {
    const r = lookup('typing mode', MODE_NAMES, values.mode);
    if (!r.ok) throw usageError(`--mode: ${r.error}`);
    layer.mode = { value: r.value as TypingMode, source: flagSource('mode') };
  }
  if (typeof values.site === 'string') {
    const r = lookup('site preset', SITE_NAMES, values.site);
    if (!r.ok) throw usageError(`--site: ${r.error}`);
    layer.site = { value: r.value, source: flagSource('site') };
  }
  if (typeof values.rules === 'string') layer.rulesText = { value: values.rules, source: flagSource('rules') };

  const sentence = values.sentence !== undefined;
  if (sentence && values.sentence !== '-') {
    throw usageError(
      '--sentence takes "-", not the sentence itself.',
      'A sentence typed as an argument is saved in your shell history and can be seen by other users in ps, and it is the secret your password is made from.',
      'Write --sentence - and type the sentence when asked (it is not shown), or pipe it in: tep g --sentence - < sentence.txt',
    );
  }
  const sentenceFlags = fieldsIn('sentence').filter((f) => values[f.name] !== undefined);
  if (!sentence && sentenceFlags.length) {
    throw usageError(
      `${sentenceFlags.map((f) => `--${f.name}`).join(', ')} ${sentenceFlags.length === 1 ? 'is' : 'are'} for your own sentence, and --sentence - is not given.`,
      'Add --sentence - to use your own sentence, or leave them out.',
    );
  }

  let format: Format | undefined;
  if (typeof values.format === 'string') {
    if (!FORMATS.includes(values.format as Format)) {
      const near = closest(values.format, FORMATS);
      throw usageError(`--format must be ${FORMATS.join(', ')}; found "${values.format}".${near ? ` Did you mean ${near}?` : ''}`);
    }
    format = values.format as Format;
  }
  if (values.explain && format === 'plain') {
    throw usageError('--explain and --format plain contradict each other: plain output is the passwords alone.', 'Use --format table or --format json with --explain.');
  }

  return {
    layer,
    ...(typeof values.config === 'string' ? { config: values.config } : {}),
    noConfig,
    sentence,
    ...(format ? { format } : {}),
    copy: values.copy === true,
    explain: values.explain === true,
    color: !noColor,
    quiet: values.quiet === true,
    help: values.help === true,
  };
}
