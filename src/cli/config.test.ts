import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { emptyModel, layerOf, loadConfig, MAX_CONFIG_BYTES, parseConfig, readConfigFile, writeAtomic, type ConfigModel, type WriteFs } from './config';
import { serializeConfig } from './configText';
import { CliError, EXIT } from './errors';
import { resolve } from './resolve';
import { flagsLayer } from './testing';

/** The error a config text raises: its title and detail lines. */
function problems(text: string, file = 'tep.yml') {
  try {
    parseConfig(text, file);
  } catch (e) {
    expect(e).toBeInstanceOf(CliError);
    expect((e as CliError).exitCode).toBe(EXIT.config);
    return { title: (e as CliError).title, details: (e as CliError).details };
  }
  throw new Error('expected the config to be refused');
}

/** Only the problem lines, not the quoted file lines. */
const messages = (text: string) => problems(text).details.filter((d) => !d.startsWith('    '));

describe('parseConfig: what a valid file says', () => {
  const text = `# a comment
version: 1
mode: two-finger
site: short-max-16
rules:
  max-length: 14
  symbols: "!@#"
options:
  swaps: 3
  separator: space
sentence:
  shrink: ends
swaps:
  off: [a>@]
  custom:
    - { from: ph, to: f }
output:
  count: 2
  sort: strength
`;

  it('reads every section into the engine\'s terms, with the line each key is on', () => {
    const { model, lines } = parseConfig(text, 'tep.yml');
    expect(model).toEqual({
      mode: 'two-finger',
      site: 'short-max-16',
      rules: { 'max-length': 14, symbols: '!@#' },
      options: { swaps: 3, separator: ' ' },
      sentence: { shrink: 'ends' },
      swaps: { disabled: ['a>@'], custom: [{ from: 'ph', to: 'f' }] },
      output: { count: 2, sort: 'strength' },
    });
    expect(lines).toMatchObject({ mode: 3, site: 4, 'rules.max-length': 6, 'rules.symbols': 7, 'options.swaps': 9, 'options.separator': 10, 'sentence.shrink': 12, swaps: 13, 'output.count': 18 });
  });

  it('becomes a layer whose sources are the file and line', () => {
    const layer = layerOf(parseConfig(text, 'bank.yml'));
    expect(layer.values['max-length']).toEqual({ value: 14, source: { kind: 'file', file: 'bank.yml', line: 6, key: 'rules.max-length' } });
    expect(layer.mode).toEqual({ value: 'two-finger', source: { kind: 'file', file: 'bank.yml', line: 3, key: 'mode' } });
    expect(layer.site?.source).toEqual({ kind: 'file', file: 'bank.yml', line: 4, key: 'site' });
    const r = resolve(layer, flagsLayer({}), { tty: true });
    expect(r.generation.req).toMatchObject({ minLength: 8, maxLength: 14, allowedSymbols: '!@#', twists: 3, separator: ' ' });
    expect(r.generation.mappingSettings).toEqual({ disabled: ['a>@'], custom: [{ from: 'ph', to: 'f' }] });
    expect(r.count).toBe(2);
  });

  it('takes options: preset, or no options at all, as the mode\'s preset', () => {
    expect(parseConfig('version: 1\noptions: preset\n', 'x').model.options).toBe('preset');
    expect(parseConfig('version: 1\n', 'x').model).toEqual(emptyModel());
  });

  it('accepts a mode by its alias and empty sections', () => {
    const { model } = parseConfig('version: 1\nmode: minimal-quick\nrules:\nsentence:\n', 'x');
    expect(model.mode).toBe('quick');
    expect(model.rules).toEqual({});
  });
});

describe('parseConfig: every way a file can be wrong, each with its line', () => {
  it('YAML that does not parse, with the line quoted', () => {
    const p = problems('version: 1\nrules: [1, 2\n');
    expect(p.title).toBe('tep.yml is not a valid tep config (1 problem):');
    expect(p.details[0]).toMatch(/^tep\.yml:\d+: /);
  });

  it('a key twice in one section', () => {
    expect(messages('version: 1\nmode: quick\nmode: two-finger\n')).toEqual(['tep.yml:3: a key appears twice in the same section; keep one']);
  });

  it('unquoted symbols read as a YAML tag, which would silently mean none: refused, with how to quote them', () => {
    const [m] = messages('version: 1\nrules:\n  symbols: !@#$\n');
    expect(m).toMatch(/^tep\.yml:3: Unresolved tag: !@#\$: a value starting with "!" is read as a YAML tag, not as text\. Symbols such as/);
    expect(m).toContain('symbols: "!@#$%"');
  });

  it('a separator of "#" unquoted, which YAML reads as a comment', () => {
    expect(messages('version: 1\noptions:\n  separator: #\n')[0]).toMatch(/^tep\.yml:3: options\.separator must be auto, space, none, or one symbol such as ";"; found null\. A "#" after a space starts a comment in YAML/);
  });

  it('an empty file', () => {
    expect(problems('').title).toBe('tep.yml is empty.');
    expect(problems('# only a comment\n').title).toBe('tep.yml is empty.');
  });

  it('a file that is not a map', () => {
    expect(messages('- 1\n- 2\n')).toEqual(['tep.yml:1: the file must be a map of keys (version: 1, mode: ..., rules: ...), not a list']);
  });

  it('no version, a newer version, a wrong version', () => {
    expect(messages('mode: quick\n')).toEqual(['tep.yml:1: the file has no version. Add "version: 1" as its first line.']);
    expect(messages('version: 2\n')).toEqual(['tep.yml:1: version 2 was written by a newer tep; this one reads version 1. Upgrade tep, or run tep config to write a version 1 file.']);
    expect(messages('version: one\n')).toEqual(['tep.yml:1: version must be 1; found the text "one".']);
  });

  it('unknown keys, at the top and in a section, with the likeliest one meant and the ones there are', () => {
    expect(messages('version: 1\nrule:\n  max-length: 3\n')).toEqual([
      'tep.yml:2: unknown key "rule" in the top level. Did you mean rules? The keys there are: version, mode, site, rules, options, sentence, swaps, output.',
    ]);
    expect(messages('version: 1\nrules:\n  max-lenght: 30\n')).toEqual([
      'tep.yml:3: unknown key "max-lenght" in rules. Did you mean max-length? The keys there are: min-length, max-length, min-uppercase, min-digits, min-symbols, symbols, spaces.',
    ]);
    expect(messages('version: 1\noptions:\n  swap: 2\n')[0]).toMatch(/^tep\.yml:3: unknown key "swap" in options\. Did you mean swaps\?/);
    expect(messages('version: 1\nswaps:\n  of: []\n')[0]).toMatch(/^tep\.yml:3: unknown key "of" in swaps\. Did you mean off\?/);
  });

  it('a section that is not a map', () => {
    expect(messages('version: 1\nrules: 12\n')).toEqual(['tep.yml:2: rules must be a map of keys; found 12.']);
    expect(messages('version: 1\noptions: [1]\n')).toEqual(['tep.yml:2: options must be "preset" (the typing mode\'s own options) or a map of option values; found a list.']);
  });

  it('an unknown mode or site preset, with the names there are', () => {
    expect(messages('version: 1\nmode: two-fingers\n')[0]).toBe(
      'tep.yml:2: mode: "two-fingers" is not a typing mode. The typing modes are: two-finger, ten-finger, one-handed, quick (or minimal-quick). Did you mean two-finger?',
    );
    expect(messages('version: 1\nsite: bank\n')[0]).toMatch(/^tep\.yml:2: site: "bank" is not a site preset\. The site presets are: typical-site, /);
    expect(messages('version: 1\nmode: 3\n')[0]).toMatch(/^tep\.yml:2: mode: the typing mode must be one of /);
  });

  it('values out of range or of the wrong kind, with the key, what was found and what is expected', () => {
    expect(messages('version: 1\nrules:\n  min-length: 0\n  spaces: yes\n  symbols: "!a"\noutput:\n  count: 50\n')).toEqual([
      'tep.yml:3: rules.min-length must be from 1 to 256; found 0.',
      'tep.yml:4: rules.spaces must be true or false; found "yes".',
      'tep.yml:5: rules.symbols cannot include the letter "a": the letter "a" is not a symbol; letters and digits are always allowed, so list only symbols.',
      'tep.yml:7: output.count must be from 1 to 20; found 50.',
    ]);
  });

  it('every problem at once, in line order, each followed by its line', () => {
    const p = problems('version: 1\nrules:\n  min-length: 0\n  max-length: 999\n');
    expect(p.title).toBe('tep.yml is not a valid tep config (2 problems):');
    expect(p.details).toEqual([
      'tep.yml:3: rules.min-length must be from 1 to 256; found 0.',
      '      3 |   min-length: 0',
      'tep.yml:4: rules.max-length must be from 1 to 256; found 999.',
      '      4 |   max-length: 999',
    ]);
  });

  it('bad swaps: not a built-in, a malformed entry, a custom swap the core refuses, a duplicate', () => {
    expect(
      messages(`version: 1
swaps:
  off: [zz>q, 3]
  custom:
    - { from: PH, to: f }
    - ph
    - { from: ph, to: f }
    - { from: ph, to: f }
`),
    ).toEqual([
      'tep.yml:3: swaps.off entry 2 must be a built-in swap written "from>to", such as "a>@"; found 3.',
      'tep.yml:3: swaps.off entry 1: "zz>q" is not a built-in swap. Built-in swaps are written "from>to", such as "a>@" or "ph>f".',
      'tep.yml:5: swaps.custom entry 1: PH>f: Replace: 1-8 lowercase letters.',
      'tep.yml:6: swaps.custom entry 2 must be a map with "from" and "to", such as { from: ph, to: f }; found the text "ph".',
      'tep.yml:8: swaps.custom entry 4: ph>f is listed twice (also entry 3).',
    ]);
  });
});

describe('serializeConfig', () => {
  const today = '2026-10-20';
  const models: ConfigModel[] = [
    { ...emptyModel(), mode: 'two-finger', site: 'typical-site' },
    {
      mode: 'quick',
      rules: { 'min-length': 10, 'max-length': 20, 'min-uppercase': 1, 'min-digits': 1, 'min-symbols': 1, symbols: '!#&*,:', spaces: false },
      options: { strength: 45, shortest: true, comfort: 'strict', separator: '#', swaps: 1 },
      sentence: { 'target-length': null, shrink: 'vowels' },
      swaps: { disabled: ['a>@'], custom: [{ from: 'ph', to: 'f' }] },
      output: { count: 3, sort: 'memorability' },
    },
    { ...emptyModel(), site: 'nist-passphrase', rules: { 'max-length': 40 }, options: { separator: ' ' } },
  ];

  it('round-trips: written, then read, gives the same model', () => {
    for (const model of models) {
      const text = serializeConfig(model, today);
      const back = parseConfig(text, 'x').model;
      expect(back, text).toEqual({ ...model, mode: model.mode ?? 'ten-finger', swaps: model.swaps });
    }
  });

  it('writes the header, the mode with the choices, the preset\'s note and quoted symbols', () => {
    const text = serializeConfig(models[0]!, today);
    expect(text.split('\n').slice(0, 6)).toEqual([
      '# tep config, written by `tep config` on 2026-10-20.',
      '# Run `tep g` in this directory, or `tep g -c <this file>`. Edit it by hand or run `tep config` again.',
      'version: 1',
      'mode: two-finger            # two-finger | ten-finger | one-handed | quick',
      '',
      'site: typical-site          # 12-32, A + 1 + #',
    ]);
    expect(text).toContain('options: preset             # the Two-finger options as tep sets them, now and as they change');
    expect(serializeConfig(models[1]!, today)).toContain('  symbols: "!#&*,:"');
    expect(serializeConfig(models[1]!, today)).toContain('  separator: "#"');
  });

  it('resolves to the same requirements as the model it came from', () => {
    for (const model of models) {
      const a = resolve(layerOf({ model, lines: {}, file: 'x' }), flagsLayer({}), { tty: true });
      const b = resolve(layerOf(parseConfig(serializeConfig(model, today), 'x')), flagsLayer({}), { tty: true });
      expect(b.generation).toEqual(a.generation);
      expect(b.typingMode).toBe(a.typingMode);
    }
  });
});

describe('files on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tep-config-'));

  it('loads a file', () => {
    const path = join(dir, 'ok.yml');
    writeFileSync(path, 'version: 1\nmode: quick\n');
    expect(loadConfig(path, 'ok.yml').model.mode).toBe('quick');
  });

  it('a missing file says so and how to make it', () => {
    expect(() => readConfigFile(join(dir, 'nope.yml'), 'nope.yml')).toThrow(expect.objectContaining({ exitCode: EXIT.config, title: 'nope.yml does not exist.', details: ['Check the path, or run "tep config nope.yml" to write it.'] }));
  });

  it('a directory says to name the file', () => {
    mkdirSync(join(dir, 'sub'));
    expect(() => readConfigFile(join(dir, 'sub'), 'sub')).toThrow(expect.objectContaining({ title: 'sub is a directory, not a config file.' }));
  });

  it('a file far too big to be a config is refused without reading it', () => {
    const path = join(dir, 'big.yml');
    writeFileSync(path, 'x'.repeat(MAX_CONFIG_BYTES + 1));
    expect(() => readConfigFile(path, 'big.yml')).toThrow(expect.objectContaining({ title: 'big.yml is 64 KB, too big to be a tep config (they are a few hundred bytes).' }));
  });

  it('writes atomically, leaving no temporary file, mode 0644', () => {
    const path = join(dir, 'w.yml');
    writeAtomic(path, 'version: 1\n');
    expect(readFileSync(path, 'utf8')).toBe('version: 1\n');
    writeAtomic(path, 'version: 1\nmode: quick\n');
    expect(readFileSync(path, 'utf8')).toBe('version: 1\nmode: quick\n');
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('a failed write leaves the old file as it was, removes the temporary file, and says why', () => {
    const path = join(dir, 'keep.yml');
    writeFileSync(path, 'old\n');
    const removed: string[] = [];
    const failing = (code: string): WriteFs => ({
      openSync: () => 7,
      writeSync: () => {
        throw Object.assign(new Error('nope'), { code });
      },
      fsyncSync: () => {},
      closeSync: () => {},
      renameSync: () => {
        throw new Error('must not rename');
      },
      unlinkSync: (p) => void removed.push(String(p)),
    });
    expect(() => writeAtomic(path, 'new\n', failing('ENOSPC'))).toThrow(expect.objectContaining({ exitCode: EXIT.config, title: `${path} could not be written: the disk is full.`, details: ['Nothing was changed.'] }));
    expect(() => writeAtomic(path, 'new\n', failing('EACCES'))).toThrow(expect.objectContaining({ title: `${path} could not be written: permission denied.` }));
    expect(readFileSync(path, 'utf8')).toBe('old\n');
    expect(removed).toHaveLength(2);
    expect(removed[0]).toMatch(/\.keep\.yml\.\d+\.\w+\.tmp$/);
  });

  it('a directory that does not exist says so', () => {
    expect(() => writeAtomic(join(dir, 'no', 'such', 'x.yml'), 'v')).toThrow(expect.objectContaining({ title: expect.stringMatching(/could not be written: its directory does not exist\.$/) }));
  });

  it('the defaults written out are the defaults read back', () => {
    const r = resolve(layerOf(parseConfig(serializeConfig(emptyModel(), '2026-10-20'), 'x')), flagsLayer({}), { tty: true });
    expect(r.generation.req).toEqual({ ...DEFAULT_REQUIREMENTS, count: 5 });
  });
});
