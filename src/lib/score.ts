// Cold scoring: everything a card or a saved entry says about a password's
// strength and difficulty comes from this one function of the password and
// its hint. Nothing else goes in: not the settings that made it, not how
// many suggestions were shown, not how many times "New passwords" was
// pressed. So a password scores the same every time, wherever it appears.
//
// The model: an attacker who knows this tool. Each hint word is found in the
// password (whole, shortened, as a capital initial, or twisted), the hint is
// matched against the sentence templates, and the bits are log2 of the
// smallest space this tool could have drawn the sentence from (the most
// restrictive typing-comfort level that contains every word), plus the
// exact number of ways the twists could have landed. Length limits are not
// known cold and are ignored; the strength panel shows the exact figure for
// the current plan. A hint that is not one of the tool's sentences (your own
// sentence) scores only its random initials and twists.

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

export interface ColdScore {
  /** Sentence bits plus twist bits plus initial-choice bits. */
  bits: number;
  /** log2 of the sentence space, or 0 when the hint is not one of the tool's sentences. */
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
      if (s.twists > 0 && startsWithFold(rest, s.text)) consider({ word, form, base, text: rest.slice(0, s.text.length), twists: s.twists });
    }
  }
  return best;
}

/**
 * Walk the hint words through the password. A word is looked for where the
 * last one ended and, failing that, one character on (past a separator).
 * Symbols are never skipped blindly: a twist can put one at the start of a
 * word ("apples" -> "@pples").
 */
function align(password: string, words: readonly string[], mappings: readonly Mapping[]): ScoredWord[] {
  let pos = 0;
  const out: ScoredWord[] = [];
  for (const word of words) {
    let match = bestMatch(password.slice(pos), word, mappings);
    let skipped = 0;
    if (!match && pos < password.length && /[^A-Za-z0-9]/.test(password[pos]!)) {
      match = bestMatch(password.slice(pos + 1), word, mappings);
      skipped = 1;
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

  const sentenceBits = match?.bits ?? 0;
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
  };
  if (cacheable) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, result);
  }
  return result;
}
