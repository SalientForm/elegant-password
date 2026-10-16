// One-tap rule sets for common sign-up forms. A preset is only the site's
// rules (length, required classes, allowed symbols, spaces): strength,
// typing comfort, style and swaps are the user's own and stay as they are.
// The patterns are generic and labelled as such; no preset claims to be a
// particular company's current rules.

import { allowedSymbolSet, automaticSeparator, DEFAULT_REQUIREMENTS, MAX_DIGITS, MAX_SYMBOLS, MAX_UPPERCASE, separatorProblem, type Requirements } from './generate';

/** The fields that describe what a site accepts, as opposed to how the user likes passwords made. */
export const RULE_KEYS = ['minLength', 'maxLength', 'minUppercase', 'minDigits', 'minSymbols', 'allowedSymbols', 'allowSpaces'] as const;
export type RuleKey = (typeof RULE_KEYS)[number];
export type RuleFields = Pick<Requirements, RuleKey>;

export interface SitePreset {
  label: string;
  /** A few words under the label. */
  note: string;
  /** Where the pattern comes from, for the tooltip. */
  hint: string;
  rules: RuleFields;
}

/** Every printable ASCII symbol: what a site accepts when it accepts anything. */
export const ALL_SYMBOLS = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

export const rulesOf = (req: RuleFields): RuleFields => ({
  minLength: req.minLength,
  maxLength: req.maxLength,
  minUppercase: req.minUppercase,
  minDigits: req.minDigits,
  minSymbols: req.minSymbols,
  allowedSymbols: req.allowedSymbols,
  allowSpaces: req.allowSpaces,
});

const typical = rulesOf(DEFAULT_REQUIREMENTS);

export const SITE_PRESETS: readonly SitePreset[] = [
  { label: 'Typical site', note: '12-32, A + 1 + #', hint: 'The defaults: 12-32 characters, an uppercase letter, a digit and a symbol, spaces allowed.', rules: typical },
  { label: 'No spaces', note: 'as typical, no spaces', hint: 'The defaults, but the site rejects spaces, as many do.', rules: { ...typical, allowSpaces: false } },
  {
    label: 'No symbols',
    note: 'letters and digits',
    hint: 'Letters and digits only ("alphanumeric"): no symbols, no spaces.',
    rules: { ...typical, minSymbols: 0, allowedSymbols: '', allowSpaces: false },
  },
  {
    label: 'Short max (16)',
    note: '8-16, !@#$%&*',
    hint: 'Common on banking and older sites: 8-16 characters, an uppercase letter, a digit and one of a narrow set of symbols, no spaces.',
    rules: { minLength: 8, maxLength: 16, minUppercase: 1, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%&*', allowSpaces: false },
  },
  {
    label: '8-20, few symbols',
    note: 'one of !@#$%^&*',
    hint: 'A very common sign-up rule: 8-20 characters, an uppercase letter, a digit and one of the shifted number-row symbols, no spaces.',
    rules: { minLength: 8, maxLength: 20, minUppercase: 1, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%^&*', allowSpaces: false },
  },
  {
    label: 'NIST passphrase',
    note: '15-64, no must-haves',
    hint: 'NIST SP 800-63B guidance: at least 15 characters when the password is the only factor, up to at least 64, every printable symbol and the space accepted, no "must contain" rules.',
    rules: { minLength: 15, maxLength: 64, minUppercase: 0, minDigits: 0, minSymbols: 0, allowedSymbols: ALL_SYMBOLS, allowSpaces: true },
  },
];

/** The requirements with these rules in place; every other setting untouched. */
export const withRules = (req: Requirements, rules: Partial<RuleFields>): Requirements => ({ ...req, ...rules });

export interface Settled {
  req: Requirements;
  /** Each fix made, in a few words ("maximum raised to 40 to fit"), for the form to say. */
  notes: string[];
}

const COUNTS: ['minUppercase' | 'minDigits' | 'minSymbols', number, string][] = [
  ['minUppercase', MAX_UPPERCASE, 'uppercase letters'],
  ['minDigits', MAX_DIGITS, 'digits'],
  ['minSymbols', MAX_SYMBOLS, 'symbols'],
];

const shown = (separator: string) => (separator === ' ' ? 'a space' : separator === '' ? 'none' : `"${separator}"`);

/**
 * New site rules (from a preset or pasted text) made consistent with the
 * rest of the settings, so a tap or a paste never leaves the form in a
 * state the user did not cause. `stated` are the fields the new rules set
 * on purpose: a fix changes the other fields first, and each fix is named.
 * What the rules themselves contradict (pasted text asking for more required
 * characters than its own maximum) is left for the form to show.
 */
export function settleRules(req: Requirements, stated: ReadonlySet<keyof Requirements>): Settled {
  const next = { ...req };
  const notes: string[] = [];
  for (const [key, cap, label] of COUNTS) {
    if (next[key] > cap) {
      next[key] = cap;
      notes.push(`${label} capped at ${cap}`);
    }
  }
  if (next.minLength > next.maxLength) {
    if (!stated.has('maxLength')) {
      next.maxLength = next.minLength;
      notes.push(`maximum raised to ${next.maxLength} to fit`);
    } else if (!stated.has('minLength')) {
      next.minLength = next.maxLength;
      notes.push(`minimum lowered to ${next.minLength} to fit`);
    }
  }
  if (next.minSymbols > 0 && allowedSymbolSet(next).length === 0) {
    if (!stated.has('allowedSymbols')) {
      next.allowedSymbols = DEFAULT_REQUIREMENTS.allowedSymbols;
      notes.push(`symbols ${next.allowedSymbols} allowed, as none were`);
    } else if (!stated.has('minSymbols')) {
      next.minSymbols = 0;
      notes.push('symbols no longer required, as none are allowed');
    }
  }
  // Required characters beyond the maximum: lower the counts the rules did not set, the largest first, then raise an unstated maximum.
  const total = () => COUNTS.reduce((n, [key]) => n + next[key], 0);
  for (const [key, , label] of [...COUNTS].filter(([key]) => !stated.has(key)).sort(([a], [b]) => next[b] - next[a])) {
    const over = total() - next.maxLength;
    if (over <= 0) break;
    const lowered = Math.max(0, next[key] - over);
    if (lowered === next[key]) continue;
    next[key] = lowered;
    notes.push(lowered ? `${label} lowered to ${lowered} to fit` : `${label} no longer required, to fit`);
  }
  if (total() > next.maxLength && !stated.has('maxLength')) {
    next.maxLength = total();
    notes.push(`maximum raised to ${next.maxLength} to fit`);
  }
  // A separator the new rules rule out becomes Automatic, which always picks one they allow.
  if (separatorProblem(next.separator, next)) {
    const was = next.separator;
    next.separator = 'auto';
    notes.push(`separator set to Auto (${shown(automaticSeparator(next))}), as ${was === ' ' ? 'spaces are' : `${shown(was)} is`} not allowed`);
  }
  return { req: next, notes };
}

/** A preset's rules in place, settled: only the separator can need a fix, as a preset sets every rule. */
export const applyPreset = (req: Requirements, rules: RuleFields): Settled => settleRules(withRules(req, rules), new Set(RULE_KEYS));

const symbolSet = (s: string) => [...new Set(s)].sort().join('');

/** Same rules, reading the allowed symbols as a set: "#@!" is "!@#". */
export function sameRules(a: RuleFields, b: RuleFields): boolean {
  return RULE_KEYS.every((k) => (k === 'allowedSymbols' ? symbolSet(a[k]) === symbolSet(b[k]) : a[k] === b[k]));
}

/** The preset these rules match exactly, if any. */
export const matchingPreset = (req: RuleFields): SitePreset | undefined => SITE_PRESETS.find((p) => sameRules(p.rules, req));
