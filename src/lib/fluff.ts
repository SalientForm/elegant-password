// Padding ("fluff") for sentence mode: when the sentence, even with every
// word kept whole, is shorter than the site's minimum, fill the gap with
// things that are easy to remember and type. Everything here is planned
// arithmetically so the result lands on the minimum exactly, with no
// recheck and no retry.
//
// Pieces, in the order they are used:
//   word      a short word from the pools, only when more than 3 characters short
//   repeat    a digit or symbol a swap put inside a word, repeated ("$t33l" -> "$t33333l")
//   sequence  a memorable run of digits ("123", "4321")
//   marks     a closing mark repeated ("!!")
//   tag       a self-describing length tag, last: "%50" says the whole password is
//             50 characters long (the tag included); "@3" says 3 divides the length
//             of everything to its left. The number is solved, not guessed: for a
//             total tag N = length + 1 + digits(N), so 47 characters get "%50" and
//             48 get "%51", never 53.

import type { RandomSource } from './random';
import { randomInt } from './random';
import { plural } from './text';

export type LengthTag = 'total' | 'factor' | 'none';

export interface FluffPiece {
  kind: 'word' | 'repeat' | 'sequence' | 'marks' | 'tag';
  text: string;
  /** For 'repeat': which token holds the character, and which character. */
  tokenIndex?: number;
  char?: string;
  /** For 'tag': the number it states. */
  number?: number;
}

export interface FluffPlan {
  pieces: FluffPiece[];
  /** The password length once the pieces are applied. */
  total: number;
}

export interface FluffInputs {
  /** The password's length before padding. */
  length: number;
  min: number;
  max: number;
  /** The separator between tokens; words and sequences are tokens and cost its length too. */
  separator: string;
  tag: LengthTag;
  /** Symbol for the total tag ("%"), if the site allows one. */
  totalSymbol?: string;
  /** Symbol for the factor tag ("@"), if the site allows it. */
  factorSymbol?: string;
  /** The closing mark to repeat ("!"), if the site allows one. */
  mark?: string;
  /** A digit or symbol inside a word that can be repeated. */
  repeatable?: { tokenIndex: number; char: string };
  /** Words to pad with, 3-8 letters. */
  words: readonly string[];
  rng: RandomSource;
}

const SEQUENCES: Record<number, readonly string[]> = {
  1: ['1', '7', '9'],
  2: ['12', '21', '77', '99'],
  3: ['123', '321', '789', '987'],
  4: ['1234', '4321', '2468', '7890'],
  5: ['12345', '54321', '13579'],
};

export const MAX_REPEATS = 3;
const MAX_SEQUENCE = 5;
/** Words shorter than this are short words, for the padding's choice. */
export const MIN_WORD = 3;
const MAX_WORD = 8;

export const digitsOf = (n: number) => String(n).length;

/** The smallest divisor of n that is at least 2 (n itself when prime). */
export function smallestFactor(n: number): number {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
}

/**
 * The number a total tag states when added to a password of `length`
 * characters: the only N with N = length + 1 + digits(N).
 */
export function totalTagNumber(length: number, min = 0): number {
  // The smallest number that is at least `min`: a 7-character body under a minimum of 10 gets %10, not %9.
  for (let d = 1; d <= 4; d++) {
    const n = length + 1 + d;
    if (digitsOf(n) === d && n >= min) return n;
  }
  throw new RangeError(`No total tag fits a length of ${length}`);
}

const pick = <T,>(items: readonly T[], rng: RandomSource): T => items[randomInt(items.length, rng)]!;

/** Fill exactly `R` characters with words, repeats, sequences and marks, in that order of preference. */
function fill(R: number, short: number, inputs: FluffInputs, repeatsUsed: number): { pieces: FluffPiece[]; filled: number } {
  const { separator, words, rng, repeatable, mark } = inputs;
  const sep = separator.length;
  const pieces: FluffPiece[] = [];
  let left = R;
  let repeats = repeatsUsed;
  const byLength = new Map<number, string[]>();
  for (const w of words) {
    if (w.length >= MIN_WORD && w.length <= MAX_WORD) byLength.set(w.length, [...(byLength.get(w.length) ?? []), w]);
  }
  while (left > 0) {
    // A whole word, only when more than MIN_WORD characters short, and only if one fits exactly.
    const wordLen = Math.min(MAX_WORD, left - sep);
    if (short > MIN_WORD && wordLen >= MIN_WORD) {
      // Prefer a word that uses the whole remainder; otherwise the longest that leaves room for something else.
      const candidates = [wordLen, ...Array.from({ length: wordLen - MIN_WORD }, (_, i) => wordLen - 1 - i)].filter((n) => byLength.has(n));
      const n = candidates.find((len) => len === wordLen || left - (len + sep) === 0 || left - (len + sep) >= 1);
      if (n !== undefined) {
        pieces.push({ kind: 'word', text: pick(byLength.get(n)!, rng) });
        left -= n + sep;
        continue;
      }
    }
    if (repeatable && repeats < MAX_REPEATS) {
      const k = Math.min(MAX_REPEATS - repeats, left);
      pieces.push({ kind: 'repeat', text: repeatable.char.repeat(k), tokenIndex: repeatable.tokenIndex, char: repeatable.char });
      repeats += k;
      left -= k;
      continue;
    }
    // A run of digits; a single digit only when there is no mark to use instead.
    const seqLen = Math.min(MAX_SEQUENCE, left - sep);
    if (seqLen >= (mark ? 2 : 1) && (left - (seqLen + sep) === 0 || left - (seqLen + sep) >= 1)) {
      pieces.push({ kind: 'sequence', text: pick(SEQUENCES[seqLen]!, rng) });
      left -= seqLen + sep;
      continue;
    }
    if (mark) {
      pieces.push({ kind: 'marks', text: mark.repeat(left) });
      left = 0;
      continue;
    }
    // Nothing exact is possible (a one-character gap with a one-character separator and no mark): overshoot by one sequence.
    pieces.push({ kind: 'sequence', text: pick(SEQUENCES[1]!, rng) });
    left -= 1 + sep;
  }
  return { pieces, filled: R - left };
}

/**
 * Plan the padding that takes a password from `length` to at least `min`
 * (exactly `min` whenever the pieces allow), never above `max`. Returns
 * undefined when nothing fits, or when no padding is needed.
 */
export function planFluff(inputs: FluffInputs): FluffPlan | undefined {
  const { length, min, max, tag, totalSymbol, factorSymbol } = inputs;
  const short = min - length;
  if (short <= 0) return undefined;

  // The tag goes last and states a number about the finished password, so plan it first.
  if (tag === 'total' && totalSymbol) {
    const tagLen = 1 + digitsOf(min);
    if (short >= tagLen) {
      const body = fill(short - tagLen, short, inputs, 0);
      const n = totalTagNumber(length + body.filled, min);
      const total = length + body.filled + 1 + digitsOf(n);
      if (total <= max) return { pieces: [...body.pieces, { kind: 'tag', text: `${totalSymbol}${n}`, number: n }], total };
    } else {
      // The tag alone already covers the gap; it states the true total.
      const n = totalTagNumber(length, min);
      if (n <= max) return { pieces: [{ kind: 'tag', text: `${totalSymbol}${n}`, number: n }], total: n };
    }
  }
  if (tag === 'factor' && factorSymbol) {
    // Everything left of the tag must be divisible by the number; try a one-digit then a two-digit number.
    for (const tagLen of [2, 3]) {
      const leftLen = Math.max(length, min - tagLen);
      const n = smallestFactor(leftLen);
      if (leftLen < 2 || 1 + digitsOf(n) !== tagLen) continue;
      const body = fill(leftLen - length, short, inputs, 0);
      const finalLeft = length + body.filled;
      const m = smallestFactor(finalLeft);
      const total = finalLeft + 1 + digitsOf(m);
      if (total <= max) return { pieces: [...body.pieces, { kind: 'tag', text: `${factorSymbol}${m}`, number: m }], total };
    }
  }
  const body = fill(short, short, inputs, 0);
  const total = length + body.filled;
  return total <= max ? { pieces: body.pieces, total } : undefined;
}

/** Apply a repeat piece to a word: the character's first run is extended. */
export function applyRepeat(text: string, char: string, extra: string): string {
  const i = text.indexOf(char);
  return i < 0 ? text + extra : text.slice(0, i + 1) + extra + text.slice(i + 1);
}

/** Plain-language description of a plan, for the card's steps. */
export function describeFluff(plan: FluffPlan, min: number): string {
  const parts = plan.pieces.map((p) => {
    switch (p.kind) {
      case 'word':
        return `the word “${p.text}”`;
      case 'repeat':
        return `“${p.char}” repeated ${plural(p.text.length, 'more time')}`;
      case 'sequence':
        return `the digits ${p.text}`;
      case 'marks':
        return `“${p.text}” at the end`;
      case 'tag':
        return p.text.startsWith('@')
          ? `“${p.text}” (${p.number} divides the length before it)`
          : `“${p.text}” (the whole password is ${p.number} characters)`;
    }
  });
  return `padded to the ${min}-character minimum with ${parts.join(', ')}`;
}
