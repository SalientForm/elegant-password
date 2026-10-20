// Reads a site's password rules from pasted text ("Must be 8-20 characters
// and include at least one number and one of !@#$%") into the rule fields.
// Pure and deterministic: hand-written patterns, no network, no model. It
// returns only what it recognised, with a line for each, so the form can say
// what it understood and leave everything else as it was.
//
// The text is read in three passes. Symbol lists ("!@#$%", "! @ # $") are
// lifted out first, since their characters would otherwise read as
// punctuation. The rest is cut into clauses (lines, bullets, sentences), and
// each clause is searched for lengths and for mentions of a character class
// ("uppercase", "number", "special characters", "spaces", a lifted list).
// Each mention takes its meaning from the words nearest it: a count ("at
// least 2 digits") or a cue ("must", "no", "optional", "allowed"), else from
// its neighbours in the same list ("no spaces or symbols"), else from a
// heading line such as "Your password must contain:".

import type { Requirements } from './generate';
import { settleRules, type RuleFields } from './sitePresets';
import { MAX_LENGTH } from './validation'; // the form's own limit

export interface ParsedRules {
  /** Only the fields the text spoke to. */
  rules: Partial<RuleFields>;
  /** Symbols the text rules out ("any symbol except < and >"), removed from whatever is allowed. */
  excludedSymbols: string;
  /** What was understood, in words, for the form to show. Empty when nothing was. */
  understood: string[];
}

type Polarity = { kind: 'req'; n: number; each?: boolean } | { kind: 'neg' | 'opt' | 'allow' };
type Kind = 'upper' | 'lower' | 'digit' | 'symbol' | 'space' | 'letter' | 'list';

interface Mention {
  kind: Kind;
  start: number;
  end: number;
  list?: number;
  pol?: Polarity;
  skip?: boolean;
}

interface SymbolList {
  chars: string;
  /** Introduced by "such as" or "e.g.": a sample, not the full set. */
  example: boolean;
}

// ---------------------------------------------------------------- normalising

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const UNITS = 'one|two|three|four|five|six|seven|eight|nine';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';

/** Plain lowercase ASCII, one rule per line: dashes, quotes, bullets and number words all made regular. */
function normalise(text: string): string {
  return text
    .normalize('NFKC') // full-width "！" and friends become ASCII
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/≥/g, ' at least ')
    .replace(/≤/g, ' at most ')
    .replace(/[•‣⁃∙▪▫●○◦✓✔✖✗✘❌✅·]/g, '\n') // bullets and ticks start a rule
    .replace(/[^\x20-\x7E\n]/g, ' ') // anything else outside ASCII is noise to these patterns
    .toLowerCase()
    .replace(/\b(e\.g|i\.e|etc|min|max|incl|approx)\./g, (_, w: string) => w.replace('.', '')) // abbreviations are not sentence ends: "e.g." reads "eg"
    .replace(/\bbase[\s-]?10\b/g, ' ') // "base 10 digits" is not ten of them
    .replace(new RegExp(`\\b(${TENS})[\\s-](${UNITS})\\b`, 'g'), (_, t: string, u: string) => String(NUMBER_WORDS[t]! + NUMBER_WORDS[u]!))
    .replace(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g'), (w) => String(NUMBER_WORDS[w]))
    .replace(/^[ \t]*(?:[-*+>]|\d{1,2}[.)]|\(\d{1,2}\))[ \t]+/gm, ''); // list markers: "- ", "* ", "1. ", "(2) "
}

// --------------------------------------------------------------- symbol lists

const SYMBOL_CHAR = /^[!-/:-@[-`{-~]$/;
const SYMBOL_TOKEN = /^[!-/:-@[-`{-~]+$/;
const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const LIST_CUE = /symbol|special|character|punctuation|following|allowed|permitted|accepted|include|contain|\b\d+ of\b|such as|\beg\b|like/;

/** Lifts symbol lists out of the text, leaving a placeholder ("«l0»") where each was. */
function liftSymbolLists(text: string): { text: string; lists: SymbolList[] } {
  const tokens = [...text.matchAll(/\S+/g)].map((m) => ({ s: m[0], start: m.index, end: m.index + m[0].length }));
  const runs: (typeof tokens)[] = [];
  let run: typeof tokens = [];
  const close = () => {
    while (run.length && !SYMBOL_TOKEN.test(run.at(-1)!.s)) run.pop(); // a trailing "or" belongs to the prose
    if (run.length) runs.push(run);
    run = [];
  };
  for (const [i, t] of tokens.entries()) {
    const gap = i > 0 ? text.slice(tokens[i - 1]!.end, t.start) : '';
    if (gap.includes('\n')) close(); // a list never runs over a line end
    if (SYMBOL_TOKEN.test(t.s)) run.push(t);
    else if (run.length && (t.s === 'or' || t.s === 'and')) run.push(t);
    else close();
  }
  close();

  const lists: SymbolList[] = [];
  const cuts: { start: number; end: number; index: number }[] = [];
  for (const r of runs) {
    let start = r[0]!.start;
    let end = r.at(-1)!.end;
    // A full stop or comma stuck to the end is the sentence's, not the list's.
    if (r.at(-1)!.s.length > 1 && /[.,;:]$/.test(r.at(-1)!.s)) end--;
    if (r[0]!.s === ':' && r.length > 1) start = r[1]!.start; // "Symbols : !@#"
    // Brackets or quotes round the whole list, or one left dangling by a bracket opened in the prose.
    for (;;) {
      const raw = text.slice(start, end);
      const opener = raw[0]!;
      if (raw.length > 2 && CLOSERS[opener] && raw.at(-1) === CLOSERS[opener]) {
        start++;
        end--;
      } else if ('([{'.includes(opener) && raw.length > 1 && !raw.includes(CLOSERS[opener]!)) start++;
      else if (')]}'.includes(raw.at(-1)!) && raw.length > 1 && !raw.includes({ ')': '(', ']': '[', '}': '{' }[raw.at(-1)!]!)) end--;
      else break;
    }
    if (end <= start) continue;
    let parts = text
      .slice(start, end)
      .split(/\s+/)
      .filter((p) => p && p !== 'or' && p !== 'and');
    // "!, @, #" separates with commas; a comma standing alone is a member.
    if (parts.length > 1) parts = parts.map((p) => (p.length > 1 && p.endsWith(',') ? p.slice(0, -1) : p));
    const chars = [...new Set(parts.join(''))].filter((c) => SYMBOL_CHAR.test(c)).join('');
    const nearby = text.slice(Math.max(0, start - 60), start) + ' ' + text.slice(end, end + 30);
    if (chars.length < 2 || (chars.length === 2 && !LIST_CUE.test(nearby))) continue;
    const before = text.slice(Math.max(0, start - 30), start);
    lists.push({ chars, example: /\b(?:eg|for example|for instance|such as|like|including|includes)\s*[:,]?\s*[([{"']?\s*$/.test(before) });
    cuts.push({ start, end, index: lists.length - 1 });
  }
  let out = text;
  for (const c of [...cuts].reverse()) out = `${out.slice(0, c.start)} «l${c.index}» ${out.slice(c.end)}`;
  return { text: out, lists };
}

// -------------------------------------------------------------------- lengths

interface Lengths {
  mins: number[];
  maxes: number[];
  bare: number[];
}

const N = '(\\d{1,3})';
const CH = '(?:characters?|chars?|long|in length)';
// "character types", "character sets", "character classes": a count of classes, not a length.
const CLASS_WORD = '(?:types?|class(?:es)?|sets?|categor(?:y|ies)|groups?|kinds?)';
// What may follow a length number: the unit, or the end of the phrase. Never "digits", "of the following" or "character types".
const AFTER = `(?=\\s*(?:characters?\\b(?!\\s*${CLASS_WORD}\\b)|chars?\\b(?!\\s*${CLASS_WORD}\\b)|long\\b|in length\\b|$|[,:;()]|(?:and|or|but|with|including|includes|containing|that|which)\\b))`;
const MIN_CUE = '(?:at least|minimum|min|(?:no|not) (?:fewer|less|shorter) than)';
const MAX_CUE =
  "(?:(?:no|not) (?:more|longer) than|at most|up to|maximum|max|cannot exceed|can't exceed|can not exceed|must not exceed|may not exceed|should not exceed|not to exceed|not exceed|limited to|limit of)";
const LABEL = '(?:\\s+(?:password\\s+)?(?:length|characters|chars|number of characters))?\\s*(?:is|of|:|=|-)?\\s*';

const LENGTH_PATTERNS: [RegExp, (n: number[], l: Lengths) => void, boolean][] = [
  // [pattern, record, needs a length word in the clause]
  [new RegExp(`\\bexactly\\s+${N}\\s*${CH}`, 'g'), ([n], l) => (l.mins.push(n!), l.maxes.push(n!)), false],
  [new RegExp(`\\b(?:between|from)\\s+${N}\\s*(?:and|to|-)\\s*${N}${AFTER}`, 'g'), ([a, b], l) => (l.mins.push(a!), l.maxes.push(b!)), true],
  [new RegExp(`\\b${N}\\s*(?:-|to|through)\\s*${N}\\s*${CH}`, 'g'), ([a, b], l) => (l.mins.push(a!), l.maxes.push(b!)), false],
  [new RegExp(`\\b${MIN_CUE}${LABEL}${N}\\s*(?:-|to)\\s*${N}${AFTER}`, 'g'), ([a, b], l) => (l.mins.push(a!), l.maxes.push(b!)), true],
  [new RegExp(`\\b${MIN_CUE}${LABEL}(?:at least\\s*)?${N}${AFTER}`, 'g'), ([n], l) => l.mins.push(n!), true],
  [new RegExp(`(?<!\\bno |\\bnot )\\b(?:longer than|more than|over)\\s+${N}${AFTER}`, 'g'), ([n], l) => l.mins.push(n! + 1), true],
  [new RegExp(`\\b${N}\\s*(?:\\+|or more|or longer|or greater|and (?:up|above|over))${AFTER}`, 'g'), ([n], l) => l.mins.push(n!), true],
  [new RegExp(`\\b${N}\\s*${CH}\\s*(?:or more|or longer|minimum|min|at (?:the )?least|and (?:up|above|over))\\b`, 'g'), ([n], l) => l.mins.push(n!), false],
  [new RegExp(`\\b${MAX_CUE}${LABEL}${N}${AFTER}`, 'g'), ([n], l) => l.maxes.push(n!), true],
  [new RegExp(`(?<!\\bno |\\bnot )\\b(?:fewer than|less than|shorter than|under)\\s+${N}${AFTER}`, 'g'), ([n], l) => l.maxes.push(n! - 1), true],
  [new RegExp(`\\b${N}\\s*${CH}\\s*(?:or (?:less|fewer|shorter)|maximum|max|at (?:the )?most)\\b`, 'g'), ([n], l) => l.maxes.push(n!), false],
  // A range with no unit, where the clause is plainly about length: "Length: 8-64".
  [new RegExp(`\\b${N}\\s*(?:-|to)\\s*${N}${AFTER}`, 'g'), ([a, b], l) => (l.mins.push(a!), l.maxes.push(b!)), true],
];
const BARE = new RegExp(`\\b(\\d{1,3})\\s*(?:characters?|chars?)\\b(?!\\s*(?:in a row|consecutive|repeated|identical|sequential|from|of|code|pin|${CLASS_WORD})\\b)`, 'g');

/** Records the lengths a clause states and blanks them out, so their numbers are not read again as counts. */
function readLengths(clause: string, l: Lengths): string {
  const aboutLength = /\b(?:characters?|chars?|length|long)\b/.test(clause);
  const rangeOk = /\b(?:length|long)\b/.test(clause);
  let c = clause;
  for (const [i, [re, record, needsWord]] of LENGTH_PATTERNS.entries()) {
    if (needsWord && !aboutLength) continue;
    if (i === LENGTH_PATTERNS.length - 1 && !rangeOk) continue; // "0-9" in a list of digits is not a length
    c = c.replace(re, (m, ...groups: unknown[]) => {
      const nums = groups.filter((g): g is string => typeof g === 'string' && /^\d+$/.test(g)).map(Number);
      if (nums.length === 2 && !(nums[0]! >= 1 && nums[1]! > nums[0]!)) return m; // "0 through 9" is a set of digits
      if (nums.some((n) => n < 1 || n > 999)) return m;
      record(nums, l);
      return ' '.repeat(m.length);
    });
  }
  for (const m of c.matchAll(BARE)) l.bare.push(Number(m[1]));
  return c;
}

// ------------------------------------------------------------------- mentions

const KINDS: [Kind, RegExp][] = [
  ['list', /«l(\d+)»/g],
  [
    'symbol',
    /\b(?:special(?:\s+(?:characters?|chars?|symbols?|keys?))?|symbols?|non[\s-]?alpha[\s-]?numerics?(?:al)?(?:\s+(?:characters?|chars?|symbols?))?|non[\s-]?alphabetic(?:al)?(?:\s+(?:characters?|chars?))?|punctuation(?:\s+(?:marks?|characters?))?)\b/g,
  ],
  ['upper', /\b(?:upper(?:[\s-]?case)?(?=\s*(?:and|&|\/|or|,)\s*lower)|upper[\s-]?case|capitals?|caps|mixed[\s-]?case)(?:\s+(?:letters?|characters?|chars?|alphabets?|alphabetic characters?))?\b/g],
  ['lower', /\b(?:lower(?=\s*(?:and|&|\/|or|,)\s*upper)|lower[\s-]?case(?:\s+(?:letters?|characters?|chars?|alphabets?))?|small letters?)\b/g],
  ['digit', /\b(?:digits?|numbers?\b(?!\s+of\b)|numerals?|numeric(?:al)?(?:\s+(?:characters?|chars?|digits?|values?))?)\b/g],
  ['space', /\b(?:white[\s-]?spaces?|blank spaces?|spaces?)\b/g], // not "blank": "cannot be blank" is about empty fields
  ['letter', /\b(?:letters?|alphabetic(?:al)?(?:\s+characters?)?|alphabets?|alpha[\s-]?numerics?(?:\s+characters?)?)\b/g],
];

function findMentions(clause: string): Mention[] {
  const found: Mention[] = [];
  for (const [kind, re] of KINDS) {
    for (const m of clause.matchAll(re)) found.push({ kind, start: m.index, end: m.index + m[0].length, ...(kind === 'list' ? { list: Number(m[1]) } : {}) });
  }
  // Earliest first; of two that overlap, the longer ("non-alphanumeric" over "alphanumeric").
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Mention[] = [];
  for (const m of found) if (!out.length || m.start >= out.at(-1)!.end) out.push(m);
  return out;
}

// Cues, in priority order where they share a start: "not required" before "not", "must not" before "must".
const CUES: ['opt' | 'neg' | 'allow' | 'req' | 'none', string][] = [
  ['opt', "optional(?:ly)?|not required|not mandatory|not necessary|not needed|(?:do|does|need) not (?:need|have) to|need not|(?:don't|doesn't) (?:need|have) to"],
  ['none', '(?:no|not) (?:fewer|less|more) than'],
  [
    'neg',
    "(?:must|should|may|can|shall|do|does|will) not(?: (?:contain|include|have|use|be))?|cannot(?: (?:contain|include|have|use|be))?|can't(?: (?:contain|include|have|use|be))?|(?:don't|doesn't)(?: (?:contain|include|have|use))?|not (?:be )?(?:allowed|permitted|accepted|supported|valid)|disallowed|prohibited|forbidden|invalid|excluding|exclude|without|never|avoid(?:ing)?|no",
  ],
  ['allow', "allowed|permitted|accepted|acceptable|supported|valid|can(?: (?:contain|include|have|use|be))?|may(?: (?:contain|include|have|use|be))?|recommended|encouraged|suggested|ok|okay"],
  ['req', 'must(?: (?:contain|include|have|use|be))?|should|shall|requires?|required|requirements?|mandatory|needs?|needed|includes?|including|included|contains?|containing|with|has|have|having|use|using|mix(?:ture)?(?: of)?|combination of|at least|minimum|min|each|plus'],
];
const CUE = new RegExp(CUES.map(([, alts]) => `\\b(${alts})\\b`).join('|'), 'g');

function cuesIn(text: string): Polarity[] {
  const out: Polarity[] = [];
  for (const m of text.matchAll(CUE)) {
    const which = CUES[m.slice(1).findIndex((g) => g !== undefined)]![0];
    if (which === 'none') continue;
    out.push(which === 'req' ? { kind: 'req', n: 1 } : { kind: which });
  }
  return out;
}

const FILLER = "(?:(?!characters?\\b|chars?\\b|long\\b|with\\b|in\\b|and\\b|or\\b|includ|contain)[a-z'-]+\\s+){0,2}";
const COUNT_TAIL = new RegExp(`(?:\\b(no more than|not more than|at most|up to|maximum(?: of)?|max)\\s*)?\\b(an?|\\d{1,3})\\b\\s*(?:\\+|or more)?\\s*(of each\\s*:?\\s*)?${FILLER}$`);
const COUNT_AFTER = /^\s*(?:letters?|characters?|chars?)?\s*(?:(?::|=)\s*(\d{1,3})\b(?!\s*-)|\(?\s*(?:at least|minimum(?:\s+of)?|min)\s*(\d{1,3})\b)/;
const SPLIT = /,|;|\b(?:but|and|or|nor|while|whereas)\b/;
const EDGE = /\b(?:leading|trailing|begin|beginning|start|starting|end|ending|first|last)\b/;
const EXCEPT = /\b(?:other than|except(?: for)?|besides|apart from)\s*$/;

/** What a mention's own words say about it: a count, the nearest cue before it, else the first cue after it. */
function ownPolarity(before: string, after: string): Polarity | undefined {
  const piece = before.split(SPLIT).at(-1)!;
  const count = COUNT_TAIL.exec(piece);
  if (count) {
    if (count[1]) return { kind: 'allow' }; // "at most 2 symbols" sets a limit this app does not model
    const n = /^\d+$/.test(count[2]!) ? Number(count[2]) : 1;
    return { kind: 'req', n, ...(count[3] ? { each: true } : {}) };
  }
  const head = after.split(SPLIT)[0]!;
  const later = COUNT_AFTER.exec(head);
  if (later) return { kind: 'req', n: Number(later[1] ?? later[2]) };
  const following = cuesIn(head)[0];
  // "Passwords with spaces are not accepted": a "not" or "optional" after outranks a weak cue before.
  if (following && (following.kind === 'neg' || following.kind === 'opt')) return following;
  return cuesIn(piece).at(-1) ?? following;
}

// --------------------------------------------------------------------- reading

const ONLY_ALNUM = new RegExp(
  [
    String.raw`\b(?:only|just)\s+(?:use\s+)?(?:LETTERS\s*(?:,|and|or|&|/|\+)\s*DIGITS|ALNUM)`,
    String.raw`(?:LETTERS\s*(?:,|and|or|&|/|\+)\s*DIGITS|ALNUM)\s+only`,
    String.raw`\b(?:must|should|can only|may only)\s+be\s+(?:ALNUM)`,
    String.raw`\b(?:may|can)\s+only\s+(?:contain|include|use|have)\s+(?:LETTERS\s*(?:,|and|or|&|/)\s*DIGITS|ALNUM)`,
  ]
    .join('|')
    .replace(/LETTERS/g, String.raw`(?:letters?|alphabets?)(?:\s*\([^)]*\))?`)
    .replace(/DIGITS/g, String.raw`(?:numbers?|digits?|numerals?)(?:\s*\([^)]*\))?`)
    .replace(/ALNUM/g, String.raw`(?<!non[\s-]?)alpha[\s-]?numerics?(?:\s+characters?)?`),
  'g',
);

interface Found {
  req: Partial<Record<'upper' | 'digit' | 'symbol' | 'lower', number>>;
  opt: Set<string>;
  noSymbols: boolean;
  spaces?: boolean;
  allowed: string[];
  examples: string[];
  excluded: string[];
}

export function parseRuleText(input: string): ParsedRules {
  const { text, lists } = liftSymbolLists(normalise(input));
  const lengths: Lengths = { mins: [], maxes: [], bare: [] };
  const f: Found = { req: {}, opt: new Set(), noSymbols: false, allowed: [], examples: [], excluded: [] };
  let heading: Polarity | undefined; // from a line such as "Password must contain:"

  for (const raw of text.split(/\n|[.!?;](?=\s|$)/)) {
    let clause = readLengths(raw, lengths);
    clause = clause.replace(ONLY_ALNUM, (m) => {
      f.noSymbols = true;
      return ' '.repeat(m.length);
    });
    const mentions = findMentions(clause);
    if (!mentions.length) {
      if (raw.trim().endsWith(':')) heading = cuesIn(clause).at(-1);
      continue;
    }

    for (const [i, m] of mentions.entries()) {
      const before = clause.slice(i ? mentions[i - 1]!.end : 0, m.start);
      const after = clause.slice(m.end, mentions[i + 1]?.start ?? clause.length);
      if (m.kind === 'space' && (EDGE.test(before.slice(-40)) || EDGE.test(after.slice(0, 40)))) {
        m.skip = true; // "no leading or trailing spaces": passwords here never start or end with one anyway
        continue;
      }
      if (m.kind === 'list' && EXCEPT.test(before)) {
        // "no symbols other than !@#" allows the list; "any symbol except < >" rules it out.
        const rest = clause.slice(0, m.start).replace(EXCEPT, ' ') + ' ' + clause.slice(m.end);
        m.pol = cuesIn(rest).some((p) => p.kind === 'neg') ? { kind: 'allow' } : { kind: 'neg' };
        continue;
      }
      m.pol = ownPolarity(before, after);
    }
    // Mentions with no words of their own take their neighbours' ("uppercase, lowercase and numbers are required").
    const live = mentions.filter((m) => !m.skip);
    for (const [i, m] of live.entries()) {
      if (m.pol) continue;
      const prev = live.slice(0, i).reverse().find((p) => p.pol)?.pol;
      const next = live.slice(i + 1).find((p) => p.pol)?.pol;
      const from = prev ?? next ?? cuesIn(clause.slice(0, live[0]!.start)).at(-1) ?? heading;
      m.pol = from?.kind === 'req' && !from.each ? { kind: 'req', n: 1 } : from;
    }

    const hasList = live.some((m) => m.kind === 'list');
    for (const m of live) record(m, hasList, lists, f);
  }

  return finish(lengths, f);
}

function record(m: Mention, hasList: boolean, lists: SymbolList[], f: Found) {
  const pol: Polarity | undefined = m.pol ?? (m.kind === 'list' ? { kind: 'allow' } : undefined); // a list on its own is what the site accepts
  if (!pol) return;
  const req = (key: keyof Found['req'], n: number) => (f.req[key] = Math.max(f.req[key] ?? 0, n));
  switch (m.kind) {
    case 'upper':
    case 'digit':
    case 'lower':
      if (pol.kind === 'req') req(m.kind, pol.n);
      else if (pol.kind === 'opt') f.opt.add(m.kind);
      return; // "no digits" is not something this app can honour, so it is not read
    case 'symbol':
      if (pol.kind === 'req') req('symbol', pol.n);
      else if (pol.kind === 'opt') f.opt.add('symbol');
      else if (pol.kind === 'neg' && !hasList) f.noSymbols = true; // with a list, the "no" is about the list
      return;
    case 'list': {
      const list = lists[m.list!]!;
      if (pol.kind === 'neg') f.excluded.push(list.chars);
      else {
        (list.example ? f.examples : f.allowed).push(list.chars);
        if (pol.kind === 'req') req('symbol', pol.n);
      }
      return;
    }
    case 'space':
      f.spaces = pol.kind === 'neg' ? false : f.spaces === false ? false : true; // "no spaces" anywhere wins
      return;
    case 'letter':
      return;
  }
}

const unique = (parts: string[]) => [...new Set(parts.join(''))].join('');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function finish(l: Lengths, f: Found): ParsedRules {
  const rules: Partial<RuleFields> = {};
  const understood: string[] = [];

  const min = l.mins.length ? Math.max(...l.mins) : l.bare.length ? Math.max(...l.bare) : undefined; // "must be 8 characters" means at least 8
  const stated = l.maxes.length ? Math.min(...l.maxes) : undefined;
  // A maximum below the minimum is a slip in the text: the minimum stands and the maximum is raised to it, never swapped.
  const max = min !== undefined && stated !== undefined && min > stated ? min : stated;
  if (min !== undefined) rules.minLength = Math.min(min, MAX_LENGTH);
  if (max !== undefined) rules.maxLength = Math.min(max, MAX_LENGTH);
  if (min !== undefined && max !== undefined) {
    understood.push(
      `${min === max ? `exactly ${min} characters` : `${min}-${max} characters`}${stated !== max ? ` (a maximum of ${stated} is below the minimum of ${min}, so the minimum stands)` : ''}`,
    );
  }
  else if (min !== undefined) understood.push(`at least ${min} characters`);
  else if (max !== undefined) understood.push(`at most ${max} characters`);

  const counted = (key: 'upper' | 'digit' | 'symbol', field: 'minUppercase' | 'minDigits' | 'minSymbols', one: string, many: string, optional: string) => {
    const n = f.req[key];
    if (n !== undefined) {
      rules[field] = n;
      return plural(n, one, many);
    }
    if (f.opt.has(key)) {
      rules[field] = 0;
      return optional;
    }
    return undefined;
  };
  const upper = counted('upper', 'minUppercase', 'an uppercase letter', 'uppercase letters', 'uppercase optional');
  if (upper) understood.push(upper);
  if (f.req.lower) understood.push('a lowercase letter (always included)');
  const digit = counted('digit', 'minDigits', 'a digit', 'digits', 'digits optional');
  if (digit) understood.push(digit);

  const allowed = unique(f.allowed);
  const symbol = counted('symbol', 'minSymbols', 'a symbol', 'symbols', 'symbols optional');
  if (allowed) {
    rules.allowedSymbols = allowed;
    understood.push(symbol && rules.minSymbols ? `${symbol} from ${allowed}` : symbol ? `${symbol}, from ${allowed}` : `symbols ${allowed}`);
  } else if (f.noSymbols && !rules.minSymbols) {
    rules.allowedSymbols = '';
    rules.minSymbols = 0;
    understood.push('no symbols');
  } else {
    const examples = unique(f.examples);
    if (symbol || examples) understood.push([symbol, examples && `such as ${examples}`].filter(Boolean).join(', ').replace(/^such/, 'symbols such'));
  }
  const excluded = [...unique(f.excluded)].filter((c) => !allowed.includes(c)).join('');
  if (excluded) understood.push(`not ${[...excluded].join(' ')}`);

  if (f.spaces !== undefined) {
    rules.allowSpaces = f.spaces;
    understood.push(f.spaces ? 'spaces allowed' : 'no spaces');
  }
  return { rules, excludedSymbols: excluded, understood };
}

// ------------------------------------------------------------------- applying

/**
 * The requirements with what was understood filled in, and anything else as
 * it was. Where the result would not be valid on its own (a new minimum above
 * the old maximum, more digits than the form allows, a separator the text
 * rules out), the smallest fix is made to what the text did not say, and
 * named.
 */
export function applyParsedRules(req: Requirements, parsed: ParsedRules): { req: Requirements; notes: string[] } {
  const { rules } = parsed;
  const next: Requirements = { ...req, ...rules };
  if (parsed.excludedSymbols) next.allowedSymbols = [...next.allowedSymbols].filter((c) => !parsed.excludedSymbols.includes(c)).join('');
  return settleRules(next, new Set(Object.keys(rules) as (keyof RuleFields)[]));
}
