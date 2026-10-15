// Cold scoring: everything a card or a saved entry says about a password's
// strength and difficulty comes from this one function of the password and
// its hint. Nothing else goes in: not the settings that made it, not how
// many suggestions were shown, not how many times "Refresh" was
// pressed. So a password scores the same every time, wherever it appears.
//
// The model: an attacker who knows this tool. Each hint word is found in the
// password (whole, shortened, as a capital initial, or twisted), the hint is
// matched against the sentence templates, and the bits are log2 of the
// smallest space this tool could have drawn the sentence from (the most
// restrictive typing-comfort level that contains every word), plus the
// exact number of ways the twists could have landed. Length limits are not
// known cold and are ignored; the strength panel shows the exact figure for
// the current plan. A hint that is not one of the tool's sentences is scored
// word by word from its text, the same rules for every password whatever its
// origin: a word on the tool's lists is one pick from that list, any other
// word is English-like text at a fixed number of bits per letter, a capital
// initial is one letter, a number is its digits.

import { scoreDifficulty, type Difficulty } from './difficulty';
import {
  initialsOf,
  isMadeUpNoun,
  MADE_UP_NOUNS,
  numberPlacements,
  pools,
  templates,
  twoLetter,
  twoLettersOf,
  type Comfort,
  type Slot,
} from './grammar';
import { typingProfile, type TypingProfile } from './keyboard';
import { dropVowels, normalizeSentence, SMALL_WORDS, trimInterior } from './text';
import { BUILT_IN_MAPPINGS, spellingsOf, twistOutcomes, type Mapping } from './twists';

export type WordForm = 'word' | 'short' | 'initial' | 'number' | 'dropped';

export interface ScoredWord {
  /** The hint word, normalised. */
  word: string;
  form: WordForm;
  /** The form's text before any twist ("jptr"); empty when the word was dropped. */
  base: string;
  /** As it appears in the password, case as typed; empty when dropped. */
  text: string;
  twists: number;
  /** Part of speech when the hint matched a sentence template. */
  slot?: Slot;
  /** Distinct options the slot was drawn from, when matched. */
  poolSize?: number;
}

/**
 * How closely the password still looks like its sentence, 0-100. Words that
 * keep their full length score 1, shortened words the fraction kept,
 * dropped words 0 (fidelity, 60 %); shorter passwords score higher
 * (brevity, 40 %: 1 at 16 characters or fewer, 0 at 48 or more); each
 * swapped word costs 5 points, up to 20.
 */
export interface Memorability {
  score: number;
  /** Mean size credit over the hint words, 0-1. */
  fidelity: number;
  /** 0-1 from the password's length. */
  brevity: number;
  /** Hint words that kept their full length. */
  sameSize: number;
  swappedWords: number;
}

export const MEMORABILITY = { fidelityWeight: 0.6, brevityWeight: 0.4, shortAt: 16, longAt: 48, swapPenalty: 5, maxSwapPenalty: 20 } as const;

export function memorabilityOf(password: string, words: readonly ScoredWord[]): Memorability {
  const credits = words.map((w) => {
    if (w.form === 'dropped') return 0;
    const kept = [...w.text].length / Math.max(1, [...w.word].length);
    return Math.min(1, kept);
  });
  const fidelity = credits.length ? credits.reduce((a, b) => a + b, 0) / credits.length : 0;
  const length = [...password].length;
  const brevity = Math.min(1, Math.max(0, 1 - (length - MEMORABILITY.shortAt) / (MEMORABILITY.longAt - MEMORABILITY.shortAt)));
  const swappedWords = words.filter((w) => w.twists > 0).length;
  const penalty = Math.min(MEMORABILITY.maxSwapPenalty, swappedWords * MEMORABILITY.swapPenalty);
  const score = Math.max(0, Math.round(100 * (MEMORABILITY.fidelityWeight * fidelity + MEMORABILITY.brevityWeight * brevity) - penalty));
  return { score, fidelity, brevity, sameSize: credits.filter((c) => c >= 1).length, swappedWords };
}

export interface ColdScore {
  /** Sentence bits plus twist bits plus initial-choice bits. */
  bits: number;
  /** log2 of the sentence space: the template's exact pools when the hint is one of the tool's sentences, else the words scored from their text. */
  sentenceBits: number;
  twistBits: number;
  /** Bits from which words became random initials (your own sentence only). */
  initialBits: number;
  twistCount: number;
  twistOptions: number;
  /** The matched template, number included. */
  template?: Slot[];
  /** The most restrictive comfort level whose pools contain every word. */
  comfort?: Comfort;
  /** True when every hint word was found in the password. */
  aligned: boolean;
  words: ScoredWord[];
  difficulty: Difficulty;
  typing: TypingProfile;
  memorability: Memorability;
}

const MAX_TWISTS_PER_WORD = 3;
const COMFORTS: readonly Comfort[] = ['strict', 'balanced', 'relaxed'];
const POOL_SLOTS: readonly Exclude<Slot, 'num' | 'and'>[] = ['adj', 'noun', 'verb', 'adv', 'end', 'prep'];

/** Base forms a hint word can take in a password, longest first, each with its kind. */
function formsOf(word: string): { base: string; form: WordForm }[] {
  if (/^[0-9]+$/.test(word)) {
    // Long numbers keep their leading digits ("2026" -> "20").
    return Array.from({ length: word.length }, (_, i) => ({ base: word.slice(0, word.length - i), form: 'number' as const }));
  }
  const out = new Map<string, WordForm>([[word, 'word']]);
  // Sentence mode: drop vowels, then trim interior letters down to two.
  let t = dropVowels(word);
  for (;;) {
    if (!out.has(t) && t !== word) out.set(t, 'short');
    const next = trimInterior(t);
    if (next === t || next.length < 2) break;
    t = next;
  }
  const two = twoLetter(word);
  if (!out.has(two)) out.set(two, 'short');
  return [...out].map(([base, form]) => ({ base, form })).sort((a, b) => b.base.length - a.base.length);
}

const startsWithFold = (text: string, prefix: string) => text.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();

const escapeRe = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Padding may repeat a digit or symbol a swap put inside a word ("$t33l" ->
 * "$t33333l"). How much of `rest` a spelling covers when each of its
 * non-letter characters may run on, or undefined when it does not fit.
 */
const expandCache = new Map<string, RegExp | null>();
const EXPAND_CACHE_LIMIT = 5000;

function expandedLength(rest: string, spelling: string): number | undefined {
  // Cheap checks first: the run must start like the spelling, and the spelling must have something to repeat.
  if (rest.length <= spelling.length || !startsWithFold(rest, spelling[0]!)) return undefined;
  let re = expandCache.get(spelling);
  if (re === undefined) {
    re = /[^a-zA-Z]/.test(spelling)
      ? new RegExp('^' + [...spelling].map((c) => (/[a-zA-Z]/.test(c) ? escapeRe(c) : `${escapeRe(c)}+`)).join(''), 'i')
      : null;
    if (expandCache.size >= EXPAND_CACHE_LIMIT) expandCache.clear();
    expandCache.set(spelling, re);
  }
  if (!re) return undefined;
  const m = rest.match(re);
  return m && m[0].length > spelling.length ? m[0].length : undefined;
}

/** The longest way `word` could appear at the start of `rest`; fewest twists on ties. */
function bestMatch(rest: string, word: string, mappings: readonly Mapping[]): ScoredWord | undefined {
  const forms = formsOf(word);
  let best: ScoredWord | undefined;
  const consider = (c: ScoredWord) => {
    if (!best || c.text.length > best.text.length || (c.text.length === best.text.length && c.twists < best.twists)) best = c;
  };
  for (const { base, form } of forms) {
    if (startsWithFold(rest, base)) consider({ word, form, base, text: rest.slice(0, base.length), twists: 0 });
  }
  const initial = word[0]!.toUpperCase();
  if (/[A-Z]/.test(initial) && rest[0] === initial) consider({ word, form: 'initial', base: initial, text: initial, twists: 0 });
  // Only look for twisted spellings when the plain word is not there: twists
  // never leave the plain word in place, and enumerating spellings costs more.
  if (best?.form === 'word') return best;
  for (const { base, form } of forms) {
    if (form === 'number') continue;
    for (const s of spellingsOf(base, mappings, MAX_TWISTS_PER_WORD)) {
      if (s.twists === 0) continue;
      if (startsWithFold(rest, s.text)) consider({ word, form, base, text: rest.slice(0, s.text.length), twists: s.twists });
      // Padding may have repeated a digit or symbol of this spelling; the longer run is the same word.
      const n = expandedLength(rest, s.text);
      if (n !== undefined) consider({ word, form, base, text: rest.slice(0, n), twists: s.twists });
    }
  }
  return best;
}

/**
 * Walk the hint words through the password. A word is looked for where the
 * last one ended and, failing that, further along the run of symbols that
 * follows (a separator, closing marks, the symbol of a length tag like
 * "%50"). Symbols are never skipped blindly: a twist can put one at the
 * start of a word ("apples" -> "@pples"), so matching in place always wins.
 */
function align(password: string, words: readonly string[], mappings: readonly Mapping[]): ScoredWord[] {
  let pos = 0;
  const out: ScoredWord[] = [];
  for (const word of words) {
    let match = bestMatch(password.slice(pos), word, mappings);
    let skipped = 0;
    while (!match && pos + skipped < password.length && /[^A-Za-z0-9]/.test(password[pos + skipped]!)) {
      skipped++;
      match = bestMatch(password.slice(pos + skipped), word, mappings);
    }
    if (!match) {
      out.push({ word, form: 'dropped', base: '', text: '', twists: 0 });
      continue;
    }
    out.push(match);
    pos += skipped + match.text.length;
  }
  return out;
}

const poolSets = new Map<string, Set<string>>();
function inPool(word: string, slot: Slot, comfort: Comfort, minDigits: number): boolean {
  const key = `${comfort}:${minDigits}:${slot}`;
  let set = poolSets.get(key);
  if (!set) {
    set = new Set(pools(comfort, minDigits)[slot]);
    poolSets.set(key, set);
  }
  return set.has(word);
}

/** Parts of speech a hint word could fill, from the full word lists. */
function slotsFor(word: string): Slot[] {
  if (/^[0-9]+$/.test(word)) return ['num'];
  if (word === 'and') return ['and'];
  if (isMadeUpNoun(word)) return ['noun'];
  return POOL_SLOTS.filter((slot) => inPool(word, slot, 'relaxed', 1));
}

const digitsFor = (word: string) => Math.max(1, word.length);

interface Match {
  template: Slot[];
  comfort: Comfort;
  sizes: number[];
  bits: number;
}

/** The sentence template (and comfort level) this hint fits with the fewest bits, if any. */
function matchTemplate(words: readonly string[], scored: readonly ScoredWord[]): Match | undefined {
  const options = words.map(slotsFor);
  if (options.some((o) => o.length === 0)) return undefined;
  const hasNumber = options.some((o) => o[0] === 'num');
  let best: Match | undefined;
  for (const template of templates()) {
    for (const shape of hasNumber ? numberPlacements(template) : [template]) {
      const slots = shape.slots as Slot[];
      if (slots.length !== words.length || !slots.every((slot, i) => options[i]!.includes(slot))) continue;
      const match = measureMatch(words, scored, slots, hasNumber ? numberPlacements(template).length : 1);
      if (match && (!best || match.bits < best.bits)) best = match;
    }
  }
  return best;
}

function measureMatch(words: readonly string[], scored: readonly ScoredWord[], slots: Slot[], placements: number): Match | undefined {
  // The most restrictive comfort level whose pools contain every word.
  let level = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const slot = slots[i]!;
    if (slot === 'and' || isMadeUpNoun(word)) continue;
    const minDigits = slot === 'num' ? digitsFor(word) : 1;
    const found = COMFORTS.findIndex((c, j) => j >= level && inPool(word, slot, c, minDigits));
    if (found < 0) return undefined;
    level = found;
  }
  const comfort = COMFORTS[level]!;
  const sizes = words.map((word, i) => {
    const slot = slots[i]!;
    if (slot === 'and') return 1;
    if (isMadeUpNoun(word)) return MADE_UP_NOUNS.length;
    const pool = pools(comfort, slot === 'num' ? digitsFor(word) : 1)[slot];
    const form = scored[i];
    if (form?.form === 'initial') return initialsOf(pool).length;
    if (form?.form === 'short' && form.base === twoLetter(word)) return twoLettersOf(pool).length;
    return pool.length;
  });
  const bits = sizes.reduce((sum, n) => sum + Math.log2(n), 0) + Math.log2(placements);
  return { template: slots, comfort, sizes, bits };
}

const BITS_PER_ENGLISH_LETTER = 2.3;
const SYMBOL_ALPHABET = 32;
const MEMORABLE_SETS = new Set(['2468', '8642', '13579', '97531', '1357', '7531']);

/** A run of digits anyone would remember: one digit repeated, consecutive digits up or down (123, 4321), or a well-known skip pattern. */
export function isMemorableDigits(digits: string): boolean {
  if (digits.length < 2) return true;
  if (/^(\d)\1*$/.test(digits) || MEMORABLE_SETS.has(digits)) return true;
  const step = Number(digits[1]) - Number(digits[0]);
  if (Math.abs(step) !== 1) return false;
  for (let i = 1; i < digits.length; i++) if (Number(digits[i]) - Number(digits[i - 1]) !== step) return false;
  return true;
}

/** The smallest of the tool's lists containing a word, or undefined. */
function smallestPoolFor(word: string): readonly string[] | undefined {
  const candidates = POOL_SLOTS.filter((slot) => inPool(word, slot, 'relaxed', 1)).map((slot) => pools('relaxed', 1)[slot]);
  if (isMadeUpNoun(word)) candidates.push(MADE_UP_NOUNS);
  return candidates.sort((a, b) => a.length - b.length)[0];
}

/**
 * Bits for one aligned word scored from its text alone, the same for every
 * password whatever its origin: a number by its digits (a memorable run is
 * one pick), a word on the tool's lists as one pick from the smallest list
 * holding it (its initials list when typed as an initial), any other word as
 * English-like text, an initial of it as one letter, a dropped word nothing.
 */
export function wordBitsFromText(w: ScoredWord): number {
  if (w.form === 'dropped') return 0;
  if (/^[0-9]+$/.test(w.word)) return isMemorableDigits(w.word) ? Math.log2(40) : w.word.length * Math.log2(10);
  const pool = smallestPoolFor(w.word);
  if (w.form === 'initial') return Math.log2(pool ? initialsOf(pool).length : 26);
  if (pool) return Math.log2(pool.length);
  return w.word.length * BITS_PER_ENGLISH_LETTER;
}

const choose = (n: number, k: number) => {
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return out;
};

const cache = new Map<string, ColdScore>();
const CACHE_LIMIT = 400;

/**
 * Score a password from its text and hint alone. Deterministic: the same
 * inputs always give the same result. See the note at the top of this file
 * for what the figures mean and what they leave out.
 */
export function scoreCold(password: string, hint: string, mappings: readonly Mapping[] = BUILT_IN_MAPPINGS): ColdScore {
  const key = `${password}\u0000${hint}`;
  const cacheable = mappings === BUILT_IN_MAPPINGS;
  if (cacheable) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const words = normalizeSentence(hint);
  const scored = align(password, words, mappings);
  const match = matchTemplate(words, scored);
  if (match) {
    scored.forEach((s, i) => {
      s.slot = match.template[i]!;
      s.poolSize = match.sizes[i]!;
    });
  }

  // Twists: how many distinct ways the ones found could have landed.
  const twistCount = scored.reduce((n, s) => n + s.twists, 0);
  let twistOptions = 1;
  if (twistCount > 0) {
    const bases = scored.map((s) => s.base);
    const first = scored.find((s) => s.form === 'word' || s.form === 'short');
    const protectFirstLetter = !!first && /^[A-Z][a-z]/.test(first.text);
    twistOptions = twistOutcomes(bases, {
      count: twistCount,
      mappings,
      skip: (i) => scored[i]!.form !== 'word' && scored[i]!.form !== 'short',
      protectFirstLetter,
      minDelta: -Infinity,
      maxDelta: Infinity,
    }, twistCount);
  }
  const twistBits = Math.log2(Math.max(1, twistOptions));

  // Your own sentence: which words became random initials is a choice too.
  let initialBits = 0;
  if (!match) {
    const eligible = words.filter((w) => !/^[0-9]+$/.test(w) && !SMALL_WORDS.has(w));
    const chosen = scored.filter((s) => s.form === 'initial' && eligible.includes(s.word)).length;
    if (chosen > 0) initialBits = Math.log2(choose(eligible.length, chosen));
  }

  // One rule for every password: the exact template figure when the hint is one of the tool's sentences, else each word from its text.
  const sentenceBits = match ? match.bits : scored.reduce((sum, w) => sum + wordBitsFromText(w), 0);
  const result: ColdScore = {
    bits: sentenceBits + twistBits + initialBits,
    sentenceBits,
    twistBits,
    initialBits,
    twistCount,
    twistOptions,
    template: match?.template,
    comfort: match?.comfort,
    aligned: scored.every((s) => s.form !== 'dropped'),
    words: scored,
    difficulty: scoreDifficulty(password, words.length + twistCount),
    typing: typingProfile(password),
    memorability: memorabilityOf(password, scored),
  };
  if (cacheable) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, result);
  }
  return result;
}


/** One run of characters in a password scored on its own. */
export interface AlonePart {
  text: string;
  kind: 'word' | 'letters' | 'digits' | 'symbols' | 'spaces';
  bits: number;
  /** Set when the letters are one of this tool's words (any list). */
  poolSize?: number;
}

export interface AloneScore {
  bits: number;
  parts: AlonePart[];
  difficulty: Difficulty;
  typing: TypingProfile;
}

/**
 * A rough strength figure for a password typed in with no hint, scored from
 * the text alone. Letters that are one of this tool's words count as one
 * choice from that list; other letters count as English-like text; digits
 * and symbols count as free choices unless they are a memorable run or a
 * repeat. It is deterministic and the same everywhere, and it is an estimate:
 * it knows nothing about where the password came from.
 */
export function scoreAlone(password: string): AloneScore {
  const parts: AlonePart[] = [];
  for (const m of password.matchAll(/[A-Za-z]+|[0-9]+|\s+|[^A-Za-z0-9\s]+/g)) {
    const text = m[0];
    if (/^[A-Za-z]+$/.test(text)) {
      const lower = text.toLowerCase();
      const pool = smallestPoolFor(lower);
      if (pool) {
        parts.push({ text, kind: 'word', bits: Math.log2(pool.length), poolSize: pool.length });
      } else {
        parts.push({ text, kind: 'letters', bits: text.length * BITS_PER_ENGLISH_LETTER });
      }
    } else if (/^[0-9]+$/.test(text)) {
      parts.push({ text, kind: 'digits', bits: isMemorableDigits(text) ? Math.log2(40) : text.length * Math.log2(10) });
    } else if (/^\s+$/.test(text)) {
      parts.push({ text, kind: 'spaces', bits: 0 });
    } else {
      const repeated = /^(.)\1*$/.test(text);
      parts.push({ text, kind: 'symbols', bits: repeated ? Math.log2(SYMBOL_ALPHABET) + Math.log2(text.length + 1) : text.length * Math.log2(SYMBOL_ALPHABET) });
    }
  }
  const bits = parts.reduce((sum, p) => sum + p.bits, 0);
  const chunks = parts.filter((p) => p.kind !== 'spaces').length;
  return { bits, parts, difficulty: scoreDifficulty(password, chunks), typing: typingProfile(password) };
}
