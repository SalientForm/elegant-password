// tep's entry: picks the command, runs it, and turns whatever it throws
// into a message on stderr and an exit code.

import pkg from '../../package.json';
import { configCommand } from './configCommand';
import { CliError, EXIT, usageError } from './errors';
import { ALL_FLAGS } from './flags';
import { generateCommand } from './generate';
import { CONFIG_HELP, generateHelp, OVERVIEW, UNINSTALL_HELP } from './help';
import { Cancelled, type Io } from './io';
import { closest } from './names';
import { COLOR, PLAIN, useColor } from './output';
import { renderError } from './report';
import { uninstallCommand } from './uninstall';

export const VERSION: string = pkg.version;

/** The commands: each name they answer to, how errors name them, what they run and their help. */
const COMMANDS: { names: readonly string[]; label: string; run?: (rest: string[], io: Io) => Promise<number>; help: () => string }[] = [
  { names: ['g', 'generate'], label: 'tep g', run: generateCommand, help: generateHelp },
  { names: ['config'], label: 'tep config', run: configCommand, help: () => CONFIG_HELP },
  { names: ['uninstall'], label: 'tep uninstall', run: uninstallCommand, help: () => UNINSTALL_HELP },
  { names: ['help'], label: 'tep help', help: () => OVERVIEW },
];
const commandNamed = (name: string) => COMMANDS.find((c) => c.names.includes(name));
const COMMAND_LIST = `The commands are ${COMMANDS.map((c) => (c.names.length > 1 ? `${c.names[0]} (${c.names.slice(1).join(', ')})` : c.names[0])).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
const VERSION_FLAGS = ['--version', '-V'];

async function dispatch(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === '-h' || command === '--help') {
    io.stdout.write(OVERVIEW);
    return EXIT.ok;
  }
  if (VERSION_FLAGS.includes(command)) {
    io.stdout.write(`tep ${VERSION}\n`);
    return EXIT.ok;
  }
  if (command === 'help') {
    const topic = rest[0];
    const c = topic === undefined ? commandNamed('help')! : commandNamed(topic);
    if (!c) throw usageError(`there is no command "${topic}".`, COMMAND_LIST);
    io.stdout.write(c.help());
    return EXIT.ok;
  }
  const c = commandNamed(command);
  if (c?.run) return c.run(rest, io);
  if (command.startsWith('-')) {
    // -v is almost always --version; a real tep g flag is a command left out; anything else is unknown.
    const version = closest(command, VERSION_FLAGS);
    if (version) throw usageError(`"${command}" is not a flag of tep. Did you mean ${version}?`, 'tep --version prints the version.');
    if (ALL_FLAGS.includes(command)) throw usageError(`a command comes before the flags, as in: tep g ${argv.join(' ')}`, 'Run "tep help" for the commands.');
    throw usageError(`"${command}" is not a flag of tep.`, 'Run "tep help" for the commands, or "tep help g" for the flags of tep g.');
  }
  const near = closest(command, COMMANDS.flatMap((x) => x.names));
  throw usageError(`"${command}" is not a tep command.${near ? ` Did you mean ${near}?` : ''}`, COMMAND_LIST);
}

/** How errors name the command: "tep g", "tep config", "tep uninstall", "tep help", or "tep". */
const commandName = (argv: string[]) => commandNamed(argv[0] ?? '')?.label ?? 'tep';

/** Run tep with these arguments; the exit code. Never throws. */
export async function main(argv: string[], io: Io): Promise<number> {
  const p = useColor(io.stderr.isTTY, io.env, !argv.includes('--no-color')) ? COLOR : PLAIN;
  const name = commandName(argv);
  try {
    return await dispatch(argv, io);
  } catch (e) {
    if (e instanceof Cancelled) {
      io.stderr.write(`${name}: cancelled; ${name === 'tep uninstall' ? 'nothing was removed' : name === 'tep g' ? 'no passwords were made' : 'nothing was written'}.\n`);
      return EXIT.interrupted;
    }
    if (e instanceof CliError) {
      io.stderr.write(renderError(name, e, p));
      return e.exitCode;
    }
    const message = e instanceof Error ? (e.stack ?? e.message) : String(e);
    io.stderr.write(`${p.red(`${name}: error:`)} something went wrong inside tep: this is a bug.\n  ${message.split('\n').join('\n  ')}\n  Please report it at https://github.com/SalientForm/elegant-password/issues with the command you ran.\n`);
    return EXIT.unexpected;
  }
}
