import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate, ruleProblems, separatorProblem, validate } from './generate';
import { seeded } from './testRandom';
import { applyPreset, DEFAULT_SITE_PRESET, matchingPreset, RULE_KEYS, rulesOf, sameRules, SITE_PRESETS, withRules } from './sitePresets';

describe('site rule presets', () => {
  it('are each a full, valid set of site rules and nothing else', () => {
    for (const p of SITE_PRESETS) {
      expect(Object.keys(p.rules).sort(), p.label).toEqual([...RULE_KEYS].sort());
      expect(() => validate(withRules(DEFAULT_REQUIREMENTS, p.rules)), p.label).not.toThrow();
    }
  });

  it('have distinct labels and distinct rules, so at most one matches', () => {
    expect(new Set(SITE_PRESETS.map((p) => p.label)).size).toBe(SITE_PRESETS.length);
    for (const [i, a] of SITE_PRESETS.entries()) for (const b of SITE_PRESETS.slice(i + 1)) expect(sameRules(a.rules, b.rules), `${a.label} / ${b.label}`).toBe(false);
  });

  it('start with "Typical site", which is the defaults', () => {
    expect(SITE_PRESETS[0]!.label).toBe('Typical site');
    expect(SITE_PRESETS[0]).toBe(DEFAULT_SITE_PRESET);
    expect(matchingPreset(DEFAULT_REQUIREMENTS)).toBe(DEFAULT_SITE_PRESET);
    expect(DEFAULT_SITE_PRESET.note).toBe(`${DEFAULT_REQUIREMENTS.minLength}-${DEFAULT_REQUIREMENTS.maxLength}, A + 1 + #`);
  });

  it('leave strength, comfort, style, swaps and count as they were', () => {
    const mine = { ...DEFAULT_REQUIREMENTS, targetBits: 72, comfort: 'relaxed' as const, separator: '.', includeNumber: false, twists: 0, initials: 1, shorthand: 2, madeUp: 3, glue: true, avoidPinkyStretch: false, count: 7 };
    for (const p of SITE_PRESETS) {
      const next = withRules(mine, p.rules);
      for (const key of Object.keys(mine) as (keyof typeof mine)[]) if (!(RULE_KEYS as readonly string[]).includes(key)) expect(next[key], `${p.label}: ${key}`).toEqual(mine[key]);
      expect(rulesOf(next)).toEqual(p.rules);
    }
  });

  it('match exactly, reading the allowed symbols as a set', () => {
    const short = SITE_PRESETS.find((p) => p.label === 'Short max (16)')!;
    expect(matchingPreset({ ...short.rules, allowedSymbols: [...short.rules.allowedSymbols].reverse().join('') })).toBe(short);
    expect(matchingPreset({ ...short.rules, maxLength: 17 })).toBeUndefined();
    expect(matchingPreset({ ...DEFAULT_REQUIREMENTS, minDigits: 2 })).toBeUndefined();
  });

  it('never leave the form contradicting itself, whatever separator and style were chosen', () => {
    for (const p of SITE_PRESETS) {
      for (const separator of ['auto', ';', ' ', '', '-', '.', '#', '$', '~']) {
        for (const style of [{}, { glue: true, initials: 3, avoidPinkyStretch: false }, { minSymbols: 8, maxLength: 9 }]) {
          const before = { ...DEFAULT_REQUIREMENTS, ...style, separator };
          const { req, notes } = applyPreset(before, p.rules);
          expect(ruleProblems(req), `${p.label} over ${JSON.stringify(separator)}`).toEqual([]);
          // Only the separator ever needs a fix, and only when the preset rules it out.
          const ruledOut = !!separatorProblem(separator, p.rules);
          expect(req.separator).toBe(ruledOut ? 'auto' : separator);
          expect(notes.length).toBe(ruledOut ? 1 : 0);
        }
      }
    }
  });

  it('say what they changed beyond the rules: a separator they rule out becomes Automatic', () => {
    const semicolon = { ...DEFAULT_REQUIREMENTS, separator: ';' };
    const preset = (label: string) => SITE_PRESETS.find((p) => p.label === label)!;
    expect(applyPreset(semicolon, preset('No symbols').rules).notes).toEqual(['separator set to Auto (none), as ";" is not allowed']);
    expect(applyPreset(semicolon, preset('Short max (16)').rules).notes).toEqual(['separator set to Auto (none), as ";" is not allowed']);
    expect(applyPreset({ ...DEFAULT_REQUIREMENTS, separator: ' ' }, preset('No spaces').rules).notes).toEqual(['separator set to Auto (";"), as spaces are not allowed']);
    expect(applyPreset(semicolon, preset('NIST passphrase').rules)).toEqual({ req: { ...semicolon, ...preset('NIST passphrase').rules }, notes: [] });
  });

  it('each make passwords that meet their rules after a tap, even over the old ";" default', () => {
    for (const p of SITE_PRESETS) {
      const { req } = applyPreset({ ...DEFAULT_REQUIREMENTS, separator: ';' }, p.rules);
      const result = generate({ ...req, count: 3 }, { rng: seeded(4) });
      for (const s of result.suggestions) expect(s.checks.every((c) => c.met), `${p.label}: ${s.password}`).toBe(true);
    }
  });

  it('each make passwords that meet their rules (with the automatic separator)', () => {
    for (const p of SITE_PRESETS) {
      const result = generate({ ...withRules(DEFAULT_REQUIREMENTS, p.rules), separator: 'auto', count: 2 });
      expect(result.suggestions.length, p.label).toBe(2);
      for (const s of result.suggestions) {
        expect(s.password.length).toBeGreaterThanOrEqual(p.rules.minLength);
        expect(s.password.length).toBeLessThanOrEqual(p.rules.maxLength);
        expect(s.checks.every((c) => c.met), `${p.label}: ${s.password}`).toBe(true);
      }
    }
  });
});
