// Help, generated from the field table and the flag list, so it always
// lists exactly the flags tep takes.

import { EXIT_MEANINGS } from './errors';
import { FIELDS, fieldsIn, type CliField, type FieldGroup } from './fields';
import { META_FLAGS, SHORT_SETTINGS } from './flagList';

const pad = (s: string, width: number) => (s.length >= width ? `${s}  ` : s.padEnd(width));

function fieldFlag(f: CliField): string {
  const short = SHORT_SETTINGS[f.name] ? `-${SHORT_SETTINGS[f.name]}, ` : '    ';
  if (f.kind.type === 'bool') return `${short}--${f.name}, --no-${f.name}`;
  const value =
    f.kind.type === 'int' ? `<${f.kind.min}-${f.kind.max}>` : f.kind.type === 'choice' ? `<${f.kind.choices.map((c) => c.value).join('|')}>` : f.kind.type === 'symbols' ? '<symbols>' : f.kind.type === 'separator' ? '<auto|space|none|symbol>' : f.kind.type === 'strength' ? '<preset|bits>' : '<n|none>';
  return `${short}--${f.name} ${value}`;
}

const GROUP_TITLES: Record<FieldGroup, string> = {
  rules: 'The site\'s rules (config: rules.<name>)',
  options: 'How passwords are made; --mode fills these in (config: options.<name>)',
  sentence: 'Your own sentence, with --sentence - (config: sentence.<name>)',
  output: 'Output (config: output.<name>)',
};

export const OVERVIEW = `tep: the elegant passwords generator, on the command line

Usage:
  tep g [flags]            Generate passwords (also: tep generate)
  tep config [file]        Answer a few questions and write a config file (default ./tep.yml)
  tep uninstall            Take tep off your PATH (asks first)
  tep help [command]       Help for a command
  tep --version            The version

Examples:
  tep g                                   with ./tep.yml if there is one, else the defaults
  tep g --site short-max-16 --mode two-finger
  tep g -c bank.yml -n 3
  tep g --rules "8-20 characters, at least one number" --format json
  tep g --sentence - < sentence.txt
  tep config bank.yml

Exit codes: ${EXIT_MEANINGS.map((e) => `${e.code} ${e.short}`).join(', ')}.
`;

export function generateHelp(): string {
  const width = Math.max(...FIELDS.map((f) => fieldFlag(f).length), ...META_FLAGS.map((m) => m.name.length + m.value.length + 8)) + 2;
  const lines = ['Usage: tep g [flags]', '', 'Settings come from the defaults, then the config file (./tep.yml, or -c), then these flags.', ''];
  lines.push('Flags');
  for (const m of META_FLAGS) {
    const flag = `${'short' in m ? `-${m.short}, ` : '    '}--${m.name}${m.value ? ` ${m.value}` : ''}`;
    lines.push(`  ${pad(flag, width)}${m.description}`);
  }
  for (const group of ['rules', 'options', 'sentence', 'output'] as const) {
    lines.push('', GROUP_TITLES[group]);
    for (const f of fieldsIn(group)) lines.push(`  ${pad(fieldFlag(f), width)}${f.description}`);
  }
  lines.push('', 'A value that starts with a dash is joined with "=": --symbols=-_.');
  return `${lines.join('\n')}\n`;
}

export const CONFIG_HELP = `Usage: tep config [file]

Asks the questions that make a config file, then shows every answer with a
line number: pick a line to change it, s to save, q to quit without saving.
Esc goes back to the review from a line; Ctrl+C stops, writing nothing.
Writes ./tep.yml, or the file named. An existing file is loaded first.

Choices that would contradict an earlier answer are shown but cannot be
picked, with the reason. Needs a terminal.

The file, which can also be written by hand (YAML; every key is optional
except version; the keys are tep g's flags without their dashes):
  version: 1
  mode: two-finger          # ten-finger, two-finger, one-handed or quick
  site: typical-site        # a site preset, or rules: with min-length, max-length, ...
  rules:
    symbols: "!@#$%"        # symbols are quoted, as YAML gives many a meaning
  options: preset           # the mode's own options, or a map: strength, comfort, ...
  output:
    count: 3
`;

export const UNINSTALL_HELP = `Usage: tep uninstall [--yes | -y]

Removes the links that put tep on your PATH: each tep in $TEP_BIN_DIR,
~/.local/bin or a directory on the PATH that links to a built tep (as
pnpm link:cli makes). Lists them and asks first; --yes skips the question.
The checkout and its build stay: pnpm link:cli there puts tep back.
`;
