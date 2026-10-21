// The most common passwords (commonPasswords.ts, from SecLists). A password
// that is exactly one of them is not allowed anywhere in the app or tep: a
// suggestion that comes out as one is dropped, the tester says so, and My
// list refuses it. An attacker tries these first, in this order, so its
// Strength is the guesses that takes (strength.ts). Only an exact match
// counts: "Password1" is not "password1".

import { COMMON_PASSWORDS_TEXT } from './commonPasswords';

let ranks: Map<string, number> | undefined;

/** Where the password stands on the list, 1 for the most common; undefined when it is not on it. */
export function commonRank(password: string): number | undefined {
  ranks ??= new Map(COMMON_PASSWORDS_TEXT.split('\n').map((p, i) => [p, i + 1]));
  return ranks.get(password);
}

export const isCommonPassword = (password: string) => commonRank(password) !== undefined;

/** How many passwords the list holds. */
export const COMMON_PASSWORD_COUNT = COMMON_PASSWORDS_TEXT.split('\n').length;

/** What the app says about a password on the list. */
export const commonPasswordProblem = (rank: number) =>
  `Not allowed: number ${rank.toLocaleString('en')} of the ${COMMON_PASSWORD_COUNT.toLocaleString('en')} most common passwords, which attackers try first`;
