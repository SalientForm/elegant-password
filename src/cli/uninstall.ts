// tep uninstall: removes the links that put tep on the PATH (the ones
// pnpm link:cli makes), after asking. Only a link to a built tep is touched;
// the checkout and its build stay, so pnpm link:cli there puts tep back.

import { lstatSync, readlinkSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { parseCommandArgs } from './args';
import { CliError, EXIT, usageError } from './errors';
import { UNINSTALL_HELP } from './help';
import type { Io } from './io';
import { isTepLink } from './tepLink';
import { wrapHanging } from './wrap';

export interface TepLink {
  /** The link: a directory's `tep`. */
  link: string;
  /** Where it points: a checkout's built tep. */
  target: string;
}

/**
 * Each `tep` that is a link to a built tep, in $TEP_BIN_DIR, ~/.local/bin
 * (where pnpm link:cli puts it, on the PATH or not) and every directory on
 * the PATH, in that order, each once. A `tep` that is a file, or a link to
 * anything else, is not tep's to remove.
 */
export function findLinks(env: Record<string, string | undefined>): TepLink[] {
  const dirs = [env.TEP_BIN_DIR, join(env.HOME || homedir(), '.local/bin'), ...(env.PATH ?? '').split(delimiter)].filter((d): d is string => !!d).map((d) => resolve(d));
  const found: TepLink[] = [];
  for (const dir of new Set(dirs)) {
    const link = join(dir, 'tep');
    try {
      if (!lstatSync(link).isSymbolicLink()) continue;
      const target = resolve(dir, readlinkSync(link));
      if (isTepLink(target)) found.push({ link, target });
    } catch {
      // no tep here
    }
  }
  return found;
}

export async function uninstallCommand(argv: string[], io: Io): Promise<number> {
  const parsed = parseCommandArgs(argv, { yes: { type: 'boolean', short: 'y' }, help: { type: 'boolean', short: 'h' } }, 'tep uninstall', 'tep uninstall takes --yes (-y) and nothing else.');
  if (parsed.values.help) {
    io.stdout.write(UNINSTALL_HELP);
    return EXIT.ok;
  }

  const links = findLinks(io.env);
  if (!links.length) {
    io.stdout.write('tep is not linked from your PATH, ~/.local/bin or $TEP_BIN_DIR; nothing to remove.\n');
    return EXIT.ok;
  }

  let say = (line: string) => io.stdout.write(`${line}\n`);
  if (!parsed.values.yes) {
    if (!io.stdin.isTTY) {
      throw usageError('it asks before removing anything, so it needs a terminal, and stdin is not one.', 'Run it in a terminal, or say yes up front: tep uninstall --yes');
    }
    const prompter = io.prompter();
    const lines = links.flatMap((l) => [l.link, `  -> ${l.target}`]).flatMap((line) => wrapHanging(line, prompter.noteWidth, line.startsWith(' ') ? 5 : 2));
    prompter.note(lines.join('\n'), links.length === 1 ? 'The link to remove' : 'The links to remove');
    const sure = await prompter.confirm({ message: 'Are you sure? tep will no longer run from your PATH.', initialValue: false });
    if (!sure) {
      prompter.info('Nothing was removed.');
      return EXIT.ok;
    }
    // A log line has 3 columns before it where a note has 6: wrapped here, so the run-on text stays inside the guide bar.
    say = (line) => prompter.info(wrapHanging(line, prompter.noteWidth + 3, 0).join('\n'));
  }

  for (const { link } of links) {
    try {
      rmSync(link);
    } catch (e) {
      throw new CliError(EXIT.unexpected, `${link} could not be removed: ${(e as Error).message}`, ['Remove it by hand, or run tep uninstall as a user who can.']);
    }
    say(`Removed ${link}.`);
  }
  const checkouts = [...new Set(links.map((l) => dirname(dirname(l.target))))];
  say(`${checkouts.length === 1 ? 'The checkout stays' : 'The checkouts stay'}, built: ${checkouts.join(', ')}. pnpm link:cli there puts tep back.`);
  say('A terminal that was already open may still look for tep there until you run hash -r.');
  return EXIT.ok;
}
