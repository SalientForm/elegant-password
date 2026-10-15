// One-tap rule sets for common sign-up forms. A preset is only the site's
// rules (length, required classes, allowed symbols, spaces): strength,
// typing comfort, style and swaps are the user's own and stay as they are.
// The patterns are generic and labelled as such; no preset claims to be a
// particular company's current rules.

import { DEFAULT_REQUIREMENTS, type Requirements } from './generate';

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

const symbolSet = (s: string) => [...new Set(s)].sort().join('');

/** Same rules, reading the allowed symbols as a set: "#@!" is "!@#". */
export function sameRules(a: RuleFields, b: RuleFields): boolean {
  return RULE_KEYS.every((k) => (k === 'allowedSymbols' ? symbolSet(a[k]) === symbolSet(b[k]) : a[k] === b[k]));
}

/** The preset these rules match exactly, if any. */
export const matchingPreset = (req: RuleFields): SitePreset | undefined => SITE_PRESETS.find((p) => sameRules(p.rules, req));
