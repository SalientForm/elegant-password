// Deliberate swaps for typing ease: a word that is awkward to type gets one
// fixed misspelling that removes the awkward move ("wise" -> "wyse",
// "cool" -> "cul", "lazy" -> "lasy"), instead of being filtered out.
//
// The rule, applied to a word of lowercase letters:
//   1. Awkward moves: a same-finger jump (one finger, two different keys,
//      not a roll: "ed", "un", "ki") or a long reach (LONG_REACH key widths
//      or more between consecutive keys: "w-i", "a-i", "s-o"). A word with
//      none is left alone.
//   2. Candidates: every place one EASE_RULES entry applies, never touching
//      the first letter (so the word still starts as it should and takes
//      the opening capital), never half of a double letter ("jazzy" keeps
//      its "zz"), end rules only at the very end, a hard "c" only.
//   3. A candidate counts only if it leaves fewer awkward moves, is quicker
//      to type on the rubric's time model, keeps at least 3 letters, and is
//      not a word on any list or in EASE_EXCLUDED (it must not read as
//      another word).
//   4. The winner leaves the fewest awkward moves, then is quickest to type;
//      ties go to the rule listed first, then the leftmost place.
//   5. A spelling two list words would share is given to neither, so the
//      swap never merges two words and the plan's count stays exact.
//
// Only the word itself goes in: not its neighbours, the separator, the
// settings or the user's mapping switches. So the swap is a fixed function
// of the word, adds no strength (it is counted as zero bits), and the cold
// scorer can recognise it from the hint alone.

import { SECONDS } from './difficulty';
import { isRoll, lookupKey, pressFor, transitionCost } from './keyboard';
import { ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS } from './words';

export interface EaseRule {
  from: string;
  to: string;
  /** Only at the very end of the word ("cows" -> "cowz"). */
  end?: boolean;
  /** Not when the next letter is one of these: a soft "c" (in "ce", "ci", "cy") stays a "c". */
  notBefore?: string;
}

const rules = (spec: string, extra: Partial<EaseRule> = {}): EaseRule[] =>
  spec
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [from, to] = p.split('>') as [string, string];
      return { from, to, ...extra };
    });

/**
 * The misspellings a deliberate swap may use: sound-alike spellings from
 * the built-in swap list, each kept to where it still reads as the word.
 * Outputs are lowercase letters only, so a deliberate swap never adds a
 * digit or symbol, never meets the separator and never depends on which
 * symbols a site allows.
 */
export const EASE_RULES: readonly EaseRule[] = [
  ...rules('i>y ee>ea ea>ee oo>u ou>ow z>s ck>k ph>f qu>kw ight>ite'),
  { from: 'c', to: 'k', notBefore: 'eiyhk' },
  ...rules('s>z er>a ers>as ce>z cks>x ing>in ies>ys', { end: true }),
];

/** Spellings that pass the rule but read as a different English word; such a word is left alone. */
export const EASE_EXCLUDED: ReadonlySet<string> = new Set(['bust', 'reads', 'sax', 'codas', 'steads', 'gayly']);

/** A reach this many key widths or longer between consecutive keys is awkward. */
export const LONG_REACH = 6;

export type AwkwardKind = 'same finger' | 'long reach';

export interface AwkwardMove {
  /** Index of the second key of the move. */
  at: number;
  /** The two characters, e.g. "ed". */
  keys: string;
  kind: AwkwardKind;
}

/** The awkward moves in a run of text: same-finger jumps and long reaches. */
export function awkwardMoves(text: string): AwkwardMove[] {
  const out: AwkwardMove[] = [];
  for (let i = 1; i < text.length; i++) {
    const a = lookupKey(text[i - 1]!)?.key;
    const b = lookupKey(text[i]!)?.key;
    if (!a || !b || a === b || a.finger === 8 || b.finger === 8) continue;
    const kind: AwkwardKind | undefined =
      a.finger === b.finger && !isRoll(a, b) ? 'same finger' : Math.hypot(a.x - b.x, a.y - b.y) >= LONG_REACH ? 'long reach' : undefined;
    if (kind) out.push({ at: i, keys: text[i - 1]! + text[i]!, kind });
  }
  return out;
}

/** Seconds to type a run of lowercase text on the difficulty rubric's time model (no Shift). */
export function typingSeconds(text: string): number {
  let seconds = text.length * SECONDS.keystroke;
  for (let i = 1; i < text.length; i++) seconds += transitionCost(pressFor(text[i - 1]!).key, pressFor(text[i]!).key) * SECONDS.perCost;
  return seconds;
}

export interface Ease {
  /** The word as written in the hint. */
  word: string;
  /** The word as typed. */
  text: string;
  rule: EaseRule;
  /** Where the rule applied in the word. */
  at: number;
  /** The word's awkward moves this swap takes away. */
  removed: AwkwardMove[];
}

const ALL_WORDS: ReadonlySet<string> = new Set([...ADJECTIVES, ...NOUNS, ...VERBS, ...ADVERBS, ...ENDINGS, ...PREPOSITIONS, 'and']);

/** Steps 1-4 of the rule, before the check that no two list words share a spelling. */
function bestEase(word: string): Ease | undefined {
  if (!/^[a-z]{3,}$/.test(word)) return undefined;
  const before = awkwardMoves(word);
  if (before.length === 0) return undefined;
  const seconds = typingSeconds(word);
  let best: { ease: Ease; left: number; seconds: number } | undefined;
  for (const rule of EASE_RULES) {
    for (let at = word.indexOf(rule.from, 1); at >= 1; at = word.indexOf(rule.from, at + 1)) {
      const end = at + rule.from.length;
      if (rule.end && end !== word.length) continue;
      if (rule.notBefore && end < word.length && rule.notBefore.includes(word[end]!)) continue;
      if (word[at - 1] === rule.from[0] || word[end] === rule.from.at(-1)) continue; // half of a double letter
      const text = word.slice(0, at) + rule.to + word.slice(end);
      if (text.length < 3 || ALL_WORDS.has(text) || EASE_EXCLUDED.has(text)) continue;
      const left = awkwardMoves(text).length;
      const t = typingSeconds(text);
      if (left >= before.length || t >= seconds) continue;
      if (best && (left > best.left || (left === best.left && t >= best.seconds - 1e-12))) continue;
      // The moves the swap takes away: those it touched in the word, less any it leaves in place.
      const after = awkwardMoves(text)
        .filter((m) => m.at >= at && m.at <= at + rule.to.length)
        .map((m) => m.keys);
      const removed = before.filter((m) => {
        if (m.at < at || m.at > end) return false;
        const kept = after.indexOf(m.keys);
        if (kept >= 0) after.splice(kept, 1);
        return kept < 0;
      });
      best = { ease: { word, text, rule, at, removed }, left, seconds: t };
    }
  }
  return best?.ease;
}

let listEases: Map<string, Ease> | undefined;
let easedToWord: Map<string, string> | undefined;
/** Every spelling a list word's swap would produce, shared or not. */
let claimed: ReadonlySet<string> = new Set();

/** Every list word's swap, computed once; spellings two words would share are dropped (step 5). */
function listTables(): { eases: Map<string, Ease>; plain: Map<string, string> } {
  if (!listEases || !easedToWord) {
    const raw = [...ALL_WORDS].flatMap((w) => {
      const e = bestEase(w);
      return e ? [e] : [];
    });
    const claims = new Map<string, number>();
    for (const e of raw) claims.set(e.text, (claims.get(e.text) ?? 0) + 1);
    const kept = raw.filter((e) => claims.get(e.text) === 1);
    listEases = new Map(kept.map((e) => [e.word, e]));
    easedToWord = new Map(kept.map((e) => [e.text, e.word]));
    claimed = new Set(claims.keys());
  }
  return { eases: listEases, plain: easedToWord };
}

const cache = new Map<string, Ease | null>();
const CACHE_LIMIT = 5000;

/** The deliberate swap for a word, or undefined when the word is fine as it is (or no swap fits the rule). */
export function easeOf(word: string): Ease | undefined {
  const { eases } = listTables();
  if (ALL_WORDS.has(word)) return eases.get(word);
  let hit = cache.get(word);
  if (hit === undefined) {
    const e = bestEase(word);
    // A word of your own never takes a spelling a list word already has.
    hit = e && !claimed.has(e.text) ? e : null;
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(word, hit);
  }
  return hit ?? undefined;
}

/** A word as typed with its deliberate swap; the word itself when it has none. */
export const easedText = (word: string): string => easeOf(word)?.text ?? word;

/** The list word a deliberately swapped spelling stands for; the text itself when it is not one. */
export const plainOf = (text: string): string => listTables().plain.get(text) ?? text;

/** What a swap took away, in words: "the long reach w-i", "the same-finger jump e-c". */
export function describeRemoved(e: Ease): string {
  const moves = e.removed.map((m) => `the ${m.kind === 'same finger' ? 'same-finger jump' : 'long reach'} ${m.keys[0]}-${m.keys[1]}`);
  return moves.join(' and ') || 'an awkward move';
}
