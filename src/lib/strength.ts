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
// In both, a character that repeats the one before it adds nothing. The
// app's own figure, for an attacker who knows it exactly, is the bits
// model in score.ts and the plan; it needs the session and stays there.

/** Bits per letter of English-like text. */
export const BITS_PER_ENGLISH_LETTER = 2.3;
/** A memorable digit run (a repeat, a consecutive run, a well-known skip) counts as one pick from this many. */
export const MEMORABLE_DIGITS_CHOICES = 40;
/** Choices per symbol: a distinct symbol is one pick from this many. */
export const SYMBOL_CHOICES = 32;

/** How many characters each class holds, for Raw's alphabet. Symbols are the printable ASCII marks and the space; "other" is about an alphabet. */
export const CLASS_SIZES = { lower: 26, upper: 26, digit: 10, symbol: 33, other: 50 } as const;
export type CharClass = keyof typeof CLASS_SIZES;

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
  kind: 'letters' | 'digits' | 'symbol';
  bits: number;
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
 * How a Strength figure is made up: a run of letters as English-like text
 * (never less than one letter's pick, one more bit when it has a capital),
 * a run of digits by its digits (a memorable run one pick, a single digit
 * its own), each distinct symbol one pick, however often it appears.
 * Repeated characters were already cut to one.
 */
export function strengthParts(password: string): StrengthPart[] {
  const parts = partsOf(collapseRuns(password));
  const seenSymbols = new Set<string>();
  return parts.map(({ text, kind }) => {
    if (kind === 'letters') {
      const n = [...text].length;
      return { text, kind, bits: Math.max(Math.log2(26), n * BITS_PER_ENGLISH_LETTER) + (/\p{Lu}/u.test(text) ? 1 : 0) };
    }
    if (kind === 'digits') {
      return { text, kind, bits: text.length === 1 ? Math.log2(10) : isMemorableDigits(text) ? Math.log2(MEMORABLE_DIGITS_CHOICES) : text.length * Math.log2(10) };
    }
    const first = !seenSymbols.has(text);
    seenSymbols.add(text);
    return { text, kind, bits: first ? Math.log2(SYMBOL_CHOICES) : 0 };
  });
}

/** Strength: the figure for an attacker who knows English and the usual habits, not this tool. From the password alone. */
export function strengthBits(password: string): number {
  return strengthParts(password).reduce((sum, p) => sum + p.bits, 0);
}
