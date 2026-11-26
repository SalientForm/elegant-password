// A configuration as plain data, its JSON form: the object a tep.yml
// describes, in the file's own vocabulary (kebab-case keys, named values),
// always the current version. What a saved web configuration, a My list
// entry and a package caller hold. checkConfig (check.ts) reads it back.

import { fieldsIn, formatValue, type FieldGroup } from './fields';
import type { ConfigModel } from './model';
import { appModeName, modeName } from './names';
import { CONFIG_VERSION } from './version';

/** A value as a configuration states it: a name, a number, true or false, or symbols. */
export type ConfigValue = string | number | boolean;

/** A configuration in its JSON form. Every key but `version` may be left out, and takes the default. */
export interface Config {
  version: number;
  /** An app mode's name: "sentences". */
  'app-mode'?: string;
  /** A typing mode's name: "ten-finger". */
  'typing-mode'?: string;
  /** A site preset's name: "short-max-16". */
  site?: string;
  /** Rule values by key, over the site preset. */
  rules?: Record<string, ConfigValue>;
  /** "preset": the typing mode's own options. Otherwise option values by key, over them. */
  options?: 'preset' | Record<string, ConfigValue>;
  /** How a sentence the user wrote or edited is fitted. */
  sentence?: Record<string, ConfigValue>;
  /** Built-in swaps switched off ("o>0"), and the user's own. */
  swaps?: { off?: string[]; custom?: { from: string; to: string }[] };
}

/** The values of one section in the configuration's vocabulary. */
function sectionOf(group: FieldGroup, values: Record<string, unknown>): Record<string, ConfigValue> {
  const out: Record<string, ConfigValue> = {};
  for (const f of fieldsIn(group)) if (f.name in values) out[f.name] = formatValue(f, values[f.name]);
  return out;
}

/** A model as plain data, at the current version. Sections it does not state are left out. */
export function configToJson(model: ConfigModel): Config {
  const config: Config = { version: CONFIG_VERSION };
  if (model.appMode) config['app-mode'] = appModeName(model.appMode);
  if (model.typingMode) config['typing-mode'] = modeName(model.typingMode);
  if (model.site) config.site = model.site;
  if (Object.keys(model.rules).length) config.rules = sectionOf('rules', model.rules);
  if (model.options !== 'preset') config.options = sectionOf('options', model.options);
  if (Object.keys(model.sentence).length) config.sentence = sectionOf('sentence', model.sentence);
  if (model.swaps && (model.swaps.disabled.length || model.swaps.custom.length)) {
    config.swaps = {
      ...(model.swaps.disabled.length ? { off: [...model.swaps.disabled] } : {}),
      ...(model.swaps.custom.length ? { custom: model.swaps.custom.map((m) => ({ from: m.from, to: m.to })) } : {}),
    };
  }
  return config;
}
