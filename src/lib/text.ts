// Word-level text helpers shared by sentence mode and the cold scorer.
// Kept free of other imports so the scorer never depends on the generator.

/**
 * The longest sentence, hint or password under test either front end takes,
 * in characters. Scoring a text is quadratic in places (the alignment, the
 * twist count), so the length is capped rather than left open; at this cap
 * the longest permitted batch answers in about a quarter of a second on a
 * desktop (docs/decisions.md, "The engine's budget").
 */
export const MAX_SENTENCE_LENGTH = 500;

/**
 * Why a sentence is too long, or undefined when it is not: the one check
 * and wording for the engine and for `tep g`, so a sentence that reaches
 * the engine by any route is capped the same way. Lengths count UTF-16
 * code units, as the web app's fields and the CLI already do.
 */
export function sentenceLengthProblem(sentence: string): string | undefined {
  return sentence.length > MAX_SENTENCE_LENGTH ? `The sentence is ${sentence.length} characters; ${MAX_SENTENCE_LENGTH} is the most this tool takes. Use a shorter sentence.` : undefined;
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
