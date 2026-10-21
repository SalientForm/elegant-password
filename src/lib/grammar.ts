// Sentence templates. Every password is one of these shapes filled with
// random words, so it always reads as a grammatical statement:
//
//   adj noun adv verb num adj noun prep adj noun end
//   "sleepy otters gently paint 7 rusty boats near quiet lakes tonight"

import { ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS } from './words';
import { easedText } from './ease';
import { wordCost } from './keyboard';

export type Slot = 'num' | 'adj' | 'noun' | 'verb' | 'adv' | 'end' | 'prep' | 'and';

export const SLOT_LABELS: Record<Slot, string> = {
  num: 'number',
  adj: 'adjective',
  noun: 'noun',
  verb: 'verb',
  adv: 'adverb',
  end: 'ending',
  prep: 'preposition',
  and: 'joiner',
};

export interface Template {
  slots: readonly Slot[];
}

// Clauses in increasing length. Each one is still a complete sentence.
export const CLAUSES: readonly (readonly Slot[])[] = [
  ['noun', 'verb', 'noun'],
  ['adj', 'noun', 'verb', 'noun'],
  ['adj', 'noun', 'verb', 'adj', 'noun'],
  ['adj', 'noun', 'adv', 'verb', 'adj', 'noun'],
  ['adj', 'noun', 'adv', 'verb', 'adj', 'noun', 'end'],
  ['adj', 'noun', 'adv', 'verb', 'adj', 'noun', 'prep', 'noun'],
  ['adj', 'noun', 'adv', 'verb', 'adj', 'noun', 'prep', 'adj', 'noun'],
  ['adj', 'noun', 'adv', 'verb', 'adj', 'noun', 'prep', 'adj', 'noun', 'end'],
];

/** Every sentence shape: single clauses and two clauses joined by "and". */
export function templates(): Template[] {
  const out: Template[] = CLAUSES.map((c) => ({ slots: c }));
  for (const first of CLAUSES.slice(1)) {
    for (const second of CLAUSES) {
      out.push({ slots: [...first, 'and', ...second] });
    }
  }
  return out;
}

/**
 * The template with a number placed in front of each noun phrase in turn:
 * "7 sleepy otters ...", "... paint 7 rusty boats", "... near 7 lakes".
 * Nouns are plural and numbers start at 2, so every placement stays grammatical.
 */
export function numberPlacements(template: Template): Template[] {
  const out: Template[] = [];
  template.slots.forEach((slot, i) => {
    const prev = template.slots[i - 1];
    const startsPhrase = (slot === 'adj' || slot === 'noun') && (prev === undefined || prev === 'verb' || prev === 'prep' || prev === 'and');
    if (startsPhrase) out.push({ slots: [...template.slots.slice(0, i), 'num', ...template.slots.slice(i)] });
  });
  return out;
}

/** Small words: these glue onto the next word when gluing is on. */
export const SMALL_SLOTS: readonly Slot[] = ['prep', 'and'];

// Which words become capital initials first: small words lose the least
// strength and meaning, nouns the most.
export const INITIAL_PRIORITY: readonly Slot[] = ['prep', 'and', 'adv', 'end', 'verb', 'adj', 'noun'];

/**
 * Positions of the `count` words that become a single capital letter,
 * chosen by a fixed priority (so the choice itself adds no strength and
 * costs none to count).
 */
export function initialPositions(slots: readonly Slot[], count: number, taken: readonly number[] = []): number[] {
  const out: number[] = [];
  for (const kind of INITIAL_PRIORITY) {
    slots.forEach((slot, i) => {
      if (slot === kind && out.length < count && !taken.includes(i)) out.push(i);
    });
  }
  return out.sort((a, b) => a - b);
}

// Made-up nouns: keyboard rolls, contiguous letters along one row under one
// hand ("ert", "dfg", "lkj"), either direction, 2-4 keys long.
const ROLL_ROWS = ['qwert', 'asdfg', 'zxcvb', 'yuiop', 'hjkl', 'nm'];

export const KEY_ROLLS: readonly string[] = (() => {
  const out = new Set<string>();
  for (const row of ROLL_ROWS) {
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i + len <= row.length; i++) {
        const seg = row.slice(i, i + len);
        out.add(seg);
        out.add([...seg].reverse().join(''));
      }
    }
  }
  return [...out].sort();
})();

/**
 * Every made-up noun: one or two key rolls joined ("ertdfg"), 3-8 letters,
 * in all lowercase or ALL CAPS (never mixed). Treated as nouns.
 */
export const MADE_UP_NOUNS: readonly string[] = (() => {
  const lower = new Set<string>();
  for (const a of KEY_ROLLS) {
    if (a.length >= 3) lower.add(a);
    for (const b of KEY_ROLLS) {
      const w = a + b;
      if (w.length >= 3 && w.length <= 8) lower.add(w);
    }
  }
  // A roll that spells a real word on the lists ("pods") is that word, never a made-up noun: read back, it
  // would be taken for one, and a kept sentence holding the word refused for a made-up noun it never had.
  const real = new Set([ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS].flat());
  const words = [...lower].filter((w) => !real.has(w)).sort();
  return [...words, ...words.map((w) => w.toUpperCase())];
})();

const MADE_UP_SET = new Set(MADE_UP_NOUNS);
export const isMadeUpNoun = (word: string) => MADE_UP_SET.has(word);

/** Positions of the first `count` nouns, which become made-up nouns. */
export function madeUpPositions(slots: readonly Slot[], count: number): number[] {
  return slots.flatMap((s, i) => (s === 'noun' ? [i] : [])).slice(0, count);
}

// Which words are typed as two letters first: long words save the most.
export const SHORTHAND_PRIORITY: readonly Slot[] = ['adv', 'adj', 'noun', 'verb', 'end'];

/** Positions typed as two letters, avoiding positions already used for initials. */
export function shorthandPositions(slots: readonly Slot[], count: number, taken: readonly number[]): number[] {
  const out: number[] = [];
  for (const kind of SHORTHAND_PRIORITY) {
    slots.forEach((slot, i) => {
      if (slot === kind && out.length < count && !taken.includes(i)) out.push(i);
    });
  }
  return out.sort((a, b) => a - b);
}

/**
 * A word as two letters: its first letter and its last consonant
 * ("jupiter" -> "jr", "piece" -> "pc", "gently" -> "gy"). Words with no
 * consonant after the first letter keep their last letter ("eau" -> "eu").
 */
export function twoLetter(word: string): string {
  if (word.length <= 2) return word;
  const rest = word.slice(1);
  const consonants = rest.replace(/[aeiou]/g, '');
  return word[0]! + (consonants.at(-1) ?? rest.at(-1)!);
}

/** The distinct two-letter forms a pool can produce: what a two-letter slot really chooses from. */
export function twoLettersOf(pool: readonly string[]): string[] {
  return [...new Set(pool.map(twoLetter))].sort();
}

/** The distinct capital initials a word pool can produce: what an initial slot really chooses from. */
export function initialsOf(pool: readonly string[]): string[] {
  return [...new Set(pool.map((w) => w[0]!.toUpperCase()))].sort();
}

export type Comfort = 'strict' | 'balanced' | 'relaxed';

/** Share of each word pool kept, easiest-to-type words first. */
export const COMFORT_SHARE: Record<Comfort, number> = {
  strict: 0.4,
  balanced: 0.7,
  relaxed: 1,
};

/**
 * The leading number. For one digit (or none) it is 2-99; for n digits it is
 * every n-digit number, so the digit count is guaranteed. Numbers start at 2
 * so plural nouns stay grammatical.
 */
function numbers(minDigits: number): string[] {
  if (minDigits <= 1) return Array.from({ length: 98 }, (_, i) => String(i + 2));
  const lo = 10 ** (minDigits - 1);
  return Array.from({ length: 9 * lo }, (_, i) => String(lo + i));
}

const RAW_POOLS: Record<Exclude<Slot, 'num'>, readonly string[]> = {
  adj: ADJECTIVES,
  noun: NOUNS,
  verb: VERBS,
  adv: ADVERBS,
  end: ENDINGS,
  prep: PREPOSITIONS,
  and: ['and'],
};

// Pools never shrink below this, so small lists keep some variety.
export const MIN_POOL = 12;

const poolCache = new Map<string, Record<Slot, readonly string[]>>();

/**
 * Word and number pools filtered to the easiest-to-type share for a
 * comfort level. The joiner is never filtered. With `eased`, words are
 * ranked as they are typed with their deliberate swaps (see ease.ts), so a
 * word that one fixed misspelling makes easy stays in; the pools still hold
 * the words as written, and keep the same sizes.
 */
export function pools(comfort: Comfort, minDigits = 1, eased = false): Record<Slot, readonly string[]> {
  const cacheKey = `${comfort}:${minDigits}:${eased ? 1 : 0}`;
  const cached = poolCache.get(cacheKey);
  if (cached) return cached;
  const share = COMFORT_SHARE[comfort];
  // Numbers are ranked like words: close-together digits ("357") beat far-apart ones ("129").
  const result: Partial<Record<Slot, readonly string[]>> = { num: easiest(numbers(minDigits), share) };
  for (const [slot, words] of Object.entries(RAW_POOLS) as [Exclude<Slot, 'num'>, readonly string[]][]) {
    result[slot] = slot === 'and' ? words : easiest(words, share, eased ? easedText : undefined);
  }
  const complete = result as Record<Slot, readonly string[]>;
  poolCache.set(cacheKey, complete);
  return complete;
}

/** The easiest-to-type share of a pool, never fewer than MIN_POOL; `typed` gives the spelling to rank by. */
function easiest(words: readonly string[], share: number, typed: (w: string) => string = (w) => w): readonly string[] {
  if (share >= 1) return words;
  const keep = Math.max(MIN_POOL, Math.round(words.length * share));
  return [...words]
    .map((w) => ({ w, cost: wordCost(typed(w)) }))
    .sort((a, b) => a.cost - b.cost || a.w.localeCompare(b.w))
    .slice(0, keep)
    .map((x) => x.w);
}

const typedCache = new WeakMap<readonly string[], readonly string[]>();

/** A pool as typed with deliberate swaps: the same size, since no two words share a swapped spelling. */
export function typedPool(pool: readonly string[]): readonly string[] {
  let typed = typedCache.get(pool);
  if (!typed) {
    typed = pool.map(easedText);
    typedCache.set(pool, typed);
  }
  return typed;
}
