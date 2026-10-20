import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, ruleProblems, validate } from './generate';
import { applyParsedRules, parseRuleText } from './ruleText';
import type { RuleFields } from './sitePresets';

interface Case {
  name: string;
  text: string;
  rules: Partial<RuleFields>;
  understood?: string[];
  excluded?: string;
}

// Real phrasings, many copied in the shape sign-up forms show them: bullets, ticks, numbered lists, stray
// headings and sentences that are not rules at all.
const CASES: Case[] = [
  {
    name: 'the example: a range, a digit and one of a symbol list',
    text: 'Must be 8-20 characters and include at least one number and one of !@#$%',
    rules: { minLength: 8, maxLength: 20, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%' },
    understood: ['8-20 characters', 'a digit', 'a symbol from !@#$%'],
  },
  { name: '"at least N characters long"', text: 'Password must be at least 8 characters long.', rules: { minLength: 8 }, understood: ['at least 8 characters'] },
  { name: '"between N and M characters"', text: 'Your password must be between 10 and 64 characters.', rules: { minLength: 10, maxLength: 64 } },
  { name: '"N to M characters" with a number word', text: 'Choose a password of eight to sixteen characters', rules: { minLength: 8, maxLength: 16 } },
  { name: '"N or more characters" with a mix of classes', text: 'Use 8 or more characters with a mix of letters, numbers & symbols', rules: { minLength: 8, minDigits: 1, minSymbols: 1 } },
  { name: '"no more than N" and "at least N" in one sentence', text: 'Your password must be at least 6 characters, and no more than 12.', rules: { minLength: 6, maxLength: 12 } },
  { name: '"up to N characters" alone', text: 'Passwords can be up to 64 characters.', rules: { maxLength: 64 }, understood: ['at most 64 characters'] },
  { name: '"no longer than" and "no shorter than"', text: 'Password must be no longer than 20 characters and no shorter than 10.', rules: { minLength: 10, maxLength: 20 } },
  { name: '"fewer than N" as a maximum, and characters ruled out', text: 'The password must be fewer than 17 characters and must not contain the characters < > " \' &', rules: { maxLength: 16 }, excluded: '<>"\'&' },
  { name: '"Minimum length: N" and "Maximum length: M" labels', text: 'Minimum length: 12\nMaximum length: 128', rules: { minLength: 12, maxLength: 128 } },
  { name: 'abbreviations: "min. 10 chars, 2+ digits"', text: 'min. 10 chars, 2+ digits', rules: { minLength: 10, minDigits: 2 } },
  { name: '"exactly N characters"', text: 'Your passcode must be exactly 8 characters.', rules: { minLength: 8, maxLength: 8 }, understood: ['exactly 8 characters'] },
  { name: 'a bare "must be N characters" as a minimum, with a separate maximum', text: 'Your password must be 8 characters, max 20', rules: { minLength: 8, maxLength: 20 } },
  {
    name: 'a bulleted checklist under a heading',
    text: 'Your password must contain:\n• 8-64 characters\n• At least one uppercase letter\n• At least one lowercase letter\n• At least one number\n• At least one special character (!@#$%^&*)',
    rules: { minLength: 8, maxLength: 64, minUppercase: 1, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%^&*' },
    understood: ['8-64 characters', 'an uppercase letter', 'a lowercase letter (always included)', 'a digit', 'a symbol from !@#$%^&*'],
  },
  {
    name: 'a copied form with ticks, crosses and labels around the rules',
    text: 'Create a password\nPassword*\n\nPassword requirements:\n✓ Between 8 and 32 characters\n✓ One uppercase letter\n✓ One number\n✗ One special character\nShow password',
    rules: { minLength: 8, maxLength: 32, minUppercase: 1, minDigits: 1, minSymbols: 1 },
  },
  {
    name: 'a numbered list with en dashes and a rule about the username',
    text: '1. Must be 10–64 characters long\n2. Must include a lowercase letter, an uppercase letter and a number\n3. Must not include spaces\n4. Must not be the same as your username',
    rules: { minLength: 10, maxLength: 64, minUppercase: 1, minDigits: 1, allowSpaces: false },
  },
  {
    name: 'a heading ending in a colon carries "must" to bare items below it',
    text: 'Your password must have:\n8 or more characters\nupper & lowercase letters\nat least one number',
    rules: { minLength: 8, minUppercase: 1, minDigits: 1 },
  },
  {
    name: '"needs to" with "upper and lower case" and "a number or symbol"',
    text: 'Your password needs to:\n- include both lower and upper case characters\n- include at least one number or symbol\n- be at least 8 characters long',
    rules: { minLength: 8, minUppercase: 1, minDigits: 1, minSymbols: 1 },
  },
  { name: '"at least N" counts per class', text: 'Password requires 2 uppercase letters, at least 3 digits and a minimum of 2 special characters.', rules: { minUppercase: 2, minDigits: 3, minSymbols: 2 }, understood: ['2 uppercase letters', '3 digits', '2 symbols'] },
  { name: '"capital letter" and "must not exceed"', text: 'Must not exceed 16 characters, at least 1 capital letter', rules: { maxLength: 16, minUppercase: 1 } },
  {
    name: 'classes listed first and "are required" after them; "optional" for symbols',
    text: 'Uppercase, lowercase and numbers are required. Symbols are optional.',
    rules: { minUppercase: 1, minDigits: 1, minSymbols: 0 },
    understood: ['an uppercase letter', 'a lowercase letter (always included)', 'a digit', 'symbols optional'],
  },
  { name: '"Mix uppercase and lowercase letters, numbers and symbols"', text: 'Use at least 12 characters. Mix uppercase and lowercase letters, numbers and symbols. Don\'t use a password from another site.', rules: { minLength: 12, minUppercase: 1, minDigits: 1, minSymbols: 1 } },
  {
    name: '"3 of the following 4 categories": requiring each one satisfies it',
    text: 'Must contain characters from at least 3 of the following 4 categories: English uppercase characters (A through Z), English lowercase characters (a through z), Base 10 digits (0 through 9), Non-alphabetic characters (for example, !, $, #, %)',
    rules: { minUppercase: 1, minDigits: 1, minSymbols: 1 },
    understood: ['an uppercase letter', 'a lowercase letter (always included)', 'a digit', 'a symbol, such as !$#%'],
  },
  { name: 'a symbol list given as examples ("such as") is not the full allowed set', text: 'Must contain at least two special characters such as @, # or $.', rules: { minSymbols: 2 }, understood: ['2 symbols, such as @#$'] },
  { name: 'an allowed-symbols label with a spaced list', text: 'Special characters allowed: ~ ! @ # $ % ^ & * ( ) _ - + =', rules: { allowedSymbols: '~!@#$%^&*()_-+=' }, understood: ['symbols ~!@#$%^&*()_-+='] },
  {
    name: 'a full keyboard symbol list, quotes and backslash included',
    text: 'Password must contain a minimum of 1 lower case letter [a-z] and a minimum of 1 upper case letter [A-Z] and a minimum of 1 numeric character [0-9] and a minimum of 1 special character: ~`!@#$%^&*()-_+={}[]|\\;:"<>,./?',
    rules: { minUppercase: 1, minDigits: 1, minSymbols: 1, allowedSymbols: '~`!@#$%^&*()-_+={}[]|\\;:"<>,./?' },
  },
  { name: 'a length label without a unit, and a symbol list after a label', text: 'Password length: 8 - 30. Allowed symbols: !#$%&*+-=?@^_', rules: { minLength: 8, maxLength: 30, allowedSymbols: '!#$%&*+-=?@^_' } },
  {
    name: 'a small symbol list whose full stop ends the sentence, then "cannot contain spaces"',
    text: 'Password must be 6-16 characters. It can contain letters, numbers and these symbols: _ - . @. It cannot contain spaces.',
    rules: { minLength: 6, maxLength: 16, allowedSymbols: '_-.@', allowSpaces: false },
  },
  { name: '"letters and numbers only"', text: 'Letters and numbers only, 6 to 12 characters.', rules: { minLength: 6, maxLength: 12, allowedSymbols: '', minSymbols: 0 }, understood: ['6-12 characters', 'no symbols'] },
  { name: '"must be alphanumeric"', text: 'Password must be alphanumeric and 8 to 15 characters in length.', rules: { minLength: 8, maxLength: 15, allowedSymbols: '', minSymbols: 0 } },
  { name: '"can only contain letters and numbers"', text: 'Passwords can only contain letters and numbers.', rules: { allowedSymbols: '', minSymbols: 0 } },
  { name: '"No special characters" and a bare maximum', text: 'No special characters. Maximum length: 20.', rules: { maxLength: 20, allowedSymbols: '', minSymbols: 0 }, understood: ['at most 20 characters', 'no symbols'] },
  { name: '"special characters are not permitted"', text: 'Special characters are not permitted.', rules: { allowedSymbols: '', minSymbols: 0 } },
  { name: '"no spaces or symbols other than" a list allows that list', text: 'No spaces or symbols other than !@#', rules: { allowedSymbols: '!@#', allowSpaces: false } },
  { name: '"any special character except" a list rules the list out', text: 'Any special character except < and > is fine. Must be at least eight characters.', rules: { minLength: 8 }, excluded: '<>', understood: ['at least 8 characters', 'not < >'] },
  { name: '"cannot contain spaces" with counts and a range', text: 'Passwords must be between 8 and 16 characters, contain at least 2 numbers, and cannot contain spaces.', rules: { minLength: 8, maxLength: 16, minDigits: 2, allowSpaces: false } },
  { name: '"Passwords with spaces are not accepted"', text: 'Passwords with spaces are not accepted', rules: { allowSpaces: false }, understood: ['no spaces'] },
  { name: '"Spaces are permitted" among advice', text: 'For your security, choose a password that is at least 12 characters long. Avoid using your name or birthday. Spaces are permitted.', rules: { minLength: 12, allowSpaces: true } },
  { name: '"any characters, including spaces, are allowed"', text: 'Password should be 15+ characters; any characters, including spaces, are allowed.', rules: { minLength: 15, allowSpaces: true } },
  { name: '"no leading or trailing spaces" says nothing about spaces inside', text: 'No leading or trailing spaces. Minimum 8 characters.', rules: { minLength: 8 } },
  { name: '"cannot be blank" is not about spaces', text: 'Password cannot be blank. Must be 12 characters or more.', rules: { minLength: 12 } },
  { name: 'a limit on repeated characters is not a length', text: 'Passwords are case sensitive and must be at least 8 characters with no more than 3 repeated characters in a row.', rules: { minLength: 8 } },
  { name: '"0-9" beside "number" is not a length', text: 'Must be 8–64 characters long and contain a number (0-9).', rules: { minLength: 8, maxLength: 64, minDigits: 1 } },
  { name: '"not required" for symbols, a PIN rule ignored', text: 'Password: 4-digit PIN not allowed. Minimum 8 characters, including a number. Special characters are not required.', rules: { minLength: 8, minDigits: 1, minSymbols: 0 } },
  {
    name: 'a guidance paragraph with an em dash and examples',
    text: 'At least 8 characters—the more characters, the better. A mixture of both uppercase and lowercase letters. A mixture of letters and numbers. Inclusion of at least one special character, e.g., ! @ # ? ]',
    rules: { minLength: 8, minUppercase: 1, minDigits: 1, minSymbols: 1 },
  },
  { name: 'full-width characters and non-breaking spaces', text: 'Ｐａｓｓｗｏｒｄ：８ - 20 characters， at least one ｎｕｍｂｅｒ', rules: { minLength: 8, maxLength: 20, minDigits: 1 } },
  {
    name: '"may include these special characters" sets the list without requiring one',
    text: 'Your password must be 8-20 characters long, must include at least one letter and one number, and may include these special characters: !@#$%^&*()',
    rules: { minLength: 8, maxLength: 20, minDigits: 1, allowedSymbols: '!@#$%^&*()' },
  },
  { name: '"must not contain:" before spaces and a short list', text: 'Password must not contain: spaces, < or >', rules: { allowSpaces: false }, excluded: '<>' },
  { name: '"should contain" counts as a rule', text: 'Your password should contain at least one symbol and one capital.', rules: { minUppercase: 1, minSymbols: 1 } },
  { name: 'a statement of what is allowed changes nothing', text: 'Passwords may contain letters, numbers and symbols.', rules: {}, understood: [] },
  { name: 'a sign-up page sentence about a code', text: 'Thanks for signing up! We will send you a 6 character code.', rules: {}, understood: [] },
  {
    name: 'a maximum below the minimum: the minimum stands, never swapped',
    text: 'Use at least 12 characters. Maximum 8 characters.',
    rules: { minLength: 12, maxLength: 12 },
    understood: ['exactly 12 characters (a maximum of 8 is below the minimum of 12, so the minimum stands)'],
  },
  { name: 'text with no rules at all', text: 'Hello world, I like cats.', rules: {}, understood: [] },
  { name: 'empty text', text: '   ', rules: {}, understood: [] },
];

describe('parseRuleText', () => {
  it.each(CASES)('reads $name', ({ text, rules, understood, excluded }) => {
    const parsed = parseRuleText(text);
    expect(parsed.rules).toEqual(rules);
    if (understood) expect(parsed.understood).toEqual(understood);
    expect(parsed.excludedSymbols).toBe(excluded ?? '');
    // Something was understood exactly when something will change.
    expect(parsed.understood.length > 0).toBe(Object.keys(parsed.rules).length > 0 || !!parsed.excludedSymbols);
  });

  it('does not read a count of character classes as a length', () => {
    for (const text of [
      'Contain at least 3 of the 4 character types: uppercase, lowercase, numbers, symbols',
      'Include characters from 3 character classes',
      'Use at least 2 character sets',
      'Passwords must use 3 of the 4 character categories',
    ]) {
      expect(parseRuleText(text).rules.minLength, text).toBeUndefined();
    }
    expect(parseRuleText('Use 8 characters or more').rules.minLength).toBe(8); // a real length still reads
  });

  it('is deterministic: the same text always reads the same', () => {
    for (const { text } of CASES) expect(parseRuleText(text)).toEqual(parseRuleText(text));
  });

  it('never returns a field outside the site rules', () => {
    const keys = new Set(['minLength', 'maxLength', 'minUppercase', 'minDigits', 'minSymbols', 'allowedSymbols', 'allowSpaces']);
    for (const { text } of CASES) for (const k of Object.keys(parseRuleText(text).rules)) expect(keys.has(k), k).toBe(true);
  });
});

describe('applyParsedRules', () => {
  const custom = { ...DEFAULT_REQUIREMENTS, targetBits: 60, comfort: 'strict' as const, separator: '.', twists: 3, initials: 2, glue: true, count: 9 };

  it('fills in only what was understood and keeps every other setting', () => {
    const { req, notes } = applyParsedRules({ ...custom, separator: '#' }, parseRuleText('Must be 8-20 characters and include at least one number and one of !@#$%.'));
    expect(req).toEqual({ ...custom, separator: '#', minLength: 8, maxLength: 20, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%' });
    expect(notes).toEqual([]);
  });

  it('changes nothing for text with no rules', () => {
    expect(applyParsedRules(custom, parseRuleText('Welcome back! Sign in below.')).req).toEqual(custom);
  });

  it('raises the maximum to a new minimum above it, and says so', () => {
    const { req, notes } = applyParsedRules(DEFAULT_REQUIREMENTS, parseRuleText('At least 40 characters.'));
    expect(req).toMatchObject({ minLength: 40, maxLength: 40 });
    expect(notes).toEqual(['maximum raised to 40 to fit']);
    expect(() => validate(req)).not.toThrow();
  });

  it('lowers the minimum to a new maximum below it, and says so', () => {
    const { req, notes } = applyParsedRules(DEFAULT_REQUIREMENTS, parseRuleText('Up to 10 characters.'));
    expect(req).toMatchObject({ minLength: 10, maxLength: 10 });
    expect(notes).toEqual(['minimum lowered to 10 to fit']);
  });

  it('caps counts at what the form allows', () => {
    const { req, notes } = applyParsedRules(DEFAULT_REQUIREMENTS, parseRuleText('Must contain at least 6 numbers.'));
    expect(req.minDigits).toBe(4);
    expect(notes).toEqual(['digits capped at 4']);
    expect(() => validate(req)).not.toThrow();
  });

  it('takes ruled-out symbols away from the ones allowed now', () => {
    const { req } = applyParsedRules(DEFAULT_REQUIREMENTS, parseRuleText('Must not contain the characters & * ^'));
    expect(req.allowedSymbols).toBe('!@#$%-_.,?;');
  });

  it('brings back the usual symbols when one is required and none are allowed', () => {
    const none = { ...DEFAULT_REQUIREMENTS, minSymbols: 0, allowedSymbols: '' };
    const { req, notes } = applyParsedRules(none, parseRuleText('Must include a special character.'));
    expect(req).toMatchObject({ minSymbols: 1, allowedSymbols: DEFAULT_REQUIREMENTS.allowedSymbols });
    expect(notes).toHaveLength(1);
  });

  it('sets a separator the text rules out to Automatic, and says so', () => {
    const semicolon = { ...DEFAULT_REQUIREMENTS, separator: ';' };
    const alnum = applyParsedRules(semicolon, parseRuleText('Letters and numbers only, no spaces.'));
    expect(alnum.req).toMatchObject({ separator: 'auto', allowedSymbols: '', minSymbols: 0, allowSpaces: false });
    expect(alnum.notes).toEqual(['separator set to Auto (none), as ";" is not allowed']);
    const spaced = applyParsedRules({ ...DEFAULT_REQUIREMENTS, separator: ' ' }, parseRuleText('No spaces.'));
    expect(spaced.req.separator).toBe('auto');
    expect(spaced.notes).toEqual(['separator set to Auto (";"), as spaces are not allowed']);
    const excluded = applyParsedRules(semicolon, parseRuleText('Must not contain ; or :'));
    expect(excluded.req.separator).toBe('auto');
    expect(excluded.notes).toEqual(['separator set to Auto (a space), as ";" is not allowed']);
    // Automatic itself is never changed: it follows the rules on its own.
    expect(applyParsedRules(DEFAULT_REQUIREMENTS, parseRuleText('Letters and numbers only.')).notes).toEqual([]);
  });

  it('lowers the counts the text did not set when they no longer fit its maximum, the largest first', () => {
    const mine = { ...DEFAULT_REQUIREMENTS, minUppercase: 3, minDigits: 4, minSymbols: 6 };
    const { req, notes } = applyParsedRules(mine, parseRuleText('Must be at most 8 characters.'));
    expect(req).toMatchObject({ maxLength: 8, minLength: 8, minSymbols: 1, minDigits: 4, minUppercase: 3 });
    expect(notes).toEqual(['minimum lowered to 8 to fit', 'symbols lowered to 1 to fit']);
    // Counts the text did set stay; the others give way.
    const stated = applyParsedRules(mine, parseRuleText('8 characters maximum, with at least 6 symbols.'));
    expect(stated.req).toMatchObject({ maxLength: 8, minSymbols: 6, minDigits: 0, minUppercase: 2 });
    expect(stated.notes).toEqual(['minimum lowered to 8 to fit', 'digits no longer required, to fit', 'uppercase letters lowered to 2 to fit']);
  });

  it('never leaves the rules contradicting themselves, from any starting point, for any text it reads', () => {
    const starts = [
      DEFAULT_REQUIREMENTS,
      { ...DEFAULT_REQUIREMENTS, separator: ';' },
      { ...DEFAULT_REQUIREMENTS, separator: ' ' },
      { ...DEFAULT_REQUIREMENTS, separator: '-', allowedSymbols: '-' },
      { ...DEFAULT_REQUIREMENTS, minUppercase: 8, minDigits: 4, minSymbols: 8, maxLength: 64, minLength: 30 },
      { ...DEFAULT_REQUIREMENTS, minSymbols: 0, allowedSymbols: '', allowSpaces: false, separator: '' },
    ];
    const texts = [...CASES.map((c) => c.text), 'At most 6 characters.', 'Exactly 4 characters.', 'Must include 8 symbols, 4 digits and 8 capitals, up to 12 characters.'];
    for (const start of starts) {
      for (const text of texts) {
        const { req } = applyParsedRules(start, parseRuleText(text));
        // Only text that contradicts itself may leave a problem, and then only about the counts it set against its own maximum.
        for (const p of ruleProblems(req)) expect(p.fields[0], `${text} from ${JSON.stringify(start)}: ${p.message}`).toBe('maxLength');
      }
    }
  });
});
