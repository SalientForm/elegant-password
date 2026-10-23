// What every password is checked against before it is shown, and how long
// a strength takes to guess. Split from generate.ts so the checks can be
// read on their own; generate.ts re-exports all of it, so callers keep one
// import for requirements.

import { COMMON_PASSWORD_COUNT, commonPasswordProblem, commonRank } from './common';
import type { RequirementCheck, Requirements } from './requirements';
import { plural } from './text';
import { isSymbol } from './validation';

export const countUpper = (text: string) => text.replace(/[^A-Z]/g, '').length;
export const countLower = (text: string) => text.replace(/[^a-z]/g, '').length;

export interface CheckContext {
  separator: string;
  endSymbol: string;
  /** Overrides for how the uppercase, digit and symbol rules were met. */
  uppercaseHow?: string;
  digitsHow?: string;
  symbolsHow?: string;
}

export function checkRequirements(password: string, req: Requirements, ctx?: CheckContext): RequirementCheck[] {
  const allowed = new Set(req.allowedSymbols);
  const symbols = [...password].filter(isSymbol);
  const len = [...password].length;
  const checks: RequirementCheck[] = [
    {
      rule: `${req.minLength}-${req.maxLength} characters`,
      met: len >= req.minLength && len <= req.maxLength,
      how: `${len} characters`,
    },
    {
      rule: 'Only allowed symbols',
      met: symbols.every((c) => allowed.has(c)) && (req.allowSpaces || !password.includes(' ')),
      how: symbols.length ? `uses ${[...new Set(symbols)].map((c) => `"${c}"`).join(' ')}` : 'no symbols used',
    },
  ];
  const atLeast = (n: number, thing: string) => (n === 1 ? `${thing}` : `At least ${n} ${thing}s`);
  if (req.minUppercase > 0) {
    const n = countUpper(password);
    checks.push({
      rule: atLeast(req.minUppercase, req.minUppercase === 1 ? 'Uppercase letter' : 'uppercase letter'),
      met: n >= req.minUppercase,
      how:
        ctx?.uppercaseHow ??
        (req.minUppercase === 1
          ? 'one word starts with a capital, one Shift press, like the start of a sentence'
          : `${n} capitals from writing ${n > 8 ? 'whole words' : 'a whole word'} in capitals: hold Shift once, no back-and-forth`),
    });
  }
  if (req.minLowercase > 0) {
    const n = countLower(password);
    checks.push({
      rule: atLeast(req.minLowercase, req.minLowercase === 1 ? 'Lowercase letter' : 'lowercase letter'),
      met: n >= req.minLowercase,
      how: `${plural(n, 'lowercase letter')}: the words not in capitals`,
    });
  }
  if (req.minDigits > 0) {
    const n = password.replace(/[^0-9]/g, '').length;
    checks.push({
      rule: atLeast(req.minDigits, req.minDigits === 1 ? 'Digit' : 'digit'),
      met: n >= req.minDigits,
      how:
        ctx?.digitsHow ??
        (req.minDigits === 1 ? 'a number counts something in the sentence' : `a ${req.minDigits}-digit number counts something in the sentence`),
    });
  }
  if (req.minSymbols > 0) {
    const how = [
      ctx && isSymbol(ctx.separator) ? `words are separated by "${ctx.separator}"` : '',
      ctx?.symbolsHow ?? '',
      ctx?.endSymbol ? `the sentence ends with "${ctx.endSymbol}"` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    checks.push({
      rule: atLeast(req.minSymbols, req.minSymbols === 1 ? 'Symbol' : 'symbol'),
      met: symbols.length >= req.minSymbols,
      how: how || `uses ${symbols.length} symbols`,
    });
  }
  const rank = commonRank(password);
  checks.push({
    rule: 'Not a common password',
    met: rank === undefined,
    how: rank === undefined ? `not one of the ${COMMON_PASSWORD_COUNT.toLocaleString('en')} most common passwords` : commonPasswordProblem(rank),
  });
  return checks;
}

export interface CrackEstimate {
  scenario: string;
  guessesPerSecond: number;
  seconds: number;
}

export const ATTACK_SCENARIOS: readonly { scenario: string; guessesPerSecond: number }[] = [
  { scenario: 'Online attack, rate limited', guessesPerSecond: 10 },
  { scenario: 'Stolen database, slow hash (bcrypt)', guessesPerSecond: 1e5 },
  { scenario: 'Stolen database, fast hash, GPU farm', guessesPerSecond: 1e11 },
];

/** Average time to guess, i.e. half the space, at a few attacker speeds. */
export function crackEstimates(bits: number): CrackEstimate[] {
  const guesses = 2 ** (bits - 1);
  return ATTACK_SCENARIOS.map((s) => ({ ...s, seconds: guesses / s.guessesPerSecond }));
}

export function formatDuration(seconds: number): string {
  const units: [string, number][] = [
    ['year', 365.25 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  if (seconds < 1) return 'instantly';
  const [unit, size] = units.find(([, s]) => seconds >= s)!;
  const n = seconds / size;
  if (unit === 'year' && n >= 1e6) {
    const scales: [string, number][] = [
      ['trillion', 1e12],
      ['billion', 1e9],
      ['million', 1e6],
    ];
    const [word, scale] = scales.find(([, s]) => n >= s)!;
    const v = n / scale;
    return v >= 1000 ? `${v.toExponential(1)} ${word} years` : `${Math.round(v)} ${word} years`;
  }
  const rounded = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return `${rounded.toLocaleString('en')} ${unit}${rounded === 1 ? '' : 's'}`;
}
