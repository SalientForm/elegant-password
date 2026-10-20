import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { problemsOf } from '../lib/consistency';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { layerOf, parseConfig } from './config';
import { configCommand } from './configCommand';
import { fieldShape, type SelectShape } from './constraints';
import { EXIT } from './errors';
import { main } from './main';
import { resolve } from './resolve';
import { fakeIo, flagsLayer, type Step } from './testing';
import { answersOf, reviewLines } from './wizard';

const dir = () => mkdtempSync(join(tmpdir(), 'tep-config-'));

async function wizard(steps: Step[], over: { cwd?: string; args?: string[] } = {}) {
  const cwd = over.cwd ?? dir();
  const io = fakeIo({ stdinTTY: true, cwd, steps });
  const code = await main(['config', ...(over.args ?? [])], io);
  const file = join(cwd, over.args?.[0] ?? 'tep.yml');
  return { code, io, cwd, file, text: existsSync(file) ? readFileSync(file, 'utf8') : undefined };
}

const asked = (io: ReturnType<typeof fakeIo>, message: string | RegExp) => io.prompts.asked.filter((a) => (typeof message === 'string' ? a.message === message : message.test(a.message)));
const option = (io: ReturnType<typeof fakeIo>, message: string | RegExp, label: string) => asked(io, message).at(-1)!.options!.find((o) => o.label.startsWith(label))!;

/** The steps of the shortest session: a mode, a preset, the mode's options, the output as it is. */
const quick = (mode = 'Two-finger', site = 'Typical site'): Step[] => [{ select: mode }, { select: site }, { select: 'Use the' }, { select: 'Keep these' }];

describe('tep config: a new file', () => {
  it('asks the mode, the rules, the options and the output, then saves after the review', async () => {
    const { code, io, text } = await wizard([...quick(), { text: 's' }]);
    expect(code).toBe(EXIT.ok);
    expect(io.prompts.asked.map((a) => a.message)).toEqual([
      'How will you type it?',
      'The site\'s rules',
      'Options',
      'Output: 5 passwords at a terminal (1 when piped), easiest to type first',
      'Change a line (1-5), s to save, q to quit without saving',
    ]);
    expect(io.prompts.said[0]).toEqual({ kind: 'info', message: 'Writing tep.yml. Ctrl+C stops at any point without writing anything.' });
    expect(io.prompts.said.at(-1)).toEqual({ kind: 'info', message: 'Saved tep.yml. Make passwords with: tep g' });
    expect(parseConfig(text!, 'tep.yml').model).toEqual({ mode: 'two-finger', site: 'typical-site', rules: {}, options: 'preset', sentence: {}, output: {} });
    expect(text).toContain('# tep config, written by `tep config` on 2026-10-20.');
  });

  it('offers each mode with its hint, ten-finger first chosen', async () => {
    const { io } = await wizard([...quick(), { text: 'q' }]);
    const q = asked(io, 'How will you type it?')[0]!;
    expect(q.initial).toBe('ten-finger');
    expect(q.options!.map((o) => o.label)).toEqual(['Two-finger', 'Ten-finger', 'One-handed', 'Minimal-quick']);
    expect(q.options![0]!.hint).toMatch(/^One finger of each hand/);
  });

  it('writes the file named, and says how to use it', async () => {
    const { code, io, text } = await wizard([...quick(), { text: 's' }], { args: ['bank.yml'] });
    expect(code).toBe(0);
    expect(text).toContain('site: typical-site');
    expect(io.prompts.said.at(-1)!.message).toBe('Saved bank.yml. Make passwords with: tep g -c bank.yml');
  });

  it('shows every answer on a numbered review, with a sample password', async () => {
    const { io } = await wizard([...quick(), { text: 's' }]);
    const review = io.prompts.said.find((s) => s.kind === 'note')!;
    expect(review.title).toBe('Your answers, for tep.yml');
    const lines = review.message.split('\n');
    expect(lines).toEqual([
      '1  Typing mode  Two-finger',
      '2  Site rules   Typical site (12-32, A + 1 + #)',
      expect.stringMatching(/^3 {2}Options {6}the Two-finger preset: strength target Everyday \(40 bits\), shortest that meets the target off, typing comfort Balanced, keep Shift within reach off, separator a space, include a number on, minimum swaps 1, capital initials 1, two-letter words 1, made-up nouns 1, glue on$/),
      '4  Passwords    5 at a terminal, 1 when piped',
      '5  Order        Difficulty',
      '',
      expect.stringMatching(/^Sample: .+ {3}Strength \d+ {2}Difficulty \d+ {2}Memorability \d+$/),
      expect.stringMatching(/^ {8}hint: /),
    ]);
  });

  it('q quits without writing anything', async () => {
    const { code, io, text } = await wizard([...quick(), { text: 'q' }]);
    expect(code).toBe(EXIT.ok);
    expect(text).toBeUndefined();
    expect(io.prompts.said.at(-1)!.message).toBe('Quit; nothing was written.');
  });

  it('Ctrl+C at any question is exit 130 and writes nothing', async () => {
    const { code, io, text } = await wizard([{ select: 'Two-finger' }, { cancel: true }]);
    expect(code).toBe(EXIT.interrupted);
    expect(text).toBeUndefined();
    expect(io.err()).toBe('tep config: cancelled; nothing was written.\n');
  });

  it('refuses a review answer that is not a line, s or q', async () => {
    const { io } = await wizard([...quick(), { text: 'x' }, { text: '99' }, { text: 'S' }]);
    const review = asked(io, /^Change a line/)[0]!;
    expect(review.refused).toEqual([
      { value: 'x', reason: 'Type a line number from 1 to 5, s to save or q to quit.' },
      { value: '99', reason: 'Type a line number from 1 to 5, s to save or q to quit.' },
    ]);
  });
});

describe('tep config: questions shaped by earlier answers', () => {
  const eachRule = (min: string, max: string, symbols: string, spaces: 'Allowed' | 'Not allowed'): Step[] => [{ select: 'Set each rule' }, { text: min }, { text: max }, { text: symbols }, { select: spaces }];

  it('the length questions show the range that fits, and refuse what does not, saying why', async () => {
    const { io, text } = await wizard([{ select: 'Ten-finger' }, { select: 'Set each rule' }, { text: '10' }, { text: '5' }, { text: '20' }, { text: '!@#' }, { select: 'Allowed' }, { select: '1' }, { select: '1' }, { select: '1' }, { select: 'Use the' }, { select: 'Keep' }, { text: 's' }]);
    expect(asked(io, /^Minimum length/)[0]!.message).toMatch(/^Minimum length \(1-\d+\)$/);
    const max = asked(io, /^Maximum length/)[0]!;
    const low = Number(max.message.match(/\((\d+)-256\)/)![1]);
    expect(low).toBeGreaterThanOrEqual(10);
    expect(max.refused![0]!.value).toBe('5');
    expect(max.refused![0]!.reason).toMatch(new RegExp(`^5 is too low: .*The lowest that fits is ${low}\\.$`));
    expect(parseConfig(text!, 'x').model.rules).toEqual({ 'min-length': 10, 'max-length': 20, 'min-uppercase': 1, 'min-digits': 1, 'min-symbols': 1, symbols: '!@#', spaces: true });
  });

  it('a question with one choice left is stated, not asked, with why', async () => {
    const { io, text } = await wizard([{ select: 'Ten-finger' }, ...eachRule('12', '32', '', 'Allowed'), { select: '1' }, { select: '1' }, { select: 'Use the' }, { select: 'Keep' }, { text: 's' }]);
    expect(asked(io, 'Required symbols')).toEqual([]);
    expect(io.prompts.said).toContainEqual({
      kind: 'info',
      message: 'Required symbols: 0, the only choice left: the others are ruled out (a symbol is required, but no symbols are allowed (from your answer for allowed symbols)).',
    });
    expect(parseConfig(text!, 'x').model.rules['min-symbols']).toBe(0);
  });

  it('refuses symbols that are not keyboard symbols, saying which', async () => {
    const { io } = await wizard([{ select: 'Ten-finger' }, { select: 'Set each rule' }, { text: '12' }, { text: '32' }, { text: '!a' }, { text: '!!' }, { text: '!@' }, { select: 'Allowed' }, { select: '1' }, { select: '1' }, { select: '1' }, { select: 'Use the' }, { select: 'Keep' }, { text: 'q' }]);
    expect(asked(io, /^Allowed symbols/)[0]!.refused).toEqual([
      { value: '!a', reason: 'The symbols cannot include the letter "a": the letter "a" is not a symbol; letters and digits are always allowed, so list only symbols.' },
      { value: '!!', reason: 'The symbols lists "!" twice.' },
    ]);
  });

  it('a separator the rules forbid is shown but cannot be picked, with the answer that rules it out', async () => {
    const { io } = await wizard([
      { select: 'Ten-finger' },
      { select: 'No spaces' },
      { select: 'Set each option' },
      { select: 'Everyday' },
      { select: 'Off' },
      { select: 'Balanced' },
      { select: 'On' },
      { select: 'Off' },
      { select: 'On' },
      { select: 'Auto' },
      { select: 'On' },
      { select: '2' },
      { select: '0' },
      { select: '0' },
      { select: '0' },
      { select: 'Off' },
      { select: 'Keep' },
      { text: 'q' },
    ]);
    const space = option(io, 'Separator', 'Space');
    expect(space.disabled).toBe(true);
    expect(space.hint).toBe('not allowed: The separator is a space, but spaces are not allowed (from your answer for spaces)');
  });

  it('a strength the rules cannot reach is a warning, not a block: it can be chosen', async () => {
    const steps: Step[] = [{ select: 'Ten-finger' }, { select: 'Short max (16)' }, { select: 'Set each option' }, { select: 'Strong' }];
    const { io } = await wizard([...steps, { cancel: true }]);
    const strong = option(io, 'Strength target', 'Strong');
    expect(strong.disabled).toBeUndefined();
    expect(strong.hint).toMatch(/^warning: these rules reach at most [\d.]+ bits with your answers so far and the Ten-finger preset for the rest, so you would get the strongest they allow$/);
    expect(option(io, 'Strength target', 'Another number').disabled).toBeUndefined();
  });

  it('any number of bits can be given instead of a preset', async () => {
    const steps: Step[] = [{ select: 'Ten-finger' }, { select: 'Typical site' }, { select: 'Set each option' }, { select: 'Another number' }, { text: '300' }, { text: '45' }];
    const { io } = await wizard([...steps, { cancel: true }]);
    expect(asked(io, /^Strength target, in bits/)[0]!.refused).toEqual([{ value: '300', reason: '300 is out of range: it must be from 0 to 256.' }]);
  });

  it('the review warns when the target is out of reach, naming the lines', async () => {
    const { io } = await wizard([{ select: 'Ten-finger' }, { select: 'Short max (16)' }, { select: 'Set each option' }, { select: 'Strong' }, ...Array(11).fill({ select: '' }).map((_, i) => ({ select: ['Off', 'Balanced', 'On', 'Off', 'On', 'Auto', 'On', '2', '0', '0', '0', 'Off'][i]! })).slice(0, 11), { select: 'Off' }, { select: 'Keep' }, { text: 'q' }]);
    const review = io.prompts.said.find((s) => s.kind === 'note')!.message;
    expect(review).toMatch(/Warning: The strength target, Strong \(50 bits\), is out of reach: these rules allow at most [\d.]+ bits/);
    expect(review).toMatch(/or lower the target \(line \d+\)\./);
  });
});

describe('tep config: pasted rules', () => {
  it('reads them, says how, and keeps the rest from the Typical site', async () => {
    const { io, text } = await wizard([{ select: 'Ten-finger' }, { select: 'Paste' }, { text: '' }, { text: 'hello' }, { text: 'Must be 8-20 characters and include at least one number' }, { select: 'Use the' }, { select: 'Keep' }, { text: 's' }]);
    const paste = asked(io, 'Paste the site\'s rules (one line)')[0]!;
    expect(paste.refused!.map((r) => r.reason)).toEqual(['Paste the rules, or press Ctrl+C to stop.', expect.stringMatching(/^No password rules found in that\./)]);
    expect(io.prompts.said).toContainEqual({ kind: 'info', message: expect.stringMatching(/^Read as: 8-20 characters/) });
    expect(parseConfig(text!, 'x').model.rules).toMatchObject({ 'min-length': 8, 'max-length': 20, 'min-uppercase': 1, symbols: DEFAULT_REQUIREMENTS.allowedSymbols });
  });

  it('rules that do not fit together: says why, then asks each rule from the text\'s values', async () => {
    const { io } = await wizard([{ select: 'Ten-finger' }, { select: 'Paste' }, { text: 'Must be 4-6 characters' }, { cancel: true }]);
    expect(io.prompts.said).toContainEqual({ kind: 'warn', message: expect.stringMatching(/^Those rules do not fit together: No made-up sentence fits between 4 and 6 characters.*Asking each rule, starting from what the text said where that fits\.$/) });
    expect(asked(io, /^Minimum length/)[0]!.initial).toBe('4');
  });
});

describe('tep config: a contradiction that gets through is a bug, said at once', () => {
  it('says so, then asks again with that choice ruled out', async () => {
    // A broken shaper that offers every separator: the wizard must catch what it lets through.
    const broken = ((f, a, where, defaults) => {
      const shape = fieldShape(f, a, where, defaults);
      if (shape.kind !== 'select') return shape;
      return { ...shape, choices: (shape as SelectShape<unknown>).choices.map(({ blocked, ...c }) => (void blocked, c)) };
    }) as typeof fieldShape;
    const steps: Step[] = [{ select: 'Ten-finger' }, { select: 'No spaces' }, { select: 'Set each option' }, { select: 'Everyday' }, { select: 'Off' }, { select: 'Balanced' }, { select: 'On' }, { select: 'Off' }, { select: 'On' }, { select: 'Space' }, { select: 'Auto' }, { cancel: true }];
    const io = fakeIo({ stdinTTY: true, cwd: dir(), steps });
    const code = await configCommand([], io, { fieldShape: broken }).catch(() => 130);
    expect(code).toBe(130);
    const bug = io.prompts.said.find((s) => s.kind === 'error')!;
    expect(bug.message).toBe(
      `Separator: Space contradicts your other answers: The separator is a space, but spaces are not allowed (from your answer for spaces). This is a bug in tep: the question should not have offered it. Please report it at https://github.com/SalientForm/elegant-password/issues. Pick something else.`,
    );
    const again = asked(io, 'Separator');
    expect(again).toHaveLength(2);
    expect(again[1]!.options!.find((o) => o.label === 'Space')).toMatchObject({ disabled: true, hint: 'not allowed: it contradicts your other answers (a bug in tep)' });
  });
});

describe('tep config: the review', () => {
  it('changes a line, shaped by every other line, then returns to the review', async () => {
    const { text } = await wizard([...quick(), { text: '1' }, { select: 'One-handed' }, { text: 's' }]);
    expect(parseConfig(text!, 'x').model.mode).toBe('one-handed');
  });

  it('names the line that rules a choice out', async () => {
    const steps: Step[] = [
      { select: 'Ten-finger' },
      { select: 'No spaces' },
      { select: 'Set each option' },
      ...['Everyday', 'Off', 'Balanced', 'On', 'Off', 'On', 'Auto', 'On', '2', '0', '0', '0', 'Off'].map((s) => ({ select: s })),
      { select: 'Keep' },
    ];
    const first = await wizard([...steps, { text: 'q' }]);
    const lines = first.io.prompts.said.find((s) => s.kind === 'note')!.message.split('\n');
    const separatorLine = Number(lines.find((l) => /^\s*\d+\s+Separator/.test(l))!.trim().split(/\s+/)[0]);
    const { io } = await wizard([...steps, { text: String(separatorLine) }, { select: 'Auto' }, { text: 'q' }]);
    expect(option(io, 'Separator', 'Space').hint).toBe('not allowed: The separator is a space, but spaces are not allowed (see line 2)');
  });

  it('a line no other choice fits cannot be changed: says which line holds it', async () => {
    const steps: Step[] = [{ select: 'Ten-finger' }, { select: 'Set each rule' }, { text: '12' }, { text: '32' }, { text: '' }, { select: 'Allowed' }, { select: '1' }, { select: '1' }, { select: 'Use the' }, { select: 'Keep' }];
    const first = await wizard([...steps, { text: 'q' }]);
    const lines = first.io.prompts.said.find((s) => s.kind === 'note')!.message.split('\n');
    const symbolsLine = Number(lines.find((l) => /Required symbols/.test(l))!.trim().split(/\s+/)[0]);
    const { io } = await wizard([...steps, { text: String(symbolsLine) }, { text: 'q' }]);
    expect(io.prompts.said).toContainEqual({
      kind: 'warn',
      message: expect.stringMatching(new RegExp(`^Line ${symbolsLine} cannot be changed: every other choice contradicts another line\\. A symbol is required, but no symbols are allowed \\(see line \\d+\\)\\. Change that line first\\.$`)),
    });
  });

  it('changing the mode keeps options set one by one unless asked, and offers the new preset only if it fits', async () => {
    const steps: Step[] = [{ select: 'Ten-finger' }, { select: 'Typical site' }, { select: 'Set each option' }, ...['Everyday', 'Off', 'Balanced', 'On', 'Off', 'On', 'Auto', 'On', '2', '0', '0', '0', 'Off'].map((s) => ({ select: s })), { select: 'Keep' }];
    const kept = await wizard([...steps, { text: '1' }, { select: 'Two-finger' }, { confirm: false }, { text: 's' }]);
    expect(parseConfig(kept.text!, 'x').model).toMatchObject({ mode: 'two-finger', options: expect.objectContaining({ swaps: 2 }) });
    const taken = await wizard([...steps, { text: '1' }, { select: 'Two-finger' }, { confirm: true }, { text: 's' }]);
    expect(parseConfig(taken.text!, 'x').model).toMatchObject({ mode: 'two-finger', options: 'preset' });
  });

  it('switching options from the preset to one by one starts from the preset\'s values', async () => {
    const { io } = await wizard([...quick(), { text: '3' }, { select: 'Set each option' }, { text: 'q' }]);
    const after = io.prompts.said.filter((s) => s.kind === 'note')[1]!.message;
    expect(after).toMatch(/Options\s+set one by one:/);
    expect(after).toMatch(/Separator\s+a space/);
  });
});

describe('tep config: an existing file', () => {
  it('opens on the review with its answers, and asks before overwriting', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nmode: quick\nsite: no-spaces\n');
    const { code, io, text } = await wizard([{ text: 's' }, { confirm: true }], { cwd });
    expect(code).toBe(0);
    expect(io.prompts.said[0]!.message).toBe('Editing tep.yml: every answer is below, ready to change.');
    expect(asked(io, /^Overwrite tep\.yml\? Comments added to it by hand are not kept\.$/)).toHaveLength(1);
    expect(parseConfig(text!, 'x').model).toMatchObject({ mode: 'quick', site: 'no-spaces' });
  });

  it('no to overwriting goes back to the review', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nmode: quick\n');
    const { text } = await wizard([{ text: 's' }, { confirm: false }, { text: 'q' }], { cwd });
    expect(text).toBe('version: 1\nmode: quick\n');
  });

  it('keeps the sentence options and swaps it does not ask about', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nsentence:\n  shrink: ends\nswaps:\n  off: [a>@]\n');
    const { text } = await wizard([{ text: 's' }, { confirm: true }], { cwd });
    expect(parseConfig(text!, 'x').model).toMatchObject({ sentence: { shrink: 'ends' }, swaps: { disabled: ['a>@'], custom: [] } });
  });

  it('a file that contradicts itself is named, and asked again from where it stops fitting', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nrules:\n  min-length: 20\n  max-length: 16\n');
    const { io } = await wizard([{ select: 'Typical site' }, { select: 'Use the' }, { select: 'Keep' }, { text: 's' }, { confirm: true }], { cwd });
    expect(io.prompts.said).toContainEqual({
      kind: 'warn',
      message: 'tep.yml contradicts itself: The minimum length (20) is above the maximum length (16). Asking the site\'s rules again, starting from the file\'s values where they fit.',
    });
  });

  it('a file it cannot read is exit 4, and is not overwritten', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nrules:\n  max-lenght: 3\n');
    const { code, io, text } = await wizard([], { cwd });
    expect(code).toBe(EXIT.config);
    expect(io.err()).toContain('tep config does not overwrite a file it cannot read: fix tep.yml, or move it aside and run tep config again.');
    expect(text).toBe('version: 1\nrules:\n  max-lenght: 3\n');
  });

  it('answersOf reads a file the way tep g does', () => {
    const model = parseConfig('version: 1\nmode: two-finger\nrules:\n  max-length: 20\noptions:\n  swaps: 3\n', 'x').model;
    const a = answersOf(model);
    const g = resolve(layerOf({ model, lines: {}, file: 'x' }), flagsLayer({}), { tty: true }).generation.req;
    expect(reviewLines(a).length).toBeGreaterThan(10);
    expect(problemsOf(g)).toEqual([]);
    expect(a.rules['max-length']).toBe(20);
    expect(a.options.swaps).toBe(3);
  });
});

describe('tep config: the command line', () => {
  it('needs a terminal', async () => {
    const io = fakeIo({ stdinTTY: false });
    expect(await main(['config'], io)).toBe(EXIT.usage);
    expect(io.err()).toBe('tep config: error: it asks questions, so it needs a terminal, and stdin is not one.\n  Run it in a terminal, or write tep.yml by hand: "tep help config" shows the format, and tep g checks it.\n');
  });

  it('takes one file name, and no flags but --help', async () => {
    const two = fakeIo({ stdinTTY: true });
    expect(await main(['config', 'a.yml', 'b.yml'], two)).toBe(EXIT.usage);
    expect(two.err()).toContain('it takes one file name; found 2: a.yml b.yml.');
    const flag = fakeIo({ stdinTTY: true });
    expect(await main(['config', '--force'], flag)).toBe(EXIT.usage);
    expect(flag.err()).toContain('unknown flag --force.');
    const help = fakeIo({ stdinTTY: true });
    expect(await main(['config', '--help'], help)).toBe(EXIT.ok);
    expect(help.out()).toMatch(/^Usage: tep config \[file\]/);
  });

  it('refuses a directory, or a file in a directory that does not exist', async () => {
    const cwd = dir();
    mkdirSync(join(cwd, 'sub'));
    const d = fakeIo({ stdinTTY: true, cwd });
    expect(await main(['config', 'sub'], d)).toBe(EXIT.config);
    expect(d.err()).toContain('sub is a directory, not a config file.');
    const missing = fakeIo({ stdinTTY: true, cwd });
    expect(await main(['config', 'no/such/x.yml'], missing)).toBe(EXIT.config);
    expect(missing.err()).toContain('no/such/x.yml cannot be written: the directory no/such does not exist.');
  });
});
