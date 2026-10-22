import { describe, expect, it } from 'vitest';
import { DEFAULT_TYPING_MODE, difficultyIn, TYPING_MODE_IDS, type TypingMode } from './difficulty';
import { DEFAULT_REQUIREMENTS, generate, ruleProblems, STRENGTH_PRESETS, type Requirements } from './generate';
import { formatProfileValue, matchesProfile, MODE_MEASURES, MODE_PROFILES, PROFILE_KEYS, profileValues, unusedIn, withProfile } from './modeProfiles';
import { RULE_KEYS, SITE_PRESETS, withRules } from './sitePresets';
import { seeded } from './testRandom';

describe('mode profiles', () => {
  it('ten-finger is exactly the defaults, so nothing changes for anyone who never picks a mode', () => {
    expect(withProfile(DEFAULT_REQUIREMENTS, 'ten-finger')).toEqual({ req: DEFAULT_REQUIREMENTS, notes: [] });
    expect(matchesProfile(DEFAULT_REQUIREMENTS, DEFAULT_TYPING_MODE)).toBe(true);
  });

  it('set only strength, comfort and style: the site rules, the count and the rest stay as they were', () => {
    const mine: Requirements = { ...DEFAULT_REQUIREMENTS, minLength: 10, maxLength: 20, minDigits: 2, allowedSymbols: '#@', allowSpaces: false, count: 7 };
    for (const mode of TYPING_MODE_IDS) {
      const { req } = withProfile(mine, mode);
      for (const key of RULE_KEYS) expect(req[key], `${mode}: ${key}`).toEqual(mine[key]);
      for (const key of Object.keys(mine) as (keyof Requirements)[]) {
        if (!(PROFILE_KEYS as readonly string[]).includes(key)) expect(req[key], `${mode}: ${key}`).toEqual(mine[key]);
      }
    }
  });

  it('are valid at every site preset and make passwords that meet its rules', () => {
    for (const mode of TYPING_MODE_IDS) {
      for (const p of SITE_PRESETS) {
        const { req, notes } = withProfile(withRules(DEFAULT_REQUIREMENTS, p.rules), mode);
        expect(ruleProblems(req), `${mode} at ${p.label}`).toEqual([]);
        expect(notes, `${mode} at ${p.label}`).toEqual([]);
        const r = generate({ ...req, count: 3 }, { rng: seeded(3) });
        expect(r.suggestions.length, `${mode} at ${p.label}`).toBeGreaterThan(0);
        for (const s of r.suggestions) expect(s.checks.every((c) => c.met), `${mode} at ${p.label}: ${s.password}`).toBe(true);
      }
    }
  });

  it('match until one option is edited away, and the other modes never match', () => {
    const r = withProfile(DEFAULT_REQUIREMENTS, 'one-handed').req;
    expect(matchesProfile(r, 'one-handed')).toBe(true);
    expect(matchesProfile(r, 'ten-finger')).toBe(false);
    expect(matchesProfile({ ...r, twists: 3 }, 'one-handed')).toBe(false);
    expect(matchesProfile(withProfile({ ...r, twists: 3 }, 'one-handed').req, 'one-handed')).toBe(true);
    // The separator a profile asks for depends on the site: a space where allowed, else Automatic.
    expect(profileValues('two-finger', { allowSpaces: true }).separator).toBe(' ');
    expect(profileValues('two-finger', { allowSpaces: false }).separator).toBe('auto');
    expect(matchesProfile(withProfile({ ...DEFAULT_REQUIREMENTS, allowSpaces: false }, 'two-finger').req, 'two-finger')).toBe(true);
  });

  it('no mode uses made-up nouns: they are left for the user to choose', () => {
    for (const mode of TYPING_MODE_IDS) expect(withProfile(DEFAULT_REQUIREMENTS, mode).req.madeUp, mode).toBe(0);
  });

  it('two-finger has no use for the pinky rule or deliberate swaps; the other modes use every option', () => {
    expect(unusedIn('two-finger').map((u) => u.key)).toEqual(['avoidPinkyStretch', 'easeSwaps']);
    for (const u of unusedIn('two-finger')) expect(MODE_PROFILES['two-finger'].values[u.key]).toBe(false); // their neutral value
    for (const mode of ['ten-finger', 'one-handed', 'quick'] as const) expect(unusedIn(mode)).toEqual([]);
    expect(formatProfileValue('avoidPinkyStretch', 'two-finger')).toBe('—');
    expect(formatProfileValue('avoidPinkyStretch', 'one-handed')).toBe('On');
    expect(formatProfileValue('targetBits', 'quick')).toBe('4 bits (Minimal)');
    expect(formatProfileValue('targetBits', 'ten-finger')).toBe('40 bits (Everyday)');
    expect(formatProfileValue('separator', 'two-finger')).toBe('Space if allowed, else Auto');
    expect(formatProfileValue('comfort', 'one-handed')).toBe('Strict');
    expect(formatProfileValue('madeUp', 'quick')).toBe('None');
    expect(formatProfileValue('initials', 'quick')).toBe('None');
  });

  it("Minimal-quick's target is the Minimal preset, below the yellow band, and the measured figures are filled in", () => {
    expect(STRENGTH_PRESETS[0]).toMatchObject({ label: 'Minimal', bits: MODE_PROFILES.quick.values.targetBits });
    expect(MODE_PROFILES.quick.values.shortest).toBe(true);
    expect(MODE_PROFILES['one-handed'].values.shiftReach).toBe(true);
    for (const mode of TYPING_MODE_IDS) {
      const m = MODE_MEASURES.byMode[mode];
      expect(m.difficulty, mode).toBeGreaterThan(0);
      expect(MODE_MEASURES.defaults[mode], mode).toBeGreaterThan(0);
      // The tuning rule: a mode's options make its passwords easier in its own rubric than the defaults are, at the target's strength.
      if (mode !== DEFAULT_TYPING_MODE) expect(m.difficulty, `${mode} easier than the defaults`).toBeLessThan(MODE_MEASURES.defaults[mode]);
      expect(m.bits, `${mode} meets its target`).toBeGreaterThanOrEqual(MODE_PROFILES[mode].values.targetBits);
    }
  });
});

/** The means over `batches` × `count` suggestions of these requirements, scored in every mode. */
export function measure(req: Requirements, batches: number, count: number) {
  const sums = { tenFinger: 0, bits: 0, memorability: 0, length: 0, n: 0 };
  const byMode = Object.fromEntries(TYPING_MODE_IDS.map((m) => [m, 0])) as Record<TypingMode, number>;
  for (let k = 0; k < batches; k++) {
    const r = generate({ ...req, count }, { rng: seeded(1000 + k) });
    for (const s of r.suggestions) {
      sums.n++;
      sums.bits += r.plan.bits;
      sums.memorability += s.memorability;
      sums.length += s.password.length;
      for (const m of TYPING_MODE_IDS) byMode[m] += difficultyIn(s.password, s.difficulty, m).score;
    }
  }
  const mean = (v: number) => Math.round((v / sums.n) * 10) / 10;
  return { n: sums.n, bits: mean(sums.bits), memorability: mean(sums.memorability), length: mean(sums.length), difficulty: Object.fromEntries(TYPING_MODE_IDS.map((m) => [m, mean(byMode[m])])) as Record<TypingMode, number> };
}

describe('measured', () => {
  // pnpm measure:modes: prints the figures to paste into MODE_MEASURES.
  it.skipIf(!process.env.MEASURE_MODES)("each mode's options at the Typical site rules, against the defaults scored in that mode", () => {
    const batches = 120;
    const count = 5;
    const defaults = measure(DEFAULT_REQUIREMENTS, batches, count);
    const out = {
      asOf: new Date().toISOString().slice(0, 10),
      n: defaults.n,
      rules: 'Typical site',
      defaults: defaults.difficulty,
      byMode: Object.fromEntries(
        TYPING_MODE_IDS.map((mode) => {
          const m = measure(withProfile(DEFAULT_REQUIREMENTS, mode).req, batches, count);
          return [mode, { difficulty: m.difficulty[mode], tenFinger: m.difficulty['ten-finger'], bits: m.bits, memorability: m.memorability, length: m.length }];
        }),
      ),
    };
    console.log(`MODE_MEASURES = ${JSON.stringify(out, null, 2)}`);
    expect(out.n).toBe(batches * count);
  });
});
