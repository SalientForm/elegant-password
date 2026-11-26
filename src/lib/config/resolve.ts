// The settings a configuration stands for, layered from lowest to highest:
// the defaults, then each layer given (a config file, then tep's flags).
// Within each: the site preset, the rules text, the rule values, the typing
// mode's preset, the option values. Every field remembers where its value
// came from, in the caller's own terms (tep: a flag, a file line, a wizard
// line; the package: a key path), so each front end words its messages its
// own way. Nothing is fixed to fit: what contradicts itself is the caller's
// to report, in full. A front end's own settings (tep's count and order)
// are its own to layer.

import { DEFAULT_TYPING_MODE, type TypingMode } from '../difficulty';
import { DEFAULT_SENTENCE_OPTIONS, type SentenceOptions } from '../fromSentence';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../generate';
import { DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../mappingSettings';
import { profileValues, PROFILE_KEYS, unusedIn } from '../modeProfiles';
import { mergeParsedRules, parseRuleText, rulesTextLengthProblem } from '../ruleText';
import { RULE_KEYS, type SitePreset } from '../sitePresets';
import { fieldsIn, reqField, type ConfigField, type FieldGroup } from './fields';
import { siteName } from './names';

/**
 * Where a value came from: the default, a preset or the rules text chosen
 * somewhere, or one of the caller's own origins `G`, which say where.
 */
export type Origin<G> = { kind: 'default' } | { kind: 'site'; preset: string; via: Origin<G> } | { kind: 'mode'; mode: TypingMode; via: Origin<G> } | { kind: 'rules-text'; via: Origin<G> } | G;

export interface Sourced<T, S> {
  value: T;
  source: S;
}

/** What one layer (a configuration, or tep's flags) says. Only what it states. */
export interface Layer<S> {
  site?: Sourced<SitePreset, S>;
  /** A site's rules in words, for parseRuleText. */
  rulesText?: Sourced<string, S>;
  mode?: Sourced<TypingMode, S>;
  /** Values by field name ("max-length"), already parsed into the engine's terms. A name the core does not know (tep's count) is the caller's. */
  values: Record<string, Sourced<unknown, S>>;
  mappings?: Sourced<MappingSettings, S>;
}

export const emptyLayer = <S>(): Layer<S> => ({ values: {} });

/** Why a layer's rules text was refused whole: none of it is read. */
export type RulesTextRefusal<S> = { source: S; text: string } & ({ kind: 'too-long'; message: string } | { kind: 'unsupported'; unsupported: string[] } | { kind: 'none-understood' });

/** An option the typing mode has no use for, with the value it holds and where that came from. */
export interface UnusedOption<S> {
  field: ConfigField;
  value: unknown;
  /** Why the mode has no use for it, as a sentence. */
  reason: string;
  source: S;
}

export interface Layered<S> {
  ok: true;
  /** The requirements; `count` is the engine's default, for the caller to set. */
  req: Requirements;
  sentenceOptions: SentenceOptions;
  mappingSettings: MappingSettings;
  typingMode: TypingMode;
  /** Where each core field's value came from, by field name, plus "mode" for the typing mode and "swaps" when a layer states them. */
  sources: Record<string, S>;
  /** Each rules text read, with what it was read as. */
  rulesRead: { source: S; understood: string[] }[];
  /** Every option the typing mode has no use for, whoever set it: the caller keeps those set by hand. */
  unused: UnusedOption<S>[];
}

export type LayerResult<S> = Layered<S> | { ok: false; refused: RulesTextRefusal<S> };

/**
 * Layer the defaults, `lower` (a config file) and `upper` (tep's flags, or
 * an empty layer). A typing mode in `upper` replaces `lower`'s own options,
 * as picking a mode does in the web app. A rules text that cannot be read
 * whole stops the layering.
 */
export function layerSettings<G>(lower: Layer<Origin<G>> | undefined, upper: Layer<Origin<G>>): LayerResult<Origin<G>> {
  type S = Origin<G>;
  const req: Requirements = { ...DEFAULT_REQUIREMENTS };
  const sentenceOptions: SentenceOptions = { ...DEFAULT_SENTENCE_OPTIONS };
  const sources: Record<string, S> = {};
  const rulesRead: { source: S; understood: string[] }[] = [];
  for (const group of ['rules', 'options', 'sentence'] as const) for (const f of fieldsIn(group)) sources[f.name] = { kind: 'default' };

  const set = (f: ConfigField, value: unknown, source: S) => {
    if (f.target.kind === 'req') (req as unknown as Record<string, unknown>)[f.target.key] = value;
    else (sentenceOptions as unknown as Record<string, unknown>)[f.target.key] = value;
    sources[f.name] = source;
  };
  const apply = (layer: Layer<S>, group: FieldGroup) => {
    for (const f of fieldsIn(group)) {
      const v = layer.values[f.name];
      if (v) set(f, v.value, v.source);
    }
  };

  // The site's rules: preset, then words, then values; the lower layer first, the upper over it.
  for (const layer of [lower, upper]) {
    if (!layer) continue;
    if (layer.site) {
      const via = layer.site.source;
      for (const key of RULE_KEYS) set(reqField(key)!, layer.site.value.rules[key], { kind: 'site', preset: siteName(layer.site.value), via });
    }
    if (layer.rulesText) {
      const { value: text, source } = layer.rulesText;
      // Past the cap nothing of it is read: refused whole, never cut, as the web box refuses the paste.
      const tooLong = rulesTextLengthProblem(text);
      if (tooLong) return { ok: false, refused: { source, text, kind: 'too-long', message: tooLong } };
      const parsed = parseRuleText(text);
      // A rule the tool cannot keep is refused, never applied cut down: "exactly 300 characters" must not come back as 128.
      if (parsed.unsupported.length) return { ok: false, refused: { source, text, kind: 'unsupported', unsupported: parsed.unsupported } };
      if (!parsed.understood.length) return { ok: false, refused: { source, text, kind: 'none-understood' } };
      // Merged as the web form merges them, but never settled: a contradiction is reported, not fixed.
      const merged = mergeParsedRules(req, parsed);
      for (const key of merged.fields) set(reqField(key)!, merged.rules[key], { kind: 'rules-text', via: source });
      rulesRead.push({ source, understood: parsed.understood });
    }
    apply(layer, 'rules');
  }

  // The typing mode, and the options its preset fills in.
  const modeFrom = upper.mode ?? lower?.mode;
  const typingMode = modeFrom?.value ?? DEFAULT_TYPING_MODE;
  sources.mode = modeFrom?.source ?? { kind: 'default' };
  const profile = profileValues(typingMode, req);
  for (const key of PROFILE_KEYS) set(reqField(key)!, profile[key], { kind: 'mode', mode: typingMode, via: sources.mode });
  if (lower && !upper.mode) apply(lower, 'options');
  apply(upper, 'options');

  for (const layer of [lower, upper]) if (layer) apply(layer, 'sentence');

  const mappings = upper.mappings ?? lower?.mappings;
  if (mappings) sources.swaps = mappings.source;

  const unused = unusedIn(typingMode).map((u) => {
    const field = reqField(u.key)!;
    return { field, value: req[u.key], reason: u.reason, source: sources[field.name]! };
  });

  return { ok: true, req, sentenceOptions, mappingSettings: mappings?.value ?? DEFAULT_MAPPING_SETTINGS, typingMode, sources, rulesRead, unused };
}

/** The option keys whose values differ from the typing mode's own, by field name: a mode changed by hand. */
export function changedOptions(req: Requirements, typingMode: TypingMode): string[] {
  const profile = profileValues(typingMode, req);
  return PROFILE_KEYS.filter((key) => req[key] !== profile[key]).map((key) => reqField(key)!.name);
}
