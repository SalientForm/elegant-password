import { describe, expect, it } from 'vitest';
import { problemsOf, warningsOf } from '../lib/consistency';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { explainProblem, explainWarning, largestWorkingCount, largestWorkingMin, renderExplained, smallestMaxForTarget, smallestWorkingMax } from './messages';
import { resolve, type Layer } from './resolve';
import { describeSource, howToChange } from './sources';
import { fieldNamed } from './fields';
import { fileAt, fileLayer, flag, flagsLayer } from './testing';

/** The one problem these layers lead to, explained. */
function explainOne(file: Layer | undefined, flags: Layer) {
  const r = resolve(file, flags, { tty: true });
  const problems = problemsOf(r.generation.req);
  expect(problems, JSON.stringify(problems)).toHaveLength(1);
  return explainProblem(problems[0]!, r.generation.req, { source: (f) => r.sources[f.name]! });
}

const ok = (req: Requirements) => problemsOf(req).length === 0;

describe('every contradiction, explained', () => {
  it('min-above-max: both values, where each came from, and how far to move either', () => {
    const e = explainOne(fileLayer({ 'rules.min-length': 20 }), flagsLayer({ 'max-length': 16 }));
    expect(e).toEqual({
      title: 'The minimum length (20) is above the maximum length (16).',
      values: ['minimum length: 20 (from tep.yml line 3 (rules.min-length))', 'maximum length: 16 (from --max-length)'],
      fix: 'Lower the minimum length to 16 or less (rules.min-length in tep.yml (line 3)), or raise the maximum length to 20 or more (--max-length).',
    });
  });

  it('counts-exceed-max: the counts that need the room, the total, and each way out', () => {
    const e = explainOne(undefined, flagsLayer({ 'min-uppercase': 8, 'min-digits': 4, 'min-symbols': 8, 'max-length': 16 }));
    expect(e.title).toBe('8 uppercase letters, 4 digits and 8 symbols need at least 20 characters, more than the maximum length of 16.');
    expect(e.values).toEqual([
      'maximum length: 16 (from --max-length)',
      'required uppercase letters: 8 (from --min-uppercase)',
      'required digits: 4 (from --min-digits)',
      'required symbols: 8 (from --min-symbols)',
    ]);
    expect(e.fix).toBe(
      'Raise the maximum length to 20 or more (--max-length), or require fewer: required uppercase letters (--min-uppercase), required digits (--min-digits) or required symbols (--min-symbols).',
    );
  });

  it('counts-exceed-max names a preset\'s values as the preset\'s, changed where the preset was chosen', () => {
    const e = explainOne(undefined, flagsLayer({ 'min-length': 1, 'max-length': 2 }, { site: 'typical-site' }));
    expect(e.title).toBe('1 uppercase letter, 1 digit and 1 symbol need at least 3 characters, more than the maximum length of 2.');
    expect(e.values[1]).toBe('required uppercase letters: 1 (from the typical-site site preset, chosen by --site)');
  });

  it('symbols-none-allowed', () => {
    const e = explainOne(undefined, flagsLayer({ symbols: '', 'min-symbols': 2 }));
    expect(e).toEqual({
      title: '2 symbols are required, but no symbols are allowed.',
      values: ['required symbols: 2 (from --min-symbols)', 'allowed symbols: none (from --symbols)'],
      fix: 'List the symbols the site accepts (--symbols), such as "!@#$%", or require none (set --min-symbols to 0).',
    });
    expect(explainOne(undefined, flagsLayer({ symbols: '', 'min-symbols': 1 })).title).toBe('A symbol is required, but no symbols are allowed.');
  });

  it('separator-not-allowed: a space where spaces are not allowed', () => {
    const e = explainOne(undefined, flagsLayer({ spaces: false, separator: ' ' }));
    expect(e).toEqual({
      title: 'The separator is a space, but spaces are not allowed.',
      values: ['separator: a space (from --separator)', 'spaces: not allowed (from --spaces)'],
      fix: 'Set the separator to auto, which always picks one the rules allow (--separator), or allow spaces (--spaces).',
    });
  });

  it('separator-not-allowed: a symbol the site does not take, listing the ones it does', () => {
    const e = explainOne(fileLayer({ 'options.separator': '.' }), flagsLayer({ symbols: '!@' }));
    expect(e.title).toBe('The separator is ".", which is not one of the allowed symbols ("!@").');
    expect(e.values).toEqual(['separator: "." (from tep.yml line 3 (options.separator))', 'allowed symbols: "!@" (from --symbols)']);
    expect(e.fix).toBe('Set the separator to auto, which always picks one the rules allow (options.separator in tep.yml (line 3)), or allow "." (--symbols).');
  });

  it('separator-invalid: the core\'s reason, and what a separator can be', () => {
    const req = { ...DEFAULT_REQUIREMENTS, separator: 'ab' };
    const [p] = problemsOf(req);
    const e = explainProblem(p!, req, { source: () => flag('separator') });
    expect(e.title).toBe('The separator must be a single character.');
    expect(e.fix).toBe('Set the separator to auto, space, none or one keyboard symbol (--separator).');
  });

  it('no-fit: the length window, and the nearest window that works, found by the engine', () => {
    const e = explainOne(undefined, flagsLayer({ 'min-length': 4, 'max-length': 6, 'min-uppercase': 0, 'min-digits': 0, 'min-symbols': 0 }));
    const req = { ...DEFAULT_REQUIREMENTS, minLength: 4, maxLength: 6, minUppercase: 0, minDigits: 0, minSymbols: 0 };
    const max = smallestWorkingMax(req)!;
    expect(e.title).toBe('No made-up sentence fits between 4 and 6 characters.');
    expect(e.values).toEqual(['minimum length: 4 (from --min-length)', 'maximum length: 6 (from --max-length)']);
    expect(e.fix).toBe(`Raise the maximum length to ${max} or more (--max-length). Or use your own sentence with --sentence -, which can be shortened further.`);
  });

  it('too-few-letters: every way to free letters, each with where to change it', () => {
    const e = explainOne(undefined, flagsLayer({ 'min-uppercase': 8, 'max-length': 12, initials: 3, 'two-letter': 3, 'made-up': 3 }));
    expect(e.title).toBe('No made-up sentence between 12 and 12 characters has 8 letters to capitalise.');
    expect(e.values).toHaveLength(5);
    expect(e.fix).toMatch(/^Raise the maximum length to \d+ or more \(--max-length\), require at most \d+ uppercase letters? \(--min-uppercase\), use fewer capital initials \(--initials\), use fewer two-letter words \(--two-letter\) or use fewer made-up nouns \(--made-up\)\.$/);
  });

  it('no-closing: the separator is the only symbol, so nothing can close the password', () => {
    const e = explainOne(undefined, flagsLayer({ symbols: ';', separator: ';', 'min-symbols': 8, 'max-length': 20 }));
    expect(e.title).toBe('8 symbols are required, but the only allowed symbol is the separator ";", and a password cannot end with its separator, so there is nothing to close it with.');
    expect(e.fix).toMatch(/^Allow another symbol \(--symbols\), choose another separator \(--separator\), or require at most \d+ symbols? \(--min-symbols\)\.$/);
  });

  it('range: a value out of range, named with where it came from', () => {
    const req = { ...DEFAULT_REQUIREMENTS, minLength: 0 };
    const [p] = problemsOf(req);
    const e = explainProblem(p!, req, { source: () => fileAt(4, 'rules.min-length') });
    expect(e.title).toBe('The minimum length must be a whole number from 1 to 256.');
    expect(e.fix).toBe('Change rules.min-length in tep.yml (line 4).');
  });

  it('renders as a title, then each value and the fix, indented', () => {
    const e = explainOne(fileLayer({ 'rules.min-length': 20 }), flagsLayer({ 'max-length': 16 }));
    expect(renderExplained(e)).toEqual([e.title, `  ${e.values[0]}`, `  ${e.values[1]}`, `  Fix: ${e.fix}`]);
  });
});

describe('the unreachable target, explained', () => {
  it('says how many bits the rules reach and the maximum length that would reach the target', () => {
    const r = resolve(undefined, flagsLayer({ 'max-length': 16, strength: 50 }), { tty: true });
    const [w] = warningsOf(r.generation.req);
    const e = explainWarning(w!, r.generation.req, { source: (f) => r.sources[f.name]! });
    const reach = smallestMaxForTarget(r.generation.req)!;
    expect(e.title).toBe(`The strength target, Strong (50 bits), is out of reach: these rules allow at most ${w!.reached.toFixed(1)} bits, so tep makes the strongest passwords they allow.`);
    expect(e.values).toEqual(['strength target: Strong (50 bits) (from --strength)', 'maximum length: 16 (from --max-length)']);
    expect(e.fix).toBe(`A maximum length of ${reach} would reach it (--max-length), or lower the target (--strength).`);
  });

  it('only suggests lowering the target when no length reaches it', () => {
    const r = resolve(undefined, flagsLayer({ strength: 256 }), { tty: true });
    const [w] = warningsOf(r.generation.req);
    expect(explainWarning(w!, r.generation.req, { source: (f) => r.sources[f.name]! }).fix).toBe('Lower the target (--strength).');
  });
});

describe('the searches behind the fixes', () => {
  const brute = (from: number, to: number, works: (n: number) => boolean) => {
    for (let n = from; from <= to ? n <= to : n >= to; n += from <= to ? 1 : -1) if (works(n)) return n;
    return undefined;
  };

  it('smallestWorkingMax and largestWorkingMin agree with trying every length', () => {
    for (const over of [
      { minLength: 4, maxLength: 6, minUppercase: 0, minDigits: 0, minSymbols: 0 },
      { minLength: 30, maxLength: 31, madeUp: 3, comfort: 'strict' as const },
      { minLength: 12, maxLength: 12, minUppercase: 6 },
    ]) {
      const req = { ...DEFAULT_REQUIREMENTS, ...over };
      expect(smallestWorkingMax(req), JSON.stringify(over)).toBe(brute(req.maxLength + 1, 256, (n) => ok({ ...req, maxLength: n })));
      expect(largestWorkingMin(req), JSON.stringify(over)).toBe(brute(req.minLength - 1, 1, (n) => ok({ ...req, minLength: n })));
    }
  });

  it('largestWorkingCount steps down to the first count that works', () => {
    const req = { ...DEFAULT_REQUIREMENTS, minUppercase: 8, maxLength: 12, initials: 3, shorthand: 3, madeUp: 3 };
    const n = largestWorkingCount(req, 'minUppercase');
    expect(n).toBe(brute(7, 0, (k) => ok({ ...req, minUppercase: k })));
  });
});

describe('sources', () => {
  const max = fieldNamed('max-length')!;
  it('read as phrases', () => {
    expect(describeSource({ kind: 'default' })).toBe('the default');
    expect(describeSource({ kind: 'terminal', tty: true })).toBe('the default at a terminal');
    expect(describeSource({ kind: 'terminal', tty: false })).toBe('the default when output is piped');
    expect(describeSource(flag('max-length'))).toBe('--max-length');
    expect(describeSource(fileAt(7, 'rules.max-length'))).toBe('tep.yml line 7 (rules.max-length)');
    expect(describeSource({ kind: 'site', preset: 'no-spaces', via: { kind: 'default' } })).toBe('the no-spaces site preset');
    expect(describeSource({ kind: 'mode', mode: 'quick', via: { kind: 'default' } })).toBe("the quick mode's preset, the default mode");
    expect(describeSource({ kind: 'mode', mode: 'quick', via: flag('mode') })).toBe("the quick mode's preset, chosen by --mode");
    expect(describeSource({ kind: 'rules-text', via: flag('rules') })).toBe('the rules text given to --rules');
    expect(describeSource({ kind: 'wizard', line: 3, label: 'Maximum length' })).toBe('line 3 (Maximum length)');
  });

  it('say how to change a value in the terms it was set in', () => {
    expect(howToChange(max, flag('max-length'))).toBe('--max-length');
    expect(howToChange(max, fileAt(7, 'rules.max-length'))).toBe('rules.max-length in tep.yml (line 7)');
    expect(howToChange(max, { kind: 'site', preset: 'x', via: fileAt(2, 'site', 'bank.yml') })).toBe('--max-length, or rules.max-length in bank.yml');
    expect(howToChange(max, { kind: 'site', preset: 'x', via: flag('site') })).toBe('--max-length');
    expect(howToChange(max, { kind: 'default' })).toBe('--max-length');
    expect(howToChange(max, { kind: 'wizard', line: 4, label: 'x' })).toBe('line 4');
  });
});
