// Twists: symbol swaps and deliberate misspellings applied to a few letters
// of the sentence ("amber" -> "@mber", "phone" -> "fone").
//
// A twist only adds strength because *where* it lands is random. For each
// password we count every distinct way the chosen number of twists could have
// been applied, pick one uniformly, and report log2 of that count as the bits
// it added. The same table answers "how many ways were there" for a password
// scored cold from its hint.

import { lookupKey } from './keyboard';
import { weightedIndex, type RandomSource } from './random';
import { letterCount } from './text';

export type MappingKind = 'symbol' | 'digit' | 'spelling' | 'custom';

export interface Mapping {
  from: string;
  to: string;
  kind: MappingKind;
}

export const MAPPING_KIND_LABELS: Record<MappingKind, string> = {
  symbol: 'Symbol swaps',
  digit: 'Number swaps',
  spelling: 'Misspellings',
  custom: 'Your mappings',
};

/** The built-in kinds in the order they are listed: symbol swaps, number swaps, misspellings. */
export const BUILT_IN_KINDS = ['symbol', 'digit', 'spelling'] as const satisfies readonly MappingKind[];

const pairs = (kind: MappingKind, spec: string): Mapping[] =>
  spec
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [from, to] = p.split('>') as [string, string];
      return { from, to, kind };
    });

// 64 built-in mappings: 12 symbol swaps, 18 number swaps, 34 misspellings.
export const BUILT_IN_MAPPINGS: readonly Mapping[] = [
  ...pairs('symbol', 'a>@ at>@ and>& l>! i>! s>$ c>( h># t>+ x>* i>| ll>!!'),
  ...pairs('digit', 'o>0 i>1 l>1 e>3 a>4 s>5 g>6 t>7 b>8 g>9 z>2 to>2 too>2 for>4 ate>8 one>1 won>1 four>4'),
  ...pairs(
    'spelling',
    `ph>f f>ph ck>k c>k ce>z qu>kw x>ks cks>x s>z z>s ee>ea ea>ee ie>ee oo>u
     ou>ow er>a ight>ite you>u are>r see>c ie>y y>ie tion>shun wh>w th>d
     ing>in ll>l tt>t ss>s pp>p le>el ei>ie ise>ize i>y`,
  ),
];

export const mappingKey = (m: Pick<Mapping, 'from' | 'to'>) => `${m.from}>${m.to}`;

/** The most characters either side of a custom swap may have: Replace is 1 to this many lowercase letters, With at most this many characters. */
export const MAX_MAPPING_LENGTH = 8;
const CUSTOM_FROM = new RegExp(`^[a-z]{1,${MAX_MAPPING_LENGTH}}$`);

/**
 * Reason a custom mapping is unusable, or undefined if it is fine. The
 * output may only use lowercase letters, digits and keyboard symbols: a
 * capital in the middle of a word would make the case alternate, which the
 * typing model never allows, and it would be silently skipped anyway.
 */
export function validateMapping(from: string, to: string): string | undefined {
  if (!CUSTOM_FROM.test(from)) return `Replace: 1-${MAX_MAPPING_LENGTH} lowercase letters.`;
  if (to.length > MAX_MAPPING_LENGTH) return `With: at most ${MAX_MAPPING_LENGTH} characters.`;
  if (to === from) return 'Replace and With are the same.';
  for (const c of to) {
    if (c === ' ') return 'With: spaces are not allowed.';
    if (/[A-Z]/.test(c)) return 'With: lowercase letters only, so the case never alternates inside a word.';
    if (!lookupKey(c)) return `With: "${c}" is not on a standard keyboard.`;
  }
  return undefined;
}

export interface AppliedTwist {
  wordIndex: number;
  mapping: Mapping;
  before: string;
  after: string;
}

export interface TwistResult {
  words: string[];
  applied: AppliedTwist[];
  /** log2 of the number of distinct results that were possible. */
  bits: number;
  /** How many distinct results were possible. */
  options: number;
}

export interface TwistOptions {
  count: number;
  mappings: readonly Mapping[];
  /** Word positions that must not be twisted (e.g. the leading number). */
  skip: (wordIndex: number) => boolean;
  /** The word that takes the opening capital: its first character stays a letter, so the capital can go there. */
  capitalAt?: number;
  /** Allowed change in total length, so the result still fits the length limits. */
  minDelta: number;
  maxDelta: number;
  /**
   * The twisted words must keep at least this many letters between them, so
   * an uppercase rule that needs N capitals can still be met afterwards.
   */
  minLetters?: number;
}

interface Candidate {
  start: number;
  end: number;
  mapping: Mapping;
}

/** One distinct way to spell a word, with the fewest twists that produce it. */
export interface Spelling {
  text: string;
  twists: number;
  /** Change in length compared with the plain word. */
  delta: number;
  /** Change in letter count compared with the plain word. */
  letters: number;
}

interface Variant extends Spelling {
  used: Candidate[];
}

function candidatesFor(word: string, mappings: readonly Mapping[], protectStart: boolean): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const mapping of mappings) {
    const key = mappingKey(mapping);
    if (seen.has(key)) continue;
    seen.add(key);
    for (let start = word.indexOf(mapping.from); start >= 0; start = word.indexOf(mapping.from, start + 1)) {
      if (protectStart && start === 0 && !/^[a-z]/.test(mapping.to)) continue;
      out.push({ start, end: start + mapping.from.length, mapping });
    }
  }
  return out;
}

function applyToWord(word: string, used: readonly Candidate[]): string {
  let out = word;
  for (const c of [...used].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, c.start) + c.mapping.to + out.slice(c.end);
  }
  return out;
}

/**
 * Every distinct spelling of a word using up to `max` non-overlapping
 * twists. A word never disappears entirely: a spelling that would leave
 * nothing (a custom mapping deleting the whole word) is not an option.
 */
function variantsFor(word: string, candidates: readonly Candidate[], max: number): Variant[] {
  const byText = new Map<string, Variant>();
  const used: Candidate[] = [];
  const base = letterCount(word);
  const walk = (from: number) => {
    const text = applyToWord(word, used);
    const existing = byText.get(text);
    if (text !== '' && (!existing || existing.twists > used.length)) {
      byText.set(text, { text, twists: used.length, delta: text.length - word.length, letters: letterCount(text) - base, used: [...used] });
    }
    if (used.length === max) return;
    for (let i = from; i < candidates.length; i++) {
      const c = candidates[i]!;
      if (used.some((u) => c.start < u.end && u.start < c.end)) continue;
      used.push(c);
      walk(i + 1);
      used.pop();
    }
  };
  walk(0);
  return [...byText.values()];
}

// Spellings are memoised per mapping list: sentence mode finishes the same
// words many times, and the cold scorer asks about the same words again. A
// list that is dropped takes its spellings with it; the built-in list lives
// as long as the page, so each list's spellings are capped and start afresh
// when full, like the scorer's caches.
const variantCache = new WeakMap<readonly Mapping[], Map<string, Variant[]>>();
/** The most spellings kept for one mapping list. */
export const VARIANT_CACHE_LIMIT = 5000;

function cachedVariants(word: string, mappings: readonly Mapping[], max: number, protectStart: boolean): Variant[] {
  let byKey = variantCache.get(mappings);
  if (!byKey) {
    byKey = new Map();
    variantCache.set(mappings, byKey);
  }
  const key = `${max}:${protectStart ? 1 : 0}:${word}`;
  let v = byKey.get(key);
  if (!v) {
    v = variantsFor(word, candidatesFor(word, mappings, protectStart), max);
    if (byKey.size >= VARIANT_CACHE_LIMIT) byKey.clear();
    byKey.set(key, v);
  }
  return v;
}

/** How many spellings are cached for a mapping list; for tests of the cap. */
export const cachedSpellingCount = (mappings: readonly Mapping[]) => variantCache.get(mappings)?.size ?? 0;

/** Every distinct spelling of a word reachable with up to `max` twists, including the plain word at 0. */
export function spellingsOf(word: string, mappings: readonly Mapping[], max: number, protectStart = false): readonly Spelling[] {
  return cachedVariants(word, mappings, max, protectStart);
}

const stateKey = (twists: number, delta: number, letters: number) => `${twists}:${delta}:${letters}`;
const parseKey = (key: string) => key.split(':').map(Number) as [number, number, number];

interface Table {
  variants: Variant[][];
  /** suffix[i] maps (twists, length change, letter change) to the number of ways words i.. can produce it. */
  suffix: Map<string, number>[];
  /** Letters in the twistable words before any twist. */
  baseLetters: number;
}

function buildTable(words: readonly string[], opts: TwistOptions): Table {
  const plain = (word: string): Variant => ({ text: word, twists: 0, delta: 0, letters: 0, used: [] });
  const variants = words.map((word, i) =>
    opts.skip(i) ? [plain(word)] : cachedVariants(word, opts.mappings, opts.count, i === opts.capitalAt),
  );
  const baseLetters = words.reduce((n, w, i) => (opts.skip(i) ? n : n + letterCount(w)), 0);

  const suffix: Map<string, number>[] = new Array(words.length + 1);
  suffix[words.length] = new Map([[stateKey(0, 0, 0), 1]]);
  for (let i = words.length - 1; i >= 0; i--) {
    const row = new Map<string, number>();
    for (const [key, ways] of suffix[i + 1]!) {
      const [t, d, l] = parseKey(key);
      for (const v of variants[i]!) {
        if (t + v.twists > opts.count) continue;
        const k = stateKey(t + v.twists, d + v.delta, l + v.letters);
        row.set(k, (row.get(k) ?? 0) + ways);
      }
    }
    suffix[i] = row;
  }
  return { variants, suffix, baseLetters };
}

/** The end states that use exactly `k` twists and respect the length and letter limits. */
function endStates(table: Table, opts: TwistOptions, k: number): [string, number][] {
  const minLetters = opts.minLetters ?? 0;
  return [...table.suffix[0]!].filter(([key]) => {
    const [t, d, l] = parseKey(key);
    return t === k && d >= opts.minDelta && d <= opts.maxDelta && table.baseLetters + l >= minLetters;
  });
}

/**
 * How many distinct results exactly `k` twists could produce on these words
 * under the given limits. This is what a password's twist bits are counted
 * from, whether at generation time or when scoring it cold from its hint.
 */
export function twistOutcomes(words: readonly string[], opts: TwistOptions, k: number): number {
  if (k === 0) return 1;
  const table = buildTable(words, { ...opts, count: k });
  return endStates(table, opts, k).reduce((sum, [, n]) => sum + n, 0);
}

/**
 * Apply `count` twists, chosen uniformly from every distinct result that
 * fits the length limits. Each word contributes one of its distinct
 * spellings, counted at the fewest twists that make it, so the count is
 * exact for the set we sample from. Falls back to fewer twists when the
 * words leave no room.
 */
export function applyTwists(words: readonly string[], opts: TwistOptions, rng: RandomSource): TwistResult {
  const table = buildTable(words, opts);
  const { variants, suffix } = table;

  for (let k = opts.count; k > 0; k--) {
    const ends = endStates(table, opts, k);
    const options = ends.reduce((sum, [, n]) => sum + n, 0);
    if (options === 0) continue;

    let [twistsLeft, deltaLeft, lettersLeft] = parseKey(ends[weightedIndex(ends.map(([, n]) => n), rng)]![0]);
    const out: string[] = [];
    const applied: AppliedTwist[] = [];
    words.forEach((word, i) => {
      const next = suffix[i + 1]!;
      const vs = variants[i]!;
      const weights = vs.map((v) => next.get(stateKey(twistsLeft - v.twists, deltaLeft - v.delta, lettersLeft - v.letters)) ?? 0);
      const v = vs[weightedIndex(weights, rng)]!;
      twistsLeft -= v.twists;
      deltaLeft -= v.delta;
      lettersLeft -= v.letters;
      out.push(v.text);
      for (const c of [...v.used].sort((a, b) => a.start - b.start)) {
        applied.push({ wordIndex: i, mapping: c.mapping, before: word, after: v.text });
      }
    });
    return { words: out, applied, bits: Math.log2(options), options };
  }
  return { words: [...words], applied: [], bits: 0, options: 1 };
}
