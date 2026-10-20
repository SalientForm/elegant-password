// tep config [file]: load the file if there is one, ask the questions (or
// open on the review), and write the answers. Never writes a contradiction,
// never overwrites without asking, never leaves a half-written file.

import { existsSync, statSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { DEFAULT_CONFIG_FILE, loadConfig, writeAtomic } from './config';
import { serializeConfig } from './configText';
import { parseCommandArgs } from './args';
import { CliError, configError, EXIT, usageError } from './errors';
import { CONFIG_HELP } from './help';
import type { Io } from './io';
import { answersOf, modelOf, runHint, Wizard, type WizardHooks } from './wizard';

/** A date as the config's header writes it: 2026-10-20, local time. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function configCommand(argv: string[], io: Io, hooks?: WizardHooks): Promise<number> {
  const parsed = parseCommandArgs(argv, { help: { type: 'boolean', short: 'h' } }, 'tep config', 'tep config takes a file name and nothing else: tep config bank.yml', true);
  if (parsed.values.help) {
    io.stdout.write(CONFIG_HELP);
    return EXIT.ok;
  }
  if (parsed.positionals.length > 1) {
    throw usageError(`it takes one file name; found ${parsed.positionals.length}: ${parsed.positionals.join(' ')}.`, 'Write one file at a time: tep config bank.yml');
  }
  const file = parsed.positionals[0] ?? DEFAULT_CONFIG_FILE;
  if (!io.stdin.isTTY) {
    throw usageError(
      'it asks questions, so it needs a terminal, and stdin is not one.',
      `Run it in a terminal, or write ${file} by hand: "tep help config" shows the format, and tep g checks it.`,
    );
  }

  const abs = resolvePath(io.cwd, file);
  if (!existsSync(dirname(abs))) throw configError(`${file} cannot be written: the directory ${dirname(file)} does not exist.`, 'Make the directory first, or name a file in one that exists.');
  const exists = existsSync(abs);
  if (exists && statSync(abs).isDirectory()) throw configError(`${file} is a directory, not a config file.`, `Name a file, as in tep config ${file.replace(/\/$/, '')}/${DEFAULT_CONFIG_FILE}`);

  let start;
  if (exists) {
    try {
      start = answersOf(loadConfig(abs, file).model);
    } catch (e) {
      if (e instanceof CliError && e.exitCode === EXIT.config) {
        throw new CliError(EXIT.config, e.title, [...e.details, `tep config does not overwrite a file it cannot read: fix ${file}, or move it aside and run tep config again.`]);
      }
      throw e;
    }
  }

  const prompter = io.prompter();
  prompter.info(exists ? `Editing ${file}: every answer is below, ready to change.` : `Writing ${file}. Ctrl+C stops at any point without writing anything.`);
  const wizard = new Wizard({
    prompter,
    file,
    ...(hooks ? { hooks } : {}),
    ...(exists
      ? { confirmSave: () => prompter.confirm({ message: `Overwrite ${file}? Comments added to it by hand are not kept.`, initialValue: true }) }
      : {}),
  });
  const result = await wizard.run(start);
  if (result.kind === 'quit') {
    prompter.info('Quit; nothing was written.');
    return EXIT.ok;
  }
  writeAtomic(abs, serializeConfig(modelOf(result.answers), isoDay(io.now())), undefined, file);
  prompter.info(`Saved ${file}. Make passwords with: ${runHint(file)}`);
  return EXIT.ok;
}
