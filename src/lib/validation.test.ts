import { describe, expect, it } from 'vitest';
import { automaticSeparator, DEFAULT_REQUIREMENTS, generate, type Requirements } from './generate';
import { seeded } from './testRandom';
import { allowedSymbolSet, ignoredSymbols, RequirementsError, ruleProblems, separatorProblem, validate } from './validation';

const req = (over: Partial<Requirements> | Record<string, unknown>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over }) as Requirements;
/** The fields of each problem, for compact expectations. */
const fieldsOf = (over: Partial<Requirements> | Record<string, unknown>) => ruleProblems(req(over)).map((p) => p.fields);
const messages = (over: Partial<Requirements> | Record<string, unknown>) => ruleProblems(req(over)).map((p) => p.message);

describe('ruleProblems', () => {
  it('finds nothing in the defaults', () => {
    expect(ruleProblems(DEFAULT_REQUIREMENTS)).toEqual([]);
  });

  it('length: each bound a whole number from 1 to 256, and the minimum not above the maximum', () => {
    for (const bad of [0, -3, 1.5, 257, Number.NaN, '12']) {
      expect(fieldsOf({ minLength: bad }), String(bad)).toEqual([['minLength']]);
      expect(fieldsOf({ maxLength: bad, minLength: 1 }), String(bad)).toContainEqual(['maxLength']);
    }
    expect(fieldsOf({ minLength: 40, maxLength: 32 })).toEqual([['minLength', 'maxLength']]);
    expect(messages({ minLength: 40, maxLength: 32 })).toEqual(['The minimum length (40) is above the maximum (32).']);
    expect(fieldsOf({ minLength: 32, maxLength: 32 })).toEqual([]);
  });

  it('must contain: each count a whole number in its range', () => {
    expect(fieldsOf({ minUppercase: 9 })).toEqual([['minUppercase']]);
    expect(fieldsOf({ minDigits: 5 })).toEqual([['minDigits']]);
    expect(fieldsOf({ minSymbols: -1 })).toEqual([['minSymbols']]);
    expect(fieldsOf({ minDigits: 1.5 })).toEqual([['minDigits']]);
    expect(messages({ minSymbols: 9 })).toEqual(['Symbols must be a whole number from 0 to 8.']);
  });

  it('must contain: the required characters fit within the maximum, one character to a rule', () => {
    expect(fieldsOf({ minLength: 8, maxLength: 10, minUppercase: 8, minDigits: 4, minSymbols: 1 })).toEqual([['maxLength', 'minUppercase', 'minDigits', 'minSymbols']]);
    expect(messages({ minLength: 8, maxLength: 10, minUppercase: 8, minDigits: 4, minSymbols: 1 })).toEqual([
      '8 uppercase letters + 4 digits + 1 symbol need at least 13 characters, more than the maximum of 10.',
    ]);
    // Only the rules in force are named, and exactly enough room is fine.
    expect(fieldsOf({ minLength: 2, maxLength: 3, minUppercase: 0, minDigits: 2, minSymbols: 2 })).toEqual([['maxLength', 'minDigits', 'minSymbols']]);
    expect(fieldsOf({ minLength: 2, maxLength: 4, minUppercase: 0, minDigits: 2, minSymbols: 2 })).toEqual([]);
  });

  it('site allows: symbols required but none the tool can type', () => {
    expect(fieldsOf({ minSymbols: 1, allowedSymbols: '' })).toEqual([['allowedSymbols', 'minSymbols']]);
    expect(messages({ minSymbols: 2, allowedSymbols: '' })[0]).toBe(
      '2 symbols are required, but no symbols are allowed. List the symbols the site accepts, or untick Symbols under Must contain.',
    );
    // Letters, digits, spaces and symbols off the keyboard are not symbols the tool can use.
    expect(messages({ minSymbols: 1, allowedSymbols: 'ab 1é' })[0]).toMatch(/^A symbol is required, but no symbols are allowed \(none of ab 1é is a keyboard symbol\)/);
    expect(fieldsOf({ minSymbols: 0, allowedSymbols: '' })).toEqual([]);
    expect(fieldsOf({ minSymbols: 1, allowedSymbols: 'é!' })).toEqual([]);
    expect(fieldsOf({ allowedSymbols: 42 })).toContainEqual(['allowedSymbols']);
  });

  it('separator: one the rules allow, or Automatic or none, which always are', () => {
    expect(fieldsOf({ separator: ';', allowedSymbols: '!@#' })).toEqual([['separator']]);
    expect(messages({ separator: ';', allowedSymbols: '!@#' })).toEqual(['";" is chosen as the separator, but it is not an allowed symbol. Choose Auto to use one the site allows.']);
    expect(messages({ separator: ' ', allowSpaces: false })).toEqual(['Space is chosen as the separator, but spaces are not allowed. Choose Auto to use one the site allows.']);
    expect(messages({ separator: 'x' })).toEqual(['The separator must be a symbol or a space, not a letter or digit.']);
    expect(messages({ separator: ';;' })).toEqual(['The separator must be a single character.']);
    expect(messages({ separator: 'é', allowedSymbols: 'é!' })).toEqual(['"é" is not on a standard keyboard.']);
    expect(fieldsOf({ separator: 7 })).toEqual([['separator']]);
    for (const separator of ['auto', '']) {
      expect(fieldsOf({ separator, allowedSymbols: '', minSymbols: 0, allowSpaces: false })).toEqual([]);
    }
  });

  it('strength, comfort, shapes, swaps and the count stay in their ranges', () => {
    expect(fieldsOf({ targetBits: -1 })).toEqual([['targetBits']]);
    expect(fieldsOf({ targetBits: 257 })).toEqual([['targetBits']]);
    expect(fieldsOf({ targetBits: Number.NaN })).toEqual([['targetBits']]);
    expect(fieldsOf({ targetBits: 0 })).toEqual([]);
    expect(fieldsOf({ comfort: 'weird' })).toEqual([['comfort']]);
    expect(fieldsOf({ initials: 4 })).toEqual([['initials']]);
    expect(fieldsOf({ shorthand: -1 })).toEqual([['shorthand']]);
    expect(fieldsOf({ madeUp: 1.5 })).toEqual([['madeUp']]);
    expect(fieldsOf({ twists: 4 })).toEqual([['twists']]);
    expect(fieldsOf({ count: 0 })).toEqual([['count']]);
    expect(fieldsOf({ count: 21 })).toEqual([['count']]);
  });

  it('lists every problem at once, in form order', () => {
    expect(fieldsOf({ minLength: 40, maxLength: 32, minSymbols: 1, allowedSymbols: '', separator: ' ', allowSpaces: false, count: 0 })).toEqual([
      ['minLength', 'maxLength'],
      ['allowedSymbols', 'minSymbols'],
      ['separator'],
      ['count'],
    ]);
  });

  it('is what the engine checks: validate throws the first problem, so nothing is ever made from a contradiction', () => {
    expect(() => validate(DEFAULT_REQUIREMENTS)).not.toThrow();
    expect(() => validate(req({ minLength: 40, maxLength: 32, count: 0 }))).toThrow(new RequirementsError('The minimum length (40) is above the maximum (32).'));
    expect(() => generate(req({ minSymbols: 1, allowedSymbols: '' }))).toThrow(/no symbols are allowed/);
  });
});

describe('the symbols field', () => {
  it('uses keyboard symbols once each, and names everything else as not used', () => {
    expect(allowedSymbolSet({ allowedSymbols: '!!@a1 é#' })).toEqual(['!', '@', '#']);
    expect(ignoredSymbols('!!@a1 é#')).toEqual(['a', '1', ' ', 'é']);
    expect(ignoredSymbols(DEFAULT_REQUIREMENTS.allowedSymbols)).toEqual([]);
  });
});

describe('the Automatic separator', () => {
  it('is ";" whenever allowed, else a space, else "." or ",", else none', () => {
    expect(automaticSeparator(DEFAULT_REQUIREMENTS)).toBe(';');
    expect(automaticSeparator(req({ allowedSymbols: '!@#$%&*' }))).toBe(' ');
    expect(automaticSeparator(req({ allowedSymbols: '!@#.,', allowSpaces: false }))).toBe('.');
    expect(automaticSeparator(req({ allowedSymbols: '!@#,', allowSpaces: false }))).toBe(',');
    expect(automaticSeparator(req({ allowedSymbols: '!@#-', allowSpaces: false }))).toBe(''); // "-" is a pinky stretch
    expect(automaticSeparator(req({ allowedSymbols: '!@#-', allowSpaces: false, avoidPinkyStretch: false }))).toBe('-');
    expect(automaticSeparator(req({ allowedSymbols: '', allowSpaces: false, minSymbols: 0 }))).toBe('');
  });

  it('always resolves to a separator the rules allow, whatever the rules', () => {
    const rng = seeded(7);
    const pick = <T,>(xs: readonly T[]) => xs[rng.uint32() % xs.length]!;
    for (let i = 0; i < 300; i++) {
      const r = req({
        allowedSymbols: pick(['', ';', '.', '!@#', '-_', ';.,', '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~', 'é', 'ab']),
        allowSpaces: pick([true, false]),
        avoidPinkyStretch: pick([true, false]),
        minSymbols: 0,
      });
      expect(separatorProblem(automaticSeparator(r), r), JSON.stringify(r)).toBeUndefined();
    }
  });

  it('is the default, and makes the same passwords the old ";" default made', () => {
    expect(DEFAULT_REQUIREMENTS.separator).toBe('auto');
    const auto = generate(DEFAULT_REQUIREMENTS, { rng: seeded(11) });
    const semicolon = generate({ ...DEFAULT_REQUIREMENTS, separator: ';' }, { rng: seeded(11) });
    expect(auto.plan.separator).toBe(';');
    expect(auto.suggestions.map((s) => s.password)).toEqual(semicolon.suggestions.map((s) => s.password));
  });
});
