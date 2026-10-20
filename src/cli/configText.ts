// Writing a config file's text: the header, each section with a comment
// saying what it is, symbols always quoted. Pure, with no YAML library and
// no file system, so the Fun page's CLI prompt can show a real file.

import { DEFAULT_TYPING_MODE } from '../lib/difficulty';
import { modeLabel } from '../lib/modeProfiles';
import { SITE_PRESETS } from '../lib/sitePresets';
import type { ConfigModel } from './configModel';
import { CONFIG_VERSION } from './configVersion';
import { fieldsIn, formatValue, type CliField, type FieldGroup } from './fields';
import { MODE_NAMES, modeName, SITE_NAMES } from './names';

/**
 * A scalar as YAML: names, numbers and booleans as they are, anything else
 * in double quotes (JSON's quoting is valid YAML), so no symbol is ever read
 * as YAML syntax. A string that starts with a digit is quoted too: a swap to
 * "0" written bare would read back as the number 0.
 */
const scalar = (v: unknown) => (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off'].includes(v)) ? String(v) : JSON.stringify(v));
const pad = (s: string, width = 28) => (s.length >= width ? `${s} ` : s.padEnd(width));

/** The file's text: header, then each section with a comment saying what it is. Sections the model does not state are left out. */
export function serializeConfig(model: ConfigModel, today: string): string {
  const out: string[] = [
    `# tep config, written by \`tep config\` on ${today}.`,
    '# Run `tep g` in this directory, or `tep g -c <this file>`. Edit it by hand or run `tep config` again.',
    `version: ${CONFIG_VERSION}`,
  ];
  const mode = model.mode ?? DEFAULT_TYPING_MODE;
  out.push(`${pad(`mode: ${scalar(modeName(mode))}`)}# ${MODE_NAMES.map((m) => m.name).join(' | ')}`, '');

  if (model.site) {
    const preset = SITE_PRESETS.find((p) => SITE_NAMES.find((s) => s.value === p)!.name === model.site)!;
    out.push(`${pad(`site: ${scalar(model.site)}`)}# ${preset.note}${Object.keys(model.rules).length ? '; rules below replace its values' : ''}`);
  }
  section(out, 'rules', model.rules, model.site ? undefined : 'the site\'s rules');

  if (model.options === 'preset') {
    out.push('', `${pad('options: preset')}# the ${modeLabel(mode)} options as tep sets them, now and as they change`);
  } else {
    out.push('');
    section(out, 'options', model.options, `set one by one; the ${modeLabel(mode)} preset fills in any left out`);
  }
  if (Object.keys(model.output).length) {
    out.push('');
    section(out, 'output', model.output);
  }
  if (Object.keys(model.sentence).length) {
    out.push('');
    section(out, 'sentence', model.sentence, 'for --sentence');
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

function section(out: string[], group: FieldGroup, values: Record<string, unknown>, comment?: string) {
  const fields = fieldsIn(group).filter((f) => f.name in values);
  if (!fields.length) return;
  out.push(comment ? `${pad(`${group}:`)}# ${comment}` : `${group}:`);
  for (const f of fields) out.push(`  ${f.name}: ${valueText(f, values[f.name])}`);
}

/** A value as YAML: symbols and separators always in double quotes, since YAML reads many symbols as syntax. */
function valueText(f: CliField, value: unknown): string {
  const v = formatValue(f, value);
  if (f.kind.type === 'symbols' || (f.kind.type === 'separator' && typeof v === 'string' && !['auto', 'space', 'none'].includes(v))) return JSON.stringify(v);
  return scalar(v);
}
