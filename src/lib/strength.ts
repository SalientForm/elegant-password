// Two strength figures that know nothing about this app, so a password
// scores the same wherever it appears and whatever was switched on when it
// was made:
//
// - Raw: brute force over the characters used, the figure every naive
//   meter gives. The attacker knows nothing.
// - Strength: an attacker who knows English and people's habits (where a
//   capital, a digit or a symbol usually goes) but has never heard of this
//   tool: no word lists, no sentence patterns, no swap table, no hint.
//
// In both, a character that repeats the one before it adds nothing. Strength
// also knows the habits an attacker tries early: a password that is exactly
// one of the most common passwords (common.ts) is the guesses it takes to
// reach it on that list; a block typed again and again ("Password1!" three
// times, "aA" twelve) counts once, plus how many times; and a walk along a
// keyboard row or the alphabet ("asdf", "lkjh", "abcd") is one pick. The
// app's own figure, for an attacker who knows it exactly, is the bits model
// in score.ts and the plan; it needs the session and stays there.

import { commonRank } from './common';

/** Bits per letter of English-like text. */
export const BITS_PER_ENGLISH_LETTER = 2.3;
/** A memorable digit run (a repeat, a consecutive run, a well-known skip) counts as one pick from this many. */
export const MEMORABLE_DIGITS_CHOICES = 40;
/** Choices per symbol: a distinct symbol is one pick from this many. */
export const SYMBOL_CHOICES = 32;

/** How many characters each class holds, for Raw's alphabet. Symbols are the printable ASCII marks and the space; "other" is about an alphabet. */
export const CLASS_SIZES = { lower: 26, upper: 26, digit: 10, symbol: 33, other: 50 } as const;
export type CharClass = keyof typeof CLASS_SIZES;

/** A walk along a keyboard row or the alphabet, four letters or more, is one pick from this many: about 26 starts, two directions, a few lengths, rows or the alphabet. */
export const KEY_WALK_CHOICES = 1000;
/** The shortest walk read as one: three adjacent letters are common in English ("rst", "nop"), four almost never. */
export const MIN_KEY_WALK = 4;

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

/** The text with each run of one repeated character cut to that character: "aaab!!" is "ab!". */
export const collapseRuns = (text: string) => text.replace(/(.)\1+/gsu, '$1');

export const classOf = (c: string): CharClass => (/[a-z]/.test(c) ? 'lower' : /[A-Z]/.test(c) ? 'upper' : /[0-9]/.test(c) ? 'digit' : /^[ -~]$/.test(c) ? 'symbol' : 'other');

/**
 * Brute force over the characters used: each character (a run of one
 * character counted once) is one pick from an alphabet made of the classes
 * present. Empty is 0.
 */
export function rawBits(password: string): number {
  const chars = [...collapseRuns(password)];
  if (chars.length === 0) return 0;
  const alphabet = [...new Set(chars.map(classOf))].reduce((n, k) => n + CLASS_SIZES[k], 0);
  return chars.length * Math.log2(alphabet);
}

/** One run of a password as Strength reads it. */
export interface StrengthPart {
  text: string;
  /** 'common': the whole password is on the common list; 'repeat': how many times the block before it was typed. */
  kind: 'letters' | 'digits' | 'symbol' | 'common' | 'repeat';
  bits: number;
}

const LETTER_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const ROW_OF = new Map(LETTER_ROWS.flatMap((row, y) => [...row].map((c, x) => [c, { x, y }] as const)));

/** The step from one letter to the next along a keyboard row (+1 or -1), or 0 when they are not neighbours on one. */
const rowStep = (a: string, b: string) => {
  const p = ROW_OF.get(a);
  const q = ROW_OF.get(b);
  return p && q && p.y === q.y && Math.abs(p.x - q.x) === 1 ? q.x - p.x : 0;
};
const alphabetStep = (a: string, b: string) => {
  const d = b.charCodeAt(0) - a.charCodeAt(0);
  return /[a-z]/.test(a) && /[a-z]/.test(b) && Math.abs(d) === 1 ? d : 0;
};

/** How many letters of a run lie in keyboard or alphabet walks of MIN_KEY_WALK or more, and how many such walks there are. */
export function keyWalks(run: string): { letters: number; walks: number } {
  const chars = [...run.toLowerCase()];
  let letters = 0;
  let walks = 0;
  let i = 0;
  while (i < chars.length - 1) {
    let best = 1;
    for (const step of [rowStep, alphabetStep]) {
      const dir = step(chars[i]!, chars[i + 1]!);
      if (!dir) continue;
      let j = i + 1;
      while (j < chars.length - 1 && step(chars[j]!, chars[j + 1]!) === dir) j++;
      best = Math.max(best, j - i + 1);
    }
    if (best >= MIN_KEY_WALK) {
      letters += best;
      walks++;
      i += best;
    } else i++;
  }
  return { letters, walks };
}

/** Whether a block of this length typed this many times in a row reads as a repetition, not as text: three letters or more twice, or two letters three times ("banana" and "cocoa" stay words). */
const isRepetition = (length: number, times: number) => (length >= 3 && times >= 2) || (length === 2 && times >= 3);

/**
 * The text with each block typed again and again in a row cut to one copy,
 * and how many times each such block was typed: "Password1!Password1!x" is
 * "Password1!x" with one block typed twice. Runs of one character are
 * collapseRuns' business, so this starts from blocks of two.
 */
export function collapseBlocks(text: string): { text: string; repeats: { block: string; times: number }[] } {
  const chars = [...text];
  const repeats: { block: string; times: number }[] = [];
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const found = repetitionAt(chars, i);
    if (found) {
      const block = chars.slice(i, i + found.length).join('');
      out += block;
      repeats.push({ block, times: found.times });
      i += found.length * found.times;
    } else out += chars[i++];
  }
  return { text: out, repeats };
}

/**
 * The block starting at `i` that is typed again and again and covers the
 * most text (of two that cover as much, the shorter: "ab" over "abab"), or
 * undefined when no block there reads as a repetition. One pass builds the
 * Z-array of the suffix (z[k]: how many characters from i + k on match
 * those from i on); a block of length L is then typed 1 + z[L] / L times
 * in a row, so every length is read off without comparing slices.
 */
function repetitionAt(chars: readonly string[], i: number): { length: number; times: number } | undefined {
  const m = chars.length - i;
  const z = new Int32Array(m);
  let l = 0;
  let r = 0;
  for (let k = 1; k < m; k++) {
    let zk = k < r ? Math.min(r - k, z[k - l]!) : 0;
    while (k + zk < m && chars[i + zk] === chars[i + k + zk]) zk++;
    z[k] = zk;
    if (k + zk > r) {
      l = k;
      r = k + zk;
    }
  }
  let found: { length: number; times: number } | undefined;
  for (let length = 2; 2 * length <= m; length++) {
    const times = 1 + Math.floor(z[length]! / length);
    if (isRepetition(length, times) && (!found || length * times > found.length * found.times)) found = { length, times };
  }
  return found;
}

/** The password cut into runs of letters (a capital after a lower-case letter starts a new run), runs of digits, and single other characters. */
function partsOf(password: string): { text: string; kind: StrengthPart['kind'] }[] {
  const out: { text: string; kind: StrengthPart['kind'] }[] = [];
  let last: { text: string; kind: StrengthPart['kind'] } | undefined;
  for (const c of password) {
    const kind: StrengthPart['kind'] = /\p{L}/u.test(c) ? 'letters' : /[0-9]/.test(c) ? 'digits' : 'symbol';
    const newWord = kind === 'letters' && last?.kind === 'letters' && /\p{Lu}/u.test(c) && /\p{Ll}/u.test(last.text.at(-1)!);
    if (last && last.kind === kind && kind !== 'symbol' && !newWord) last.text += c;
    else {
      last = { text: c, kind };
      out.push(last);
    }
  }
  return out;
}

/**
 * How a Strength figure is made up. A password on the common list is the
 * guesses it takes to reach it there (log2 of its place), nothing else.
 * Otherwise: a run of letters as English-like text (never less than one
 * letter's pick, one more bit when it has a capital), with each keyboard or
 * alphabet walk in it one pick; a run of digits by its digits (a memorable
 * run one pick, a single digit its own); each distinct symbol one pick,
 * however often it appears; and a block typed again and again once, plus
 * the number of times (log2). Repeated characters were already cut to one.
 */
export function strengthParts(password: string): StrengthPart[] {
  const rank = commonRank(password);
  if (rank !== undefined) return [{ text: password, kind: 'common', bits: Math.log2(rank) }];
  const { text: once, repeats } = collapseBlocks(collapseRuns(password));
  const parts = partsOf(collapseRuns(once));
  const seenSymbols = new Set<string>();
  const read: StrengthPart[] = parts.map(({ text, kind }) => {
    if (kind === 'letters') {
      const n = [...text].length;
      const { letters, walks } = keyWalks(text);
      const rest = n - letters;
      const textBits = rest > 0 || walks === 0 ? Math.max(Math.log2(26), rest * BITS_PER_ENGLISH_LETTER) : 0;
      return { text, kind, bits: textBits + walks * Math.log2(KEY_WALK_CHOICES) + (/\p{Lu}/u.test(text) ? 1 : 0) };
    }
    if (kind === 'digits') {
      return { text, kind, bits: text.length === 1 ? Math.log2(10) : isMemorableDigits(text) ? Math.log2(MEMORABLE_DIGITS_CHOICES) : text.length * Math.log2(10) };
    }
    const first = !seenSymbols.has(text);
    seenSymbols.add(text);
    return { text, kind, bits: first ? Math.log2(SYMBOL_CHOICES) : 0 };
  });
  return [...read, ...repeats.map(({ block, times }) => ({ text: `${block} ×${times}`, kind: 'repeat' as const, bits: Math.log2(times) }))];
}

/** Strength: the figure for an attacker who knows English and the usual habits, not this tool. From the password alone. */
export function strengthBits(password: string): number {
  return strengthParts(password).reduce((sum, p) => sum + p.bits, 0);
}
