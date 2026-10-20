// The flags of tep g that are not settings (the settings are the field
// table's): what each takes and does. Pure, so help and the Fun page's CLI
// prompt can list them without the parser.

import { MODE_NAMES, SITE_NAMES } from './names';

/** Short forms of the settings' flags: -n for --count. */
export const SHORT_SETTINGS: Record<string, string> = { count: 'n' };

export type Format = 'table' | 'plain' | 'json';
export const FORMATS: readonly Format[] = ['table', 'plain', 'json'];

/** The flags that are not settings, with what each takes, for help and for messages. */
export const META_FLAGS = [
  { name: 'config', short: 'c', value: '<file>', description: 'Read settings from this config file instead of ./tep.yml' },
  { name: 'no-config', value: '', description: 'Read no config file, not even ./tep.yml' },
  { name: 'mode', short: 'm', value: '<mode>', description: `Typing mode: ${MODE_NAMES.map((m) => m.name).join(', ')}; fills in the options that suit it` },
  { name: 'site', short: 's', value: '<preset>', description: `Site rules preset: ${SITE_NAMES.map((s) => s.name).join(', ')}` },
  { name: 'rules', value: '<text>', description: 'The site\'s rules as written on its sign-up form ("8-20 characters, one number")' },
  { name: 'sentence', value: '-', description: 'Use your own sentence, read from stdin (or typed, hidden, at a terminal)' },
  { name: 'format', short: 'f', value: '<format>', description: 'table (at a terminal), plain (piped: passwords only) or json' },
  { name: 'copy', value: '', description: 'Also copy the first password to the clipboard' },
  { name: 'explain', value: '', description: 'Say why each password is what it is: words, swaps, rules met' },
  { name: 'no-color', value: '', description: 'No colour (also when NO_COLOR is set or output is not a terminal)' },
  { name: 'quiet', short: 'q', value: '', description: 'No warnings or notes on stderr' },
  { name: 'help', short: 'h', value: '', description: 'This help' },
] as const;
