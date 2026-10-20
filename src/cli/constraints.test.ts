import { describe, expect, it } from 'vitest';
import { problemsOf } from '../lib/consistency';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { profileValues } from '../lib/modeProfiles';
import { ALL_SYMBOLS } from '../lib/sitePresets';
import { fieldShape, LOOSEST, modeShape, noAnswers, optionsHowShape, problemsWith, reasonFor, reqOf, rulesHowShape, withField, type Answers, type NumberShape, type SelectShape } from './constraints';
import { fieldNamed } from './fields';

const F = (name: string) => fieldNamed(name)!;
const none = { lineOf: () => undefined };
const answers = (over: Partial<Answers>): Answers => ({ ...noAnswers(), ...over });

describe('reqOf', () => {
  it('fills what is unanswered with the loosest values', () => {
    const req = reqOf(noAnswers());
    expect(req).toMatchObject({ minLength: 1, maxLength: 256, minUppercase: 0, minDigits: 0, minSymbols: 0, allowedSymbols: ALL_SYMBOLS, allowSpaces: true, comfort: 'relaxed', madeUp: 0, glue: false, separator: 'auto' });
    expect(Object.keys(LOOSEST).sort()).toEqual(['avoid-pinky', 'comfort', 'ease-swaps', 'glue', 'initials', 'made-up', 'max-length', 'min-digits', 'min-length', 'min-symbols', 'min-uppercase', 'number', 'separator', 'shift-reach', 'shortest', 'spaces', 'strength', 'swaps', 'symbols', 'two-letter'].sort());
  });

  it('takes a site preset, then the values over it', () => {
    expect(reqOf(answers({ site: 'short-max-16', rules: { 'max-length': 14 } }))).toMatchObject({ minLength: 8, maxLength: 14, allowSpaces: false });
  });

  it('takes the mode\'s preset when options follow it, or the options set', () => {
    const preset = reqOf(answers({ mode: 'two-finger', site: 'typical-site', optionsHow: 'preset' }));
    expect(preset).toMatchObject(profileValues('two-finger', { allowSpaces: true }));
    expect(reqOf(answers({ optionsHow: 'each', options: { swaps: 3 } })).twists).toBe(3);
  });
});

describe('problemsWith', () => {
  it('finds nothing when some completion of what is unanswered works', () => {
    expect(problemsWith(noAnswers())).toEqual([]);
    expect(problemsWith(answers({ rules: { 'max-length': 16 } }))).toEqual([]);
    expect(problemsWith(answers({ rules: { 'max-length': 8 } })).map((p) => p.code)).toEqual(['no-fit']);
  });

  it('tries glue and no separator for an unanswered glue and separator, since neither way is always looser', () => {
    // A maximum so short that only words run together fit.
    const tight = answers({ rules: { 'min-length': 1, 'max-length': 7, 'min-uppercase': 0, 'min-digits': 0, 'min-symbols': 0 } });
    const loosestOnly = problemsOf(reqOf(tight));
    const anyWay = problemsWith(tight);
    expect(anyWay.length).toBeLessThanOrEqual(loosestOnly.length);
  });

  it('finds the contradiction in answers that have one', () => {
    expect(problemsWith(answers({ rules: { 'min-length': 20, 'max-length': 16 } })).map((p) => p.code)).toEqual(['min-above-max']);
  });
});

describe('the questions', () => {
  it('modes: all allowed while options are not chosen; with the preset, a mode whose preset contradicts the rules is not', () => {
    expect(modeShape(noAnswers(), none).choices.every((c) => !c.blocked)).toBe(true);
    // No symbols at all and one required: every preset still works, as they set no rules.
    const shape = modeShape(answers({ site: 'typical-site', optionsHow: 'preset' }), none);
    expect(shape.choices.every((c) => !c.blocked)).toBe(true);
  });

  it('site presets: one that contradicts an option answered is not allowed, with why', () => {
    const a = answers({ mode: 'ten-finger', optionsHow: 'each', options: { separator: ' ' } });
    const shape = rulesHowShape(a, none);
    const noSpaces = shape.choices.find((c) => c.label === 'No spaces')!;
    expect(noSpaces.blocked).toBe('The separator is a space, but spaces are not allowed (from your answer for separator)');
    expect(shape.choices.find((c) => c.label === 'Typical site')!.blocked).toBeUndefined();
    expect(shape.choices.slice(-2).map((c) => c.label)).toEqual(["Paste the site's rules", 'Set each rule']);
  });

  it('options: the mode\'s preset is not allowed when it contradicts the rules', () => {
    // Only "!" allowed, and the separator a space the rules forbid would come from the preset; two-finger resolves it to Auto, so it fits.
    const shape = optionsHowShape(answers({ mode: 'two-finger', site: 'no-spaces' }), none);
    expect(shape.choices.find((c) => c.value === 'preset')!.blocked).toBeUndefined();
  });

  it('counts: a count the other answers rule out is not allowed, with why, and the ones below it are', () => {
    // ";" is the only symbol and also the separator: it cannot close a password, so only so many symbols can be had.
    const a = answers({ rules: { symbols: ';', 'max-length': 20 }, optionsHow: 'each', options: { separator: ';' } });
    const shape = fieldShape(F('min-symbols'), a, none) as SelectShape<number>;
    const ok = shape.choices.filter((c) => !c.blocked).map((c) => c.value);
    const blocked = shape.choices.filter((c) => c.blocked);
    expect(ok[0]).toBe(0);
    expect(ok).toEqual(Array.from({ length: ok.length }, (_, i) => i)); // every count up to the highest that fits
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0]!.blocked).toMatch(/^\d+ symbols are required, but the only allowed symbol is the separator ";", and a password cannot end with its separator, so there is nothing to close it with \(from your answer for allowed symbols, separator\)$/);
  });

  it('reasons name the review line on the review, and the question before it', () => {
    const a = answers({ site: 'no-spaces', optionsHow: 'each', options: {} });
    const problems = problemsWith(withField(a, F('separator'), ' '));
    expect(reasonFor(problems, withField(a, F('separator'), ' '), ['separator'], none)).toBe('The separator is a space, but spaces are not allowed (from your answer for spaces)');
    expect(reasonFor(problems, withField(a, F('separator'), ' '), ['separator'], { lineOf: (f) => (f.name === 'spaces' ? 2 : undefined) })).toBe('The separator is a space, but spaces are not allowed (see line 2)');
  });
});

describe('number ranges', () => {
  /** Every value the field allows, by trying each one. */
  const scan = (name: string, a: Answers) => {
    const f = F(name);
    const k = f.kind as { min: number; max: number };
    const ok: number[] = [];
    for (let n = k.min; n <= k.max; n++) if (!problemsWith(withField(a, f, n)).length) ok.push(n);
    return ok;
  };
  const states: Answers[] = [
    noAnswers(),
    answers({ rules: { 'min-length': 30 } }),
    answers({ rules: { 'max-length': 14 }, optionsHow: 'each', options: { 'made-up': 3, comfort: 'strict' } }),
    answers({ rules: { 'min-uppercase': 8, 'min-digits': 4, 'min-symbols': 8 } }),
    answers({ site: 'typical-site', mode: 'quick', optionsHow: 'preset', rules: {} }),
    answers({ rules: { symbols: ';', 'min-symbols': 3 }, optionsHow: 'each', options: { separator: ';' } }),
  ];

  it('the binary search finds exactly the lengths a scan of every value finds: the allowed lengths are one unbroken range', () => {
    for (const [i, a] of states.entries()) {
      for (const name of ['min-length', 'max-length']) {
        const { [name]: _, ...rules } = a.rules;
        void _;
        const without = { ...a, rules };
        const shape = fieldShape(F(name), without, none) as NumberShape;
        const allowed = scan(name, without);
        expect(allowed.length, `state ${i} ${name}`).toBeGreaterThan(0);
        expect([shape.min, shape.max], `state ${i} ${name}`).toEqual([allowed[0], allowed.at(-1)]);
        expect(allowed.length, `state ${i} ${name}: a gap in the range`).toBe(allowed.at(-1)! - allowed[0]! + 1);
      }
    }
  }, 120_000);

  it('says why the value just outside the range is not allowed', () => {
    const shape = fieldShape(F('max-length'), answers({ rules: { 'min-length': 20 } }), none) as NumberShape;
    expect(shape.min).toBe(20);
    expect(shape.below).toBe('The minimum length (20) is above the maximum length (19) (from your answer for minimum length)');
    expect(shape.above).toBeUndefined();
  });

  it('starts from the answer given, the default, or the nearest value that fits', () => {
    expect((fieldShape(F('max-length'), noAnswers(), none) as NumberShape).initial).toBe(DEFAULT_REQUIREMENTS.maxLength);
    expect((fieldShape(F('max-length'), answers({ rules: { 'min-length': 40 } }), none) as NumberShape).initial).toBe(40);
  });
});
