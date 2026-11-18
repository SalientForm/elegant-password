// Writing a configuration as YAML text: each section with a comment saying
// what it is, symbols always quoted. Pure, with no YAML library and no file
// system, so the Fun page's CLI prompt can show a real file. A front end
// words the comments its own way (tep names its commands) and may add
// sections of its own after the options (tep's output).

import { DEFAULT_TYPING_MODE } from '../difficulty';
import { modeLabel } from '../modeProfiles';
import { SITE_PRESETS } from '../sitePresets';
import { fieldsIn, formatValue, type ConfigField } from './fields';
import type { ConfigModel } from './model';
import { MODE_NAMES, modeName, SITE_NAMES } from './names';
import { CONFIG_VERSION } from './version';

/** How a front end words the comments, and what it adds. */
export interface TextWording {
  /** Comment lines before `version`, each without its "# ". */
  header: readonly string[];
  /** The comment after `options: preset`, given the typing mode's label. */
  presetNote: (modeLabel: string) => string;
  /** The comment on the sentence section. */
  sentenceNote: string;
  /** Lines added after the options, as YAML (tep's output section). */
  afterOptions?: readonly string[];
}

export const DEFAULT_WORDING: TextWording = {
  header: [],
  presetNote: (label) => `the ${label} options as Elegant Passwords sets them, now and as they change`,
  sentenceNote: 'for a sentence of your own',
};

/**
 * A scalar as YAML: names, numbers and booleans as they are, anything else
 * in double quotes (JSON's quoting is valid YAML), so no symbol is ever read
 * as YAML syntax. A string that starts with a digit is quoted too: a swap to
 * "0" written bare would read back as the number 0.
 */
const scalar = (v: unknown) => (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off'].includes(v)) ? String(v) : JSON.stringify(v));
const pad = (s: string, width = 28) => (s.length >= width ? `${s} ` : s.padEnd(width));

/** The configuration's text: header, then each section with a comment saying what it is. Sections the model does not state are left out. */
export function configToText(model: ConfigModel, wording: TextWording = DEFAULT_WORDING): string {
  const out: string[] = [...wording.header.map((line) => `# ${line}`), `version: ${CONFIG_VERSION}`];
  const mode = model.mode ?? DEFAULT_TYPING_MODE;
  out.push(`${pad(`mode: ${scalar(modeName(mode))}`)}# ${MODE_NAMES.map((m) => m.name).join(' | ')}`, '');

  if (model.site) {
    const preset = SITE_PRESETS.find((p) => SITE_NAMES.find((s) => s.value === p)!.name === model.site)!;
    out.push(`${pad(`site: ${scalar(model.site)}`)}# ${preset.note}${Object.keys(model.rules).length ? '; rules below replace its values' : ''}`);
  }
  out.push(...sectionLines('rules', fieldsIn('rules'), model.rules, model.site ? undefined : 'the site\'s rules'));

  if (model.options === 'preset') {
    out.push('', `${pad('options: preset')}# ${wording.presetNote(modeLabel(mode))}`);
  } else {
    out.push('', ...sectionLines('options', fieldsIn('options'), model.options, `set one by one; the ${modeLabel(mode)} preset fills in any left out`));
  }
  out.push(...(wording.afterOptions ?? []));
  if (Object.keys(model.sentence).length) {
    out.push('', ...sectionLines('sentence', fieldsIn('sentence'), model.sentence, wording.sentenceNote));
  }
  if (model.swaps && (model.swaps.disabled.length || model.swaps.custom.length)) {
    out.push('', 'swaps:');
    if (model.swaps.disabled.length) out.push(`  off: [${model.swaps.disabled.map(scalar).join(', ')}]`);
    if (model.swaps.custom.length) {
      out.push('  custom:');
      for (const m of model.swaps.custom) out.push(`    - { from: ${scalar(m.from)}, to: ${scalar(m.to)} }`);
    }
  }
  return `${out.join('\n')}\n`;
}

/** A section's lines: its key, with a comment when given, then each of its fields the values state. None when it states none. */
export function sectionLines(group: string, fields: readonly Pick<ConfigField<string, unknown>, 'name' | 'kind'>[], values: Record<string, unknown>, comment?: string): string[] {
  const stated = fields.filter((f) => f.name in values);
  if (!stated.length) return [];
  return [comment ? `${pad(`${group}:`)}# ${comment}` : `${group}:`, ...stated.map((f) => `  ${f.name}: ${valueText(f, values[f.name])}`)];
}

/** A value as YAML: symbols and separators always in double quotes, since YAML reads many symbols as syntax. */
function valueText(f: Pick<ConfigField<string, unknown>, 'name' | 'kind'>, value: unknown): string {
  const v = formatValue(f, value);
  if (f.kind.type === 'symbols' || (f.kind.type === 'separator' && typeof v === 'string' && !['auto', 'space', 'none'].includes(v))) return JSON.stringify(v);
  return scalar(v);
}
