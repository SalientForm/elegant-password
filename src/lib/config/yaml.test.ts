import { describe, expect, it } from 'vitest';
import { int } from './fields';
import { emptyModel } from './model';
import { MAX_CONFIG_BYTES } from './version';
import { configFromYaml, type YamlProblem } from './yaml';

/** The problems a text has. */
function problems(text: string): YamlProblem[] {
  const r = configFromYaml(text);
  if (r.ok) throw new Error('expected the text to be refused');
  return r.problems;
}

describe('configFromYaml: a configuration as YAML text', () => {
  const text = `# a comment
version: 2
typing-mode: two-finger
site: short-max-16
rules:
  max-length: 14
  symbols: "!@#"
options:
  swaps: 3
sentence:
  shrink: ends
swaps:
  off: [a>@]
`;

  it('reads every section, with the line each key is set on: a value\'s own, a section\'s key', () => {
    const r = configFromYaml(text);
    expect(r.ok && r.config).toEqual({
      typingMode: 'two-finger',
      site: 'short-max-16',
      rules: { 'max-length': 14, symbols: '!@#' },
      options: { swaps: 3 },
      sentence: { shrink: 'ends' },
      swaps: { disabled: ['a>@'], custom: [] },
    });
    expect(r.ok && r.lines).toMatchObject({ version: 2, 'typing-mode': 3, site: 4, rules: 5, 'rules.max-length': 6, 'rules.symbols': 7, 'options.swaps': 9, 'sentence.shrink': 11, swaps: 12 });
  });

  it('puts a key of the other version on its own line', () => {
    expect(problems('version: 2\nsite: no-spaces\nmode: quick\n')).toEqual([
      { path: 'mode', line: 3, message: '"mode" is version 1\'s name for the typing mode; version 2 calls it typing-mode.' },
    ]);
  });

  it('gives each problem its key path and line, in line order', () => {
    expect(problems('version: 1\nrules:\n  max-lenght: 30\nmod: x\n').map(({ path, line }) => [path, line])).toEqual([
      ['rules.max-lenght', 3],
      ['mod', 4],
    ]);
    expect(problems('version: 1\nrules:\n  min-length: 0\n  max-length: 999\n')).toEqual([
      { path: 'rules.min-length', line: 3, message: 'rules.min-length must be from 1 to 128; found 0.' },
      { path: 'rules.max-length', line: 4, message: 'rules.max-length must be from 1 to 128; found 999.' },
    ]);
  });

  it('puts an unknown section on its key\'s line, a swap on its entry\'s, and no version on the first', () => {
    expect(problems('version: 1\nrule:\n  max-length: 3\n')[0]).toMatchObject({ path: 'rule', line: 2 });
    expect(problems('version: 1\nswaps:\n  custom:\n    - { from: a, to: b }\n    - { from: o, to: 0 }\n')[0]).toMatchObject({ path: 'swaps.custom.1.to', line: 5 });
    expect(problems('\n\nmode: quick\n')[0]).toMatchObject({ path: 'version', line: 1 });
  });

  it('empty text, or only a comment, has a code', () => {
    for (const t of ['', '# only a comment\n', '""\n']) expect(problems(t)).toEqual([{ line: 1, message: 'the configuration is empty. It starts with "version: 2".', code: 'empty' }]);
  });

  it('a newer version has a code and the version, worded for no front end', () => {
    expect(problems('version: 3\n')).toEqual([{ path: 'version', line: 1, message: 'version 3 was written by a newer release; this one reads versions 1 and 2.', code: 'newer-version', version: 3 }]);
  });

  it('a top level that is not a map, on its own line', () => {
    expect(problems('# a list\n- 1\n')).toEqual([{ line: 2, message: 'the file must be a map of keys (version: 2, typing-mode: ..., rules: ...), not a list' }]);
  });

  it('refuses anchors and aliases with a code, the name and the quoting hint, a tag with how to quote it', () => {
    expect(problems('version: 1\noptions: &loop\n  separator: *loop\n')).toEqual([
      { line: 2, message: '"&loop" is a YAML anchor, and anchors are not supported in a configuration. Take it out.', code: 'anchor', name: 'loop', hint: undefined },
      { line: 3, message: expect.stringMatching(/^"\*loop" is a YAML alias, and aliases are not supported in a configuration\. Write the value itself\. Symbols such as/), code: 'alias', name: 'loop', hint: expect.stringContaining('separator: ";"') },
    ]);
    const [anchor] = problems('version: 1\nrules:\n  min-length: &n 12\n');
    expect(anchor).toMatchObject({ code: 'anchor', name: 'n', line: 3, hint: expect.stringMatching(/^Symbols such as/) });
    const [tag] = problems('version: 1\nrules:\n  symbols: !@#$\n');
    expect(tag).toMatchObject({ line: 3, message: expect.stringMatching(/^Unresolved tag: !@#\$: a value starting with "!" is read as a YAML tag, not as text\. .*symbols: "!@#\$%"/) });
    expect(tag!.code).toBeUndefined();
  });

  it('a key twice, and YAML that does not parse', () => {
    expect(problems('version: 1\nmode: quick\nmode: two-finger\n')).toEqual([{ line: 3, message: 'a key appears twice in the same section; keep one' }]);
    expect(problems('version: 1\nrules: [1, 2\n')[0]!.code).toBeUndefined();
  });

  it('says a symbol list or separator read as nothing may be an unquoted "#"', () => {
    expect(problems('version: 1\noptions:\n  separator: #\n')[0]!.message).toMatch(
      /^options\.separator must be auto, space, none, or one symbol such as ";"; found null\. A "#" after a space starts a comment in YAML, so the value was read as nothing\. Symbols such as .* as in options\.separator: ";"/,
    );
    expect(configFromYaml('version: 1\nrules:\n  symbols: null\n').ok).toBe(false);
    expect(problems('version: 1\nrules:\n  max-length: null\n')[0]!.message).toBe('rules.max-length must be a whole number from 1 to 128; found null.'); // not a symbol setting: no hint
  });

  it('refuses text far too big to be a configuration, without parsing it', () => {
    const big = `version: 1\n#${'x'.repeat(MAX_CONFIG_BYTES)}\n`;
    expect(problems(big)).toEqual([{ line: 1, message: 'the text is 64 KB, too big to be a configuration (they are a few hundred bytes).', code: 'too-big', bytes: big.length }]);
  });

  it('checks a front end\'s own section too, with its lines', () => {
    const output = { output: [{ name: 'count', kind: int(1, 20) }] };
    const r = configFromYaml('version: 1\noutput:\n  count: 2\n', output);
    expect(r).toEqual({ ok: true, config: { ...emptyModel(), output: { count: 2 } }, lines: { version: 1, output: 2, 'output.count': 3 } });
    const bad = configFromYaml('version: 1\noutput:\n  count: 50\n', output);
    expect(bad.ok || bad.problems).toEqual([{ path: 'output.count', line: 3, message: 'output.count must be from 1 to 20; found 50.' }]);
  });
});
