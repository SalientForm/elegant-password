// tep's exit codes, and the one error type every command throws: a title
// that says what is wrong, then the details (the values involved, where
// each came from, how to fix it), printed to stderr by main.

export const EXIT = {
  /** Passwords printed, or the config saved. */
  ok: 0,
  /** A bug: the engine failed in a way no setting explains. */
  unexpected: 1,
  /** The command line: an unknown flag, a bad value, an unknown preset, flags that cannot go together. */
  usage: 2,
  /** Settings that contradict each other. */
  contradiction: 3,
  /** A config file that cannot be read or is not valid. */
  config: 4,
  /** Ctrl+C. */
  interrupted: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Each exit code and what it means, in full for the Fun page's CLI prompt and in short for the help line. The help line is built from this list, so the two cannot drift. */
export const EXIT_MEANINGS: readonly { code: ExitCode; meaning: string; short: string }[] = [
  { code: EXIT.ok, meaning: 'Passwords printed, or the config saved (or the wizard quit with q or Esc)', short: 'done' },
  { code: EXIT.unexpected, meaning: 'A bug: the engine failed in a way no setting explains; or the clipboard tool failed, or a link tep uninstall could not remove', short: 'a bug, a failed clipboard tool or a link that could not be removed' },
  { code: EXIT.usage, meaning: 'The command line: an unknown flag, a bad value, an unknown preset, flags that contradict each other, no terminal for tep config or tep uninstall without --yes, no clipboard tool', short: 'the command line' },
  { code: EXIT.contradiction, meaning: 'Settings that contradict each other, or a sentence that cannot be made to fit', short: 'settings that contradict each other' },
  { code: EXIT.config, meaning: 'A config file that cannot be read or is not valid', short: 'a config file' },
  { code: EXIT.interrupted, meaning: 'Interrupted (Ctrl+C)', short: 'interrupted' },
];

/** `text` ending in a full stop, unless it already ends a sentence (a "Did you mean x?" keeps its question mark). */
export const punctuated = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

/** Where to report a bug, named wherever one is suspected. */
export const ISSUES = 'https://github.com/SalientForm/elegant-password/issues';

export class CliError extends Error {
  constructor(
    readonly exitCode: ExitCode,
    /** One sentence: what is wrong. */
    readonly title: string,
    /** Further lines, printed indented under the title. */
    readonly details: readonly string[] = [],
  ) {
    super(title);
    this.name = 'CliError';
  }
}

export const usageError = (title: string, ...details: string[]) => new CliError(EXIT.usage, title, details);
export const configError = (title: string, ...details: string[]) => new CliError(EXIT.config, title, details);
