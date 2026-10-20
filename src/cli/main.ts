// tep's entry: picks the command, runs it, and turns whatever it throws
// into a message on stderr and an exit code.

import pkg from '../../package.json';
import { configCommand } from './configCommand';
import { CliError, EXIT, usageError } from './errors';
import { generateCommand } from './generate';
import { CONFIG_HELP, generateHelp, OVERVIEW } from './help';
import { Cancelled, type Io } from './io';
import { closest } from './names';
import { COLOR, PLAIN, useColor } from './output';
import { renderError } from './report';

export const VERSION: string = pkg.version;
const COMMANDS = ['g', 'generate', 'config', 'help'];

async function dispatch(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === '-h' || command === '--help') {
    io.stdout.write(OVERVIEW);
    return EXIT.ok;
  }
  if (command === '--version' || command === '-V') {
    io.stdout.write(`tep ${VERSION}\n`);
    return EXIT.ok;
  }
  if (command === 'help') {
    const topic = rest[0];
    if (topic === undefined) io.stdout.write(OVERVIEW);
    else if (topic === 'g' || topic === 'generate') io.stdout.write(generateHelp());
    else if (topic === 'config') io.stdout.write(CONFIG_HELP);
    else throw usageError(`there is no command "${topic}".`, 'The commands are g (generate) and config.');
    return EXIT.ok;
  }
  if (command === 'g' || command === 'generate') return generateCommand(rest, io);
  if (command === 'config') return configCommand(rest, io);
  if (command.startsWith('-')) {
    throw usageError(`a command comes before the flags, as in: tep g ${argv.join(' ')}`, 'Run "tep help" for the commands.');
  }
  const near = closest(command, COMMANDS);
  throw usageError(`"${command}" is not a tep command.${near ? ` Did you mean ${near}?` : ''}`, 'The commands are g (generate), config and help.');
}

/** How errors name the command: "tep g", "tep config", or "tep". */
function commandName(argv: string[]): string {
  const [command] = argv;
  if (command === 'g' || command === 'generate') return 'tep g';
  if (command === 'config') return 'tep config';
  if (command === 'help') return 'tep help';
  return 'tep';
}

/** Run tep with these arguments; the exit code. Never throws. */
export async function main(argv: string[], io: Io): Promise<number> {
  const p = useColor(io.stderr.isTTY, io.env, !argv.includes('--no-color')) ? COLOR : PLAIN;
  const name = commandName(argv);
  try {
    return await dispatch(argv, io);
  } catch (e) {
    if (e instanceof Cancelled) {
      io.stderr.write(`${name}: cancelled; nothing was written.\n`);
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
