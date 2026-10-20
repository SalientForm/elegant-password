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
