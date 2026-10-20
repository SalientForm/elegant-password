// The settings tep generates from, layered from lowest to highest (spec
// §5.1): the defaults, the config file, then the flags. Within each: the
// site preset, the rules text (flags only), the rule values, the mode's
// preset, the option values. Every field remembers where its value came
// from. Nothing is fixed to fit: what contradicts itself is reported by
// the caller, in full.

import { DEFAULT_TYPING_MODE, type TypingMode } from '../lib/difficulty';
import { DEFAULT_SENTENCE_OPTIONS, type SentenceOptions } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../lib/mappingSettings';
import { modeLabel, profileValues, PROFILE_KEYS, unusedIn } from '../lib/modeProfiles';
import type { GenerationSettings } from '../lib/pipeline';
import { parseRuleText } from '../lib/ruleText';
import { RULE_KEYS, type SitePreset } from '../lib/sitePresets';
import { DEFAULT_SORT, type SortOrder } from '../lib/sort';
import { usageError } from './errors';
import { describeValue, FIELDS, reqField, type CliField } from './fields';
import { siteName } from './names';
import { describeSource, isExplicit, type Source } from './sources';

export interface Sourced<T> {
  value: T;
  source: Source;
}

/** What one layer (a config file, or the flags) says. Only what it states. */
export interface Layer {
  site?: Sourced<SitePreset>;
  /** A site's rules in words, for parseRuleText (flags only). */
  rulesText?: Sourced<string>;
  mode?: Sourced<TypingMode>;
  /** Values by field name ("max-length"), already parsed into the engine's terms. */
  values: Record<string, Sourced<unknown>>;
  mappings?: Sourced<MappingSettings>;
}

export const emptyLayer = (): Layer => ({ values: {} });

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

const COUNT_AT_TERMINAL = 5;
const COUNT_PIPED = 1;

export function resolve(file: Layer | undefined, flags: Layer, env: ResolveEnv): Resolved {
  const req: Requirements = { ...DEFAULT_REQUIREMENTS };
  const sentenceOptions: SentenceOptions = { ...DEFAULT_SENTENCE_OPTIONS };
  let sort: SortOrder = DEFAULT_SORT;
  let count = env.tty ? COUNT_AT_TERMINAL : COUNT_PIPED;
  const sources: Record<string, Source> = {};
  const notes: string[] = [];
  for (const f of FIELDS) sources[f.name] = { kind: 'default' };
  sources.count = { kind: 'terminal', tty: env.tty };

  const set = (f: CliField, value: unknown, source: Source) => {
    if (f.target.kind === 'req') (req as unknown as Record<string, unknown>)[f.target.key] = value;
    else if (f.target.kind === 'sentence') (sentenceOptions as unknown as Record<string, unknown>)[f.target.key] = value;
    else if (f.target.key === 'count') count = value as number;
    else sort = value as SortOrder;
    sources[f.name] = source;
  };
  const apply = (layer: Layer, group: CliField['group']) => {
    for (const f of FIELDS.filter((x) => x.group === group)) {
      const v = layer.values[f.name];
      if (v) set(f, v.value, v.source);
    }
  };

  // The site's rules: preset, then words, then values; the file first, the flags over it.
  for (const layer of [file, flags]) {
    if (!layer) continue;
    if (layer.site) {
      const via = layer.site.source;
      for (const key of RULE_KEYS) set(reqField(key)!, layer.site.value.rules[key], { kind: 'site', preset: siteName(layer.site.value), via });
    }
    if (layer.rulesText) {
      const parsed = parseRuleText(layer.rulesText.value);
      const where = describeSource(layer.rulesText.source);
      if (!parsed.understood.length) {
        throw usageError(
          `${where}: no password rules found in "${layer.rulesText.value}".`,
          'The text should read like a sign-up form\'s rules, such as "8-20 characters, at least one number and one of !@#$%".',
          'Leave the rules text out and set the rules with --site or --min-length, --max-length, --symbols and the like instead.',
        );
      }
      const via: Source = { kind: 'rules-text', via: layer.rulesText.source };
      for (const [key, value] of Object.entries(parsed.rules)) set(reqField(key as keyof Requirements)!, value, via);
      if (parsed.excludedSymbols) set(reqField('allowedSymbols')!, [...req.allowedSymbols].filter((c) => !parsed.excludedSymbols.includes(c)).join(''), via);
      notes.push(`Read the rules text (${where}) as: ${parsed.understood.join('; ')}.`);
    }
    apply(layer, 'rules');
  }

  // The typing mode, and the options its preset fills in. A mode on the command line replaces the file's own options, as picking a mode does in the web app.
  const modeFrom = flags.mode ?? file?.mode;
  const typingMode = modeFrom?.value ?? DEFAULT_TYPING_MODE;
  sources.mode = modeFrom?.source ?? { kind: 'default' };
  const profile = profileValues(typingMode, req);
  for (const key of PROFILE_KEYS) set(reqField(key)!, profile[key], { kind: 'mode', mode: typingMode, via: sources.mode });
  if (file && !flags.mode) apply(file, 'options');
  apply(flags, 'options');

  for (const layer of [file, flags]) if (layer) apply(layer, 'sentence');
  for (const layer of [file, flags]) if (layer) apply(layer, 'output');
  req.count = count;

  const warnings = unusedIn(typingMode)
    .map((u) => ({ u, f: reqField(u.key)! }))
    .filter(({ f }) => isExplicit(sources[f.name]!))
    .map(
      ({ u, f }) =>
        `${describeSource(sources[f.name]!)} sets ${f.label} to ${describeValue(f, (req as unknown as Record<string, unknown>)[u.key])}, which means nothing for ${modeLabel(typingMode)} typing: ${u.reason} The setting still applies to how passwords are made.`,
    );

  const mappingSettings = flags.mappings?.value ?? file?.mappings?.value ?? DEFAULT_MAPPING_SETTINGS;
  if (file?.mappings) sources.swaps = file.mappings.source;

  return {
    generation: {
      mode: env.sentence === undefined ? 'generated' : 'sentence',
      req,
      sentence: env.sentence ?? '',
      sentenceOptions,
      mappingSettings,
    },
    typingMode,
    sort,
    count,
    sources,
    notes,
    warnings,
  };
}

/** A field's current value in resolved settings. */
export function valueOf(r: Pick<Resolved, 'generation' | 'sort' | 'count'>, f: CliField): unknown {
  if (f.target.kind === 'req') return r.generation.req[f.target.key];
  if (f.target.kind === 'sentence') return r.generation.sentenceOptions[f.target.key];
  return f.target.key === 'count' ? r.count : r.sort;
}
