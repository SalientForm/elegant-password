import { describe, expect, it } from 'vitest';
import { checkConfig, valueAt, type CheckProblem } from './check';
import { int } from './fields';
import { emptyModel } from './model';

/** The problems a configuration has, as key path and message (and code, when it has one). */
function problems(data: unknown): Pick<CheckProblem, 'path' | 'message' | 'code'>[] {
  const r = checkConfig(data);
  if (r.ok) throw new Error('expected the configuration to be refused');
  return r.problems.map((p) => ({ path: p.path, message: p.message, ...(p.code ? { code: p.code } : {}) }));
}

describe('checkConfig: a configuration as plain data', () => {
  it('reads every section into the engine\'s terms', () => {
    const r = checkConfig({
      version: 2,
      'app-mode': 'sentences',
      'typing-mode': 'two-finger',
      site: 'short-max-16',
      rules: { 'max-length': 14, symbols: '!@#' },
      options: { swaps: 3, separator: 'space', strength: 'strong' },
      sentence: { shrink: 'keep', 'target-length': 'none' },
      swaps: { off: ['a>@'], custom: [{ from: 'cat', to: 'k@' }] },
    });
    expect(r).toEqual({
      ok: true,
      config: {
        appMode: 'sentences',
        typingMode: 'two-finger',
        site: 'short-max-16',
        rules: { 'max-length': 14, symbols: '!@#' },
        options: { swaps: 3, separator: ' ', strength: 50 },
        sentence: { shrink: 'none', 'target-length': null },
        swaps: { disabled: ['a>@'], custom: [{ from: 'cat', to: 'k@' }] },
      },
    });
  });

  it('reads version 1, its mode as the typing mode and its app mode left unstated, as version 2 reads the same', () => {
    const v1 = checkConfig({ version: 1, mode: 'quick', site: 'no-spaces', options: { swaps: 2 } });
    expect(v1).toEqual({ ok: true, config: { ...emptyModel(), typingMode: 'quick', site: 'no-spaces', options: { swaps: 2 } } });
    expect(checkConfig({ version: 2, 'typing-mode': 'quick', site: 'no-spaces', options: { swaps: 2 } })).toEqual(v1);
    expect(checkConfig({ version: 1 })).toEqual(checkConfig({ version: 2 }));
  });

  it('names a key of the other version as such, not as an unknown key', () => {
    expect(problems({ version: 2, mode: 'quick' })).toEqual([{ path: ['mode'], message: '"mode" is version 1\'s name for the typing mode; version 2 calls it typing-mode.' }]);
    expect(problems({ version: 1, 'typing-mode': 'quick', 'app-mode': 'sentences' })).toEqual([
      { path: ['app-mode'], message: '"app-mode" is a version 2 key, and this configuration is version 1. Write "version: 2" to use it.' },
      { path: ['typing-mode'], message: '"typing-mode" is a version 2 key, and this configuration is version 1, where the typing mode is "mode". Write "version: 2" to use it.' },
    ]);
    // Said with the shape's problems when those stop the check, and after the version when there is none.
    expect(problems({ version: 2, mode: 'quick', rule: {} }).map((p) => p.path.join('.'))).toEqual(['mode', 'rule']);
    expect(problems({ mode: 'quick' }).map((p) => p.path.join('.'))).toEqual(['version', 'mode']);
  });

  it('takes options: preset, no options, and empty sections as stating nothing', () => {
    expect(checkConfig({ version: 1 })).toEqual({ ok: true, config: emptyModel() });
    expect(checkConfig({ version: 1, options: 'preset', rules: null, sentence: null, swaps: null })).toEqual({ ok: true, config: emptyModel() });
  });

  it('an empty configuration, with a code and no front end named', () => {
    for (const data of [undefined, null, '']) {
      expect(problems(data)).toEqual([{ path: [], message: 'the configuration is empty. It starts with "version: 2".', code: 'empty' }]);
    }
  });

  it('a configuration that is not a map', () => {
    expect(problems([1, 2])).toEqual([{ path: [], message: 'the file must be a map of keys (version: 2, typing-mode: ..., rules: ...), not a list' }]);
    expect(problems('hello')[0]!.message).toMatch(/not the text "hello"$/);
  });

  it('no version, a newer one with a code, a wrong one', () => {
    expect(problems({})).toEqual([{ path: ['version'], message: 'the file has no version. Add "version: 2" as its first line.' }]);
    const newer = checkConfig({ version: 3 });
    expect(newer.ok || newer.problems).toEqual([{ path: ['version'], message: 'version 3 was written by a newer release; this one reads versions 1 and 2.', code: 'newer-version', version: 3 }]);
    expect(problems({ version: 'one' })).toEqual([{ path: ['version'], message: 'version must be 1 or 2; found the text "one".' }]);
    expect(problems({ version: 1.5 })).toEqual([{ path: ['version'], message: 'version must be 1 or 2; found 1.5.' }]);
    expect(problems({ version: 0 })).toEqual([{ path: ['version'], message: 'version must be 1 or 2; found 0.' }]);
  });

  it('unknown keys at the key itself, with the likeliest one meant and the ones there are', () => {
    const r = checkConfig({ version: 1, rule: {} });
    expect(r.ok || r.problems).toEqual([
      { path: ['rule'], key: true, message: 'unknown key "rule" in the top level. Did you mean rules? The keys there are: version, mode, site, rules, options, sentence, swaps.' },
    ]);
    expect(problems({ version: 1, output: { count: 2 } })[0]!.message).toMatch(/^unknown key "output" in the top level\. The keys there are: version, mode, site, rules, options, sentence, swaps\.$/); // tep's, not the core's
    expect(problems({ version: 2, typing: 'quick' })[0]!.message).toBe('unknown key "typing" in the top level. Did you mean typing-mode? The keys there are: version, app-mode, typing-mode, site, rules, options, sentence, swaps.');
    expect(problems({ version: 1, rules: { 'max-lenght': 30 } })).toEqual([
      { path: ['rules', 'max-lenght'], message: 'unknown key "max-lenght" in rules. Did you mean max-length? The keys there are: min-length, max-length, min-uppercase, min-lowercase, min-digits, min-symbols, symbols, spaces.' },
    ]);
    expect(problems({ version: 1, options: { swap: 2 } })[0]).toMatchObject({ path: ['options', 'swap'], message: expect.stringMatching(/^unknown key "swap" in options\. Did you mean swaps\?/) });
    expect(problems({ version: 1, swaps: { of: [] } })[0]).toMatchObject({ path: ['swaps', 'of'], message: expect.stringMatching(/^unknown key "of" in swaps\. Did you mean off\?/) });
  });

  it('a section of the wrong type, saying what was found', () => {
    expect(problems({ version: 1, rules: 12 })).toEqual([{ path: ['rules'], message: 'rules must be a map of keys; found 12.' }]);
    expect(problems({ version: 1, swaps: { off: 'a>@' } })).toEqual([{ path: ['swaps', 'off'], message: 'swaps.off must be a list; found the text "a>@".' }]);
    expect(problems({ version: 1, options: [1] })).toEqual([{ path: ['options'], message: 'options must be "preset" (the typing mode\'s own options) or a map of option values; found a list.' }]);
  });

  it('an unknown mode or site preset, or one of the wrong type', () => {
    expect(problems({ version: 1, mode: 'two-fingers' })).toEqual([
      { path: ['mode'], message: 'mode: "two-fingers" is not a typing mode. The typing modes are: two-finger, ten-finger, one-handed, quick (or minimal-quick). Did you mean two-finger?' },
    ]);
    expect(problems({ version: 2, 'typing-mode': 'two-fingers' })[0]).toMatchObject({ path: ['typing-mode'], message: expect.stringMatching(/^typing-mode: "two-fingers" is not a typing mode\./) });
    expect(problems({ version: 2, 'app-mode': 'sentence' })).toEqual([{ path: ['app-mode'], message: 'app-mode: "sentence" is not an app mode. The app modes are: sentences. Did you mean sentences?' }]);
    expect(problems({ version: 2, 'app-mode': 2 })).toEqual([{ path: ['app-mode'], message: 'app-mode: the app mode must be one of sentences' }]);
    expect(problems({ version: 1, site: 3 })[0]).toMatchObject({ path: ['site'], message: expect.stringMatching(/^site: the site preset must be one of typical-site, /) });
  });

  it('values out of range or of the wrong kind, each at its key path, naming its setting', () => {
    const r = checkConfig({ version: 1, rules: { 'min-length': 0, spaces: 'yes' }, options: { comfort: 3 }, sentence: { 'shrink-from': 'four' } });
    expect(r.ok || r.problems.map((p) => [p.path.join('.'), p.message, p.field?.name])).toEqual([
      ['rules.min-length', 'rules.min-length must be from 1 to 128; found 0.', 'min-length'],
      ['rules.spaces', 'rules.spaces must be true or false; found "yes".', 'spaces'],
      ['sentence.shrink-from', 'sentence.shrink-from must be a whole number from 2 to 20; found "four".', 'shrink-from'],
      ['options.comfort', 'options.comfort must be one of strict, balanced, relaxed; found 3.', 'comfort'],
    ]);
  });

  it('options as a map: each value checked, in the field table\'s order, the preset left behind', () => {
    expect(checkConfig({ version: 1, options: { glue: true } })).toEqual({ ok: true, config: { ...emptyModel(), options: { glue: true } } });
    expect(problems({ version: 1, options: { glue: 'yes', initials: 99 } }).map((p) => p.path.join('.'))).toEqual(['options.initials', 'options.glue']);
  });

  it('bad swaps, each at its entry, numbered from one, duplicates naming the first', () => {
    expect(
      problems({
        version: 1,
        swaps: {
          off: ['zz>q', 3],
          custom: [{ from: 'PH', to: 'f' }, 'ph', { from: 'cat', to: 'k@' }, { from: 'cat', to: 'k@' }, { from: 'o', to: 0 }, { from: 'ph', to: 'f' }],
        },
      }).map((p) => [p.path.join('.'), p.message]),
    ).toEqual([
      ['swaps.off.1', 'swaps.off entry 2 must be a built-in swap written "from>to", such as "a>@"; found 3.'],
      ['swaps.custom.1', 'swaps.custom entry 2 must be a map with "from" and "to", such as { from: ph, to: f }; found the text "ph".'],
      ['swaps.custom.4.to', 'swaps.custom entry 5: "to" must be text; found 0. Put it in double quotes, as in to: "0".'],
      ['swaps.off.0', 'swaps.off entry 1: "zz>q" is not a built-in swap. Built-in swaps are written "from>to", such as "a>@" or "ph>f".'],
      ['swaps.custom.0', 'swaps.custom entry 1: PH>f: Replace: 1-8 lowercase letters.'],
      ['swaps.custom.3', 'swaps.custom entry 4: cat>k@ is listed twice (also entry 3).'],
      ['swaps.custom.5', 'swaps.custom entry 6: ph>f is a built-in swap already, so it needs no custom entry.'],
    ]);
  });

  it('every problem at once, across sections', () => {
    expect(problems({ mode: 'x', rules: { 'max-length': 999 }, sentence: { drop: 1 } }).map((p) => p.path.join('.'))).toEqual(['version', 'mode', 'rules.max-length', 'sentence.drop']);
  });

  it('a front end\'s own section, checked as the core\'s are and listed after them', () => {
    const output = [{ name: 'count', kind: int(1, 20) }];
    expect(checkConfig({ version: 1, output: { count: 3 } }, { output })).toEqual({ ok: true, config: { ...emptyModel(), output: { count: 3 } } });
    expect(checkConfig({ version: 1 }, { output })).toEqual({ ok: true, config: { ...emptyModel(), output: {} } });
    const r = checkConfig({ version: 1, outpt: {}, output: { count: 50, cuont: 1 } }, { output });
    expect(r.ok || r.problems.map((p) => p.message).sort()).toEqual([
      'unknown key "cuont" in output. Did you mean count? The keys there are: count.',
      'unknown key "outpt" in the top level. Did you mean output? The keys there are: version, mode, site, rules, options, sentence, swaps, output.',
    ]);
    const range = checkConfig({ version: 1, output: { count: 50 } }, { output });
    expect(range.ok || range.problems.map((p) => [p.path, p.message])).toEqual([[['output', 'count'], 'output.count must be from 1 to 20; found 50.']]);
  });
});

describe('valueAt', () => {
  it('finds a value by its key path, or nothing', () => {
    const data = { swaps: { custom: [{ from: 'ph', to: 'f' }] } };
    expect(valueAt(data, ['swaps', 'custom', 0, 'to'])).toBe('f');
    expect(valueAt(data, [])).toBe(data);
    expect(valueAt(data, ['rules', 'max-length'])).toBeUndefined();
  });
});
