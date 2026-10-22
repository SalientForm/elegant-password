// A site's requirements: their shape, the defaults, and the shape of one
// rule's check. A module of their own so the validator and the checks can
// name them without importing the generator, which imports both (audit
// L12); generate.ts re-exports all of it, so callers keep one import for
// requirements.

import type { Comfort } from './grammar';

/**
 * What goes between words: 'auto' (Automatic: see resolveSeparator), ''
 * (nothing), or one character: a space, or any symbol the site allows.
 */
export type Separator = string;

export interface Requirements {
  minLength: number;
  maxLength: number;
  /** At least this many uppercase letters, digits and symbols (0 = not required). */
  minUppercase: number;
  /**
   * At least this many lowercase letters (0 = not required). Words are
   * lower case, so this only bites when capitals take most of the letters:
   * more than one capital puts whole words in capitals, and a password left
   * with too few lowercase letters is never shown.
   */
  minLowercase: number;
  minDigits: number;
  minSymbols: number;
  /** Symbols the site accepts. Separators and end marks are drawn from these. */
  allowedSymbols: string;
  allowSpaces: boolean;
  separator: Separator;
  /** Lead with a number even when digits are not required (cheap extra strength). */
  includeNumber: boolean;
  /** Minimum entropy in bits, assuming the attacker knows exactly how this tool works. */
  targetBits: number;
  /**
   * The shortest sentence that still meets the target: each shape's length
   * window is cut from the top to the fewest characters at which its count
   * reaches 2^targetBits (at a target the first length already reaches, one
   * length). Off, the whole range counts and the strongest short plan wins.
   */
  shortest: boolean;
  comfort: Comfort;
  /** Minimum swaps (symbol swaps or misspellings) per password, 0-3, applied whenever the letters allow. */
  twists: number;
  /** Words typed as a single capital letter ("brings" -> "B"), 0-3. */
  initials: number;
  /** Words typed as two letters, first and last consonant ("gently" -> "gy"), 0-3. */
  shorthand: number;
  /** Nouns replaced by made-up words of at most two key rolls ("ertdfg"), 0-3. */
  madeUp: number;
  /** Attach numbers and small-word initials to the next word ("5ls", "Fp33z"). */
  glue: boolean;
  /**
   * Never pick a symbol the pinky must stretch more than one key to reach
   * ("! - _ = + ) | ~" ...) for twists, closing marks or the automatic
   * separator. A separator the user picks explicitly is still honoured.
   */
  avoidPinkyStretch: boolean;
  /**
   * Keep every Shift stroke within one hand's reach: never pick a shifted
   * symbol more than four keys from both Shift keys ("$ % ^ & *") for
   * twists, closing marks or the automatic separator, and put the opening
   * capital on a word whose first letter is in reach (not T G B Y H N U J I)
   * when the sentence has one.
   */
  shiftReach: boolean;
  /**
   * Deliberate swaps for typing ease: a word with a same-finger jump or a
   * long reach is typed with one fixed misspelling that removes it ("wise"
   * -> "wyse"; see ease.ts). A fixed rule that comes with the word, so it
   * adds no bits and nothing to remember. On by default: measured at the
   * defaults it makes passwords a little easier to type and costs nothing
   * on strength or memorability (TODO.md has the figures).
   */
  easeSwaps: boolean;
  count: number;
}

export const DEFAULT_REQUIREMENTS: Requirements = {
  minLength: 12,
  maxLength: 32,
  minUppercase: 1,
  minLowercase: 0,
  minDigits: 1,
  minSymbols: 1,
  allowedSymbols: '!@#$%^&*-_.,?;',
  allowSpaces: true,
  separator: 'auto',
  includeNumber: true,
  targetBits: 40,
  shortest: false,
  comfort: 'balanced',
  twists: 2,
  initials: 0,
  shorthand: 0,
  madeUp: 0,
  glue: false,
  avoidPinkyStretch: true,
  shiftReach: false,
  easeSwaps: true,
  count: 5,
};

export interface RequirementCheck {
  rule: string;
  met: boolean;
  how: string;
}
