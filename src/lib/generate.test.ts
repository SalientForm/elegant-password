import { describe, expect, it } from 'vitest';
import { closingSymbol, crackEstimates, DEFAULT_REQUIREMENTS, formatDuration, generate, RequirementsError, trimSeparators, type Requirements } from './generate';
import { seeded } from './testRandom';
import { BUILT_IN_MAPPINGS, type Mapping } from './twists';
import { isMadeUpNoun, pools, twoLetter } from './grammar';
import { easedText, easeOf, plainOf } from './ease';
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
      expect(s.password).toMatch(/([^a-zA-Z0-9 ])\1\1$/) // three closing marks of one symbol, drawn for the password;
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
        easeSwaps: i % 2 === 0, // not drawn, so the other combinations stay the ones this test has always covered
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

describe('edges of a password', () => {
  it('never start or end with a space or the separator', () => {
    expect(trimSeparators(';test;', ';')).toBe('test');
    expect(trimSeparators(' test ', ' ')).toBe('test');
    expect(trimSeparators(';; a;b ;;', ';')).toBe('a;b');
    expect(trimSeparators('a;b', ';')).toBe('a;b');
    expect(trimSeparators('a.b.', ';')).toBe('a.b.'); // another symbol is not a separator
    expect(trimSeparators(' x ', '')).toBe('x');
    expect(trimSeparators(' x ', 'auto')).toBe('x');
    expect(trimSeparators('', ';')).toBe('');
  });

  it('closing marks never use the separator character, so the rule costs nothing', () => {
    const req = { ...DEFAULT_REQUIREMENTS, separator: '.', allowedSymbols: '.?;', minSymbols: 6 };
    expect(closingSymbol(req, ['.', '?', ';'], '.')).toBe('?');
    const r = generate(req, { rng: seeded(3) });
    expect(r.plan.endSymbol).not.toContain('.');
    for (const s of r.suggestions) {
      expect(s.password).not.toMatch(/^[ .]|[ .]$/);
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
    }
    // When nothing else is allowed there is no closing mark at all: the request is refused rather than a password trimmed short.
    expect(closingSymbol({ ...req, allowedSymbols: '.' }, ['.'], '.')).toBeUndefined();
  });

  it('holds for every generated password', () => {
    for (const separator of [';', ' ', '.', '-']) {
      const r = generate({ ...DEFAULT_REQUIREMENTS, separator, minSymbols: 3, count: 10, avoidPinkyStretch: false }, { rng: seeded(11) });
      for (const s of r.suggestions) expect(s.password, separator).not.toMatch(new RegExp(`^[ ${separator.replace('-', '\\-')}]|[ ${separator.replace('-', '\\-')}]$`));
    }
  });
});

describe('generate: the separator is never a closing mark or a swap output', () => {
  it('refuses closing marks that would be the separator, naming it, instead of a password short on symbols', () => {
    expect(() => generate({ ...DEFAULT_REQUIREMENTS, separator: '.', allowedSymbols: '.', allowSpaces: false, minSymbols: 6 })).toThrow(/only allowed symbol is the separator/);
    // Separators alone meeting the rule are fine, and no password ends with one.
    const ok = generate({ ...DEFAULT_REQUIREMENTS, separator: '.', allowedSymbols: '.', allowSpaces: false, minSymbols: 2, count: 10 }, { rng: seeded(1) });
    for (const s of ok.suggestions) {
      expect(s.checks.every((c) => c.met)).toBe(true);
      expect(s.password.endsWith('.')).toBe(false);
    }
  });

  it('never draws a swap whose output is the separator, which the edge trim would remove and leave the password short', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate({ ...DEFAULT_REQUIREMENTS, separator: '$', allowedSymbols: '$', allowSpaces: false, minLength: 20, maxLength: 20, twists: 2, count: 20 }, { rng: seeded(seed) });
      for (const s of r.suggestions) {
        expect([...s.password].length).toBe(20);
        expect(s.checks.every((c) => c.met)).toBe(true);
      }
    }
    const custom: Mapping[] = [...BUILT_IN_MAPPINGS, { from: 's', to: ';', kind: 'symbol' }];
    const r = generate({ ...DEFAULT_REQUIREMENTS, count: 20, twists: 2 }, { rng: seeded(2), mappings: custom });
    for (const s of r.suggestions) {
      expect([...s.password].length).toBeGreaterThanOrEqual(DEFAULT_REQUIREMENTS.minLength);
      expect(s.password.includes(';;')).toBe(false);
    }
  });
});

describe('variety across a batch', () => {
  it('draws the closing symbol per password, so a batch ends in different marks, all allowed and never the separator', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, allowSpaces: true, separator: ' ', allowedSymbols: '!?.$#', minSymbols: 2, count: 20 }, { rng: seeded(5) });
    const endings = new Set(r.suggestions.map((s) => s.password.slice(-2)));
    expect(endings.size).toBeGreaterThanOrEqual(3);
    for (const s of r.suggestions) {
      expect(s.password).toMatch(/[!?.$#]{2}$/);
      expect(s.checks.every((c) => c.met)).toBe(true);
    }
  });

  it('keeps the opening capital on the first word: a generated batch varies in its words, and the sentence-like start types fastest', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, initials: 0, madeUp: 0, count: 20 }, { rng: seeded(6) });
    for (const s of r.suggestions) {
      expect(s.password.split(';').find((w) => /[a-zA-Z]/.test(w))).toMatch(/^[0-9]*[A-Z]/); // the first word with letters, after any glued number
      expect(s.typing.caseChanges).toBeLessThanOrEqual(1);
    }
  });

  it('applies the minimum number of swaps or one more, at random', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, twists: 1, count: 20 }, { rng: seeded(7) });
    const counts = new Set(r.suggestions.map((s) => s.twists.length));
    expect(counts.has(1) && counts.has(2)).toBe(true);
    for (const s of r.suggestions) expect(s.twists.length).toBeGreaterThanOrEqual(1);
  });
});

describe('deliberate swaps for typing ease', () => {
  const whole = (w: { slot: string; text: string; original: string }) => w.slot !== 'num' && w.text.length > 2 && w.original.length > 2;

  it('types every awkward whole word with its swap, keeps the hint as written, and adds no bits', () => {
    const r = generate(req({ easeSwaps: true, twists: 0, count: 20 }), { rng: seeded(5) });
    let eased = 0;
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const cold = scoreCold(s.password, s.hint);
      expect(cold.bits).toBe(s.bits);
      expect(cold.twistCount, s.password).toBe(0);
      expect(cold.aligned, s.password).toBe(true);
      for (const w of s.words.filter(whole)) expect(w.text.toLowerCase(), s.password).toBe(easedText(w.original));
      expect(s.hint).toBe(s.words.map((w) => w.original).join(' '));
      expect(cold.easedCount).toBe(s.words.filter((w) => w.text.toLowerCase() !== w.original).length);
      eased += cold.easedCount;
    }
    expect(eased).toBeGreaterThan(0);
  });

  it('keeps the plan exact: the same pool sizes, with words counted at their typed length', () => {
    const tight = { includeNumber: false, minDigits: 0, minSymbols: 0, targetBits: 0, minLength: 12, maxLength: 14, separator: ';', twists: 0 };
    const on = generate(req({ ...tight, easeSwaps: true, count: 20 }), { rng: seeded(6) });
    const off = generate(req({ ...tight, easeSwaps: false, count: 1 }), { rng: seeded(6) });
    expect(on.plan.template.slots).toEqual(['noun', 'verb', 'noun']);
    expect(on.plan.easeSwaps).toBe(true);
    // Swaps change no pool size, so the unconstrained figure is the same with them on or off: zero bits.
    expect(on.plan.breakdown.map((b) => b.poolSize)).toEqual(off.plan.breakdown.map((b) => b.poolSize));
    expect(on.plan.bits + on.plan.lengthPenaltyBits).toBeCloseTo(off.plan.bits + off.plan.lengthPenaltyBits, 9);
    // Brute force over the length histograms of the words as typed.
    const p = pools('balanced', 0, true);
    const histogram = (words: readonly string[]) => {
      const h = new Map<number, number>();
      for (const w of words) h.set(w.length, (h.get(w.length) ?? 0) + 1);
      return h;
    };
    const count = (typed: (w: string) => string) => {
      const nouns = histogram(p.noun.map(typed));
      const verbs = histogram(p.verb.map(typed));
      let n = 0;
      for (const [a, x] of nouns) for (const [b, y] of verbs) for (const [c, z] of nouns) if (a + b + c >= 10 && a + b + c <= 12) n += x * y * z;
      return n;
    };
    expect(on.plan.bits).toBeCloseTo(Math.log2(count(easedText)), 9);
    expect(count(easedText)).not.toBe(count((w) => w)); // the typed lengths are what count
    for (const s of on.suggestions) {
      expect(s.password.length, s.password).toBeGreaterThanOrEqual(12);
      expect(s.password.length, s.password).toBeLessThanOrEqual(14);
    }
  });

  it('never swaps initials, two-letter words, made-up nouns or numbers, and random swaps on top are counted from the swapped spelling', () => {
    const r = generate(req({ easeSwaps: true, initials: 1, shorthand: 1, madeUp: 1, twists: 3, minUppercase: 3, count: 20, maxLength: 64, targetBits: 50 }), { rng: seeded(8) });
    for (const s of r.suggestions) {
      for (const c of s.checks) expect(c.met, `${s.password}: ${c.rule}`).toBe(true);
      const cold = scoreCold(s.password, s.hint);
      expect(cold.aligned, `${s.password} / ${s.hint}`).toBe(true);
      expect(cold.template).toBeDefined();
      for (const w of s.words) {
        if (/^[A-Z]$/.test(w.text)) expect(w.original[0]!.toUpperCase()).toBe(w.text);
        if (w.slot === 'num') expect(w.text).toMatch(/^[0-9]+$/);
      }
      for (const w of cold.words) if (w.form === 'eased') expect(w.base).toBe(easedText(w.word));
      // Every random swap is on a word as typed, deliberate swap included.
      for (const t of s.twists) expect(plainOf(t.before) !== t.before || easeOf(t.before) === undefined, t.before).toBe(true);
    }
  });

  it('is deterministic: the same draw gives the same passwords, and a word is always swapped the same way', () => {
    const a = generate(req({ easeSwaps: true, count: 10 }), { rng: seeded(9) });
    const b = generate(req({ easeSwaps: true, count: 10 }), { rng: seeded(9) });
    expect(a.suggestions.map((s) => s.password)).toEqual(b.suggestions.map((s) => s.password));
    const spelled = new Map<string, Set<string>>();
    for (const seed of [1, 2, 3, 4]) {
      for (const s of generate(req({ easeSwaps: true, twists: 0, comfort: 'relaxed', count: 20 }), { rng: seeded(seed) }).suggestions) {
        for (const w of s.words.filter(whole)) spelled.set(w.original, new Set([...(spelled.get(w.original) ?? []), w.text.toLowerCase()]));
      }
    }
    for (const [word, texts] of spelled) expect([...texts], word).toEqual([easedText(word)]);
  });
});
