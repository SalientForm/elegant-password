// The settings tep generates from, layered from lowest to highest (spec
// §5.1): the defaults, the config file, then the flags. The core layers
// the configuration's settings (src/lib/config/resolve.ts), each value
// with its source; tep adds its count and order, the count's default at a
// terminal, and its own words for what the layering found. Nothing is
// fixed to fit: what contradicts itself is reported by the caller, in full.

import { emptyLayer as coreEmptyLayer, layerSettings, type Layer as CoreLayer, type RulesTextRefusal, type Sourced as CoreSourced } from '../lib/config/resolve';
import type { TypingMode } from '../lib/difficulty';
import { modeLabel } from '../lib/modeProfiles';
import type { GenerationSettings } from '../lib/pipeline';
import { DEFAULT_SORT, type SortOrder } from '../lib/sort';
import { lowerFirst } from '../lib/text';
import { usageError } from './errors';
import { COUNT_AT_TERMINAL, COUNT_PIPED, describeValue, fieldsIn } from './fields';
import { describeSource, isExplicit, type Given, type Source } from './sources';

export type Sourced<T> = CoreSourced<T, Source>;

/** What one layer (a config file, or the flags) says. Only what it states. */
export type Layer = CoreLayer<Source>;

export const emptyLayer = (): Layer => coreEmptyLayer<Source>();

export interface Resolved {
  generation: GenerationSettings;
  typingMode: TypingMode;
  sort: SortOrder;
  count: number;
  /** Where each field's value came from, by field name, plus "mode" for the typing mode. */
  sources: Record<string, Source>;
  /** What the rules text was read as, to say on stderr. */
  notes: string[];
  /** Options set by hand that the typing mode has no use for. */
  warnings: string[];
}

export interface ResolveEnv {
  /** Whether stdout is a terminal: it decides the count's default. */
  tty: boolean;
  /** The user's own sentence, for sentence mode; undefined to make one up. */
  sentence?: string;
}

export function resolve(file: Layer | undefined, flags: Layer, env: ResolveEnv): Resolved {
  const layered = layerSettings<Given>(file, flags);
  if (!layered.ok) throw refused(layered.refused);
  const { req, typingMode } = layered;
  const sources: Record<string, Source> = { ...layered.sources, count: { kind: 'terminal', tty: env.tty }, sort: { kind: 'default' } };

  // Output: the file first, the flags over it.
  let sort: SortOrder = DEFAULT_SORT;
  let count = env.tty ? COUNT_AT_TERMINAL : COUNT_PIPED;
  for (const layer of [file, flags]) {
    if (!layer) continue;
    for (const f of fieldsIn('output')) {
      const v = layer.values[f.name];
      if (!v) continue;
      if (f.target.kind === 'output' && f.target.key === 'count') count = v.value as number;
      else sort = v.value as SortOrder;
      sources[f.name] = v.source;
    }
  }
  req.count = count;

  const notes = layered.rulesRead.map((r) => `Read the rules text (${describeSource(r.source)}) as: ${r.understood.join('; ')}.`);
  const warnings = layered.unused
    .filter((u) => isExplicit(u.source))
    .map(
      (u) =>
        `${describeSource(u.source)} sets ${u.field.label} to ${describeValue(u.field, u.value)}, which ${modeLabel(typingMode)} typing has no use for (${lowerFirst(u.reason.replace(/\.$/, ''))}). It still shapes the passwords as set.`,
    );

  return {
    generation: {
      mode: env.sentence === undefined ? 'generated' : 'sentence',
      req,
      sentence: env.sentence ?? '',
      sentenceOptions: layered.sentenceOptions,
      mappingSettings: layered.mappingSettings,
    },
    typingMode,
    sort,
    count,
    sources,
    notes,
    warnings,
  };
}

/** A rules text the core refused whole, as tep says it. */
function refused(r: RulesTextRefusal<Source>) {
  const where = describeSource(r.source);
  switch (r.kind) {
    case 'too-long':
      return usageError(
        `${where}: the rules text is too long to read.`,
        r.message,
        'Or leave the rules text out and set the rules with --site or --min-length, --max-length, --symbols and the like instead.',
      );
    case 'unsupported':
      return usageError(
        `${where}: ${r.unsupported.length === 1 ? 'a rule' : `${r.unsupported.length} rules`} in "${r.text}" cannot be kept.`,
        ...r.unsupported.map((u) => `Not kept: ${u}.`),
        'Change the rules text to what the site allows that this tool can make, or set the rules with --min-length, --max-length, --symbols and the like instead.',
      );
    case 'none-understood':
      return usageError(
        `${where}: no password rules found in "${r.text}".`,
        'The text should read like a sign-up form\'s rules, such as "8-20 characters, at least one number and one of !@#$%".',
        'Leave the rules text out and set the rules with --site or --min-length, --max-length, --symbols and the like instead.',
      );
  }
}
