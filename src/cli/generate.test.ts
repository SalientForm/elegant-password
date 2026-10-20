import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRequirements, DEFAULT_REQUIREMENTS } from '../lib/generate';
import { EXIT } from './errors';
import { main, VERSION } from './main';
import { fakeIo, type FakeIo } from './testing';

async function run(args: string[], over: Parameters<typeof fakeIo>[0] = {}): Promise<{ code: number; io: FakeIo }> {
  const io = fakeIo(over);
  const code = await main(args, io);
  return { code, io };
}

const ESC = '\u001b[';

describe('tep g: output', () => {
  it('piped, prints one password and nothing else', async () => {
    const { code, io } = await run(['g']);
    expect(code).toBe(EXIT.ok);
    const lines = io.out().trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    expect(checkRequirements(lines[0]!, DEFAULT_REQUIREMENTS).every((c) => c.met)).toBe(true);
    expect(io.err()).toBe('');
  });

  it('at a terminal, prints a table of 5: each password with its badges and hint', async () => {
    const { code, io } = await run(['g', '--no-color'], { stdoutTTY: true });
    expect(code).toBe(EXIT.ok);
    const lines = io.out().trimEnd().split('\n');
    expect(lines).toHaveLength(10);
    expect(lines[0]).toMatch(/^1 {2}\S.* {3}Strength \d+ {2}Difficulty \d+ {2}Memory \d+$/);
    expect(lines[1]).toMatch(/^ {3}hint: /);
    expect(io.out()).not.toContain(ESC);
  });

  it('colours the table at a terminal, and not with NO_COLOR or --no-color', async () => {
    expect((await run(['g'], { stdoutTTY: true })).io.out()).toContain(ESC);
    expect((await run(['g'], { stdoutTTY: true, env: { NO_COLOR: '1' } })).io.out()).not.toContain(ESC);
    expect((await run(['g', '--no-color'], { stdoutTTY: true })).io.out()).not.toContain(ESC);
  });

  it('-n and --count set how many; --format plain and table override the default', async () => {
    expect((await run(['g', '-n', '3'])).io.out().trimEnd().split('\n')).toHaveLength(3);
    expect((await run(['g', '--count', '2', '--format', 'table'])).io.out()).toMatch(/hint: /);
    expect((await run(['g', '--format', 'plain'], { stdoutTTY: true })).io.out().trimEnd().split('\n')).toHaveLength(5);
  });

  it('orders by the sort asked for', async () => {
    const { io } = await run(['g', '-n', '6', '--sort', 'strength', '--format', 'json']);
    const bits = JSON.parse(io.out()).suggestions.map((s: { bits: number }) => s.bits);
    expect(bits).toEqual([...bits].sort((a: number, b: number) => b - a));
  });

  it('--format json: the documented fields, difficulty for the typing mode, warnings included', async () => {
    const { code, io } = await run(['g', '-n', '2', '--mode', 'two-finger', '--format', 'json']);
    expect(code).toBe(0);
    const data = JSON.parse(io.out());
    expect(Object.keys(data)).toEqual(['mode', 'typingMode', 'separator', 'sort', 'warnings', 'suggestions']);
    expect(data).toMatchObject({ mode: 'generated', typingMode: 'two-finger', separator: ' ', sort: 'difficulty' });
    expect(Object.keys(data.suggestions[0])).toEqual(['password', 'hint', 'bits', 'difficulty', 'difficultyLabel', 'memorability', 'readings']);
    expect(data.suggestions[0].readings.difficulty).toMatch(/\(two-finger\)$/);
  });

  it('--explain adds the plan and each password\'s why, in a table or JSON', async () => {
    const table = (await run(['g', '-n', '1', '--explain', '--format', 'table'])).io.out();
    expect(table).toMatch(/^Plan: [\d.]+ bits for anyone who knows exactly how tep works, meeting the target\./);
    for (const part of ['Words: ', 'Fast to type:', 'Rules:', '  met: ']) expect(table).toContain(part);
    const json = JSON.parse((await run(['g', '-n', '1', '--explain', '--format', 'json'])).io.out());
    expect(json.plan.breakdown.length).toBeGreaterThan(2);
    expect(json.suggestions[0].explain).toEqual(expect.arrayContaining([expect.stringMatching(/^Words: /), 'Fast to type:']));
  });
});

describe('tep g: warnings and notes on stderr', () => {
  it('an unreachable target: once, with the bits reached, the length that would reach it, and passwords anyway', async () => {
    const { code, io } = await run(['g', '--site', 'short-max-16', '--strength', 'strong']);
    expect(code).toBe(EXIT.ok);
    expect(io.out().trim()).not.toBe('');
    const err = io.err();
    expect(err.match(/out of reach/g)).toHaveLength(1);
    expect(err).not.toContain('The length limits allow at most'); // the engine's shorter warning is not repeated
    expect(err).toMatch(/tep g: warning: The strength target, Strong \(50 bits\), is out of reach: these rules allow at most [\d.]+ bits/);
    expect(err).toMatch(/maximum length: 16 \(from the short-max-16 site preset, chosen by --site\)/);
    expect(err).toMatch(/Fix: A maximum length of \d+ would reach it \(--max-length\), or lower the target \(--strength\)\./);
  });

  it('puts the warnings in the JSON too, and --quiet keeps stderr empty', async () => {
    const { io } = await run(['g', '--site', 'short-max-16', '--strength', 'strong', '--format', 'json', '--quiet']);
    expect(io.err()).toBe('');
    expect(JSON.parse(io.out()).warnings.some((w: string) => /out of reach/.test(w))).toBe(true);
  });

  it('an option set by hand that the mode has no use for', async () => {
    const { code, io } = await run(['g', '--mode', 'two-finger', '--avoid-pinky']);
    expect(code).toBe(0);
    expect(io.err()).toContain('tep g: warning: --avoid-pinky sets avoid pinky stretches to on, which means nothing for Two-finger typing');
  });

  it('says how it read --rules', async () => {
    const { code, io } = await run(['g', '--rules', 'Must be 8-20 characters and include at least one number']);
    expect(code).toBe(0);
    expect(io.err()).toMatch(/^tep g: note: Read the rules text \(--rules\) as: 8-20 characters/);
  });
});

describe('tep g: contradictions (exit 3)', () => {
  it('names each problem, its values and where each came from, and a fix; nothing on stdout', async () => {
    const { code, io } = await run(['g', '--min-length', '20', '--max-length', '16']);
    expect(code).toBe(EXIT.contradiction);
    expect(io.out()).toBe('');
    expect(io.err()).toBe(
      [
        'tep g: error: these settings contradict each other, so no passwords were made:',
        '  The minimum length (20) is above the maximum length (16).',
        '       minimum length: 20 (from --min-length)',
        '       maximum length: 16 (from --max-length)',
        '       Fix: Lower the minimum length to 16 or less (--min-length), or raise the maximum length to 20 or more (--max-length).',
        '',
      ].join('\n'),
    );
  });

  it('numbers several problems', async () => {
    const { code, io } = await run(['g', '--min-length', '40', '--symbols=', '--min-symbols', '2']);
    expect(code).toBe(EXIT.contradiction);
    expect(io.err()).toMatch(/contradict each other \(2 problems\)/);
    expect(io.err()).toMatch(/\n {2}1\. The minimum length \(40\) is above the maximum length \(32\)\./);
    expect(io.err()).toMatch(/\n {2}2\. 2 symbols are required, but no symbols are allowed\./);
  });

  it('what only planning finds: no sentence fits', async () => {
    const { code, io } = await run(['g', '--min-length', '4', '--max-length', '6', '--min-uppercase', '0', '--min-digits', '0', '--min-symbols', '0']);
    expect(code).toBe(EXIT.contradiction);
    expect(io.err()).toContain('No made-up sentence fits between 4 and 6 characters.');
    expect(io.err()).toContain('Or use your own sentence with --sentence -');
  });

  it('a sentence the engine cannot fit', async () => {
    const { code, io } = await run(['g', '--sentence', '-', '--max-length', '4', '--min-length', '4'], { stdin: 'supercalifragilistic expialidocious wonderful\n' });
    expect(code).toBe(EXIT.contradiction);
    expect(io.err()).toMatch(/^tep g: error: your sentence cannot be made to fit these rules, so no passwords were made:/);
    expect(io.err()).toContain('Try a longer or shorter sentence');
  });
});

describe('tep g: the command line (exit 2)', () => {
  const usage = async (args: string[], title: string | RegExp, detail?: string | RegExp) => {
    const { code, io } = await run(['g', ...args]);
    expect(code, args.join(' ')).toBe(EXIT.usage);
    const [first, ...rest] = io.err().trimEnd().split('\n');
    if (typeof title === 'string') expect(first).toBe(`tep g: error: ${title}`);
    else expect(first).toMatch(title);
    if (detail) expect(rest.join('\n')).toMatch(detail);
    expect(io.out()).toBe('');
  };

  it('an unknown flag, with the likeliest one meant', () => usage(['--max-lenght', '3'], 'unknown flag --max-lenght. Did you mean --max-length?', 'Run "tep help g" for every flag.'));
  it('an unknown short flag', () => usage(['-x'], 'unknown flag -x.'));
  it('a flag with no value', () => usage(['--max-length'], '--max-length needs a value, as in --max-length 12.'));
  it('a flag whose value is another flag', () => usage(['--max-length', '--spaces'], 'the value after --max-length, "--spaces", starts with a dash, so it reads as another flag.', 'If it is the value, join them with "=": --max-length=--spaces'));
  it('a value for an on/off flag', () => usage(['--spaces=yes'], '--spaces takes no value.', 'It is on or off: write --spaces for on, --no-spaces for off.'));
  it('a value starting with a dash, with how to give it', () => usage(['--symbols', '-_'], 'the value after --symbols, "-_", starts with a dash, so it reads as another flag.', 'If it is the value, join them with "=": --symbols=-_'));
  it('key=value written as an argument, with the flag meant', () => usage(['mode=ten-finger'], '"mode=ten-finger" is not a flag: tep g takes only flags.', 'Flags start with two dashes: --mode ten-finger'));
  it('a flag given twice', () => usage(['--max-length', '12', '--max-length=20'], '--max-length is given 2 times (--max-length 12, --max-length 20).'));
  it('on and off both', () => usage(['--spaces', '--no-spaces'], '--spaces and --no-spaces are both given; they contradict each other.'));
  it('-c and --no-config', () => usage(['-c', 'x.yml', '--no-config'], '-c and --no-config contradict each other: one names a config file, the other says to read none.'));
  it('a value out of range', () => usage(['--max-length', '0'], '--max-length must be from 1 to 256; found 0.', 'For example: --max-length 12'));
  it('a value of the wrong kind', () => usage(['--comfort', 'loose'], '--comfort must be one of strict, balanced, relaxed; found "loose".'));
  it('a symbol that is not one', () => usage(['--symbols', '!a'], /^tep g: error: --symbols cannot include the letter "a"/));
  it('an unknown mode, preset or format', async () => {
    await usage(['--mode', 'two'], /^tep g: error: --mode: "two" is not a typing mode\. The typing modes are: /);
    await usage(['--site', 'banks'], /^tep g: error: --site: "banks" is not a site preset\./);
    await usage(['--format', 'yaml'], '--format must be table, plain, json; found "yaml".');
  });
  it('sentence options without --sentence', () => usage(['--shrink', 'ends', '--no-padding'], '--shrink, --padding are for your own sentence, and --sentence - is not given.'));
  it('the sentence as an argument, refused with why', () =>
    usage(['--sentence', 'Sally eats sweets'], '--sentence takes "-", not the sentence itself.', /shell history .* ps/));
  it('--explain with plain output', () => usage(['--explain', '--format', 'plain'], '--explain and --format plain contradict each other: plain output is the passwords alone.'));
  it('rules text with no rules', () => usage(['--rules', 'hello'], '--rules: no password rules found in "hello".'));
});

describe('tep g: config files', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'tep-g-'));

  it('reads ./tep.yml when there is one, and names its lines in messages', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nrules:\n  min-length: 20\n  max-length: 16\n');
    const { code, io } = await run(['g'], { cwd });
    expect(code).toBe(EXIT.contradiction);
    expect(io.err()).toContain('minimum length: 20 (from tep.yml line 3 (rules.min-length))');
    expect(io.err()).toContain('Fix: Lower the minimum length to 16 or less (rules.min-length in tep.yml (line 3)), or raise the maximum length to 20 or more (rules.max-length in tep.yml (line 4)).');
  });

  it('flags win over the file', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nrules:\n  min-length: 20\n  max-length: 16\n');
    expect((await run(['g', '--max-length', '30'], { cwd })).code).toBe(0);
  });

  it('--no-config ignores ./tep.yml', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'tep.yml'), 'not: [valid');
    expect((await run(['g', '--no-config'], { cwd })).code).toBe(0);
  });

  it('-c reads the file named, relative to the working directory', async () => {
    const cwd = dir();
    writeFileSync(join(cwd, 'bank.yml'), 'version: 1\nsite: short-max-16\noutput:\n  count: 3\n');
    const { code, io } = await run(['g', '-c', 'bank.yml'], { cwd });
    expect(code).toBe(0);
    const lines = io.out().trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    for (const pw of lines) expect(pw.length).toBeLessThanOrEqual(16);
  });

  it('a missing -c file, or a bad one, is exit 4 with what to do', async () => {
    const cwd = dir();
    const missing = await run(['g', '-c', 'nope.yml'], { cwd });
    expect(missing.code).toBe(EXIT.config);
    expect(missing.io.err()).toBe('tep g: error: nope.yml does not exist.\n  Check the path, or run "tep config nope.yml" to write it.\n');
    writeFileSync(join(cwd, 'tep.yml'), 'version: 1\nrules:\n  max-lenght: 3\n');
    const bad = await run(['g'], { cwd });
    expect(bad.code).toBe(EXIT.config);
    expect(bad.io.err()).toContain('tep.yml:3: unknown key "max-lenght" in rules. Did you mean max-length?');
  });
});

describe('tep g: your own sentence', () => {
  it('reads one line from stdin', async () => {
    const { code, io } = await run(['g', '--sentence', '-', '--format', 'json'], { stdin: 'Sally eats sweets on Sundays\n' });
    expect(code).toBe(0);
    const data = JSON.parse(io.out());
    expect(data.mode).toBe('sentence');
    expect(data.suggestions[0].hint.toLowerCase()).toContain('sally');
  });

  it('refuses empty stdin, more than one line, and text with no words', async () => {
    expect((await run(['g', '--sentence', '-'], { stdin: '\n' })).io.err()).toContain('--sentence - found nothing on stdin.');
    expect((await run(['g', '--sentence', '-'], { stdin: 'one\ntwo\n' })).io.err()).toContain('--sentence - found 2 lines on stdin; it takes one sentence, on one line.');
    const noWords = await run(['g', '--sentence', '-'], { stdin: '... !!!\n' });
    expect(noWords.code).toBe(EXIT.usage);
    expect(noWords.io.err()).toContain('It has no words');
  });

  it('asks for it, hidden, at a terminal, refusing a blank one', async () => {
    const { code, io } = await run(['g', '--sentence', '-', '-n', '1'], { stdinTTY: true, steps: [{ secret: '   ' }, { secret: 'Sally eats sweets on Sundays' }] });
    expect(code).toBe(0);
    expect(io.prompts.asked[0]).toMatchObject({ kind: 'secret', message: 'Your sentence (not shown as you type)' });
    expect(io.prompts.asked[0]!.refused![0]!.reason).toMatch(/^Type a sentence/);
  });

  it('Ctrl+C at the prompt is exit 130', async () => {
    const { code, io } = await run(['g', '--sentence', '-'], { stdinTTY: true, steps: [{ cancel: true }] });
    expect(code).toBe(EXIT.interrupted);
    expect(io.err()).toBe('tep g: cancelled; nothing was written.\n');
  });
});

describe('tep g: --copy', () => {
  it('copies the first password shown, and says with what', async () => {
    const { code, io } = await run(['g', '-n', '3', '--copy'], { env: { WAYLAND_DISPLAY: 'wayland-0' }, tools: ['wl-copy'] });
    expect(code).toBe(0);
    expect(io.copied).toEqual([{ command: ['wl-copy'], input: io.out().split('\n')[0] }]);
    expect(io.err()).toBe('tep g: copied password 1 to the clipboard (wl-copy).\n');
  });

  it('uses pbcopy on macOS, xclip or xsel on X11, clip.exe on WSL', async () => {
    expect((await run(['g', '--copy'], { platform: 'darwin', tools: ['pbcopy'] })).io.copied[0]!.command).toEqual(['pbcopy']);
    expect((await run(['g', '--copy'], { env: { DISPLAY: ':0' }, tools: ['xsel'] })).io.copied[0]!.command).toEqual(['xsel', '--clipboard', '--input']);
    expect((await run(['g', '--copy'], { env: { DISPLAY: ':0' }, tools: ['xclip', 'xsel'] })).io.copied[0]!.command).toEqual(['xclip', '-selection', 'clipboard']);
    expect((await run(['g', '--copy'], { env: { WSL_DISTRO_NAME: 'Ubuntu' }, tools: ['clip.exe'] })).io.copied[0]!.command).toEqual(['clip.exe']);
  });

  it('no tool is exit 2, naming what it tried and how to get one; the passwords are still printed', async () => {
    const { code, io } = await run(['g', '--copy'], { env: { DISPLAY: ':0' } });
    expect(code).toBe(EXIT.usage);
    expect(io.out().trim()).not.toBe('');
    expect(io.err()).toBe(
      'tep g: error: --copy found no clipboard tool, so nothing was copied.\n  Tried xclip (X11 (package xclip)), xsel (X11 (package xsel)); none is installed.\n  Install wl-clipboard (Wayland) or xclip (X11), or leave out --copy and pipe instead: tep g | wl-copy\n',
    );
    expect((await run(['g', '--copy'])).io.err()).toContain('This session has no display');
  });

  it('a failing tool is exit 1, with what it said', async () => {
    const { code, io } = await run(['g', '--copy'], { env: { DISPLAY: ':0' }, tools: ['xclip'], clipboardFails: true });
    expect(code).toBe(EXIT.unexpected);
    expect(io.err()).toContain('--copy: xclip failed, so nothing was copied.\n  xclip -selection clipboard exited with status 1: no display.');
  });
});

describe('tep: commands, help and version', () => {
  it('prints the version', async () => {
    for (const flag of ['--version', '-V']) expect((await run([flag])).io.out()).toBe(`tep ${VERSION}\n`);
  });

  it('prints help for the overview and each command', async () => {
    expect((await run([])).io.out()).toMatch(/^tep: the elegant passwords generator/);
    expect((await run(['help'])).io.out()).toMatch(/^tep: the elegant passwords generator/);
    const g = (await run(['help', 'g'])).io.out();
    expect(g).toMatch(/^Usage: tep g \[flags\]/);
    for (const flag of ['--max-length <1-256>', '--spaces, --no-spaces', '-n, --count <1-20>', '--separator <auto|space|none|symbol>', '-c, --config <file>', '--sentence -']) expect(g).toContain(flag);
    expect((await run(['g', '--help'])).io.out()).toBe(g);
    expect((await run(['help', 'config'])).io.out()).toMatch(/^Usage: tep config \[file\]/);
  });

  it('refuses an unknown command or help topic, and flags without a command', async () => {
    const r = await run(['generat']);
    expect(r.code).toBe(EXIT.usage);
    expect(r.io.err()).toBe('tep: error: "generat" is not a tep command. Did you mean generate?\n  The commands are g (generate), config and help.\n');
    expect((await run(['help', 'x'])).io.err()).toBe('tep help: error: there is no command "x".\n  The commands are g (generate) and config.\n');
    expect((await run(['--max-length', '3'])).io.err()).toMatch(/^tep: error: a command comes before the flags, as in: tep g --max-length 3/);
  });

  it('turns anything unexpected into exit 1 and asks for a report', async () => {
    const io = fakeIo({ stdinTTY: true });
    io.prompter = () => {
      throw new Error('boom');
    };
    const code = await main(['g', '--sentence', '-'], io);
    expect(code).toBe(EXIT.unexpected);
    expect(io.err()).toMatch(/^tep g: error: something went wrong inside tep: this is a bug\.\n {2}Error: boom/);
    expect(io.err()).toContain('Please report it at https://github.com/SalientForm/elegant-password/issues');
  });
});
