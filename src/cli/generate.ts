// tep g: settings from the defaults, the config file and the flags; every
// contradiction reported in full and nothing made from one; then the
// shared pipeline, the same calls the web app makes: inputsFor, runInputs,
// presentSuggestions.

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { problemsOf, warningsOf, type Problem } from '../lib/consistency';
import { runInputs } from '../lib/engine';
import { shortfallWarning } from '../lib/generate';
import { inputsFor, presentSuggestions } from '../lib/pipeline';
import { normalizeSentence } from '../lib/text';
import { ruleProblems } from '../lib/validation';
import { copyToClipboard } from './clipboard';
import { DEFAULT_CONFIG_FILE, layerOf, loadConfig } from './config';
import { CliError, EXIT, usageError } from './errors';
import { parseGenerateArgs } from './flags';
import { generateHelp } from './help';
import type { Io } from './io';
import { explainProblem, explainWarning, renderExplained, type Refer } from './messages';
import { COLOR, PLAIN, render, useColor } from './output';
import { resolve, type Layer, type Resolved } from './resolve';

const ISSUES = 'https://github.com/SalientForm/elegant-password/issues';
/** Longer than any sentence anyone types. */
const MAX_SENTENCE = 500;

/** Every contradiction in resolved settings, as one error: each problem with its values, their sources and a fix. */
export function contradictionError(problems: Problem[], r: Resolved): CliError {
  const refer: Refer = { source: (f) => r.sources[f.name]! };
  const details = problems.flatMap((p, i) => {
    const [title, ...rest] = renderExplained(explainProblem(p, r.generation.req, refer), '     ');
    return [`${problems.length > 1 ? `${i + 1}. ` : ''}${title}`, ...rest, ''];
  });
  details.pop();
  return new CliError(
    EXIT.contradiction,
    `these settings contradict each other${problems.length > 1 ? ` (${problems.length} problems)` : ''}, so no passwords were made:`,
    details,
  );
}

/** Why a sentence cannot be used, or undefined when it can. */
function sentenceProblem(sentence: string): string | undefined {
  if (!sentence.trim()) return 'Type a sentence, such as "Sally eats sweets on Sundays".';
  if (sentence.length > MAX_SENTENCE) return `Keep it under ${MAX_SENTENCE} characters; it is ${sentence.length}.`;
  if (!normalizeSentence(sentence).length) return 'It has no words: a sentence needs letters or digits, such as "Sally eats sweets on Sundays".';
  return undefined;
}

async function readSentence(io: Io): Promise<string> {
  if (io.stdin.isTTY) {
    return (await io.prompter().secret({ message: 'Your sentence (not shown as you type)', validate: sentenceProblem })).trim();
  }
  const text = await io.stdin.readAll();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) throw usageError('--sentence - found nothing on stdin.', 'Pipe a sentence in (tep g --sentence - < sentence.txt), or run at a terminal to type it.');
  if (lines.length > 1) throw usageError(`--sentence - found ${lines.length} lines on stdin; it takes one sentence, on one line.`);
  const problem = sentenceProblem(lines[0]!);
  if (problem) throw usageError(`--sentence -: the sentence on stdin cannot be used. ${problem}`);
  return lines[0]!;
}

export async function generateCommand(argv: string[], io: Io): Promise<number> {
  const flags = parseGenerateArgs(argv);
  if (flags.help) {
    io.stdout.write(generateHelp());
    return EXIT.ok;
  }

  let file: Layer | undefined;
  if (!flags.noConfig) {
    const path = flags.config ?? DEFAULT_CONFIG_FILE;
    const abs = resolvePath(io.cwd, path);
    if (flags.config !== undefined || existsSync(abs)) file = layerOf(loadConfig(abs, path));
  }

  const sentence = flags.sentence ? await readSentence(io) : undefined;
  const r = resolve(file, flags.layer, { tty: io.stdout.isTTY, ...(sentence !== undefined ? { sentence } : {}) });
  const req = r.generation.req;
  const refer: Refer = { source: (f) => r.sources[f.name]! };

  // Sentence mode does not plan a made-up sentence, so only the rules themselves can contradict.
  const problems = r.generation.mode === 'sentence' ? ruleProblems(req).map((p) => ({ ...p, source: 'rules' as const })) : problemsOf(req);
  if (problems.length) throw contradictionError(problems, r);

  const err = useColor(io.stderr.isTTY, io.env, flags.color) ? COLOR : PLAIN;
  const say = (kind: 'warning' | 'note', lines: string[]) => {
    if (flags.quiet || !lines.length) return;
    const [first, ...rest] = lines;
    io.stderr.write(`${(kind === 'warning' ? err.yellow : err.dim)(`tep g: ${kind}:`)} ${first}\n${rest.map((l) => `  ${l}\n`).join('')}`);
  };

  const targetWarnings = r.generation.mode === 'generated' ? warningsOf(req).map((w) => renderExplained(explainWarning(w, req, refer))) : [];

  const outcome = runInputs(inputsFor(r.generation));
  if (!outcome.ok) {
    if (outcome.unexpected) {
      throw new CliError(EXIT.unexpected, 'something went wrong inside tep: this is a bug, not your settings.', [
        outcome.error,
        `Please report it at ${ISSUES} with the command you ran${r.generation.mode === 'sentence' ? ' (but not your sentence)' : ''}.`,
      ]);
    }
    throw new CliError(EXIT.contradiction, r.generation.mode === 'sentence' ? 'your sentence cannot be made to fit these rules, so no passwords were made:' : 'no passwords can be made from these settings:', [
      outcome.error,
      r.generation.mode === 'sentence' ? 'Try a longer or shorter sentence, or widen the length range (--min-length, --max-length).' : 'Widen the length range (--min-length, --max-length) or require fewer characters.',
    ]);
  }

  // The engine's own shortfall warning says less than tep's, which names the sources and the length that would reach the target.
  const shortfall = outcome.plan && !outcome.plan.meetsTarget ? shortfallWarning(outcome.plan.bits, req) : undefined;
  const engineWarnings = outcome.warnings.filter((w) => w !== shortfall);
  const shown = {
    outcome,
    suggestions: presentSuggestions(outcome.suggestions, r.typingMode, r.sort),
    typingMode: r.typingMode,
    sort: r.sort,
    minUppercase: req.minUppercase,
    warnings: [...r.warnings, ...targetWarnings.map((w) => w.join(' ')), ...engineWarnings],
  };
  const format = flags.format ?? (io.stdout.isTTY ? 'table' : 'plain');
  io.stdout.write(render(format, shown, useColor(io.stdout.isTTY, io.env, flags.color) ? COLOR : PLAIN, flags.explain));

  say('note', r.notes);
  for (const w of r.warnings) say('warning', [w]);
  for (const w of targetWarnings) say('warning', w);
  for (const w of engineWarnings) say('warning', [w]);

  if (flags.copy) {
    const tool = copyToClipboard(shown.suggestions[0]!.password, io.platform, io.env, io.clipboard);
    if (!flags.quiet) io.stderr.write(`${err.dim('tep g:')} copied password 1 to the clipboard (${tool}).\n`);
  }
  return EXIT.ok;
}
