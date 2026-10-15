// Twists: symbol swaps and deliberate misspellings applied to a few letters
// of the sentence ("amber" -> "@mber", "phone" -> "fone").
//
// A twist only adds strength because *where* it lands is random. For each
// password we count every distinct way the chosen number of twists could have
// been applied, pick one uniformly, and report log2 of that count as the bits
// it added.

import { lookupKey } from './keyboard';
import { weightedIndex, type RandomSource } from './random';

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

/** Reason a custom mapping is unusable, or undefined if it is fine. */
export function validateMapping(from: string, to: string): string | undefined {
  if (!/^[a-z]{1,8}$/.test(from)) return 'Replace: 1-8 lowercase letters.';
  if (to.length > 8) return 'With: at most 8 characters.';
  if (to === from) return 'Replace and With are the same.';
  for (const c of to) {
    if (c === ' ') return 'With: spaces are not allowed.';
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
  /** Keep the first character a letter so sentence-case capitalisation still works. */
  protectFirstLetter: boolean;
  /** Allowed change in total length, so the result still fits the length limits. */
  minDelta: number;
  maxDelta: number;
}

interface Candidate {
  start: number;
  end: number;
  mapping: Mapping;
}

/** One distinct way to spell a word, with the fewest twists that produce it. */
interface Variant {
  text: string;
  twists: number;
  delta: number;
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

/** Every distinct spelling of a word using up to `max` non-overlapping twists. */
function variantsFor(word: string, candidates: readonly Candidate[], max: number): Variant[] {
  const byText = new Map<string, Variant>();
  const used: Candidate[] = [];
  const walk = (from: number) => {
    const text = applyToWord(word, used);
    const existing = byText.get(text);
    if (!existing || existing.twists > used.length) {
      byText.set(text, { text, twists: used.length, delta: text.length - word.length, used: [...used] });
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

const stateKey = (twists: number, delta: number) => `${twists}:${delta}`;

/**
 * Apply `count` twists, chosen uniformly from every distinct result that
 * fits the length limits. Each word contributes one of its distinct
 * spellings, counted at the fewest twists that make it, so the count is
 * exact for the set we sample from. Falls back to fewer twists when the
 * words leave no room.
 */
export function applyTwists(words: readonly string[], opts: TwistOptions, rng: RandomSource): TwistResult {
  const firstWord = words.findIndex((_, i) => !opts.skip(i));
  const variants = words.map((word, i) =>
    opts.skip(i)
      ? [{ text: word, twists: 0, delta: 0, used: [] }]
      : variantsFor(word, candidatesFor(word, opts.mappings, opts.protectFirstLetter && i === firstWord), opts.count),
  );

  // suffix[i] maps (twists, length change) to the number of ways words i.. can produce it.
  const suffix: Map<string, number>[] = new Array(words.length + 1);
  suffix[words.length] = new Map([[stateKey(0, 0), 1]]);
  for (let i = words.length - 1; i >= 0; i--) {
    const row = new Map<string, number>();
    for (const [key, ways] of suffix[i + 1]!) {
      const [t, d] = key.split(':').map(Number) as [number, number];
      for (const v of variants[i]!) {
        if (t + v.twists > opts.count) continue;
        const k = stateKey(t + v.twists, d + v.delta);
        row.set(k, (row.get(k) ?? 0) + ways);
      }
    }
    suffix[i] = row;
  }

  for (let k = opts.count; k > 0; k--) {
    const ends = [...suffix[0]!].filter(([key]) => {
      const [t, d] = key.split(':').map(Number) as [number, number];
      return t === k && d >= opts.minDelta && d <= opts.maxDelta;
    });
    const options = ends.reduce((sum, [, n]) => sum + n, 0);
    if (options === 0) continue;

    let [twistsLeft, deltaLeft] = ends[weightedIndex(ends.map(([, n]) => n), rng)]![0].split(':').map(Number) as [number, number];
    const out: string[] = [];
    const applied: AppliedTwist[] = [];
    words.forEach((word, i) => {
      const next = suffix[i + 1]!;
      const vs = variants[i]!;
      const weights = vs.map((v) => next.get(stateKey(twistsLeft - v.twists, deltaLeft - v.delta)) ?? 0);
      const v = vs[weightedIndex(weights, rng)]!;
      twistsLeft -= v.twists;
      deltaLeft -= v.delta;
      out.push(v.text);
      for (const c of [...v.used].sort((a, b) => a.start - b.start)) {
        applied.push({ wordIndex: i, mapping: c.mapping, before: word, after: v.text });
      }
    });
    return { words: out, applied, bits: Math.log2(options), options };
  }
  return { words: [...words], applied: [], bits: 0, options: 1 };
}
