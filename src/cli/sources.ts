// Where each setting's value came from, so every message can say it: "from
// --max-length", "from tep.yml line 7 (rules.max-length)", "from the
// short-max-16 site preset (chosen by --site)", "line 3 of the review".
// And how to change it, in the same terms.

import type { TypingMode } from '../lib/difficulty';
import { keyPath, type CliField } from './fields';
import { modeName } from './names';

export type Source =
  | { kind: 'default' }
  /** The count's default, which depends on whether output goes to a terminal. */
  | { kind: 'terminal'; tty: boolean }
  | { kind: 'flag'; flag: string }
  | { kind: 'file'; file: string; line: number; key: string }
  | { kind: 'site'; preset: string; via: Source }
  | { kind: 'mode'; mode: TypingMode; via: Source }
  | { kind: 'rules-text'; via: Source }
  | { kind: 'wizard'; line: number; label: string };

/** Where a value came from, as a phrase that follows "from". */
export function describeSource(s: Source): string {
  switch (s.kind) {
    case 'default':
      return 'the default';
    case 'terminal':
      return s.tty ? 'the default at a terminal' : 'the default when output is piped';
    case 'flag':
      return s.flag;
    case 'file':
      return `${s.file} line ${s.line} (${s.key})`;
    case 'site':
      return `the ${s.preset} site preset${s.via.kind === 'default' ? '' : `, chosen by ${describeSource(s.via)}`}`;
    case 'mode':
      return `the ${modeName(s.mode)} mode's preset${s.via.kind === 'default' ? ', the default mode' : `, chosen by ${describeSource(s.via)}`}`;
    case 'rules-text':
      return `the rules text given to ${describeSource(s.via)}`;
    case 'wizard':
      return `line ${s.line} (${s.label})`;
  }
}

/** Whether the user set this value themselves, rather than a default or a preset filling it in. */
export const isExplicit = (s: Source) => s.kind === 'flag' || s.kind === 'file' || s.kind === 'wizard' || s.kind === 'rules-text';

/** The file a value traces back to, if any: a preset chosen in a file is changed in that file. */
function fileOf(s: Source): string | undefined {
  if (s.kind === 'file') return s.file;
  if (s.kind === 'site' || s.kind === 'mode' || s.kind === 'rules-text') return fileOf(s.via);
  return undefined;
}

/**
 * How to change a setting whose value came from `s`, in the terms the user
 * used: the flag, the key in their file, or the review line. A preset's
 * value is overridden where the preset was chosen.
 */
export function howToChange(f: CliField, s: Source): string {
  if (s.kind === 'wizard') return `line ${s.line}`;
  if (s.kind === 'file') return `${keyPath(f)} in ${s.file} (line ${s.line})`;
  if (s.kind === 'flag') return `--${f.name}`;
  const file = fileOf(s);
  return file ? `--${f.name}, or ${keyPath(f)} in ${file}` : `--${f.name}`;
}
