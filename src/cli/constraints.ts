// What each of tep config's questions may offer, given the answers so far
// (spec §7.2). A choice is allowed when the answers, the choice, and the
// loosest value of every question not yet answered can make passwords: so
// an allowed answer always leaves a way to finish, and later questions only
// narrow what earlier ones allowed. On the review screen there is nothing
// left unanswered, and a choice is checked against every other answer.
// Pure: the wizard asks, this decides.

import { problemsOf, reachableBits, type Problem } from '../lib/consistency';
import { DEFAULT_TYPING_MODE, TYPING_MODES, type TypingMode } from '../lib/difficulty';
import { separatorChoices } from '../lib/choices';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import type { MappingSettings } from '../lib/mappingSettings';
import { MINIMAL_BITS, modeLabel, profileValues, PROFILE_KEYS, unusedIn } from '../lib/modeProfiles';
import { ALL_SYMBOLS, RULE_KEYS } from '../lib/sitePresets';
import { DEFAULT_SORT } from '../lib/sort';
import { MAX_TARGET_BITS } from '../lib/validation';
import { explainProblem } from './messages';
import { COUNT_AT_TERMINAL, describeValue, fieldNamed, fieldsIn, parseValue, reqField, STRENGTH_NAMES, type CliField } from './fields';
import { MODE_NAMES, SITE_NAMES } from './names';
import type { Source } from './sources';


/** How long working out one question's choices may take, in milliseconds of CPU time (user decision, 2026-10-20). src/cli/walk.test.ts holds it. */
export const QUESTION_BUDGET_MS = 750;

/** What the wizard has been told. Fields absent are not answered yet. */
export interface Answers {
  mode?: TypingMode;
  /** The site preset the rules come from, by name. */
  site?: string;
  /** Rule values by field name: over the site preset, or every rule when set one by one. */
  rules: Record<string, unknown>;
  /** Whether the rules question has been answered at all. */
  rulesAnswered: boolean;
  optionsHow?: 'preset' | 'each';
  /** Option values by field name, when set one by one. */
  options: Record<string, unknown>;
  /** Count and order, when set. */
  output: Record<string, unknown>;
  /** Carried over from a loaded file untouched: the wizard does not ask about these. */
  sentence: Record<string, unknown>;
  /** Values the pasted rules or a loaded file asked for that could not be kept, for the review to show; never saved. */
  dropped?: { field: string; value: unknown; from: string; reason: string }[];
  swaps?: MappingSettings;
}

export const noAnswers = (): Answers => ({ rules: {}, rulesAnswered: false, options: {}, output: {}, sentence: {} });

/** The value a question not yet answered is checked with: the one that rules out least. */
export const LOOSEST: Record<string, unknown> = {
  'min-length': 1,
  'max-length': 256,
  'min-uppercase': 0,
  'min-lowercase': 0,
  'min-digits': 0,
  'min-symbols': 0,
  symbols: ALL_SYMBOLS,
  spaces: true,
  strength: MINIMAL_BITS,
  shortest: false,
  comfort: 'relaxed',
  'avoid-pinky': false,
  'shift-reach': false,
  'ease-swaps': DEFAULT_REQUIREMENTS.easeSwaps,
  separator: 'auto',
  number: false,
  swaps: 0,
  initials: 0,
  'two-letter': 0,
  'made-up': 0,
  glue: false,
};

/**
 * No single value is loosest for glue (joining words shortens a sentence,
 * which helps a short maximum and hurts a long minimum) or the separator:
 * an unanswered one is tried both ways, and a choice is allowed when any
 * way works.
 */
const VARIANTS: Record<string, unknown>[] = [{}, { glue: true }, { separator: '' }, { glue: true, separator: '' }];

const presetRules = (site: string) => SITE_NAMES.find((s) => s.name === site)!.value.rules;

/** The requirements these answers stand for, with `fill` for anything unanswered. */
export function reqOf(a: Answers, fill: Record<string, unknown> = LOOSEST): Requirements {
  const req = { ...DEFAULT_REQUIREMENTS } as unknown as Record<string, unknown>;
  const preset = a.site ? presetRules(a.site) : undefined;
  for (const key of RULE_KEYS) {
    const f = reqField(key)!;
    req[key] = f.name in a.rules ? a.rules[f.name] : preset ? preset[key] : fill[f.name];
  }
  const mode = a.mode ?? DEFAULT_TYPING_MODE;
  const profile = profileValues(mode, req as unknown as Requirements) as unknown as Record<string, unknown>;
  for (const key of PROFILE_KEYS) {
    const f = reqField(key)!;
    req[key] =
      a.optionsHow === 'preset' ? profile[key] : a.optionsHow === 'each' ? (f.name in a.options ? a.options[f.name] : fill[f.name]) : fill[f.name];
  }
  req.count = (a.output.count as number | undefined) ?? COUNT_AT_TERMINAL;
  return req as unknown as Requirements;
}

/** The mode's preset value of every option, by field name: what an option not yet asked starts from. */
function presetFill(a: Answers): Record<string, unknown> {
  const req = reqOf({ ...a, optionsHow: 'preset' });
  return Object.fromEntries(fieldsIn('options').map((f) => [f.name, req[f.target.key as keyof Requirements]]));
}

/** Fields that are still unanswered, by name. */
function unanswered(a: Answers): Set<string> {
  const out = new Set<string>();
  if (!a.site) for (const f of fieldsIn('rules')) if (!(f.name in a.rules)) out.add(f.name);
  if (a.optionsHow !== 'preset') for (const f of fieldsIn('options')) if (a.optionsHow !== 'each' || !(f.name in a.options)) out.add(f.name);
  return out;
}

/**
 * The problems with these answers: none when some completion of what is
 * unanswered can make passwords, else the problems of the loosest one.
 */
export function problemsWith(a: Answers): Problem[] {
  const open = unanswered(a);
  let first: Problem[] | undefined;
  for (const variant of VARIANTS) {
    const keys = Object.keys(variant);
    if (keys.length && !keys.every((k) => open.has(k))) continue; // only vary what is unanswered
    const problems = problemsFor(reqOf(a, { ...LOOSEST, ...variant }));
    if (!problems.length) return [];
    first ??= problems;
    // Glue and the separator cannot mend the rules themselves (only a separator the rules forbid, which a variant changes).
    if (problems.every((p) => p.source === 'rules' && !p.fields.includes('separator'))) break;
  }
  return first ?? [];
}

/**
 * problemsOf, remembered: the same requirements come up again and again (a
 * question's choices, the review, the next question), and planning a set
 * that fails walks every sentence shape.
 */
const known = new Map<string, Problem[]>();
const keyOf = (req: Requirements) => JSON.stringify(req, Object.keys(req).sort());
export function problemsFor(req: Requirements): Problem[] {
  const key = keyOf(req);
  let problems = known.get(key);
  if (!problems) {
    problems = problemsOf(req);
    if (known.size > 5000) known.clear();
    known.set(key, problems);
  }
  return problems;
}

const reaches = new Map<string, number | undefined>();
/** reachableBits, remembered. */
function reachFor(req: Requirements): number | undefined {
  const key = keyOf({ ...req, targetBits: 0, shortest: false });
  if (!reaches.has(key)) reaches.set(key, reachableBits(req));
  return reaches.get(key);
}

/** These answers with one field set. */
export function withField(a: Answers, f: CliField, value: unknown): Answers {
  if (f.group === 'rules') return { ...a, rules: { ...a.rules, [f.name]: value } };
  if (f.group === 'options') return { ...a, optionsHow: a.optionsHow ?? 'each', options: { ...a.options, [f.name]: value } };
  return { ...a, output: { ...a.output, [f.name]: value } };
}

/** A field's value under these answers (answered or filled in). */
export const valueIn = (a: Answers, f: CliField) => {
  if (f.target.kind === 'req') return reqOf(a, LOOSEST)[f.target.key];
  if (f.target.kind === 'output') return f.target.key === 'count' ? ((a.output.count as number | undefined) ?? COUNT_AT_TERMINAL) : (a.output.sort ?? DEFAULT_SORT);
  return a.sentence[f.name];
};

/** How a reason refers to the answers that rule a choice out: their review line, or their question. */
export interface Where {
  /** The review line a field is on, or undefined before the review. */
  lineOf(field: CliField): number | undefined;
}

/** Why a choice is not allowed, naming the answers that rule it out. */
export function reasonFor(problems: Problem[], a: Answers, own: readonly string[], where: Where): string {
  const p = problems[0]!;
  const req = reqOf(a);
  const refer = {
    source: (f: CliField): Source => {
      const line = where.lineOf(f);
      return line ? { kind: 'wizard', line, label: f.label } : { kind: 'default' };
    },
  };
  const title = explainProblem(p, req, refer).title;
  // A separator the rules forbid comes down to the rule as well: spaces, or the allowed symbols.
  const fields = p.code === 'separator-not-allowed' ? [...p.fields, req.separator === ' ' ? ('allowSpaces' as const) : ('allowedSymbols' as const)] : p.fields;
  const blocking = fields
    .map((k) => reqField(k))
    .filter((f): f is CliField => !!f && !own.includes(f.name) && isAnswered(a, f));
  const lines = [...new Set(blocking.map((f) => where.lineOf(f)).filter((n): n is number => n !== undefined))];
  const labels = [...new Set(blocking.map((f) => f.label))];
  if (lines.length) return `${title.replace(/\.$/, '')} (see line ${lines.join(', ')})`;
  if (labels.length) return `${title.replace(/\.$/, '')} (from your answer for ${labels.join(', ')})`;
  return title;
}

function isAnswered(a: Answers, f: CliField): boolean {
  if (f.group === 'rules') return a.site !== undefined || f.name in a.rules;
  if (f.group === 'options') return a.optionsHow === 'preset' || (a.optionsHow === 'each' && f.name in a.options);
  return f.name in a.output;
}

// ---------------------------------------------------------------- shapes

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
  /** Why it cannot be chosen; set means disabled. */
  blocked?: string;
  /** Can be chosen, but worth knowing first (a strength the rules cannot reach). */
  warning?: string;
}

export interface SelectShape<T> {
  kind: 'select';
  /** The fields the question sets, so a reason never names the question itself as what rules a choice out. */
  own?: string[];
  message: string;
  choices: Choice<T>[];
  initial?: T;
  apply(a: Answers, value: T): Answers;
}

export interface NumberShape {
  kind: 'number';
  own?: string[];
  message: string;
  /** Every value from min to max is allowed. */
  min: number;
  max: number;
  initial?: number;
  /** Why the value just outside each end is not allowed, for the refusal. */
  below?: string;
  above?: string;
  /** The widest the field could ever be, for refusing what is not a number in range at all. */
  limits: { min: number; max: number };
  apply(a: Answers, value: number): Answers;
}

export interface TextShape {
  kind: 'text';
  own?: string[];
  message: string;
  initial?: string;
  placeholder?: string;
  /** Why an answer is refused, or undefined to accept it. */
  validate(value: string): string | undefined;
  apply(a: Answers, value: string): Answers;
}

export type Shape = SelectShape<unknown> | NumberShape | TextShape;

/** Mark each choice: blocked with the reason when it leads to a contradiction. */
function check<T>(a: Answers, choices: Omit<Choice<T>, 'blocked'>[], apply: (a: Answers, v: T) => Answers, own: readonly string[], where: Where): Choice<T>[] {
  return choices.map((c) => {
    if (c.value === OTHER_BITS) return c; // asks for a number next, checked then
    const problems = problemsWith(apply(a, c.value));
    return problems.length ? { ...c, blocked: reasonFor(problems, apply(a, c.value), own, where) } : c;
  });
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The typing mode question. With options following the preset, a mode whose preset contradicts the rules is not allowed. */
export function modeShape(a: Answers, where: Where): SelectShape<TypingMode> {
  const apply = (x: Answers, mode: TypingMode) => ({ ...x, mode });
  return {
    kind: 'select',
    message: 'How will you type it?',
    choices: check(
      a,
      MODE_NAMES.map((m) => ({ value: m.value, label: m.label, hint: modeHint(m.value) })),
      apply,
      ['mode'],
      where,
    ),
    ...(a.mode ? { initial: a.mode } : { initial: DEFAULT_TYPING_MODE }),
    apply,
  } as SelectShape<TypingMode>;
}

const modeHint = (mode: TypingMode) => TYPING_MODES.find((m) => m.id === mode)!.hint;

export type RulesHow = { kind: 'site'; site: string } | { kind: 'paste' } | { kind: 'each' };

/** Where the site's rules come from: a preset, pasted text, or each rule. */
export function rulesHowShape(a: Answers, where: Where): SelectShape<RulesHow> {
  const apply = (x: Answers, how: RulesHow): Answers =>
    how.kind === 'site' ? { ...x, site: how.site, rules: {}, rulesAnswered: true } : how.kind === 'each' && x.site ? { ...x, site: undefined, rules: { ...rulesOf(x) }, rulesAnswered: true } : { ...x, rulesAnswered: true };
  const presets = SITE_NAMES.map((s) => ({ value: { kind: 'site', site: s.name } as RulesHow, label: s.label, hint: s.value.note }));
  const own = fieldsIn('rules').map((f) => f.name);
  return {
    kind: 'select',
    message: 'The site\'s rules',
    choices: [
      ...check(a, presets, apply, own, where),
      { value: { kind: 'paste' }, label: 'Paste the site\'s rules', hint: 'the wording from its sign-up form' },
      { value: { kind: 'each' }, label: 'Set each rule', hint: 'length, required characters, symbols, spaces' },
    ],
    ...(a.site ? { initial: presets.find((p) => (p.value as { site: string }).site === a.site)!.value } : {}),
    apply,
  } as SelectShape<RulesHow>;
}

/** Every rule value these answers stand for, by field name. */
export function rulesOf(a: Answers): Record<string, unknown> {
  const req = reqOf(a);
  return Object.fromEntries(fieldsIn('rules').map((f) => [f.name, req[f.target.key as keyof Requirements]]));
}

/**
 * Use the mode's options as they are, or set each. Set each while asking
 * for the first time: only the options the mode has no use for are filled
 * in (with the preset's neutral values); the rest are asked. From the
 * review (`prefill`): every option starts from the preset's value.
 */
export function optionsHowShape(a: Answers, where: Where, prefill = false): SelectShape<'preset' | 'each'> {
  const apply = (x: Answers, how: 'preset' | 'each'): Answers => {
    if (how === 'preset') return { ...x, optionsHow: 'preset', options: {} };
    if (x.optionsHow === 'each') return x;
    const req = reqOf({ ...x, optionsHow: 'preset' });
    const unused = new Set(unusedIn(x.mode ?? DEFAULT_TYPING_MODE).map((u) => reqField(u.key)!.name));
    const fill = fieldsIn('options').filter((f) => prefill || unused.has(f.name));
    return { ...x, optionsHow: 'each', options: Object.fromEntries(fill.map((f) => [f.name, req[f.target.key as keyof Requirements]])) };
  };
  const mode = MODE_NAMES.find((m) => m.value === (a.mode ?? DEFAULT_TYPING_MODE))!.label;
  return {
    kind: 'select',
    message: 'Options',
    choices: [
      ...check(a, [{ value: 'preset' as const, label: `Use the ${mode} preset`, hint: 'the options that suit the mode, as tep measures them' }], (x) => apply(x, 'preset'), fieldsIn('options').map((f) => f.name), where),
      { value: 'each' as const, label: 'Set each option', hint: 'strength, comfort, separator, swaps and the rest' },
    ],
    ...(a.optionsHow ? { initial: a.optionsHow } : {}),
    apply,
  } as SelectShape<'preset' | 'each'>;
}

/** The question for one field, shaped by the answers. `defaults` suggests a starting value (a loaded file's, or pasted rules') where it is allowed. */
export function fieldShape(f: CliField, a: Answers, where: Where, defaults: Record<string, unknown> = {}): Shape {
  // "Another number of bits" sets nothing yet: the number asked next does.
  const apply = (x: Answers, v: unknown) => (v === OTHER_BITS ? x : withField(x, f, v));
  const current = f.name in (f.group === 'rules' ? a.rules : f.group === 'options' ? a.options : a.output) ? valueIn(a, f) : undefined;
  const fallback = current ?? (f.name in defaults ? defaults[f.name] : undefined) ?? (f.group === 'options' ? reqOf({ ...a, optionsHow: 'preset' })[f.target.key as keyof Requirements] : f.group === 'rules' ? (a.site ? valueIn(a, f) : reqOf(a, DEFAULT_RULE_FILL)[f.target.key as keyof Requirements]) : valueIn(a, f));
  const message = capital(f.label);
  const k = f.kind;

  if (k.type === 'int' && k.max - k.min > 20) return numberShape(f, a, where, message, fallback as number);

  let options: Omit<Choice<unknown>, 'blocked'>[];
  switch (k.type) {
    case 'int':
      options = Array.from({ length: k.max - k.min + 1 }, (_, i) => ({ value: k.min + i, label: String(k.min + i) }));
      break;
    case 'bool':
      options = f.name === 'spaces' ? [
        { value: true, label: 'Allowed' },
        { value: false, label: 'Not allowed' },
      ] : [
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ];
      break;
    case 'choice':
      options = k.choices.map((c) => ({ value: c.value, label: c.label, hint: c.hint }));
      break;
    case 'separator':
      options = separatorChoices(reqOf(a)).map((c) => ({ value: c.value, label: c.label, hint: c.hint }));
      break;
    case 'strength': {
      // What the rules reach with the answers so far and, for options not yet asked, the mode's preset: the values they start from.
      const reach = reachFor(reqOf(apply(a, MINIMAL_BITS), { ...LOOSEST, ...presetFill(a) }));
      const rest = unanswered(apply(a, MINIMAL_BITS)).size ? ` with your answers so far and the ${modeLabel(a.mode ?? DEFAULT_TYPING_MODE)} preset for the rest` : '';
      options = STRENGTH_NAMES.map((s) => ({
        value: s.bits,
        label: `${s.label} (${s.bits} bits)`,
        ...(reach !== undefined && s.bits > reach ? { warning: `these rules reach at most ${reach.toFixed(1)} bits${rest}, so you would get the strongest they allow` } : {}),
      }));
      if (typeof fallback === 'number' && !STRENGTH_NAMES.some((s) => s.bits === fallback)) options.push({ value: fallback, label: `${fallback} bits` });
      options.push({ value: OTHER_BITS, label: 'Another number of bits', hint: `0 to ${MAX_TARGET_BITS}` });
      break;
    }
    case 'symbols':
      return symbolsShape(f, a, where, message, fallback as string);
    default:
      throw new Error(`no question for ${f.name}`);
  }
  return {
    kind: 'select',
    own: [f.name],
    message,
    choices: check(a, options, apply, [f.name], where),
    initial: fallback,
    apply,
  } as SelectShape<unknown>;
}

/** Rules set one by one start from the Typical site rules, not from the loosest. */
const DEFAULT_RULE_FILL = Object.fromEntries(fieldsIn('rules').map((f) => [f.name, DEFAULT_REQUIREMENTS[f.target.key as keyof Requirements]]));

/** A number in a range, found by trying values: binary search where the field is monotonic (lengths), every value otherwise. */
function numberShape(f: CliField, a: Answers, where: Where, message: string, fallback: number): NumberShape {
  const k = f.kind as { type: 'int'; min: number; max: number };
  const ok = (n: number) => problemsWith(withField(a, f, n)).length === 0;
  let min = k.min;
  let max = k.max;
  if (f.name === 'max-length') {
    // Allowed lengths run from the smallest that works up to the top.
    if (!ok(max)) min = max + 1;
    else {
      let lo = k.min;
      let hi = max;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ok(mid)) hi = mid;
        else lo = mid + 1;
      }
      min = lo;
    }
  } else if (f.name === 'min-length') {
    // Allowed minimums run from 1 up to the largest that works.
    if (!ok(min)) max = min - 1;
    else {
      let lo = min;
      let hi = k.max;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ok(mid)) lo = mid;
        else hi = mid - 1;
      }
      max = lo;
    }
  } else {
    while (min <= max && !ok(min)) min++;
    while (max >= min && !ok(max)) max--;
  }
  const why = (n: number) => {
    if (n < k.min || n > k.max) return undefined;
    const problems = problemsWith(withField(a, f, n));
    return problems.length ? reasonFor(problems, withField(a, f, n), [f.name], where) : undefined;
  };
  const initial = fallback >= min && fallback <= max ? fallback : fallback < min ? min : max;
  return {
    kind: 'number',
    own: [f.name],
    message,
    min,
    max,
    initial,
    ...(min > k.min ? { below: why(min - 1)! } : {}),
    ...(max < k.max ? { above: why(max + 1)! } : {}),
    limits: { min: k.min, max: k.max },
    apply: (x, n) => withField(x, f, n),
  };
}

function symbolsShape(f: CliField, a: Answers, where: Where, message: string, fallback: string): TextShape {
  const apply = (x: Answers, v: string) => withField(x, f, v);
  return {
    kind: 'text',
    own: [f.name],
    message: `${message} (type them together, such as !@#$%; leave empty for none)`,
    initial: fallback,
    placeholder: 'none',
    validate(value) {
      const parsed = parseValue(f, value);
      if (!parsed.ok) return `The symbols ${parsed.error.replace('with --spaces (spaces: true)', 'by the Spaces question')}.`;
      const problems = problemsWith(apply(a, value));
      return problems.length ? reasonFor(problems, apply(a, value), [f.name], where) : undefined;
    },
    apply,
  };
}

/** The strength choice that asks for a number of bits instead. */
export const OTHER_BITS = -1;

/** A number of bits for the strength target: any from 0 to 256 (a target out of reach is a warning, not a contradiction). */
export function bitsShape(initial: number): NumberShape {
  const f = fieldNamed('strength')!;
  return { kind: 'number', own: [f.name], message: 'Strength target, in bits', min: 0, max: MAX_TARGET_BITS, initial, limits: { min: 0, max: MAX_TARGET_BITS }, apply: (x, n) => withField(x, f, n) };
}

/** Change the count and order from their defaults? */
export function outputHowShape(): SelectShape<boolean> {
  return {
    kind: 'select',
    message: `Output: ${COUNT_AT_TERMINAL} passwords at a terminal (1 when piped), easiest to type first`,
    choices: [
      { value: false, label: 'Keep these' },
      { value: true, label: 'Change them' },
    ],
    initial: false,
    apply: (a) => a,
  };
}

/** A value as the review screen shows it. */
export const shown = (f: CliField, value: unknown) => describeValue(f, value);
