import { describe, expect, it } from 'vitest';
import { crackEstimates, DEFAULT_REQUIREMENTS, formatDuration, generate, RequirementsError, type Requirements } from './generate';
import { seeded } from './testRandom';
import { isMadeUpNoun, twoLetter } from './grammar';
import { scoreCold } from './score';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

describe('generate', () => {
  const cases: [string, Partial<Requirements>][] = [
    ['defaults', {}],
    ['every rule, short limit', { minUppercase: 1, minDigits: 1, minSymbols: 1, maxLength: 24 }],
    ['symbols only via separator', { allowSpaces: false, minSymbols: 1, allowedSymbols: '-', separator: '-' }],
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

  it('defaults to the home-row semicolon, honours an explicitly chosen dash, and falls back to a stretch only when nothing else is allowed', () => {
    // The default separator must not be a pinky stretch while the pinky rule is on by default.
    expect(DEFAULT_REQUIREMENTS.separator).toBe(';');
    expect(DEFAULT_REQUIREMENTS.avoidPinkyStretch).toBe(true);
    expect(generate(req({}), { rng: seeded() }).plan.separator).toBe(';');
    expect(generate(req({ separator: '-' }), { rng: seeded() }).plan.separator).toBe('-');
    const onlyBang = generate(req({ separator: ' ', minSymbols: 1, allowedSymbols: '!' }), { rng: seeded() });
    expect(onlyBang.plan.endSymbol).toBe('!');
    expect(onlyBang.warnings.join(' ')).toMatch(/pinky stretch/);
  });

  it('rejects contradictory requirements', () => {
    expect(() => generate(req({ minLength: 30, maxLength: 20 }))).toThrow(RequirementsError);
    expect(() => generate(req({ minSymbols: 1, allowedSymbols: '', allowSpaces: true }))).toThrow(RequirementsError);
    expect(() => generate(req({ separator: ' ', allowSpaces: false }))).toThrow(RequirementsError);
    expect(() => generate(req({ separator: '-', allowedSymbols: '!' }))).toThrow(RequirementsError);
    expect(() => generate(req({ separator: 'x' }))).toThrow(/not a letter or digit/);
    expect(() => generate(req({ separator: ';;' }))).toThrow(/single character/);
    expect(() => generate(req({ separator: 'é', allowedSymbols: 'é' }))).toThrow(/standard keyboard/);
    // Any allowed symbol works as the separator, not only the ones that used to be in a list.
    const plus = generate(req({ separator: '+', allowedSymbols: '+.', avoidPinkyStretch: false, count: 2 }), { rng: seeded() });
    expect(plus.plan.separator).toBe('+');
    for (const s of plus.suggestions) {
      expect(s.password).toContain('+');
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
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

describe('audit fixes', () => {
  it('always has enough letters for the uppercase rule, even with initials, two-letter words and letter-removing swaps', () => {
    const all = (r: ReturnType<typeof generate>) => {
      for (const s of r.suggestions) for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    };
    all(generate(req({ minUppercase: 8, initials: 3, shorthand: 3, minLength: 6, maxLength: 24, targetBits: 10, count: 20, twists: 0 }), { rng: seeded(5) }));
    // The exact combination the audit fuzz found: 8 symbols, 2 digits and 8 capitals cannot all fit in 20
    // characters once the initial and two-letter words shrink the words, so it is refused rather than failed.
    const audit = req({ minLength: 4, maxLength: 20, minUppercase: 8, minDigits: 2, minSymbols: 8, allowSpaces: false, separator: ',', includeNumber: true, targetBits: 50, comfort: 'strict', twists: 1, initials: 1, shorthand: 3, glue: true, avoidPinkyStretch: false, count: 20 });
    expect(() => generate(audit, { rng: seeded(1) })).toThrow(/letters to capitalise/);
    all(generate({ ...audit, maxLength: 28 }, { rng: seeded(1) }));
    // Swaps like "and" -> "&" remove letters; they may never push the password under the rule.
    all(generate(req({ minUppercase: 8, twists: 3, minLength: 8, maxLength: 16, targetBits: 10, count: 20, avoidPinkyStretch: false }), { rng: seeded(2) }));
    // When no shape can supply the letters, the error says what to change.
    expect(() => generate(req({ minUppercase: 8, initials: 3, shorthand: 3, minLength: 1, maxLength: 8 }))).toThrow(/letters to capitalise/);
  });

  it('meets every rule across random requirement combinations', { timeout: 60_000 }, () => {
    const rng = seeded(1234);
    const pick = <T,>(xs: readonly T[]) => xs[rng.uint32() % xs.length]!;
    let generated = 0;
    for (let i = 0; i < 150; i++) {
      const minLength = pick([1, 4, 8, 10, 12, 16, 20, 30]);
      const r = req({
        minLength,
        maxLength: minLength + pick([0, 1, 2, 4, 8, 16, 40]),
        minUppercase: pick([0, 1, 2, 3, 8]),
        minDigits: pick([0, 1, 2, 4]),
        minSymbols: pick([0, 1, 2, 3, 8]),
        allowedSymbols: pick(['', '!', '-', '!@#$%^&*-_.,?;', '.', ';', '#', '"\'<>', '\\|`~']),
        allowSpaces: pick([true, false]),
        separator: pick(['auto', ' ', ';', '-', '.', '_', ',', '']),
        includeNumber: pick([true, false]),
        targetBits: pick([0, 20, 40, 50, 72]),
        comfort: pick(['strict', 'balanced', 'relaxed']),
        twists: pick([0, 1, 2, 3]),
        initials: pick([0, 1, 2, 3]),
        shorthand: pick([0, 1, 2, 3]),
        madeUp: pick([0, 1, 2]),
        glue: pick([true, false]),
        avoidPinkyStretch: pick([true, false]),
        count: 5,
      });
      try {
        const g = generate(r, { rng });
        generated++;
        for (const s of g.suggestions) {
          for (const c of s.checks) expect(c.met, `${JSON.stringify(r)} => ${s.password}: ${c.rule}`).toBe(true);
          if (r.initials === 0 && r.madeUp === 0) expect(s.typing.caseChanges, s.password).toBeLessThanOrEqual(1);
        }
      } catch (e) {
        if (!(e instanceof RequirementsError)) throw e;
      }
    }
    expect(generated).toBeGreaterThan(20);
  });

  it('never twists two-letter words, initials, numbers or made-up nouns', () => {
    const r = generate(req({ shorthand: 3, initials: 1, madeUp: 1, twists: 3, count: 20, targetBits: 60, maxLength: 60, separator: ' ' }), {
      rng: seeded(44),
    });
    let shorthandWords = 0;
    for (const s of r.suggestions) {
      shorthandWords += s.words.filter((w) => w.slot !== 'num' && w.text.length === 2 && w.text === twoLetter(w.original)).length;
      for (const t of s.twists) {
        expect(t.before, s.password).toMatch(/^[a-z]{3,}$/); // whole lowercase words only
        expect(isMadeUpNoun(t.before), s.password).toBe(false);
      }
    }
    expect(shorthandWords).toBe(3 * r.suggestions.length);
  });

  it('scores each suggestion cold from its password and hint, as plain data', () => {
    const r = generate(req({ twists: 2, initials: 1, count: 10 }), { rng: seeded(3) });
    for (const s of r.suggestions) {
      const cold = scoreCold(s.password, s.hint);
      expect(s.bits).toBe(cold.bits);
      expect(s.twistBits).toBe(cold.twistBits);
      expect(s.difficulty).toEqual(cold.difficulty);
      expect(cold.aligned, `${s.password} / ${s.hint}`).toBe(true);
      expect(cold.template).toBeDefined();
      expect(s.hint.split(' ')).toHaveLength(s.words.length);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});
