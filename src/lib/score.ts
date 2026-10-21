// Cold scoring: what a card or a saved entry says about a password's
// difficulty and memorability comes from this one function of the password
// and its hint, and nothing else: not the settings that made it, not how
// many suggestions were shown, not which swaps were switched on. So a
// password scores the same every time, wherever it appears. (Strength and
// Raw need only the password; see strength.ts.)
//
// The same function also gives the bits: the figure for an attacker who
// knows this tool. Each hint word is found in the password (whole,
// shortened, as a capital initial, or twisted), the hint is matched against
// the sentence templates, and the bits are log2 of the smallest space this
// tool could have drawn the sentence from (the most restrictive
// typing-comfort level that contains every word), plus the exact number of
// ways the twists could have landed, counted over the swap list in force
// (`mappings`: the session's, so one custom swap makes 65). That is the one
// figure here that depends on the session, and it is shown only there,
// never saved as a score. Length limits are not known cold and are ignored;
// the strength panel shows the exact figure for the current plan. A hint
// that is not one of the tool's sentences is scored word by word from its
// text, the same rules for every password whatever its origin: a word on
// the tool's lists is one pick from that list, any other word is
// English-like text at a fixed number of bits per letter (a repeated letter
// counted once), a capital initial is one letter, a number is its digits.
//
// A hint can only help an attacker. So a hint word that is not in the
// password adds nothing, letters and digits in the password that no hint
// word accounts for are scored as text, and the bits with a hint are never
// above the password's own text reading (the hint read off its text with
// inferredHint): if the hint reveals structure the text alone does not show
// (a swapped or shortened word), the text reading is the ceiling.
//
// Finding the hint's words never looks at the session: the fixed shortening
// rules, the built-in swap table, and failing those any spelling within a
// few single-character edits (so a word reached through a custom swap is
// the word, one step away, not a dropped word).
//
// Deliberate swaps for typing ease (ease.ts) are a fixed function of the
// word, so the scorer works them out from the hint: a word typed with its
// deliberate swap is form 'eased' and adds no bits. It is preferred over
// reading the same text as a random swap, which would overstate the bits;
// random swaps on top are counted from the swapped spelling, as the
// generator places them. A random swap that happens to produce a word's
// deliberate spelling is read as deliberate: the lower figure. Nor is a
// deliberate swap one more thing to remember: it follows from the word by
// one fixed rule, so it adds nothing to memory load and costs no
// memorability. The scorer still has to recognise it, or it would read as
// a random swap and be charged as one.

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
import { easedText } from './ease';
import { BITS_PER_ENGLISH_LETTER, collapseRuns, isMemorableDigits, MEMORABLE_DIGITS_CHOICES } from './strength';
import { dropVowels, normalizeSentence, SMALL_WORDS, trimInterior } from './text';
import { BUILT_IN_MAPPINGS, spellingsOf, twistOutcomes, type Mapping } from './twists';

/** 'eased': whole, with its deliberate swap for typing ease ("wise" typed "wyse"). */
export type WordForm = 'word' | 'eased' | 'short' | 'initial' | 'number' | 'dropped';

export interface ScoredWord {
  /** The hint word, normalised. */
  word: string;
  form: WordForm;
  /** The form's text before any random twist ("jptr", "wyse"); empty when the word was dropped. */
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
 * word with a random swap costs 5 points, up to 20. A word typed with its
 * deliberate swap counts as kept whole and costs nothing: the swap follows
 * from the word.
 */
export interface Memorability {
  score: number;
  /** Mean size credit over the hint words, 0-1. */
  fidelity: number;
  /** 0-1 from the password's length. */
  brevity: number;
  /** Hint words that kept their full length. */
  sameSize: number;
  /** Hint words with a random swap; deliberate swaps are not counted. */
  swappedWords: number;
}

export const MEMORABILITY = { fidelityWeight: 0.6, brevityWeight: 0.4, shortAt: 16, longAt: 48, swapPenalty: 5, maxSwapPenalty: 20 } as const;

export function memorabilityOf(password: string, words: readonly ScoredWord[]): Memorability {
  const credits = words.map((w) => {
    if (w.form === 'dropped') return 0;
    // A deliberately swapped word is the whole word as this tool types it ("cool" as "cul"), so its full length is its swapped spelling's.
    const full = w.form === 'eased' ? w.base : w.word;
    const kept = [...w.text].length / Math.max(1, [...full].length);
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
  /** The session's figure, for an attacker who knows this tool: sentence bits plus twist bits plus initial-choice bits plus leftover bits, never above textBits. Not a score. */
  bits: number;
  /** The password's own text reading (what scoreAlone gives); the ceiling for bits, since a hint can only help an attacker. */
  textBits: number;
  /** True when the hint's figure was above textBits and bits was brought down to it. */
  capped: boolean;
  /** Bits for letters and digits in the password that no hint word accounts for, scored as text. */
  leftoverBits: number;
  /** log2 of the sentence space: the template's exact pools when the hint is one of the tool's sentences, else the words scored from their text. */
  sentenceBits: number;
  twistBits: number;
  /** Bits from which words became random initials (your own sentence only). */
  initialBits: number;
  twistCount: number;
  twistOptions: number;
  /** Words typed with their deliberate swap for typing ease: zero bits, and nothing more to remember. */
  easedCount: number;
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

/** How many swaps the cold aligner tries per word, for words of up to ten letters. */
export const MAX_TWISTS_PER_WORD = 3;
/** Fewer for long words: enumerating spellings grows combinatorially with length (a 34-letter word with three swaps took seconds). */
export const twistsToTry = (length: number) => (length <= 10 ? MAX_TWISTS_PER_WORD : length <= 16 ? 2 : 1);
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
  // The deliberate swap, when the word has one, reads before a shortened form of the same text.
  const eased = easedText(word);
  if (eased !== word) out.set(eased, 'eased');
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

/** The most single-character edits a word of this many letters may be found through: the swaps tried for its length, and never more than a third of its letters (so a word typed as its initial is not "found" whole with half its letters changed). */
export const editsToTry = (length: number) => Math.min(twistsToTry(length), Math.floor(length / 3));

/**
 * The prefix of `rest` that `base` reaches with the fewest single-character
 * edits (a letter changed, added or removed), up to `max`. The match starts
 * on a letter or digit at the first character of `rest` (a symbol in front
 * of the word is the caller's to skip, and the table has the swaps that put
 * one at the start of a word); on ties the longest prefix ending in a letter
 * or digit wins, so a separator after the word is not swallowed as an edit.
 * Case is ignored. Undefined when none is within `max`.
 */
export function editMatch(rest: string, base: string, max: number): { length: number; edits: number } | undefined {
  if (max <= 0 || !base || !/^[a-z0-9]/i.test(rest)) return undefined;
  const b = base.toLowerCase();
  const r = rest.slice(0, base.length + max).toLowerCase();
  // row[j] = edits turning b[0..i) into r[0..j). With no base consumed, only the empty prefix is reachable.
  let row = Array.from({ length: r.length + 1 }, (_, j) => (j === 0 ? 0 : Number.POSITIVE_INFINITY));
  for (let i = 1; i <= b.length; i++) {
    const next = new Array<number>(r.length + 1);
    next[0] = i;
    for (let j = 1; j <= r.length; j++) {
      next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (b[i - 1] === r[j - 1] ? 0 : 1));
    }
    row = next;
  }
  let best: { length: number; edits: number; clean: boolean } | undefined;
  for (let j = 1; j <= r.length; j++) {
    const edits = row[j]!;
    if (edits > max) continue;
    const clean = /[a-z0-9]/.test(r[j - 1]!);
    if (!best || edits < best.edits || (edits === best.edits && (clean && !best.clean || (clean === best.clean && j > best.length)))) best = { length: j, edits, clean };
  }
  return best && { length: best.length, edits: best.edits };
}

/**
 * The longest way `word` could appear at the start of `rest`; fewest random
 * twists on ties, then the deliberate swap's spelling as the base: the
 * generator only ever twists on top of it, and reading it as a random swap
 * of the plain word would overstate the bits. Swapped spellings come from
 * the built-in table; a whole word not found that way is looked for within
 * a few edits, so a custom swap reads as the word, one step away.
 */
function bestMatch(rest: string, word: string): ScoredWord | undefined {
  const forms = formsOf(word);
  let best: ScoredWord | undefined;
  const consider = (c: ScoredWord) => {
    if (
      !best ||
      c.text.length > best.text.length ||
      (c.text.length === best.text.length && (c.twists < best.twists || (c.twists === best.twists && c.form === 'eased' && best.form !== 'eased')))
    ) {
      best = c;
    }
  };
  for (const { base, form } of forms) {
    if (startsWithFold(rest, base)) consider({ word, form, base, text: rest.slice(0, base.length), twists: 0 });
    else {
      // Padding may have repeated a digit or symbol the word itself contains ("st33l" typed as "st33333l"): the longer run is the same word.
      const n = expandedLength(rest, base);
      if (n !== undefined) consider({ word, form, base, text: rest.slice(0, n), twists: 0 });
    }
  }
  const initial = word[0]!.toUpperCase();
  if (/[A-Z]/.test(initial) && rest[0] === initial) consider({ word, form: 'initial', base: initial, text: initial, twists: 0 });
  // Only look for twisted spellings when the word (or its deliberate swap) is
  // there untwisted: nothing beats it, and enumerating spellings costs more.
  if (best?.form === 'word' || best?.form === 'eased') return best;
  for (const { base, form } of forms) {
    if (form === 'number') continue;
    for (const s of spellingsOf(base, BUILT_IN_MAPPINGS, twistsToTry(base.length))) {
      if (s.twists === 0) continue;
      if (startsWithFold(rest, s.text)) consider({ word, form, base, text: rest.slice(0, s.text.length), twists: s.twists });
      // Padding may have repeated a digit or symbol of this spelling; the longer run is the same word.
      const n = expandedLength(rest, s.text);
      if (n !== undefined) consider({ word, form, base, text: rest.slice(0, n), twists: s.twists });
    }
  }
  const afterTable = best as ScoredWord | undefined; // `best` is set in a closure, which narrowing does not see
  if (afterTable?.form === 'word' || afterTable?.form === 'eased') return afterTable;
  // Any other spelling within a few edits of the whole word (or its deliberate spelling): each edit one step away.
  for (const { base, form } of forms) {
    if (form !== 'word' && form !== 'eased') continue;
    const m = editMatch(rest, base, editsToTry(base.length));
    if (m) consider({ word, form, base, text: rest.slice(0, m.length), twists: m.edits });
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
function align(password: string, words: readonly string[]): { scored: ScoredWord[]; leftover: string } {
  let pos = 0;
  const out: ScoredWord[] = [];
  const covered = new Array<boolean>(password.length).fill(false);
  for (const word of words) {
    let match = bestMatch(password.slice(pos), word);
    let skipped = 0;
    while (!match && pos + skipped < password.length && /[^A-Za-z0-9]/.test(password[pos + skipped]!)) {
      skipped++;
      match = bestMatch(password.slice(pos + skipped), word);
    }
    if (!match) {
      out.push({ word, form: 'dropped', base: '', text: '', twists: 0 });
      continue;
    }
    out.push(match);
    covered.fill(true, pos + skipped, pos + skipped + match.text.length);
    pos += skipped + match.text.length;
  }
  // The password's text that no hint word accounts for, with the matched runs blanked out (by code unit, as `covered` is indexed).
  const leftover = password
    .split('')
    .map((c, i) => (covered[i] ? ' ' : c))
    .join('');
  return { scored: out, leftover };
}

const poolSets = new Map<string, Set<string>>();
function inPool(word: string, slot: Slot, comfort: Comfort, minDigits: number, eased = false): boolean {
  const key = `${comfort}:${minDigits}:${eased ? 1 : 0}:${slot}`;
  let set = poolSets.get(key);
  if (!set) {
    set = new Set(pools(comfort, minDigits, eased)[slot]);
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

/**
 * The pools a sentence could have come from: words ranked as written, or as
 * typed with their deliberate swaps (the "Ease awkward words" setting). The
 * password cannot say which for sure (a random swap can land on a word's
 * deliberate spelling), so both are tried and the lower figure kept, which
 * is never above the pools the sentence was really drawn from.
 */
const EASE_FAMILIES = [false, true] as const;

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
      for (const eased of EASE_FAMILIES) {
        const match = measureMatch(words, scored, slots, hasNumber ? numberPlacements(template).length : 1, eased);
        if (match && (!best || match.bits < best.bits)) best = match;
      }
    }
  }
  return best;
}

function measureMatch(words: readonly string[], scored: readonly ScoredWord[], slots: Slot[], placements: number, eased: boolean): Match | undefined {
  // The most restrictive comfort level whose pools contain every word.
  let level = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const slot = slots[i]!;
    if (slot === 'and' || isMadeUpNoun(word)) continue;
    const minDigits = slot === 'num' ? digitsFor(word) : 1;
    const found = COMFORTS.findIndex((c, j) => j >= level && inPool(word, slot, c, minDigits, eased));
    if (found < 0) return undefined;
    level = found;
  }
  const comfort = COMFORTS[level]!;
  const sizes = words.map((word, i) => {
    const slot = slots[i]!;
    if (slot === 'and') return 1;
    if (isMadeUpNoun(word)) return MADE_UP_NOUNS.length;
    const pool = pools(comfort, slot === 'num' ? digitsFor(word) : 1, eased)[slot];
    const form = scored[i];
    if (form?.form === 'dropped') return 1; // not in the password: adds nothing
    if (form?.form === 'initial') return initialsOf(pool).length;
    if (form?.form === 'short' && form.base === twoLetter(word)) return twoLettersOf(pool).length;
    return pool.length;
  });
  const bits = sizes.reduce((sum, n) => sum + Math.log2(n), 0) + Math.log2(placements);
  return { template: slots, comfort, sizes, bits };
}

/** Badge colour bands: strength in bits (green from 50, yellow from 40, red below) and memorability out of 100. */
export const STRENGTH_BANDS = { green: 50, yellow: 40 } as const;
export const MEMORABILITY_BANDS = { green: 75, yellow: 45 } as const;

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
 * English-like text (never less than one letter's pick, a repeated letter
 * counted once), an initial of it as one letter, a dropped word nothing.
 */
export function wordBitsFromText(w: ScoredWord): number {
  if (w.form === 'dropped') return 0;
  if (/^[0-9]+$/.test(w.word)) return isMemorableDigits(w.word) ? Math.log2(MEMORABLE_DIGITS_CHOICES) : w.word.length * Math.log2(10);
  const pool = smallestPoolFor(w.word);
  if (w.form === 'initial') return Math.log2(pool ? initialsOf(pool).length : 26);
  if (pool) return Math.log2(pool.length);
  // English-like text; a word of one or two letters is at least one pick of a letter, as an initial is.
  return Math.max(Math.log2(26), collapseRuns(w.word).length * BITS_PER_ENGLISH_LETTER);
}

const choose = (n: number, k: number) => {
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return out;
};

/** A short id for a mapping list, so caches can key on which list was used. */
const listIds = new WeakMap<readonly Mapping[], number>();
let nextListId = 1;
function listId(mappings: readonly Mapping[]): number {
  let id = listIds.get(mappings);
  if (id === undefined) {
    id = nextListId++;
    listIds.set(mappings, id);
  }
  return id;
}

const cache = new Map<string, ColdScore>();
const CACHE_LIMIT = 400;

/**
 * Score a password from its text and hint alone. Deterministic: the same
 * inputs always give the same result. `mappings` (the session's swap list)
 * changes only the bits; see the note at the top of this file for what the
 * figures mean and what they leave out.
 */
export function scoreCold(password: string, hint: string, mappings: readonly Mapping[] = BUILT_IN_MAPPINGS): ColdScore {
  const key = `${listId(mappings)}\u0000${password}\u0000${hint}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const words = normalizeSentence(hint);
  const { scored, leftover } = align(password, words);
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
    const twistable = (s: ScoredWord) => s.form === 'word' || s.form === 'eased' || s.form === 'short';
    // The word with the opening capital kept its first letter through the swaps, wherever it is.
    const capitalAt = scored.findIndex((s) => twistable(s) && /^[A-Z][a-z]/.test(s.text));
    twistOptions = twistOutcomes(bases, {
      count: twistCount,
      mappings,
      skip: (i) => !twistable(scored[i]!),
      capitalAt,
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
  // Letters and digits the hint does not account for are still part of the password: scored as text.
  const leftoverBits = normalizeSentence(inferredHint(leftover, mappings)).reduce((sum, w) => sum + wordBitsFromText({ word: w, form: 'word', base: w, text: w, twists: 0 }), 0);
  // A deliberate swap is a fixed function of its word: no bits, and no memory load, since the word brings it with it.
  const easedCount = scored.filter((s) => s.form === 'eased').length;
  // A hint can only help an attacker: the figure with it is never above the password's own text reading.
  const own = inferredHint(password, mappings);
  const uncapped = sentenceBits + twistBits + initialBits + leftoverBits;
  const textBits = normalizeSentence(own).join(' ') === words.join(' ') ? uncapped : scoreCold(password, own, mappings).bits;
  const result: ColdScore = {
    bits: Math.min(uncapped, textBits),
    textBits,
    capped: uncapped > textBits,
    leftoverBits,
    sentenceBits,
    twistBits,
    initialBits,
    twistCount,
    twistOptions,
    easedCount,
    template: match?.template,
    comfort: match?.comfort,
    aligned: scored.every((s) => s.form !== 'dropped'),
    words: scored,
    difficulty: scoreDifficulty(password, words.length + twistCount),
    typing: typingProfile(password),
    memorability: memorabilityOf(password, scored),
  };
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}

/** The mapping table read backwards: a spelling fragment and the letters it may stand for, with the non-letter characters a twist can put into a word. */
interface Reverse {
  swaps: readonly { twisted: string; plain: string }[];
  chars: Set<string>;
}
const reverseCache = new WeakMap<readonly Mapping[], Reverse>();
function reverseOf(mappings: readonly Mapping[]): Reverse {
  let r = reverseCache.get(mappings);
  if (!r) {
    const seen = new Set<string>();
    const swaps: { twisted: string; plain: string }[] = [];
    for (const m of mappings) {
      const key = `${m.to}>${m.from}`;
      if (m.to && !seen.has(key)) {
        seen.add(key);
        swaps.push({ twisted: m.to, plain: m.from });
      }
    }
    r = { swaps, chars: new Set(mappings.flatMap((m) => [...m.to].filter((c) => !/[A-Za-z0-9]/.test(c)))) };
    reverseCache.set(mappings, r);
  }
  return r;
}

/** A word on one of the tool's word lists; not a made-up noun, which almost any short letter string could be read as. */
const isListWord = (text: string) => /^[a-z]+$/.test(text) && POOL_SLOTS.some((slot) => inPool(text, slot, 'relaxed', 1));

/** What a run of the password could be a twisted spelling of: a word on the lists, or failing that plain letters. */
interface Recovered {
  list?: string;
  letters?: string;
}
const recoverCache = new Map<string, Recovered>();
const RECOVER_CACHE_LIMIT = 5000;
const RECOVER_FRONTIER_LIMIT = 2000;

/**
 * Undo the fewest swaps from the mapping table (up to the number the aligner
 * tries for a word this long) that turn `token` (lower case) into a word on
 * the tool's lists, and separately into plain letters ("no0n" -> "noon" even
 * though "noon" is on no list). The token itself when it is a list word.
 */
function recover(token: string, mappings: readonly Mapping[]): Recovered {
  if (!token || token.length > 24) return {};
  if (isListWord(token)) return { list: token, letters: token };
  const key = `${listId(mappings)}:${token}`;
  const hit = recoverCache.get(key);
  if (hit) return hit;
  const { swaps } = reverseOf(mappings);
  let frontier = new Set([token]);
  const seen = new Set(frontier);
  const found: Recovered = /^[a-z]+$/.test(token) ? { letters: token } : {};
  const max = twistsToTry(token.length);
  for (let depth = 1; depth <= max && !found.list; depth++) {
    const next = new Set<string>();
    const lists: string[] = [];
    const letters: string[] = [];
    for (const t of frontier) {
      // Digits and symbols are undone first; a misspelling only once the spelling is all letters.
      const plainLetters = /^[a-z]+$/.test(t);
      for (let i = 0; i < t.length; i++) {
        for (const { twisted, plain } of swaps) {
          if (!t.startsWith(twisted, i) || (!plainLetters && /^[a-z]+$/.test(twisted))) continue;
          const cand = t.slice(0, i) + plain + t.slice(i + twisted.length);
          if (seen.has(cand)) continue;
          seen.add(cand);
          if (isListWord(cand)) lists.push(cand);
          else {
            if (/^[a-z]+$/.test(cand)) letters.push(cand);
            if (next.size < RECOVER_FRONTIER_LIMIT) next.add(cand);
          }
        }
      }
    }
    if (lists.length) found.list = lists.sort()[0];
    if (!found.letters && letters.length) found.letters = letters.sort()[0];
    frontier = next;
  }
  if (recoverCache.size >= RECOVER_CACHE_LIMIT) recoverCache.clear();
  recoverCache.set(key, found);
  return found;
}

/** Pieces of a run between its non-letters that are list words of three or more letters, with the fewest swaps undone. */
const listPieces = (run: string, mappings: readonly Mapping[]) =>
  run
    .split(/[^A-Za-z]+/)
    .filter((piece) => piece.length >= 3 && recover(piece.toLowerCase(), mappings).list !== undefined).length;

/** The hint words one run of the password (letters, digits and twist symbols; no capital after a lower-case letter) stands for; see inferredHint. */
function readRun(run: string, mappings: readonly Mapping[]): string[] {
  if (/^[0-9]+$/.test(run)) return [run]; // a number is a number, never a swapped word ("4" is not "for")
  // Digits against a list word are a number ("cat1", "Blue42"), not a swap in a longer word ("cati").
  const edges = /^([0-9]*)(.*?)([0-9]*)$/.exec(run)! as unknown as [string, string, string, string];
  if ((edges[1] || edges[3]) && isListWord(edges[2].toLowerCase())) return [edges[1], edges[2].toLowerCase(), edges[3]].filter(Boolean);
  const whole = recover(run.toLowerCase(), mappings);
  if (whole.list) return [whole.list];
  // Marks around the word, not swaps in it: symbols at the end ("boats!", "sweets!!") and two or more at the start ("!!Sally"). A single opening symbol may be a swap ("$alad").
  const bare = run.replace(/[^A-Za-z0-9]+$/, '').replace(/^[^A-Za-z0-9]{2,}/, '');
  if (!bare) return [];
  const bareWhole = bare === run ? whole : recover(bare.toLowerCase(), mappings);
  if (bareWhole.list) return [bareWhole.list];
  // A number may sit against a word ("Blue42", "7boats"): leading and trailing digits are their own words.
  const [, lead, core, trail] = /^([0-9]*)(.*?)([0-9]*)$/.exec(bare)! as unknown as [string, string, string, string];
  const around = (words: string[]) => [...(lead ? [lead] : []), ...words, ...(trail ? [trail] : [])];
  if (!core) return around([]);
  const c = core === bare ? bareWhole : recover(core.toLowerCase(), mappings);
  if (c.list) return around([c.list]);
  // A word on no list with swaps in it is undone to plain letters and scored as text ("no0n" -> "noon", "T!ger" -> "tiger"); a single
  // swapped digit may open it ("0ttrs"), but a digit after it is a number ("cat1"). Not when the symbols read better as separators
  // between list words ("Sally!eats!sweets").
  if (bareWhole.letters && /[^A-Za-z]/.test(bare) && !trail && lead.length <= 1 && listPieces(bare, mappings) < 2) return [bareWhole.letters];
  if (c.letters && /[^A-Za-z]/.test(core) && listPieces(core, mappings) < 2) return around([c.letters]);
  // Plain text: a letter next to a digit ends a word, and anything that is not a letter or digit splits.
  const pieces = core
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((piece) => (/^[A-Za-z]+$/.test(piece) ? (recover(piece.toLowerCase(), mappings).list ?? piece) : piece));
  return around(pieces);
}

const inferredCache = new Map<string, string>();
const INFERRED_CACHE_LIMIT = 1000;

/**
 * The hint a password carries in its own text, read as this tool would have
 * written it. Each run of letters and digits is a word; a capital after a
 * lower-case letter starts a new word and a letter next to a digit ends one
 * ("BlueTiger42" -> "Blue Tiger 42"). A run that is a twisted spelling of a
 * word on the lists reads as that word ("Sm@rt" -> "smart", "hils" ->
 * "hills", "tu2rz" -> "tutors"), undoing the fewest swaps from the mapping
 * table, so the password's swaps are counted as the generator's hint would
 * count them; a run on no list still has its swaps undone to plain letters
 * ("no0n" -> "noon"). A run of digits is a number. A symbol a twist can
 * produce stays with its run, and reads as a mark around the word when
 * undoing it gives no list word ("sweets!!"); any other symbol or a space
 * separates words. Accents are
 * stripped the way normalizeSentence strips them, so "naïve" reads as
 * "naive".
 */
export function inferredHint(password: string, mappings: readonly Mapping[] = BUILT_IN_MAPPINGS): string {
  const key = `${listId(mappings)}:${password}`;
  const hit = inferredCache.get(key);
  if (hit !== undefined) return hit;
  const { chars } = reverseOf(mappings);
  const plain = password.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Runs of letters, digits and twist symbols; anything else separates. A capital after a lower-case letter starts a
  // new run too: a swap never changes case, so "BlueTiger" is two words.
  const hint = plain
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('')
    .map((c) => (/[A-Za-z0-9]/.test(c) || chars.has(c) ? c : ' '))
    .join('')
    .split(' ')
    .filter(Boolean)
    .flatMap((run) => readRun(run, mappings))
    .join(' ')
    .toLowerCase();
  if (inferredCache.size >= INFERRED_CACHE_LIMIT) inferredCache.clear();
  inferredCache.set(key, hint);
  return hint;
}

/**
 * The difficulty of a password that has no hint: its memory load is read
 * off its own text (inferredHint: one chunk a word, one a swap), so a
 * password typed into the tester is scored the same whether that natural
 * hint is typed in or not.
 */
export function difficultyAlone(password: string): Difficulty {
  return scoreCold(password, inferredHint(password)).difficulty;
}
