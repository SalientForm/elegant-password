// Reading and resolving a configuration (spec §5.2): checked with the
// schema, layered over the defaults, then checked as requirements, every
// problem naming the config keys at fault and nothing fixed to fit. The
// result's settings are opaque: they go to `generate`.

import { checkConfig, type KeyPath } from '../config/check';
import { describeValue, formatValue, keyPath, reqField } from '../config/fields';
import { configToJson, type Config, type ConfigValue } from '../config/json';
import type { ConfigModel } from '../config/model';
import { SITE_NAMES } from '../config/names';
import { changedOptions, emptyLayer, layerSettings, type Layer, type Origin } from '../config/resolve';
import { configToText } from '../config/text';
import { configFromYaml as readYaml } from '../config/yaml';
import { problemsOf, warningsOf } from '../consistency';
import type { TypingMode } from '../difficulty';
import type { SentenceOptions } from '../fromSentence';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../generate';
import type { MappingSettings } from '../mappingSettings';
import { modeLabel } from '../modeProfiles';
import { mergeParsedRules, parseRuleText, rulesTextLengthProblem } from '../ruleText';
import { rulesOf } from '../sitePresets';
import { lowerFirst } from '../text';

/** A problem or a warning: the config keys it is about ("rules.max-length"), none for the configuration as a whole, and why. */
export interface Message {
  keys: string[];
  message: string;
}

/** Something that stops a configuration, or a sentence, from making passwords. */
export type Problem = Message;

declare const settingsBrand: unique symbol;
/** A resolved configuration, for `generate`. Plain data, safe to keep and to send between threads; opaque to the caller. */
export type Settings = { readonly [settingsBrand]: true };

/** What Settings holds. */
export interface SettingsData {
  req: Requirements;
  sentenceOptions: SentenceOptions;
  mappingSettings: MappingSettings;
  typingMode: TypingMode;
}

export const settingsData = (settings: Settings) => settings as unknown as SettingsData;

export type Resolved =
  | {
      ok: true;
      settings: Settings;
      /** Worth saying, but passwords can be made: a strength target out of reach, an option the typing mode has no use for. */
      warnings: Message[];
      /** What the reading took as it is: a version 1 configuration read as version 2. */
      notes: string[];
      /** The `options` keys whose values differ from the typing mode's own: the mode, changed by hand. */
      changed: string[];
    }
  | { ok: false; problems: Problem[] };

/** Where a value came from: the key that states it. */
type Stated = { kind: 'key'; key: string };

const pathText = (path: KeyPath) => path.join('.');

/**
 * Check a configuration (its JSON form, or `configFromYaml`'s), layer it
 * over the defaults and check what it stands for. Every problem comes back
 * at once; a warning does not stop it.
 */
export function resolveConfig(config: unknown): Resolved {
  const checked = checkConfig(config);
  if (!checked.ok) return { ok: false, problems: checked.problems.map((p) => ({ keys: p.path.length ? [pathText(p.path)] : [], message: p.message })) };
  const model = checked.config;

  const layered = layerSettings<Stated>(layerOf(model), emptyLayer());
  if (!layered.ok) throw new Error('a configuration holds no rules text'); // never: only tep's flags do
  const { req, typingMode } = layered;
  const keysOf = (fields: readonly (keyof Requirements)[]) => [...new Set(fields.flatMap((k) => (reqField(k) ? [keyPath(reqField(k)!)] : [])))];

  const problems = problemsOf(req);
  if (problems.length) return { ok: false, problems: problems.map((p) => ({ keys: keysOf(p.fields), message: p.message })) };

  const warnings: Message[] = [
    ...warningsOf(req).map((w) => ({ keys: keysOf(['targetBits', 'maxLength']), message: w.message })),
    ...layered.unused
      .filter((u) => u.source.kind === 'key')
      .map((u) => ({
        keys: [keyPath(u.field)],
        message: `${keyPath(u.field)} sets ${u.field.label} to ${describeValue(u.field, u.value)}, which ${modeLabel(typingMode)} typing has no use for (${lowerFirst(u.reason.replace(/\.$/, ''))}). It still shapes the passwords as set.`,
      })),
  ];
  const notes = (config as { version?: unknown }).version === 1 ? ['This is a version 1 configuration: its mode was read as typing-mode. Written again, it is version 2.'] : [];
  const settings: SettingsData = { req, sentenceOptions: layered.sentenceOptions, mappingSettings: layered.mappingSettings, typingMode };
  return { ok: true, settings: settings as unknown as Settings, warnings, notes, changed: changedOptions(req, typingMode) };
}

/** The layer a checked configuration states, each value traced to its key. */
function layerOf(model: ConfigModel): Layer<Origin<Stated>> {
  const at = (key: string): Stated => ({ kind: 'key', key });
  const layer = emptyLayer<Origin<Stated>>();
  if (model.typingMode) layer.mode = { value: model.typingMode, source: at('typing-mode') };
  if (model.site) layer.site = { value: SITE_NAMES.find((s) => s.name === model.site)!.value, source: at('site') };
  const put = (section: string, values: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(values)) layer.values[name] = { value, source: at(`${section}.${name}`) };
  };
  put('rules', model.rules);
  if (model.options !== 'preset') put('options', model.options);
  put('sentence', model.sentence);
  if (model.swaps) layer.mappings = { value: model.swaps, source: at('swaps') };
  return layer;
}

/**
 * A site's sign-up text read as `rules` values, ready to merge into a
 * configuration's rules. Symbols it rules out are taken from the default
 * allowed set. A rule it states that cannot be kept is named in
 * `unsupported` and left out; past the length cap none of it is read.
 */
export function readRulesText(text: string): { rules: Record<string, ConfigValue>; understood: string[]; unsupported: string[] } {
  const tooLong = rulesTextLengthProblem(text);
  if (tooLong) return { rules: {}, understood: [], unsupported: [tooLong] };
  const parsed = parseRuleText(text);
  const merged = mergeParsedRules(rulesOf(DEFAULT_REQUIREMENTS), parsed);
  const rules: Record<string, ConfigValue> = {};
  for (const key of merged.fields) {
    const f = reqField(key)!;
    rules[f.name] = formatValue(f, merged.rules[key]);
  }
  return { rules, understood: parsed.understood, unsupported: parsed.unsupported };
}

/** A configuration as YAML text with comments, as tep config writes it, at the current version. Throws a TypeError naming every problem when it is not a valid configuration. */
export function configToYaml(config: Config): string {
  const checked = checkConfig(config);
  if (!checked.ok) throw new TypeError(`not a valid configuration: ${checked.problems.map((p) => p.message).join(' ')}`);
  return configToText(checked.config);
}

/** A configuration read from YAML text, as its JSON form at the current version, or every problem with its line. */
export function configFromYaml(text: string): { ok: true; config: Config } | { ok: false; problems: { path?: string; line: number; message: string }[] } {
  const read = readYaml(text);
  if (read.ok) return { ok: true, config: configToJson(read.config) };
  return { ok: false, problems: read.problems.map((p) => ({ ...(p.path ? { path: p.path } : {}), line: p.line, message: p.message })) };
}
