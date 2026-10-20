// One parser for the commands that take only a few flags (tep config, tep
// uninstall): Node's parseArgs, with its errors reworded in tep's terms so
// Node's own wording never reaches the user. tep g, with a flag for every
// setting, has its own richer one (flags.ts) that shares the helpers here.

import { parseArgs } from 'node:util';
import { usageError } from './errors';
import { closest } from './names';

export type ArgOptions = NonNullable<Parameters<typeof parseArgs>[0]>['options'];

export interface CommandArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

/** The flag Node's message names, in its long form where it has one ("-h, --help" names --help). */
export function flagNamed(message: string): string | undefined {
  return message.match(/Option '(?:-\w, )?(--?[^' ]+)/)?.[1] ?? message.match(/Unknown option '([^']+)'/)?.[1];
}

/** Every flag in an option table as typed: "--yes", "-y". */
export const flagsOf = (options: ArgOptions): string[] => Object.entries(options ?? {}).flatMap(([name, o]) => [`--${name}`, ...(o.short ? [`-${o.short}`] : [])]);

/**
 * Parse a command's arguments, or throw a usage error (exit 2) that names
 * the flag at fault and ends with `hint`, how the command is used.
 */
export function parseCommandArgs(args: string[], options: ArgOptions, command: string, hint: string, allowPositionals = false): CommandArgs {
  // --no-color is every command's: main reads it, so a command only has to accept it.
  const all: ArgOptions = { ...options, 'no-color': { type: 'boolean' } };
  try {
    const parsed = parseArgs({ args, options: all, strict: true, allowPositionals });
    return { values: parsed.values as CommandArgs['values'], positionals: parsed.positionals };
  } catch (e) {
    const err = e as { code?: string; message: string };
    const flag = flagNamed(err.message) ?? '?';
    switch (err.code) {
      case 'ERR_PARSE_ARGS_UNKNOWN_OPTION': {
        const near = closest(flag, flagsOf(all).filter((f) => f.startsWith('--')));
        throw usageError(`unknown flag ${flag}.${near ? ` Did you mean ${near}?` : ''}`, hint);
      }
      case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
        throw usageError(/does not take an argument/.test(err.message) ? `${flag} takes no value.` : `${flag} needs a value.`, hint);
      case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL': {
        const arg = err.message.match(/Unexpected argument '([^']*)'/)?.[1] ?? '';
        throw usageError(`"${arg}" is not a flag: ${command} takes only flags.`, hint);
      }
      default:
        throw usageError(err.message, hint);
    }
  }
}
