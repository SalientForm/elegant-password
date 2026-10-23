// The two options the typing modes switch on: the shortest sentence that
// meets the target, and keeping Shift within one hand's reach. In a file of
// their own: generate.test.ts is already the heaviest worker.
import { describe, expect, it } from 'vitest';
import { applyUppercase, automaticSeparator, DEFAULT_REQUIREMENTS, generate, mappingBlock, plan, usableMappings, type Requirements } from './generate';
import { isFarShift } from './keyboard';
import { seeded } from './testRandom';
import { BUILT_IN_MAPPINGS, mappingKey } from './twists';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

describe('shortest that meets the target', () => {
  it('at the Minimal target makes the shortest sentence the rules allow: one length, every password at or under it', () => {
    const r = generate(req({ shortest: true, targetBits: 4, count: 10 }), { rng: seeded(3) });
    expect(r.plan.shortest).toBe(true);
    expect(r.plan.meetsTarget).toBe(true);
    expect(r.plan.bits).toBeGreaterThanOrEqual(4);
    // The shortest shape is noun verb noun with the number: a digit, two 4-letter plural nouns, a 3-letter verb and three ";" make 15.
    expect(r.plan.maxLength).toBe(15);
    expect(r.plan.expectedLength).toBe(15);
    expect(r.plan.template.slots).toEqual(['noun', 'verb', 'noun']);
    for (const s of r.suggestions) {
      expect(s.password.length).toBeLessThanOrEqual(r.plan.maxLength);
      expect(s.password.length).toBeGreaterThanOrEqual(DEFAULT_REQUIREMENTS.minLength);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
    expect(r.warnings.some((w) => /below the 4-bit target/.test(w))).toBe(false);
  });

  it('at 40 bits is the shortest window that still reaches 40 bits: never longer than the plan without it, honest bits', () => {
    const without = plan(req({})).plan;
    const with40 = plan(req({ shortest: true })).plan;
    expect(with40.meetsTarget).toBe(true);
    expect(with40.bits).toBeGreaterThanOrEqual(40);
    expect(with40.bits).toBeLessThan(without.bits);
    expect(with40.maxLength).toBeLessThan(DEFAULT_REQUIREMENTS.maxLength);
    expect(with40.expectedLength).toBeLessThanOrEqual(without.expectedLength);
    const r = generate(req({ shortest: true, count: 10 }), { rng: seeded(4) });
    for (const s of r.suggestions) expect(s.password.length, s.password).toBeLessThanOrEqual(r.plan.maxLength);
  });

  it('leaves the windows alone when no cut reaches the target, and says the target is out of reach', () => {
    const r = generate(req({ shortest: true, targetBits: 200, count: 2 }), { rng: seeded(1) });
    expect(r.plan.meetsTarget).toBe(false);
    expect(r.plan.maxLength).toBe(DEFAULT_REQUIREMENTS.maxLength);
    expect(r.warnings.some((w) => /below the 200-bit target/.test(w))).toBe(true);
  });

  it('leaves a kept sentence as it is, with a warning when it is longer than the shortest plan', () => {
    const first = generate(req({ count: 2 }), { rng: seeded(5) });
    const again = generate(req({ shortest: true, targetBits: 4, count: 2 }), { rng: seeded(5), sentence: first.sentence });
    expect(again.sentence).toEqual(first.sentence);
    expect(again.suggestions.length).toBeGreaterThan(0);
    expect(again.warnings).toContainEqual(expect.stringMatching(/^The kept sentence makes \d+ characters, longer than the \d+ the shortest plan needs/));
    for (const s of again.suggestions) expect(s.hint).toBe(first.suggestions[0]!.hint);
  });
});

describe('keep Shift within reach', () => {
  it('never picks a shifted symbol out of one hand’s reach for swaps or closing marks, and puts the capital in reach', () => {
    const r = generate(req({ shiftReach: true, twists: 3, count: 20 }), { rng: seeded(9) });
    expect(r.suggestions.length).toBeGreaterThan(10);
    const noNearWord = r.warnings.some((w) => /No word in this sentence starts with a letter one hand can capitalise/.test(w));
    for (const s of r.suggestions) {
      for (const c of s.password) if (!/[a-z]/i.test(c)) expect(isFarShift(c), `${s.password}: "${c}"`).toBe(false);
      const capitals = s.password.match(/[A-Z]/g) ?? [];
      expect(capitals).toHaveLength(1);
      if (!noNearWord) expect(isFarShift(capitals[0]!), `${s.password}: "${capitals[0]}"`).toBe(false);
    }
  });

  it("the opening capital is a word's first character, with Shift reach on and off", { timeout: 20_000 }, () => {
    for (const shiftReach of [false, true]) {
      for (const twists of [1, 2, 3]) {
        for (let seed = 1; seed <= 25; seed++) {
          const r = generate(req({ shiftReach, twists }), { rng: seeded(seed) });
          for (const s of r.suggestions) {
            const capitals = [...s.password.matchAll(/[A-Z]/g)];
            expect(capitals, s.password).toHaveLength(1);
            const before = s.password[capitals[0]!.index - 1];
            // At the start, or after the separator: never after a swapped-in symbol or digit ("@Corns").
            expect(before === undefined || before === r.plan.separator, s.password).toBe(true);
          }
        }
      }
    }
  });

  it('prefers a word whose first letter capitalises in reach, and falls back to any word when none does', () => {
    expect(applyUppercase(['tiny', 'otters', 'hunt'], 1, undefined, undefined, true)).toEqual(['tiny', 'Otters', 'hunt']);
    expect(applyUppercase(['tiny', 'birds', 'hunt', 'yaks'], 1, undefined, undefined, true)).toEqual(['Tiny', 'birds', 'hunt', 'yaks']);
    expect(applyUppercase(['tiny', 'otters', 'hunt'], 1)).toEqual(['Tiny', 'otters', 'hunt']); // off: the first word, as ever
    const rng = seeded(2);
    for (let i = 0; i < 20; i++) expect(applyUppercase(['tiny', 'otters', 'sharks'], 1, undefined, rng, true)[0]).toBe('tiny');
  });

  it('drops the mappings whose output needs a far Shift key', () => {
    const usable = usableMappings(BUILT_IN_MAPPINGS, req({ shiftReach: true }), ';').map(mappingKey);
    for (const gone of ['s>$', 'x>*', 'and>&']) expect(usable).not.toContain(gone);
    for (const kept of ['a>@', 'h>#', 'e>3', 'ph>f']) expect(usable).toContain(kept);
    expect(usableMappings(BUILT_IN_MAPPINGS, req({}), ';').map(mappingKey)).toContain('s>$'); // off: as ever
  });

  it('says why a mapping cannot be used, and usableMappings keeps exactly the ones with no reason', () => {
    const r = req({ shiftReach: true, avoidPinkyStretch: true, allowedSymbols: '@#$!' });
    expect(mappingBlock({ to: '&' }, r, ';')).toBe('"&" is not an allowed symbol');
    expect(mappingBlock({ to: '@' }, r, '@')).toBe('"@" is the separator, which never comes from a swap');
    expect(mappingBlock({ to: '!' }, r, ';')).toBe('"!" needs a pinky stretch');
    expect(mappingBlock({ to: '$' }, r, ';')).toBe('"$" needs a Shift key out of one hand\'s reach');
    expect(mappingBlock({ to: '#' }, r, ';')).toBeUndefined();
    expect(usableMappings(BUILT_IN_MAPPINGS, r, ';')).toEqual(BUILT_IN_MAPPINGS.filter((m) => !mappingBlock(m, r, ';')));
  });

  it('keeps the automatic separator in reach: a space before a far symbol, and the closing mark with a warning when every symbol is far', () => {
    expect(automaticSeparator(req({ shiftReach: true, allowedSymbols: '$%^&*', allowSpaces: true }))).toBe(' ');
    expect(automaticSeparator(req({ shiftReach: true }))).toBe(';');
    const r = generate(req({ shiftReach: true, allowedSymbols: '$', allowSpaces: true, count: 2 }), { rng: seeded(1) });
    expect(r.warnings).toContainEqual(expect.stringMatching(/Every allowed symbol needs a Shift key out of one hand's reach, so the sentence ends with "\$"/));
    for (const s of r.suggestions) expect(s.password.endsWith('$')).toBe(true);
  });
});
