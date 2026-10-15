import { describe, expect, it } from 'vitest';
import { crackEstimates, DEFAULT_REQUIREMENTS, formatDuration, generate, RequirementsError, type Requirements } from './generate';
import { seeded } from './testRandom';
import { twoLetter } from './grammar';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

describe('generate', () => {
  const cases: [string, Partial<Requirements>][] = [
    ['defaults', {}],
    ['every rule, short limit', { minUppercase: 1, minDigits: 1, minSymbols: 1, maxLength: 24 }],
    ['symbols only via separator', { allowSpaces: false, minSymbols: 1, allowedSymbols: '-' }],
    ['no spaces or symbols', { allowSpaces: false, allowedSymbols: '', separator: 'auto', minSymbols: 0 }],
    ['strict comfort, high target', { comfort: 'strict', targetBits: 60, maxLength: 80 }],
    ['long minimum', { minLength: 40, maxLength: 50 }],
    ['symbol at end, restricted set', { minSymbols: 1, allowedSymbols: '#', allowSpaces: true, separator: 'auto' }],
    ['pinky rule off, three twists', { avoidPinkyStretch: false, twists: 3, minSymbols: 1 }],
  ];

  it.each(cases)('meets every requirement: %s', (_name, over) => {
    const r = req({ ...over, count: 20 });
    const result = generate(r, { rng: seeded(7) });
    expect(result.suggestions).toHaveLength(20);
    for (const s of result.suggestions) {
      for (const check of s.checks) expect(check.met, `${s.password}: ${check.rule}`).toBe(true);
      // Fast to type: the only uppercase letter is the opening capital.
      expect(s.password.replace(/[A-Z]/, '')).not.toMatch(/[A-Z]/);
      expect(s.typing.caseChanges).toBeLessThanOrEqual(1);
    }
  });

  it('meets "at least N" counts without alternating case', () => {
    const r = req({ minUppercase: 3, minDigits: 3, minSymbols: 3, separator: ' ', twists: 2, count: 20 });
    for (const s of generate(r, { rng: seeded(8) }).suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      expect(s.password.replace(/[^A-Z]/g, '').length).toBeGreaterThanOrEqual(3);
      expect(s.typing.caseChanges).toBeLessThanOrEqual(1);
      expect(s.password).toMatch(/(^| )\d{3} /);
      expect(s.password).toMatch(/\.\.\.$/);
    }
    // Separators count toward symbols, so no closing marks are needed here.
    const dashed = generate(req({ minSymbols: 3 }), { rng: seeded() });
    expect(dashed.plan.endSymbol).toBe('');
  });

  it('types chosen words as capital initials and counts only the initial letters', () => {
    const plain = generate(req({ separator: ';', targetBits: 50, maxLength: 64, count: 1 }), { rng: seeded() });
    const r = generate(req({ separator: ';', targetBits: 50, maxLength: 64, initials: 2, glue: true, twists: 0, count: 20 }), {
      rng: seeded(21),
    });
    expect(r.plan.initials).toBe(2);
    expect(r.plan.breakdown.filter((b) => b.slot === 'initial')).toHaveLength(2);
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const singles = s.words.filter((w) => /^[A-Z]$/.test(w.text));
      expect(singles).toHaveLength(2);
      for (const w of singles) expect(w.original[0]!.toUpperCase()).toBe(w.text); // a word to picture
      expect(s.password).not.toMatch(/;\d+;/); // the number glues onto the next word
    }
    // Same strength target, so the plan simply uses more words to make up for the initials.
    expect(r.plan.bits).toBeGreaterThanOrEqual(50);
    expect(plain.plan.bits).toBeGreaterThanOrEqual(50);
  });

  it('types chosen words as two letters, first and last consonant, counted exactly', () => {
    const r = generate(req({ shorthand: 2, initials: 1, twists: 0, count: 20 }), { rng: seeded(31) });
    expect(r.plan.breakdown.filter((b) => b.slot === 'shorthand')).toHaveLength(2);
    expect(r.plan.breakdown.filter((b) => b.slot === 'initial')).toHaveLength(1);
    expect(r.plan.meetsTarget).toBe(true);
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const short = s.words.filter((w) => /^[a-z]{2}$/.test(w.text) && w.text !== w.original);
      expect(short.length).toBeGreaterThanOrEqual(2);
      for (const w of short) expect(twoLetter(w.original)).toBe(w.text);
    }
    expect(twoLetter('jupiter')).toBe('jr');
    expect(twoLetter('piece')).toBe('pc');
    expect(twoLetter('idea')).toBe('id');
  });

  it('rejects counts out of range', () => {
    expect(() => generate(req({ minDigits: 5 }))).toThrow(RequirementsError);
    expect(() => generate(req({ minUppercase: -1 }))).toThrow(RequirementsError);
  });

  it('reaches the target strength when the length range allows it', () => {
    for (const targetBits of [30, 45, 60, 72]) {
      const result = generate(req({ targetBits, maxLength: 100 }), { rng: seeded() });
      expect(result.plan.meetsTarget).toBe(true);
      expect(result.plan.bits).toBeGreaterThanOrEqual(targetBits);
      expect(result.warnings).toEqual([]);
    }
  });

  it('warns rather than failing when the limits cap the strength', () => {
    const result = generate(req({ targetBits: 72, maxLength: 20 }), { rng: seeded() });
    expect(result.plan.meetsTarget).toBe(false);
    expect(result.warnings[0]).toMatch(/below the 72-bit target/);
  });

  it('reads as a sentence: verbs follow nouns, numbers start a noun phrase anywhere', () => {
    const result = generate(req({ minDigits: 1, count: 20 }), { rng: seeded(3) });
    const positions = new Set<number>();
    for (const s of result.suggestions) {
      const slots = s.words.map((w) => w.slot);
      const n = slots.indexOf('num');
      positions.add(n);
      expect(slots[n + 1]).toMatch(/adj|noun/);
      expect([undefined, 'verb', 'prep', 'and']).toContain(slots[n - 1]);
      expect(slots).toContain('verb');
      expect(slots[slots.indexOf('verb') - 1]).toMatch(/noun|adv/);
    }
    expect(positions.size).toBeGreaterThan(1);
    expect(result.plan.numberPlacements).toBeGreaterThan(1);
    expect(result.plan.breakdown.at(-1)?.label).toBe('number position');
  });

  it('keeps automatic symbols off pinky stretches when asked', () => {
    const stretch = /[!)\-_=+|\\~`\]}]/;
    const r = req({ separator: 'auto', allowSpaces: false, minSymbols: 1, twists: 3, count: 20, allowedSymbols: '!@#$%^&*-_.,?+=|' });
    for (const s of generate(r, { rng: seeded(4) }).suggestions) expect(s.password).not.toMatch(stretch);
    // With the rule off the same settings may use them.
    const loose = generate({ ...r, avoidPinkyStretch: false }, { rng: seeded(4) }).suggestions.map((s) => s.password).join(' ');
    expect(loose).toMatch(stretch);
  });

  it('honours an explicitly chosen dash and falls back to a stretch only when nothing else is allowed', () => {
    expect(generate(req({}), { rng: seeded() }).plan.separator).toBe('-');
    const onlyBang = generate(req({ separator: ' ', minSymbols: 1, allowedSymbols: '!' }), { rng: seeded() });
    expect(onlyBang.plan.endSymbol).toBe('!');
    expect(onlyBang.warnings.join(' ')).toMatch(/pinky stretch/);
  });

  it('rejects contradictory requirements', () => {
    expect(() => generate(req({ minLength: 30, maxLength: 20 }))).toThrow(RequirementsError);
    expect(() => generate(req({ minSymbols: 1, allowedSymbols: '', allowSpaces: true }))).toThrow(RequirementsError);
    expect(() => generate(req({ separator: ' ', allowSpaces: false }))).toThrow(RequirementsError);
    expect(() => generate(req({ separator: '-', allowedSymbols: '!' }))).toThrow(RequirementsError);
    expect(() => generate(req({ minLength: 1, maxLength: 4 }))).toThrow(RequirementsError);
  });
});

describe('crack estimates', () => {
  it('scales with entropy and formats readably', () => {
    const [online] = crackEstimates(40);
    expect(online!.seconds).toBeCloseTo(2 ** 39 / 10);
    expect(formatDuration(0.2)).toBe('instantly');
    expect(formatDuration(90)).toBe('1.5 minutes');
    expect(formatDuration(3 * 365.25 * 24 * 3600)).toBe('3 years');
    expect(formatDuration(5e6 * 365.25 * 24 * 3600)).toBe('5 million years');
  });
});

describe('made-up nouns', () => {
  it('are at most two key rolls, all lowercase or all caps, and counted exactly', async () => {
    const { KEY_ROLLS, MADE_UP_NOUNS } = await import('./grammar');
    const { isRoll, lookupKey } = await import('./keyboard');
    expect(MADE_UP_NOUNS).toContain('ertdfg');
    expect(MADE_UP_NOUNS).toContain('ERTDFG');
    // Every made-up noun splits into at most two rolls.
    const rollRuns = (w: string) => {
      let runs = 1;
      for (let i = 1; i < w.length; i++) {
        if (!isRoll(lookupKey(w[i - 1]!.toLowerCase())!.key, lookupKey(w[i]!.toLowerCase())!.key)) runs++;
      }
      return runs;
    };
    for (const w of MADE_UP_NOUNS) {
      expect(w === w.toLowerCase() || w === w.toUpperCase(), w).toBe(true);
      expect(rollRuns(w), w).toBeLessThanOrEqual(2);
    }
    expect(KEY_ROLLS.every((r) => rollRuns(r) === 1)).toBe(true);

    const r = generate(req({ madeUp: 2, count: 20 }), { rng: seeded(41) });
    expect(r.plan.breakdown.filter((b) => b.slot === 'madeUp')).toHaveLength(2);
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const made = s.words.filter((w) => MADE_UP_NOUNS.includes(w.text));
      expect(made.length).toBeGreaterThanOrEqual(2);
      // Never mixed case, even when the sentence needs an opening capital.
      for (const w of made) expect(w.text === w.text.toLowerCase() || w.text === w.text.toUpperCase()).toBe(true);
      for (const piece of s.password.split(/[^A-Za-z]+/)) {
        if (MADE_UP_NOUNS.includes(piece.toLowerCase())) {
          expect(piece === piece.toLowerCase() || piece === piece.toUpperCase(), s.password).toBe(true);
        }
      }
    }
  });
});
