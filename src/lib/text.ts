// Word-level text helpers shared by sentence mode and the cold scorer, and
// the small wording helpers every module that writes a sentence uses (a
// count and its noun, a first letter up or down). Kept free of other
// imports so the scorer never depends on the generator, and any module,
// either front end's included, can take a helper without drawing in more.

/**
 * The longest sentence or hint either front end takes, in characters (the
 * user's limit, 2026-10-21; a password under test is at most MAX_LENGTH,
 * 128). Scoring a text is quadratic in places (the alignment, the twist
 * count), so the length is capped rather than left open; at this cap the
 * longest permitted batch answers in about a quarter of a second on a
 * desktop (docs/decisions.md, "The engine's budget").
 */
export const MAX_HINT_LENGTH = 512;

/**
 * Why a sentence is too long, or undefined when it is not: the one check
 * and wording for the engine and for `tep g`, so a sentence that reaches
 * the engine by any route is capped the same way. Lengths count UTF-16
 * code units, as the web app's fields and the CLI already do.
 */
export function sentenceLengthProblem(sentence: string): string | undefined {
  return sentence.length > MAX_HINT_LENGTH ? `The sentence is ${sentence.length} characters; ${MAX_HINT_LENGTH} is the most this tool takes. Use a shorter sentence.` : undefined;
}

/** Small words: these become capital initials and are the first to be dropped. */
export const SMALL_WORDS: ReadonlySet<string> = new Set(
  `a an the of for to in on at by with from into onto over under up off out and or but nor so as than that
   this these those my your his her its our their is are was were be am`.split(/\s+/),
);

/** Lowercase a-z and 0-9 words: accents stripped, apostrophes removed, everything else is a separator. */
export function normalizeSentence(sentence: string): string[] {
  return sentence
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "sweets" -> "swts": keep the first letter, drop the vowels after it. */
export function dropVowels(word: string): string {
  const short = word[0] + word.slice(1).replace(/[aeiou]/g, '');
  return short.length >= 2 && short !== word ? short : word;
}

/** "jptr" -> "jpr", "lds" -> "ls": drop the second-to-last letter, keeping the first and last. */
export function trimInterior(word: string): string {
  return word.length > 2 ? word.slice(0, -2) + word.slice(-1) : word;
}

/** Count of letters a-z or A-Z. */
export const letterCount = (text: string) => text.replace(/[^a-zA-Z]/g, '').length;

/** A count and the noun that agrees with it: "1 digit", "3 digits", "2 fixes" (with `many`). */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The text with its first character in upper case: the start of a sentence. */
export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The text with its first character in lower case: a sentence carried into another. */
export const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
