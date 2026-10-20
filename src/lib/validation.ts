// Every way a set of requirements can contradict itself, found by one pure
// function so the form, the provider, stored settings and the engine all
// agree. A problem names the fields at fault, first the one where it is
// shown, so the form can put it beside what fixes it; Submit, Ctrl+Enter
// and Refresh stay off while there is any. What this cannot know without
// the word lists (no sentence of these words fits 8-10 characters) is
// found by planning, so the engine still reports that after Submit, and
// never makes a password that breaks a rule instead.

import type { Requirements } from './generate';
import { lookupKey } from './keyboard';

export const MAX_LENGTH = 256;
export const MAX_TARGET_BITS = 256;
export const MAX_COUNT = 20;
export const MAX_TWISTS = 3;
export const MAX_INITIALS = 3;
export const MAX_SHORTHAND = 3;
export const MAX_MADE_UP = 3;
export const MAX_UPPERCASE = 8;
export const MAX_DIGITS = 4;
export const MAX_SYMBOLS = 8;

const COMFORTS: readonly string[] = ['strict', 'balanced', 'relaxed'];

export class RequirementsError extends Error {}

export const isSymbol = (c: string) => /[^A-Za-z0-9\s]/.test(c);

/** The allowed symbols the tool can use: each once, keyboard symbols only. */
export function allowedSymbolSet(req: Pick<Requirements, 'allowedSymbols'>): string[] {
  return [...new Set(req.allowedSymbols)].filter((c) => isSymbol(c) && lookupKey(c));
}

/**
 * Characters in the allowed-symbols field the tool will never use: letters
 * and digits (always allowed anyway), spaces (the Spaces box says that) and
 * symbols not on a standard keyboard. Not a problem, but worth saying.
 */
export function ignoredSymbols(allowedSymbols: string): string[] {
  return [...new Set(allowedSymbols)].filter((c) => !isSymbol(c) || !lookupKey(c));
}

/** Why a separator cannot be used, or undefined when it can. 'auto' and '' (none) always can. */
export function separatorProblem(separator: string, req: Pick<Requirements, 'allowSpaces' | 'allowedSymbols'>): string | undefined {
  if (separator === 'auto' || separator === '') return undefined;
  if ([...separator].length !== 1) return 'The separator must be a single character.';
  if (separator === ' ') return req.allowSpaces ? undefined : 'Space is chosen as the separator, but spaces are not allowed.';
  if (!isSymbol(separator)) return 'The separator must be a symbol or a space, not a letter or digit.';
  if (!lookupKey(separator)) return `"${separator}" is not on a standard keyboard.`;
  if (![...req.allowedSymbols].includes(separator)) return `"${separator}" is chosen as the separator, but it is not an allowed symbol.`;
  return undefined;
}

/** How each field is named in messages. */
export const FIELD_LABELS: Record<keyof Requirements, string> = {
  minLength: 'minimum length',
  maxLength: 'maximum length',
  minUppercase: 'uppercase letters',
  minDigits: 'digits',
  minSymbols: 'symbols',
  allowedSymbols: 'allowed symbols',
  allowSpaces: 'spaces',
  separator: 'separator',
  includeNumber: 'include a number',
  targetBits: 'target strength',
  shortest: 'shortest that meets the target',
  comfort: 'typing comfort',
  twists: 'minimum swaps',
  initials: 'capital initials',
  shorthand: 'two-letter words',
  madeUp: 'made-up nouns',
  glue: 'glue',
  avoidPinkyStretch: 'avoid pinky stretches',
  shiftReach: 'keep Shift within reach',
  easeSwaps: 'deliberate swaps',
  count: 'number of suggestions',
};

/**
 * Which kind of contradiction, so a front end can word it its own way (the
 * CLI names flags and config keys, not form fields) without matching the
 * message text.
 */
export type RuleProblemCode =
  /** One field holds a value outside what it can be. */
  | 'range'
  /** The minimum length is above the maximum. */
  | 'min-above-max'
  /** The required uppercase letters, digits and symbols together need more characters than the maximum. */
  | 'counts-exceed-max'
  /** A symbol is required but no keyboard symbol is allowed. */
  | 'symbols-none-allowed'
  /** The chosen separator is a space or symbol the rules do not allow. */
  | 'separator-not-allowed'
  /** The chosen separator could never be one: a letter, a digit, more than one character, off the keyboard. */
  | 'separator-invalid';

export interface RuleProblem {
  code: RuleProblemCode;
  /** The fields at fault; the message belongs beside the first. */
  fields: (keyof Requirements)[];
  message: string;
}

const whole = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Every contradiction in these requirements, in form order. Empty when they can be submitted. */
export function ruleProblems(req: Requirements): RuleProblem[] {
  const out: RuleProblem[] = [];
  const add = (code: RuleProblemCode, message: string, ...fields: (keyof Requirements)[]) => out.push({ code, fields, message });

  // Length.
  const minOk = whole(req.minLength, 1, MAX_LENGTH);
  const maxOk = whole(req.maxLength, 1, MAX_LENGTH);
  if (!minOk) add('range', `The minimum length must be a whole number from 1 to ${MAX_LENGTH}.`, 'minLength');
  if (!maxOk) add('range', `The maximum length must be a whole number from 1 to ${MAX_LENGTH}.`, 'maxLength');
  if (minOk && maxOk && req.minLength > req.maxLength) {
    add('min-above-max', `The minimum length (${req.minLength}) is above the maximum (${req.maxLength}).`, 'minLength', 'maxLength');
  }

  // Must contain: each count in range, and together within the maximum (one character can meet only one of them).
  const counts: ['minUppercase' | 'minDigits' | 'minSymbols', string, string, number][] = [
    ['minUppercase', 'Uppercase letters', 'uppercase letter', MAX_UPPERCASE],
    ['minDigits', 'Digits', 'digit', MAX_DIGITS],
    ['minSymbols', 'Symbols', 'symbol', MAX_SYMBOLS],
  ];
  const countsOk = counts.every(([key, label, , max]) => {
    if (whole(req[key], 0, max)) return true;
    add('range', `${label} must be a whole number from 0 to ${max}.`, key);
    return false;
  });
  if (countsOk && maxOk) {
    const needed = counts.filter(([key]) => req[key] > 0);
    const sum = needed.reduce((n, [key]) => n + req[key], 0);
    if (sum > req.maxLength) {
      add(
        'counts-exceed-max',
        `${needed.map(([key, , one]) => plural(req[key], one)).join(' + ')} need at least ${sum} characters, more than the maximum of ${req.maxLength}.`,
        'maxLength',
        ...needed.map(([key]) => key),
      );
    }
  }

  // Site allows: required symbols need at least one the tool can type.
  if (typeof req.allowedSymbols !== 'string') add('range', 'The allowed symbols must be text.', 'allowedSymbols');
  else if (whole(req.minSymbols, 1, MAX_SYMBOLS) && allowedSymbolSet(req).length === 0) {
    const listed = req.allowedSymbols.trim() ? ` (none of ${req.allowedSymbols.trim()} is a keyboard symbol)` : '';
    add(
      'symbols-none-allowed',
      `${req.minSymbols === 1 ? 'A symbol is' : `${req.minSymbols} symbols are`} required, but no symbols are allowed${listed}. ` +
        'List the symbols the site accepts, or untick Symbols under Must contain.',
      'allowedSymbols',
      'minSymbols',
    );
  }

  // Strength and comfort.
  if (!(typeof req.targetBits === 'number' && req.targetBits >= 0 && req.targetBits <= MAX_TARGET_BITS)) {
    add('range', `The target strength must be from 0 to ${MAX_TARGET_BITS} bits.`, 'targetBits');
  }
  if (!COMFORTS.includes(req.comfort)) add('range', 'Typing comfort must be strict, balanced or relaxed.', 'comfort');

  // Style.
  if (typeof req.separator !== 'string') add('separator-invalid', 'The separator must be text.', 'separator');
  else if (typeof req.allowedSymbols === 'string') {
    const problem = separatorProblem(req.separator, req);
    if (problem) {
      const notAllowed = /not allowed|not an allowed/.test(problem);
      add(notAllowed ? 'separator-not-allowed' : 'separator-invalid', notAllowed ? `${problem} Choose Auto to use one the site allows.` : problem, 'separator');
    }
  }
  const shapes: ['initials' | 'shorthand' | 'madeUp' | 'twists', string, number][] = [
    ['initials', 'Capital initials', MAX_INITIALS],
    ['shorthand', 'Two-letter words', MAX_SHORTHAND],
    ['madeUp', 'Made-up nouns', MAX_MADE_UP],
    ['twists', 'Minimum swaps', MAX_TWISTS],
  ];
  for (const [key, label, max] of shapes) if (!whole(req[key], 0, max)) add('range', `${label} must be between 0 and ${max}.`, key);
  if (!whole(req.count, 1, MAX_COUNT)) add('range', `The number of suggestions must be between 1 and ${MAX_COUNT}.`, 'count');
  return out;
}

/** Throws the first problem, for the engine: it never plans from a contradiction. */
export function validate(req: Requirements): void {
  const [first] = ruleProblems(req);
  if (first) throw new RequirementsError(first.message);
}
