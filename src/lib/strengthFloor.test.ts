// Strength against the bits (audit L17). Strength's attacker knows less
// than the bits' attacker, who knows this tool, so Strength should not read
// lower. Where it may, and why, is in docs/decisions.md (Scoring); these
// tests hold the rest. Strength itself never sees the tool's lists; the
// tests use them to check it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate, type Requirements } from './generate';
import { MADE_UP_NOUNS, pools, twoLettersOf } from './grammar';
import { activeMappings, DEFAULT_MAPPING_SETTINGS } from './mappingSettings';
import { MINIMAL_BITS, MODE_PROFILES, withProfile } from './modeProfiles';
import { letterBits, VOWELS } from './strength';
import { seeded } from './testRandom';
import type { TypingMode } from './difficulty';

const mappings = activeMappings(DEFAULT_MAPPING_SETTINGS);
const MODES = Object.keys(MODE_PROFILES) as TypingMode[];
const BATCHES = 20;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const hasVowel = (w: string) => [...w.toLowerCase()].some((c) => VOWELS.includes(c));

/** Every card of seeded batches: Strength, the card's bits, and the exact figure (the plan's bits plus the card's swap bits, when lower: the card's bits ignore the length window). */
function cards(req: Requirements) {
  return Array.from({ length: BATCHES }, (_, i) => generate(req, { mappings, rng: seeded(1 + i * 7919) })).flatMap((r) =>
    r.suggestions.map((s) => ({ password: s.password, strength: s.strength, bits: s.bits, exact: Math.min(s.bits, r.plan.bits + s.twistBits) })),
  );
}

describe('Strength against the bits', { timeout: 60_000 }, () => {
  it('reads the made-up nouns at least their pick on average, where the English reading fell short', () => {
    const pick = Math.log2(MADE_UP_NOUNS.length);
    expect(mean(MADE_UP_NOUNS.map((w) => letterBits(w)))).toBeGreaterThan(pick);
    expect(mean(MADE_UP_NOUNS.map((w) => letterBits(w, true)))).toBeLessThan(pick); // read as English, as before
  });

  it('reads every two-letter form with no vowel above its pick', () => {
    for (const comfort of ['strict', 'balanced', 'relaxed'] as const) {
      for (const [slot, words] of Object.entries(pools(comfort, 1))) {
        if (slot === 'num' || slot === 'and') continue;
        const forms = twoLettersOf(words);
        for (const form of forms.filter((f) => !hasVowel(f))) expect(letterBits(form), `${comfort} ${slot} ${form}`).toBeGreaterThan(Math.log2(forms.length));
      }
    }
  });

  it('is never below the exact figure in a shortest plan, made-up nouns or not', () => {
    for (const mode of MODES) {
      const base = withProfile(DEFAULT_REQUIREMENTS, mode).req;
      for (const madeUp of [0, 2]) {
        for (const c of cards({ ...base, targetBits: MINIMAL_BITS, shortest: true, madeUp })) expect(c.strength, `${mode} ${c.password}`).toBeGreaterThanOrEqual(c.exact - 1e-9);
      }
    }
  });

  it('without made-up nouns, outside shortest plans, is below the card\'s bits for at most 2 % of cards, by at most 3 bits', () => {
    for (const mode of MODES.filter((m) => !MODE_PROFILES[m].values.shortest)) {
      const base = withProfile(DEFAULT_REQUIREMENTS, mode).req;
      for (const shape of [{}, { initials: 3 }, { shorthand: 3 }, { glue: true }]) {
        const all = cards({ ...base, ...shape });
        const below = all.filter((c) => c.strength < c.bits - 1e-9);
        const label = `${mode} ${JSON.stringify(shape)}`;
        expect(below.length / all.length, label).toBeLessThanOrEqual(0.02);
        for (const c of below) expect(c.bits - c.strength, `${label} ${c.password}`).toBeLessThanOrEqual(3);
      }
    }
  });
});
