// The Fun page's second prompt: build tep, the command line, on top of the
// app the first prompt builds. Generated from the CLI's own definitions
// (the field table, the flags, the exit codes, the config writer, the
// messages, the wizard's constraints), so it always describes the tep that
// exists. It names the shared core's functions instead of describing their
// algorithms again: prompt 1 already did, and src/prompts/cliPrompt.test.ts
// checks every name is real.
//
// Only the CLI's pure modules are imported: the Fun page runs in a browser.

import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { problemsOf, warningsOf } from '../lib/consistency';
import testTitles from '../lib/testTitles.json';
import { clipboardTools } from '../cli/clipboardTools';
import { emptyModel } from '../cli/configModel';
import { serializeConfig } from '../cli/configText';
import { CONFIG_VERSION } from '../cli/configVersion';
import { fieldShape, LOOSEST, noAnswers, QUESTION_BUDGET_MS, type SelectShape } from '../cli/constraints';
import { EXIT, EXIT_MEANINGS } from '../cli/errors';
import { describeValue, FIELDS, fieldNamed, keyPath, type CliField } from '../cli/fields';
import { FORMATS } from '../cli/flagList';
import { CONFIG_HELP, generateHelp, OVERVIEW } from '../cli/help';
import { explainWarning, renderExplained } from '../cli/messages';
import { MODE_NAMES, SITE_NAMES } from '../cli/names';
import { PLAIN } from '../cli/output';
import { contradictionError, renderError, renderNotice } from '../cli/report';
import { emptyLayer, resolve, type Layer } from '../cli/resolve';
import type { Source } from '../cli/sources';
import { answersOf, formatReview, reviewLines } from '../cli/wizard';

const code = (s: string) => `\`${s}\``;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const block = (s: string, lang = '') => `\`\`\`${lang}\n${s.trimEnd()}\n\`\`\``;

/**
 * The shared core the CLI uses, by module and name. Every one is defined by
 * prompt 1 (it is the app's own src/lib); the CLI calls them and never
 * reimplements them.
 */
export const SHARED_CORE: readonly { module: string; names: string[]; for: string }[] = [
  { module: 'engine', names: ['runInputs'], for: 'generation: one pure call, the same as the web worker makes' },
  { module: 'pipeline', names: ['inputsFor', 'presentSuggestions'], for: 'settings to engine inputs, and suggestions rescored for the typing mode and ordered' },
  { module: 'readings', names: ['scoreReadings'], for: 'the Strength, Raw, Difficulty and Memorability figures, bands and sentences' },
  { module: 'explain', names: ['typingLines', 'twistLine', 'twistOptionsLine', 'easedIn', 'easedLine'], for: 'the "Why?" sentences, for --explain' },
  { module: 'consistency', names: ['problemsOf', 'warningsOf', 'reachableBits'], for: 'contradictions (rules, then planning) and the unreachable-target warning' },
  { module: 'generate', names: ['planProblem', 'shortfallWarning', 'checkRequirements', 'DEFAULT_REQUIREMENTS', 'STRENGTH_PRESETS'], for: 'what stops planning, early exit; the engine\'s own shortfall warning, to drop as a duplicate' },
  { module: 'validation', names: ['ruleProblems', 'FIELD_LABELS', 'MAX_LENGTH', 'MAX_COUNT'], for: 'rule contradictions with codes, labels and limits' },
  { module: 'sitePresets', names: ['SITE_PRESETS', 'RULE_KEYS', 'ALL_SYMBOLS'], for: 'the site presets, named by slugs of their labels' },
  { module: 'modeProfiles', names: ['profileValues', 'unusedIn', 'PROFILE_KEYS', 'PROFILE_LABELS', 'MINIMAL_BITS', 'modeLabel'], for: 'the options each typing mode fills in, and which it has no use for' },
  { module: 'ruleText', names: ['parseRuleText'], for: 'rules pasted from a sign-up form' },
  { module: 'mappingSettings', names: ['activeMappings', 'mappingSettingsProblems', 'DEFAULT_MAPPING_SETTINGS'], for: 'which swaps are on, and what is wrong with a list of them' },
  { module: 'choices', names: ['COMFORT_CHOICES', 'SORT_CHOICES', 'SHRINK_CHOICES', 'LENGTH_TAG_CHOICES', 'separatorChoices'], for: 'every choice list with the words the web form shows' },
  { module: 'fromSentence', names: ['DEFAULT_SENTENCE_OPTIONS', 'SHRINK_FROM_RANGE', 'TARGET_LENGTH_RANGE'], for: 'sentence-mode defaults and ranges' },
  { module: 'difficulty', names: ['TYPING_MODES', 'DEFAULT_TYPING_MODE'], for: 'the typing modes and their hints' },
  { module: 'text', names: ['normalizeSentence'], for: 'whether a sentence has any words' },
];

/** The CLI's files and what each is for. */
export const CLI_FILES: readonly [string, string][] = [
  ['bin.ts', 'the executable: the real terminal, environment and clipboard, handed to main'],
  ['main.ts', 'picks the command, prints any error under the command\'s name, returns the exit code'],
  ['errors.ts', 'the exit codes, what each means, and the one error type every command throws'],
  ['io.ts', 'everything outside: streams, stdin, environment, clock, prompts, clipboard (a fake in tests)'],
  ['names.ts', 'mode, site preset and strength names derived from the core\'s labels; "did you mean"'],
  ['fields.ts', 'the field table: every setting\'s flag, config key, label, accepted values, parsing and wording'],
  ['flagList.ts', 'the flags that are not settings'],
  ['flags.ts', 'tep g\'s parser (node:util parseArgs with tokens), every refusal in tep\'s words'],
  ['sources.ts', 'where each value came from, and how to change it, in the terms the user used'],
  ['resolve.ts', 'the layering: defaults, config file, flags; a source per field; nothing fixed'],
  ['messages.ts', 'each contradiction and warning worded for the CLI, with fixes the engine finds'],
  ['report.ts', 'how errors, warnings and notes read on stderr'],
  ['configVersion.ts, configModel.ts, configText.ts, config.ts', 'the config file: version, model, writer (pure), reader with line numbers and atomic write'],
  ['output.ts', 'table, plain and JSON output, --explain, colour'],
  ['clipboardTools.ts, clipboard.ts', '--copy: which tool, and running it'],
  ['generate.ts', 'tep g'],
  ['constraints.ts', 'each wizard question\'s allowed choices and ranges, and why each other one is not'],
  ['wrap.ts', 'wraps a line for a box at the terminal, its run-on text kept under its column'],
  ['wizard.ts', 'the questions, the bug path, the review (wrapped to the box\'s width)'],
  ['prompter.ts', '@clack/prompts behind the Prompter interface, drawn on stderr'],
  ['configCommand.ts', 'tep config: load, ask, confirm, write'],
  ['uninstall.ts', 'tep uninstall: finds the links to a built tep, asks, removes them'],
  ['help.ts', 'help text, generated from the field table and the flag list'],
];

function flagRow(f: CliField): string {
  const k = f.kind;
  const takes =
    k.type === 'bool'
      ? `${code(`--${f.name}`)} / ${code(`--no-${f.name}`)}`
      : `${code(`--${f.name} <${k.type === 'int' ? `${k.min}-${k.max}` : k.type === 'choice' ? k.choices.map((c) => c.value).join('|') : k.type === 'symbols' ? 'symbols' : k.type === 'separator' ? 'auto|space|none|symbol' : k.type === 'strength' ? 'preset|bits' : 'n|none'}>`)}`;
  const target = f.target.kind === 'req' ? `${code(`req.${f.target.key}`)}` : f.target.kind === 'sentence' ? `${code(`sentenceOptions.${f.target.key}`)}` : code(f.target.key);
  return `| ${takes}${f.name === 'count' ? ` (${code('-n')})` : ''} | ${code(keyPath(f))} | ${target} | ${f.label} | ${f.description} |`;
}

/** Flags with a source each, as tep g's parser would give them. */
function flagged(values: Record<string, unknown>, extra: { site?: string; mode?: (typeof MODE_NAMES)[number]['value'] } = {}): Layer {
  const layer = emptyLayer();
  const flag = (name: string): Source => ({ kind: 'flag', flag: `--${name}` });
  for (const [name, value] of Object.entries(values)) layer.values[name] = { value, source: flag(name) };
  if (extra.site) layer.site = { value: SITE_NAMES.find((s) => s.name === extra.site)!.value, source: flag('site') };
  if (extra.mode) layer.mode = { value: extra.mode, source: flag('mode') };
  return layer;
}

/** A real tep g contradiction, as stderr shows it. */
function contradictionExample(file: Layer | undefined, flags: Layer): string {
  const r = resolve(file, flags, { tty: true });
  return renderError('tep g', contradictionError(problemsOf(r.generation.req), r), PLAIN);
}

function examples(): string {
  const fileLayer = emptyLayer();
  fileLayer.values['min-length'] = { value: 20, source: { kind: 'file', file: 'tep.yml', line: 3, key: 'rules.min-length' } };
  const one = contradictionExample(fileLayer, flagged({ 'max-length': 16 }));
  const two = contradictionExample(undefined, flagged({ 'min-length': 40, symbols: '', 'min-symbols': 2 }));
  const plan = contradictionExample(undefined, flagged({ 'min-length': 4, 'max-length': 6, 'min-uppercase': 0, 'min-digits': 0, 'min-symbols': 0 }));
  const short = resolve(undefined, flagged({ strength: 50 }, { site: 'short-max-16' }), { tty: true });
  const refer = { source: (f: CliField) => short.sources[f.name]! };
  const warning = warningsOf(short.generation.req).map((w) => renderNotice('tep g', 'warning', renderExplained(explainWarning(w, short.generation.req, refer)), PLAIN)).join('');
  return [
    `A value from a file and one from a flag (\`tep g --max-length 16\` with ${code('min-length: 20')} on line 3 of tep.yml):`,
    block(one),
    'Two problems at once (`tep g --min-length 40 --symbols= --min-symbols 2`):',
    block(two),
    'What only planning finds, with the nearest window that works found by the engine (`tep g --min-length 4 --max-length 6 --min-uppercase 0 --min-digits 0 --min-symbols 0`):',
    block(plan),
    'The unreachable target, a warning on stderr; the passwords are still printed (`tep g --site short-max-16 --strength strong`):',
    block(warning),
  ].join('\n\n');
}

function wizardExamples(): string {
  const answers = answersOf({ ...emptyModel(), mode: 'two-finger', site: 'typical-site' });
  const review = formatReview(reviewLines(answers)).join('\n');
  const separator = fieldShape(fieldNamed('separator')!, { ...noAnswers(), mode: 'ten-finger', site: 'no-spaces', rulesAnswered: true, optionsHow: 'each' }, { lineOf: () => undefined }) as SelectShape<unknown>;
  const choices = separator.choices.map((c) => `- ${c.label}${c.blocked ? `: not allowed: ${c.blocked}` : ''}`).join('\n');
  return [
    `The review for Two-finger with the Typical site preset and the mode's options (the sample password under it is random):`,
    block(review),
    'The separator question after the No spaces preset (Ten-finger, options one by one): the space is shown, dimmed, and cannot be picked; its reason is in its label, since a disabled choice cannot be focused to show a hint.',
    choices,
  ].join('\n\n');
}

export function buildCliPrompt(): string {
  const sample = serializeConfig(
    {
      ...emptyModel(),
      mode: 'two-finger',
      site: 'short-max-16',
      rules: { 'max-length': 14 },
      options: { strength: 40, separator: ' ', swaps: 2 },
      output: { count: 3 },
      swaps: { disabled: ['a>@'], custom: [{ from: 'ph', to: 'f' }] },
    },
    '2026-10-20',
  );
  const cliTests = testTitles.filter((f) => f.file.startsWith('src/cli/') || f.file === 'src/boundaries.test.ts');
  const tools = [
    ['macOS', clipboardTools('darwin', {})],
    ['Wayland', clipboardTools('linux', { WAYLAND_DISPLAY: '1' })],
    ['X11', clipboardTools('linux', { DISPLAY: '1' })],
    ['WSL', clipboardTools('linux', { WSL_DISTRO_NAME: '1' })],
  ] as const;

  return `# Build "tep", the Elegant Passwords command line

This is the second of two prompts. **Build the app from the first prompt first.** tep is a command-line front end to that app's engine, for Linux and macOS: ${code('tep g')} makes passwords, ${code('tep config')} asks questions and writes a config file. It adds no algorithm of its own. Implement everything below exactly; where a number or a message is given, use it.

## 1. Principles

- **One shared core, no drift.** The app's ${code('src/lib/')} is the shared core: plain TypeScript with no browser, Node or React. tep reaches the engine only through the same calls the web app makes, so a change to any algorithm reaches both or neither. Use these, by name; never re-derive what they do. If tep needs something the core does not offer, add it to ${code('src/lib/')} and make the web app use it too.

${SHARED_CORE.map((m) => `  - ${code(`src/lib/${m.module}.ts`)}: ${m.names.map(code).join(', ')}: ${m.for}.`).join('\n')}

- **No contradictions.** tep never generates from, saves or carries forward settings that contradict themselves, and never fixes one quietly (the web app's ${code('settleRules')} fixes are never applied). A set of settings is consistent when ${code('problemsOf(req)')} is empty: ${code('ruleProblems')} first, then ${code('planProblem')}. A strength target the rules cannot reach is a **warning**, not a contradiction: the engine makes the strongest passwords the rules allow.
- **Every message says what is wrong, where each value came from (a flag, a file and line, a preset and what chose it, a review line), and how to fix it**, with the value that would work where the engine can find it.
- **Stack**: Node 24, the app's TypeScript and Vitest; ${code('yaml')}, ${code('zod')} and ${code('@clack/prompts')} as dependencies, kept inside ${code('src/cli/')}; ${code('tsdown')} bundles ${code('src/cli/bin.ts')} to one ESM file, ${code('dist-cli/tep.mjs')}, with a ${code('#!/usr/bin/env node')} line and every dependency inlined; ${code('package.json')} gets ${code('"bin": { "tep": "dist-cli/tep.mjs" }')} and ${code('build:cli')} (tsdown, then chmod +x). Not published; ${code('pnpm link:cli')} builds it and links ${code('~/.local/bin/tep')} (or ${code('$TEP_BIN_DIR/tep')}) to the bundle, saying if that directory is off the PATH or another ${code('tep')} comes first, and ${code('tep uninstall')} or ${code('pnpm unlink:cli')} removes the link; in a fresh clone ${code('pnpm link:cli')} is the one command, as pnpm installs the dependencies before running it (not ${code('pnpm link')}, which from pnpm 10 adds a directory to the project's dependencies). No network, no telemetry, no update check. Randomness is the core's ${code('crypto.getRandomValues')}.

## 2. Layout

${CLI_FILES.map(([f, what]) => `- ${code(`src/cli/${f.includes(',') ? f.split(', ').join(', src/cli/') : f}`)}: ${what}.`).join('\n')}
- ${code('src/boundaries.test.ts')}: ${code('src/lib')} imports only ${code('src/lib')} and names no browser or Node global; ${code('src/cli')} imports only ${code('src/lib')}, ${code('node:*')}, its three packages and ${code('package.json')}, and none of the engine's inner steps (${code('generate')}, ${code('fromSentence')}, ${code('scoreCold')}, ${code('strengthBits')}, ${code('rawBits')}, ${code('scoreDifficulty')}, ${code('difficultyIn')}, ${code('sortSuggestions')}, ${code('activeMappings')}, the badge bands); the web app never imports ${code('src/cli')}; and the web app builds its inputs with ${code('inputsFor')}, orders with ${code('presentSuggestions')} and reads badges with ${code('scoreReadings')}.

## 3. Commands and exit codes

${block(OVERVIEW)}

| Code | Meaning |
| --- | --- |
${EXIT_MEANINGS.map((e) => `| ${e.code} | ${e.meaning} |`).join('\n')}

Errors print to stderr as ${code('<command>: error: <what is wrong>')} (the command is ${code('tep g')}, ${code('tep config')}, ${code('tep uninstall')}, ${code('tep help')} or ${code('tep')}), then each detail indented two spaces; ${code('tep: error:')} is red at a terminal. Anything thrown that is not tep's own error is exit ${EXIT.unexpected}: "something went wrong inside tep: this is a bug", the stack, and where to report it. Ctrl+C at a prompt prints ${code('<command>: cancelled; nothing was written.')} (${code('removed')}, for ${code('tep uninstall')}) and exits ${EXIT.interrupted}.

${code('tep uninstall')} removes each ${code('tep')} in ${code('$TEP_BIN_DIR')}, ${code('~/.local/bin')} or a directory on the PATH that is a link to a built tep (its target ends ${code('dist-cli/tep.mjs')}); a ${code('tep')} that is a file or links elsewhere is left alone. It lists the links in a note and asks "Are you sure? tep will no longer run from your PATH.", no by default; ${code('--yes')} (${code('-y')}) skips the question, and without it stdin must be a terminal (exit ${EXIT.usage}). Then it says which links went, that the checkout and its build stay (${code('pnpm link:cli')} puts tep back), and that an open terminal may need ${code('hash -r')}. With no link, it says so and exits ${EXIT.ok}.

## 4. tep g

### 4.1 Where settings come from

Lowest to highest, each layer replacing only the fields it states: the core's defaults (${code('DEFAULT_REQUIREMENTS')}, ${code('DEFAULT_SENTENCE_OPTIONS')}, all built-in swaps); the config file (${code('-c <file>')}, else ${code('./tep.yml')} if present; no parent-directory search, no global file); then the flags. Within the file, then within the flags: the site preset, the rules text (${code('--rules')}, flags only, read with ${code('parseRuleText')}: only the fields the text states, symbols it rules out removed; text with no rules is exit ${EXIT.usage}; what it read is a note on stderr), the rule values, the typing mode's preset (${code('profileValues(mode, rules)')}: its "space if allowed" separator resolves by whether spaces are allowed), then the option values. A ${code('--mode')} on the command line replaces the file's own options, as picking a mode does in the web app. Then the sentence options and the output. The count defaults to 5 when stdout is a terminal and 1 when it is piped. Every field remembers where its value came from. Options set by hand that the mode has no use for (${code('unusedIn')}) are warnings ("${resolve(undefined, flagged({ 'avoid-pinky': true }, { mode: 'two-finger' }), { tty: true }).warnings[0]}"), not errors.

Then ${code('problemsOf')} (only ${code('ruleProblems')} with ${code('--sentence')}, as there is no made-up sentence to plan); any problem is exit ${EXIT.contradiction} with no password made. Then ${code('runInputs(inputsFor(settings))')} and ${code('presentSuggestions(suggestions, typingMode, sort)')}. An engine failure marked unexpected is exit ${EXIT.unexpected}; any other (a sentence that cannot be fitted) is exit ${EXIT.contradiction}.

### 4.2 Flags

${block(generateHelp())}

Every setting is a row of one table (${code('src/cli/fields.ts')}), which the parser, the config schema, help, messages and the wizard all read:

| Flag | Config key | Engine field | Label in messages | Help |
| --- | --- | --- | --- | --- |
${FIELDS.map(flagRow).join('\n')}

Values are parsed by one function for flags and config alike, and refused with what was found and what is expected: whole numbers in range; ${code('true')}/${code('false')} in a file, ${code('--x')}/${code('--no-x')} on the command line; a choice by value, with "Did you mean" for a near miss (edit distance counting a swap of neighbouring letters as one, within a third of the length, or a unique prefix); allowed symbols as keyboard symbols only, each once (a letter, digit, space or off-keyboard character is refused, naming it); a separator as ${code('auto')}, ${code('space')}, ${code('none')} or one keyboard symbol; a strength as a preset name (${code('minimal')}, ${code('everyday')}, ${code('strong')}, ${code('very-strong')}, ${code('master-password')} or ${code('master')}) or bits 0-256; a target length as a number or ${code('none')}. Modes: ${MODE_NAMES.map((m) => code(m.name) + (m.aliases.length ? ` (or ${m.aliases.map(code).join(', ')})` : '')).join(', ')}. Site presets: ${SITE_NAMES.map((s) => code(s.name)).join(', ')} (slugs of the core's labels). Formats: ${FORMATS.map(code).join(', ')}.

The command line itself can contradict: each of these is exit ${EXIT.usage} with the flag named: an unknown flag (with the likeliest one meant); a missing value; a value for an on/off flag; a value starting with a dash ("If it is the value, join them with "=": --symbols=-_"); an argument such as ${code('mode=ten-finger')} ("Flags start with two dashes: --mode ten-finger"); a flag given twice; ${code('--x')} with ${code('--no-x')}; ${code('-c')} with ${code('--no-config')}; sentence options without ${code('--sentence -')}; ${code('--explain')} with ${code('--format plain')}. ${code('--sentence')} takes only ${code('-')}: the sentence as an argument would land in shell history and ${code('ps')}, so it is refused with that reason; with ${code('-')} it is one line of stdin (none, several, or one with no words is exit ${EXIT.usage}), or a hidden prompt when stdin is a terminal.

### 4.3 Output

- **table** (stdout a terminal): one row per password: index, password, then "Strength n  Raw n  Difficulty n  Memorability n" from ${code('scoreReadings')} (strength and memorability coloured by band, difficulty by level, raw uncoloured), then dim the session's bits ("42.7 bits": for an attacker who knows tep and the swaps in force; not a score), and "hint: ..." under it. Colour only when the stream is a terminal, ${code('NO_COLOR')} is unset and ${code('--no-color')} is not given.
- **plain** (piped): the passwords alone, one per line, so ${code('tep g | wl-copy')} works.
- **json**: ${code('{ mode, typingMode, separator, sort, warnings, suggestions: [{ password, hint, strength, raw, bits, difficulty, difficultyLabel, memorability, readings: { strength, raw, difficulty, memorability } }] }')}; with ${code('--explain')} also ${code('plan')} and each suggestion's ${code('explain')} lines.
- **--explain**: the plan's exact bits and where they come from, then for each password its words and roles, steps, swaps (${code('twistLine')}), where the swaps landed (${code('twistOptionsLine')}), deliberate swaps (${code('easedLine')}), the "Fast to type" lines (${code('typingLines')}) and every rule check, met or not.
- Notes, warnings (the engine's, minus its shortfall warning, which tep's own replaces), and the unreachable-target warning go to stderr as ${code('tep g: warning: ...')}; ${code('--quiet')} silences them (they stay in the JSON).
- ${code('--copy')} copies the first password shown, after printing, and says so on stderr: ${tools.map(([where, t]) => `${where}: ${t.map((x) => code(x.command.join(' '))).join(', ')}`).join('; ')}, the first on the PATH. None found is exit ${EXIT.usage} naming the tools tried and how to install one; a tool that fails is exit ${EXIT.unexpected} with what it said. Stdout closing early (${code('tep g | head -1')}) ends quietly.

### 4.4 Messages, generated from the real code

${examples()}

## 5. The config file

YAML, version ${CONFIG_VERSION}, kebab-case keys from the field table: ${code('version')} (required), ${code('mode')}, ${code('site')}, ${code('rules')}, ${code('options')} (${code('preset')}, or a map of option values over the mode's preset), ${code('sentence')}, ${code('swaps')} (${code('off')}: built-in swaps written ${code('from>to')}; ${code('custom')}: ${code('{ from, to }')} maps), ${code('output')} (${code('count')}, ${code('sort')}). Written by ${code('tep config')} like this:

${block(sample, 'yaml')}

Reading (${code('parseDocument')} with a line counter, the shape checked with a strict zod schema, every value with the flags' parser) reports **every** problem at once as exit ${EXIT.config}: "<file> is not a valid tep config (n problems):", then for each ${code('<file>:<line>: <what>')} and the line quoted. Problems: YAML that does not parse; a key twice; YAML warnings too, since an unquoted ${code('symbols: !@#$')} is a tag and would silently read as no symbols (say so, and how to quote); an unquoted ${code('#')} that YAML reads as a comment; an empty file; a top level that is not a map; no version, a newer one ("written by a newer tep"), a wrong one; unknown keys with "Did you mean" and the keys allowed there; a section that is not a map; an unknown mode or preset; each bad value; each bad swap (numbered as the file numbers them, duplicates naming the first). A missing ${code('-c')} file, a directory, an unreadable file, or one over 64 KB says which. A file that parses but contradicts itself is exit ${EXIT.contradiction}, its values' sources naming their lines. Writing is atomic: a temporary file beside it, flushed, renamed over it; mode 0644; a failure says why and changes nothing. Strings that are not plain lowercase names are written in double quotes, so a symbol is never read as YAML. A config never holds a sentence, a secret or a password.

## 6. tep config [file]

Needs a terminal (otherwise exit ${EXIT.usage}, pointing at the file format); one file name at most (default ${code('tep.yml')}), no flags but ${code('--help')}. Prompts are drawn on stderr. An existing file is loaded first (one that cannot be read is exit ${EXIT.config} and is never overwritten) and the wizard opens on the review; saving over it asks first ("Comments added to it by hand are not kept."); sections the wizard does not ask about (${code('sentence')}, ${code('swaps')}) are kept as they were.

### 6.1 Questions, in order

1. **Typing mode**: the core's four modes with their hints, Ten-finger first chosen.
2. **The site's rules**: each site preset with its note; "Paste the site's rules" (one line, read with ${code('parseRuleText')} over the Typical site's rules, "Read as: ..." said; rules that do not fit together are said and each rule is asked, starting from the text's values where they fit); or "Set each rule", asked in an order where each limits the next: minimum length, maximum length, allowed symbols, spaces, required uppercase letters, digits, symbols.
3. **Options**: "Use the <mode> preset" or "Set each option", asked in the core's ${code('PROFILE_KEYS')} order, skipping the mode's unused options (set to the preset's neutral values). Strength offers the presets and "Another number of bits".
4. **Output**: keep 5 passwords (1 piped), easiest first, or change the count and order.

Then the review (6.3).

### 6.2 No answer can contradict another

A choice is allowed when the answers so far, the choice, and the loosest value of every question not yet answered pass ${code('problemsOf')}; an unanswered glue and separator are tried every way (glue on or off, separator Auto or none), as neither is always looser, and the choice is allowed if any way works. An allowed answer therefore always leaves a way to finish. The loosest values:

| Setting | Loosest |
| --- | --- |
${Object.entries(LOOSEST).map(([name, v]) => `| ${capital(fieldNamed(name)!.label)} | ${describeValue(fieldNamed(name)!, v)} |`).join('\n')}

- A choice not allowed is shown, dimmed, and cannot be picked, with the reason naming the answer that rules it out ("(from your answer for spaces)" while asking, "(see line 2)" on the review).
- A question left with one allowed choice is not asked: the wizard states the value and why.
- Numbers show their allowed range ("Maximum length (14-256)"), found by binary search for the lengths (whose allowed values are one unbroken range; a test proves it) and by trying each value otherwise, and refuse anything outside it with the reason for the nearest value outside and the nearest that fits.
- Allowed symbols are typed, and refused with the reason when they are not keyboard symbols or contradict an answer.
- A strength the rules cannot reach is not ruled out: it is marked "warning: these rules reach at most n bits with your answers so far and the <mode> preset for the rest, so you would get the strongest they allow", and can be chosen.
- **A contradiction that gets through is a bug**, checked after every answer: said at once ("<question>: <choice> contradicts your other answers: <reason>. This is a bug in tep: the question should not have offered it. Please report it at <issues>. Pick something else."), the choice then shown as not allowed, and the question asked again. A question with no allowed answer at all is exit ${EXIT.unexpected}, naming each choice and why.
- Working out a question takes under ${QUESTION_BUDGET_MS} ms of CPU time; checks are remembered by settings, and the core's planning skips sentence shapes that cannot fit the window.

${wizardExamples()}

### 6.3 Review

Every answer with a line number: the mode; the site's rules (the preset and its note, or "set one by one:" with each rule on its own line, and lines for values over a preset from a loaded file); the options (the preset's values summarised, or each option on its own line); the count and the order. Then any unreachable-target warning (naming the lines to change) and a sample password with its readings and hint. Every line is wrapped to the box's width first, a value that runs on kept under its column (a warning's under its text, the sample's under the password), since the box itself would start the rest at its left edge. Where the question would not fit on one line (the terminal would wrap the title outside the prompter's guide bar), it is "Change a line (1-n), s save, q quit". "Change a line (1-n), s to save, q to quit without saving": a line asks its question again, shaped by every other line; a line no other choice fits cannot be changed ("Line n cannot be changed: every other choice contradicts another line. <reason>. Change that line first."). Changing the mode while options follow the preset changes them; a mode whose preset contradicts the rules is not allowed; with options set one by one, the new mode's preset is offered only if it fits. Saving checks once more (a problem there is the bug path, and nothing is written). A loaded file that contradicts itself is named and asked again from the first stage at which it stops fitting, with its values as defaults.

${block(CONFIG_HELP)}

## 7. Tests

A fake terminal (captured streams, a scripted prompter that records every question, its options, disabled choices and their reasons, and refuses to pick a disabled one) runs every command in-process. Covered: every flag and every refusal; every exit code; config discovery and every config problem with its line; layering and sources; every contradiction code and its message; warnings; output formats and colour; the clipboard on each platform; the wizard's paths, constraints, one-choice questions, the bug path (with a shaper that lets a bad choice through), the review, blocked lines, loading, repairing, overwriting, Ctrl+C. Random walks (40 seeded) pick any allowed choice or in-range value at every question, review edits included, and must never meet a contradiction or a question with no allowed answer, must save a file ${code('tep g')} reads with no problem, and must shape every question within the budget (CPU time; 3x on CI). The adapter to ${code('@clack/prompts')} is tested with clack mocked. The bundle is built and run as a process: version, piped output that meets the rules, JSON checked with the core's ${code('checkRequirements')}, stdin sentences, exit codes 2, 3 and 4, and ${code('| head -1')}.

### Every test, by file

${cliTests.map((f) => `**${f.file}**\n${f.titles.map((t) => (t.kind === 'group' ? `- ${t.title}` : `  - ${t.title}`)).join('\n')}`).join('\n\n')}

## 8. Acceptance

- ${code('tep g')} at the defaults prints five passwords at a terminal and one when piped, each meeting every rule of ${code('DEFAULT_REQUIREMENTS')} (max ${DEFAULT_REQUIREMENTS.maxLength}, target ${DEFAULT_REQUIREMENTS.targetBits} bits), scored exactly as the web app scores them.
- For every site preset and typing mode, the requirements tep resolves equal the web app's after picking that preset and mode.
- No command ever generates from, or writes, settings that contradict themselves.
- ${code('pnpm build:cli')} produces one file that runs with only Node 24.
`;
}
