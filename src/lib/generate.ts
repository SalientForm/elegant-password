// Turns a set of site requirements into sentence passwords plus the
// reasoning behind each one.

import type { Difficulty } from './difficulty';
import {
  initialPositions,
  initialsOf,
  MADE_UP_NOUNS,
  madeUpPositions,
  shorthandPositions,
  twoLetter,
  twoLettersOf,
  numberPlacements,
  pools,
  SLOT_LABELS,
  SMALL_SLOTS,
  templates,
  typedPool,
  type Comfort,
  type Slot,
  type Template,
} from './grammar';
import { isPinkyStretch, type TypingProfile } from './keyboard';
import { LengthModel } from './lengthModel';
import { cryptoRandom, randomInt, weightedIndex, type RandomSource } from './random';
import { scoreCold } from './score';
import { plainOf } from './ease';
import { letterCount } from './text';
import { applyTwists, BUILT_IN_MAPPINGS, type AppliedTwist, type Mapping } from './twists';
import { allowedSymbolSet, isSymbol, MAX_TWISTS, RequirementsError, separatorProblem, validate } from './validation';

// The rule checks live in validation.ts; re-exported so callers keep one import for requirements.
export {
  allowedSymbolSet,
  isSymbol,
  MAX_DIGITS,
  MAX_INITIALS,
  MAX_MADE_UP,
  MAX_SHORTHAND,
  MAX_SYMBOLS,
  MAX_TWISTS,
  MAX_UPPERCASE,
  RequirementsError,
  ruleProblems,
  separatorProblem,
  validate,
  type RuleProblem,
} from './validation';

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
   * Deliberate swaps for typing ease: a word with a same-finger jump or a
   * long reach is typed with one fixed misspelling that removes it ("wise"
   * -> "wyse"; see ease.ts). A fixed rule, so it adds no bits.
   */
  easeSwaps: boolean;
  count: number;
}


export const DEFAULT_REQUIREMENTS: Requirements = {
  minLength: 12,
  maxLength: 32,
  minUppercase: 1,
  minDigits: 1,
  minSymbols: 1,
  allowedSymbols: '!@#$%^&*-_.,?;',
  allowSpaces: true,
  separator: 'auto',
  includeNumber: true,
  targetBits: 40,
  comfort: 'balanced',
  twists: 2,
  initials: 0,
  shorthand: 0,
  madeUp: 0,
  glue: false,
  avoidPinkyStretch: true,
  easeSwaps: false,
  count: 5,
};

export interface StrengthPreset {
  label: string;
  bits: number;
  hint: string;
}

export const STRENGTH_PRESETS: readonly StrengthPreset[] = [
  { label: 'Everyday', bits: 40, hint: 'Accounts with login rate limits' },
  { label: 'Strong', bits: 50, hint: 'Email, banking, most important accounts' },
  { label: 'Very strong', bits: 60, hint: 'Accounts worth a dedicated offline attack' },
  { label: 'Master password', bits: 72, hint: 'Password manager or disk encryption' },
];

export interface SlotBreakdown {
  slot: Slot | 'position' | 'initial' | 'shorthand' | 'madeUp';
  label: string;
  poolSize: number;
  bits: number;
}

export interface Plan {
  /** The sentence shape, without the number. */
  template: Template;
  /** Places the number can go (1 when there is no number). */
  numberPlacements: number;
  /** Words typed as a single capital letter. */
  initials: number;
  separator: string;
  /** Closing marks, repeated when the separators alone do not supply enough symbols. */
  endSymbol: string;
  /** 1 capitalises the first letter; more puts whole words in capitals from the start. */
  minUppercase: number;
  /** Exact entropy: log2 of the number of passwords this plan can produce. */
  bits: number;
  meetsTarget: boolean;
  expectedLength: number;
  breakdown: SlotBreakdown[];
  /** Bits lost because the length limits rule out some word combinations. */
  lengthPenaltyBits: number;
  /** Awkward words were typed with their deliberate swaps (zero bits: a fixed rule). */
  easeSwaps?: boolean;
}

/** A generated word's part of speech, 'yours' for a word from the user's own sentence, or 'fluff' for padding. */
export type WordRole = Slot | 'yours' | 'fluff';

export const ROLE_LABELS: Record<WordRole, string> = { ...SLOT_LABELS, yours: 'your word', fluff: 'padding' };

/** Label for a word chip: made-up nouns get their own label. */
export function roleLabel(word: { text: string; original: string; slot: WordRole }, madeUp: boolean): string {
  return madeUp ? 'made-up noun' : ROLE_LABELS[word.slot];
}

export interface RequirementCheck {
  rule: string;
  met: boolean;
  how: string;
}

/**
 * One password with everything the UI says about it. Plain data, so it can
 * be stored and restored. The strength and difficulty figures come from
 * `scoreCold(password, hint)` alone, so they are the same wherever the
 * password appears and however it was arrived at.
 */
export interface Suggestion {
  password: string;
  /** What to remember: the sentence the password came from. */
  hint: string;
  /** Words as typed, after twists, with the word they came from. */
  words: { text: string; original: string; slot: WordRole }[];
  /** Plain-language log of changes made to fit the requirements (sentence mode). */
  steps: string[];
  twists: AppliedTwist[];
  /** Bits added by where the twists landed, scored cold from the hint. */
  twistBits: number;
  /** Number of distinct ways the twists could have landed on these words. */
  twistOptions: number;
  /** Total bits, scored cold from the password and hint. */
  bits: number;
  typing: TypingProfile;
  difficulty: Difficulty;
  /** 0-100: how closely the password still looks like its hint; see score.ts. */
  memorability: number;
  checks: RequirementCheck[];
}

export interface GenerateResult {
  plan: Plan;
  suggestions: Suggestion[];
  warnings: string[];
}

// The Automatic separator. ";" comes first: it sits under the right pinky
// on the home row (no reach, no Shift), counts toward the symbol rule, and
// is what the defaults have always used. Then a space (the thumb) where the
// site takes one; then "." (a bottom-row key near the letters); "," measures
// cheap but reads badly between words; "-" is a pinky stretch and "_" also
// needs Shift, so those two only come up with the pinky rule off.
export const SEPARATOR_PREFERENCE = [';', '.', '-', ',', '_'] as const;
export const END_PREFERENCE = ['.', '!', '?'] as const;

/** Allowed symbols the tool may pick on its own, honouring the pinky rule. */
export function comfortableSymbols(req: Requirements): string[] {
  const allowed = allowedSymbolSet(req);
  return req.avoidPinkyStretch ? allowed.filter((c) => !isPinkyStretch(c)) : allowed;
}

/**
 * What Automatic resolves to under these rules: ";" whenever the site
 * allows it, else a space, else the first allowed and comfortable of
 * ". - , _", else nothing (the words run together). Never a problem, so
 * a change of site rules can never leave it invalid.
 */
export function automaticSeparator(req: Requirements): string {
  const comfortable = comfortableSymbols(req);
  if (comfortable.includes(SEPARATOR_PREFERENCE[0])) return SEPARATOR_PREFERENCE[0];
  if (req.allowSpaces) return ' ';
  return SEPARATOR_PREFERENCE.find((s) => comfortable.includes(s)) ?? '';
}

/** The separator to use: Automatic resolved, or the user's own choice, which must be allowed. */
export function resolveSeparator(req: Requirements): string {
  if (req.separator === 'auto') return automaticSeparator(req);
  const problem = separatorProblem(req.separator, req);
  if (problem) throw new RequirementsError(problem);
  return req.separator;
}

/**
 * The symbol used to close the sentence when separators do not supply
 * enough. Never the separator character itself: a password must not end
 * with its separator (see trimSeparators), so closing marks are drawn from
 * the other allowed symbols whenever there is one.
 */
export function closingSymbol(req: Requirements, allowed: string[], separator = ''): string | undefined {
  const other = closingChoices(req, allowed, separator);
  return END_PREFERENCE.find((s) => other.includes(s)) ?? other[0];
}

/**
 * The symbols a password's closing mark is drawn from: the comfortable
 * allowed ones other than the separator (if every allowed symbol is a pinky
 * stretch, a stretch beats failing the rule). Each password draws its own,
 * so a batch does not all end in the same mark.
 */
export function closingChoices(req: Requirements, allowed: readonly string[], separator = ''): string[] {
  const comfortable = comfortableSymbols(req);
  const pool = comfortable.length ? comfortable : [...allowed];
  return pool.filter((s) => s !== separator);
}

/** Why closing marks are needed but none can be used, for the error message. */
export function noClosingProblem(allowed: readonly string[], separator: string): string {
  return allowed.length > 0 && allowed.every((s) => s === separator)
    ? `Symbols are required, but the only allowed symbol is the separator "${separator}", which cannot end a password. Allow another symbol or require fewer.`
    : 'Symbols are required, but no allowed symbols are listed.';
}

/**
 * A password never starts or ends with a space, and the separator counts as
 * a space for this: ";test;" with ";" as the separator is "test". Applied to
 * every password the app makes, as the last step.
 */
export function trimSeparators(password: string, separator: string): string {
  const edge = new Set([' ', ...(separator && separator !== 'auto' ? [separator] : [])]);
  let start = 0;
  let end = password.length;
  while (start < end && edge.has(password[start]!)) start++;
  while (end > start && edge.has(password[end - 1]!)) end--;
  return password.slice(start, end);
}

/** Closing marks a template needs: whatever symbols its separators do not supply. */
function endSymbolFor(separators: number, separator: string, req: Requirements, closing: string | undefined): string | undefined {
  const fromSeparators = isSymbol(separator) ? separators : 0;
  const needed = Math.max(0, req.minSymbols - fromSeparators);
  if (needed === 0) return '';
  return closing?.repeat(needed);
}

const modelCache = new Map<string, LengthModel>();

// The length model counts words as typed: with deliberate swaps on, a whole
// word's pool holds its swapped spellings, so a swap that shortens a word
// ("bricks" -> "brix") is counted at its typed length and the count stays
// exact. No two words share a swapped spelling, so the pool sizes, and the
// bits, are the same as for the words as written.
function modelFor(shape: Shape, comfort: Comfort, minDigits: number, eased: boolean): LengthModel {
  const key = `${comfort}:${minDigits}:${eased ? 1 : 0}:${shape.slots.join(' ')}:${shape.initials.join(',')}:${shape.shorthand.join(',')}:${shape.madeUp.join(',')}`;
  let model = modelCache.get(key);
  if (!model) {
    model = new LengthModel(shape.slots.map((_, i) => slotPool(shape, i, comfort, minDigits, eased)));
    modelCache.set(key, model);
  }
  return model;
}

/** Positions typed as whole words: the only ones a deliberate swap may touch. */
const isWholeWord = (shape: Shape, i: number) =>
  shape.slots[i] !== 'num' && !shape.madeUp.includes(i) && !shape.initials.includes(i) && !shape.shorthand.includes(i);

/** What a slot really chooses from, as typed: whole words (with their deliberate swaps when on), initials or two-letter forms. */
function slotPool(shape: Shape, i: number, comfort: Comfort, minDigits: number, eased = false): readonly string[] {
  const pool = pools(comfort, minDigits, eased)[shape.slots[i]!];
  if (shape.madeUp.includes(i)) return MADE_UP_NOUNS;
  if (shape.initials.includes(i)) return initialsOf(pool);
  if (shape.shorthand.includes(i)) return twoLettersOf(pool);
  return eased && isWholeWord(shape, i) ? typedPool(pool) : pool;
}

/** A template with its number placed, initials chosen and glue decided. */
interface Shape extends Template {
  /** Positions typed as a single capital letter. */
  initials: number[];
  /** Positions typed as two letters. */
  shorthand: number[];
  /** Noun positions filled with made-up roll words. */
  madeUp: number[];
  /** glue[i]: no separator after token i. */
  glue: boolean[];
}

interface Variant {
  shape: Shape;
  model: LengthModel;
  count: number;
  endSymbol: string;
  /** Letter-count range the words must fill, after separators and closing marks. */
  lo: number;
  hi: number;
}

interface Candidate {
  plan: Plan;
  /** One per number placement; sampled in proportion to how many passwords each can make. */
  variants: Variant[];
}

function shapeOf(template: Template, req: Requirements): Shape {
  const madeUp = madeUpPositions(template.slots, req.madeUp);
  const initials = initialPositions(template.slots, req.initials, madeUp);
  const shorthand = shorthandPositions(template.slots, req.shorthand, [...initials, ...madeUp]);
  const glue = template.slots.map(
    (slot, i) =>
      req.glue && i < template.slots.length - 1 && (slot === 'num' || (initials.includes(i) && SMALL_SLOTS.includes(slot))),
  );
  return { slots: template.slots, initials, shorthand, madeUp, glue };
}

const shortestCache = new WeakMap<readonly string[], number>();
function shortestIn(pool: readonly string[]): number {
  let n = shortestCache.get(pool);
  if (n === undefined) {
    n = pool.reduce((min, w) => Math.min(min, letterCount(w)), Infinity);
    shortestCache.set(pool, n);
  }
  return n;
}

/**
 * The fewest letters any sentence of this shape can offer the uppercase
 * rule: initials give 1, two-letter words 2, whole words the shortest in
 * their pool. Numbers give none; made-up nouns are never recased, so they
 * are not counted on either. A shape below the rule is never planned, so
 * every password can meet it.
 */
export function minLettersOf(shape: Shape, comfort: Comfort, minDigits: number, eased = false): number {
  return shape.slots.reduce((sum, slot, i) => {
    if (slot === 'num' || shape.madeUp.includes(i)) return sum;
    if (shape.initials.includes(i)) return sum + 1;
    if (shape.shorthand.includes(i)) return sum + 2;
    return sum + shortestIn(slotPool(shape, i, comfort, minDigits, eased)); // as typed: a swap can drop letters ("cks" -> "x")
  }, 0);
}

/** Join tokens with the separator, except after glued tokens. */
export function joinTokens(words: readonly string[], glue: readonly boolean[], separator: string): string {
  return words.map((w, i) => (i < words.length - 1 && !glue[i] ? w + separator : w)).join('');
}

export function plan(req: Requirements): Candidate {
  validate(req);
  const allowed = allowedSymbolSet(req);
  const separator = resolveSeparator(req);
  const closing = closingSymbol(req, allowed, separator);

  const withNumber = req.includeNumber || req.minDigits > 0;
  let best: Candidate | undefined;
  let tooFewLetters = false;
  // A shape whose separators do not supply the symbols, with no closing mark to make up the rest, is skipped,
  // not fatal: a longer sentence has more separators ("only ;" and 5 symbols fits six words).
  let noClosing = false;
  for (const template of templates()) {
    const shapes = (withNumber ? numberPlacements(template) : [template]).map((t) => shapeOf(t, req));
    const variants: Variant[] = [];
    for (const shape of shapes) {
      const separators = shape.slots.length - 1 - shape.glue.filter(Boolean).length;
      const endSymbol = endSymbolFor(separators, separator, req, closing);
      if (endSymbol === undefined) {
        noClosing = true;
        continue;
      }
      const overhead = separators * separator.length + endSymbol.length;
      const lo = req.minLength - overhead;
      const hi = req.maxLength - overhead;
      if (hi <= 0) continue;
      if (minLettersOf(shape, req.comfort, req.minDigits, req.easeSwaps) < req.minUppercase) {
        tooFewLetters = true;
        continue;
      }
      const model = modelFor(shape, req.comfort, req.minDigits, req.easeSwaps);
      const count = model.count(lo, hi);
      if (count > 0) variants.push({ shape, model, count, endSymbol, lo, hi });
    }
    const count = variants.reduce((sum, v) => sum + v.count, 0);
    if (count === 0) continue;

    const first = shapes[0]!;
    const bits = Math.log2(count);
    const breakdown: SlotBreakdown[] = first.slots.map((slot, i) => {
      const size = slotPool(first, i, req.comfort, req.minDigits, req.easeSwaps).length;
      const form = first.madeUp.includes(i)
        ? 'madeUp'
        : first.initials.includes(i)
          ? 'initial'
          : first.shorthand.includes(i)
            ? 'shorthand'
            : undefined;
      const labels = { madeUp: 'made-up noun', initial: `${SLOT_LABELS[slot]} initial`, shorthand: `${SLOT_LABELS[slot]} (two letters)` };
      return {
        slot: form ?? slot,
        label: form ? labels[form] : SLOT_LABELS[slot],
        poolSize: size,
        bits: Math.log2(size),
      };
    });
    if (shapes.length > 1) {
      breakdown.push({ slot: 'position', label: 'number position', poolSize: shapes.length, bits: Math.log2(shapes.length) });
    }
    const unconstrained = breakdown.reduce((sum, b) => sum + b.bits, 0);
    const meanLength =
      variants.reduce((sum, v) => sum + (v.model.meanLength(v.lo, v.hi) + req.minLength - v.lo) * v.count, 0) / count;
    const candidate: Candidate = {
      variants,
      plan: {
        template,
        numberPlacements: shapes.length,
        initials: first.initials.length,
        separator,
        endSymbol: variants[0]!.endSymbol,
        minUppercase: req.minUppercase,
        bits,
        meetsTarget: bits >= req.targetBits,
        expectedLength: meanLength,
        breakdown,
        lengthPenaltyBits: Math.max(0, unconstrained - bits),
        easeSwaps: req.easeSwaps,
      },
    };
    if (!best || better(candidate.plan, best.plan)) best = candidate;
  }
  if (!best) {
    if (noClosing) throw new RequirementsError(noClosingProblem(allowed, separator));
    throw new RequirementsError(
      tooFewLetters
        ? `No sentence between ${req.minLength} and ${req.maxLength} characters has ${req.minUppercase} letters to capitalise. ` +
          'Raise the maximum length or use fewer initials, two-letter words and made-up nouns.'
        : `No sentence fits between ${req.minLength} and ${req.maxLength} characters. Try widening the length range, ` +
          'or use your own sentence (Use my sentence), which can be shortened further.',
    );
  }
  return best;
}

/** Prefer plans that meet the target; among those, the shortest; otherwise the strongest. */
function better(a: Plan, b: Plan): boolean {
  if (a.meetsTarget !== b.meetsTarget) return a.meetsTarget;
  if (a.meetsTarget) {
    if (Math.abs(a.expectedLength - b.expectedLength) > 1e-9) return a.expectedLength < b.expectedLength;
    return a.template.slots.length < b.template.slots.length;
  }
  return a.bits > b.bits;
}

export const countUpper = (text: string) => text.replace(/[^A-Z]/g, '').length;

/**
 * One capital goes on the first letter of a word, like a sentence. More than
 * one puts whole words in capitals ("SLEEPY-otters ..."), so Shift is held
 * once instead of the case flipping back and forth. With a random source the
 * word is chosen at random (and whole-word capitals start from a random word
 * and wrap round), so a batch does not all capitalise the same word; without
 * one it is the first eligible word. Neither choice is counted as bits.
 */
export function applyUppercase(
  words: readonly string[],
  minUppercase: number,
  /** Words whose case is part of what was chosen (made-up nouns); never recased. */
  fixedCase: (i: number) => boolean = () => false,
  rng?: RandomSource,
): string[] {
  const out = [...words];
  // Capital initials and ALL-CAPS made-up nouns already count toward the rule.
  const existing = countUpper(out.join(''));
  if (existing >= minUppercase) return out;
  const eligible = out.flatMap((w, j) => (!fixedCase(j) && /[a-z]/.test(w) ? [j] : []));
  if (eligible.length === 0) return out;
  const start = rng ? randomInt(eligible.length, rng) : 0;
  if (minUppercase === 1) {
    const i = eligible[start]!;
    out[i] = out[i]!.replace(/[a-z]/, (c) => c.toUpperCase());
  } else {
    let upper = existing;
    for (let k = 0; k < eligible.length && upper < minUppercase; k++) {
      const i = eligible[(start + k) % eligible.length]!;
      upper -= countUpper(out[i]!);
      out[i] = out[i]!.toUpperCase();
      upper += countUpper(out[i]!);
    }
  }
  return out;
}

function render(words: string[], variant: Variant, plan: Plan, rng?: RandomSource, endSymbol = variant.endSymbol): string {
  const cased = applyUppercase(words, plan.minUppercase, (i) => variant.shape.madeUp.includes(i), rng);
  return trimSeparators(joinTokens(cased, variant.shape.glue, plan.separator) + endSymbol, plan.separator);
}

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
  return checks;
}

export interface GenerateOptions {
  rng?: RandomSource;
  /** Mappings twists are drawn from. Defaults to all built-in mappings. */
  mappings?: readonly Mapping[];
}

/**
 * Mappings whose output only uses characters the site accepts, and never the
 * separator: a password never starts or ends with its separator, so a swap
 * that put it at a word's edge would be trimmed away and leave the password
 * short.
 */
export function usableMappings(mappings: readonly Mapping[], req: Requirements, separator = ''): Mapping[] {
  const allowed = new Set(comfortableSymbols(req));
  if (separator) allowed.delete(separator);
  return mappings.filter((m) => [...m.to].every((c) => /[a-z0-9]/.test(c) || allowed.has(c)));
}

export function generate(req: Requirements, options: GenerateOptions = {}): GenerateResult {
  const { rng = cryptoRandom, mappings = BUILT_IN_MAPPINGS } = options;
  const { plan: chosen, variants } = plan(req);
  const p = pools(req.comfort, req.minDigits, req.easeSwaps);
  const warnings: string[] = [];
  const twistMappings = usableMappings(mappings, req, chosen.separator);
  if (req.twists > 0 && twistMappings.length === 0) {
    warnings.push(
      `Twists are on, but every enabled mapping uses a symbol this site does not allow${req.avoidPinkyStretch ? ' or that needs a pinky stretch' : ''}.`,
    );
  }
  if (!chosen.meetsTarget) {
    warnings.push(
      `The length limits allow at most ${chosen.bits.toFixed(1)} bits, below the ${req.targetBits}-bit target. ` +
        `Raise the maximum length${req.comfort === 'relaxed' ? '' : ', relax typing comfort'}` +
        `${req.includeNumber || req.minDigits > 0 ? '' : ', or add a leading number'}.`,
    );
  }
  if (chosen.endSymbol && req.avoidPinkyStretch && isPinkyStretch(chosen.endSymbol[0]!)) {
    warnings.push(`Every allowed symbol needs a pinky stretch, so the sentence ends with "${chosen.endSymbol}".`);
  }
  if (chosen.separator === '' && chosen.template.slots.length > 1 && !req.glue) {
    warnings.push('No separator is available, so the words run together. Spaces or a symbol make it easier to read.');
  }

  // Each password draws its own closing symbol, so a batch does not all end in the same mark.
  const closings = closingChoices(req, allowedSymbolSet(req), chosen.separator);
  const suggestions: Suggestion[] = [];
  for (let i = 0; i < req.count; i++) {
    const variant = variants[weightedIndex(variants.map((v) => v.count), rng)]!;
    const endSymbol = variant.endSymbol ? closings[randomInt(closings.length, rng)]!.repeat(variant.endSymbol.length) : '';
    const { shape, model } = variant;
    // Drawn as typed: with deliberate swaps on, awkward whole words come out already swapped ("wyse").
    const typed = model.sample(variant.lo, variant.hi, rng);
    const original = typed.map((w, j) => (req.easeSwaps && isWholeWord(shape, j) ? plainOf(w) : w));
    const length = render(typed, variant, chosen).length;
    // Twists never touch the number, initials, made-up nouns or two-letter
    // words, so what the card says about those stays true.
    const fixed = (j: number) => !isWholeWord(shape, j);
    // Letters the uppercase rule can count on without touching the twisted words.
    const fixedLetters = typed.reduce((n, w, j) => {
      if (!fixed(j) || shape.slots[j] === 'num') return n;
      if (shape.madeUp.includes(j)) return n + (w === w.toUpperCase() ? letterCount(w) : 0);
      return n + letterCount(w);
    }, 0);
    // Random swaps land on the words as typed, deliberate swaps included, and are counted from there.
    const twisted = applyTwists(
      typed,
      {
        // The minimum, or half the time one more (never above the setting's maximum): variety across a batch at no cost to the rules.
        count: Math.min(MAX_TWISTS, req.twists + (req.twists > 0 ? randomInt(2, rng) : 0)),
        mappings: twistMappings,
        skip: fixed,
        // The opening capital goes on the first ordinary word (twists skip made-up nouns and initials).
        protectFirstLetter: chosen.minUppercase === 1 && shape.initials.length === 0,
        minDelta: req.minLength - length,
        maxDelta: req.maxLength - length,
        minLetters: Math.max(0, req.minUppercase - fixedLetters),
      },
      rng,
    );
    const password = render(twisted.words, variant, chosen, undefined, endSymbol); // the opening capital stays: a sentence-like start
    // Initials and two-letter forms only fix some letters; offer a word to picture so they are easy to remember.
    const pictured = original.map((w, j) => {
      const matches = shape.initials.includes(j)
        ? (x: string) => x[0]!.toUpperCase() === w
        : shape.shorthand.includes(j)
          ? (x: string) => twoLetter(x) === w
          : undefined;
      if (!matches) return w;
      const options = p[shape.slots[j]!].filter(matches);
      return options[randomInt(options.length, rng)] ?? w;
    });
    const named = (positions: number[]) => positions.map((j) => `${original[j]} (${pictured[j]})`).join(', ');
    const shapeSteps = [
      shape.initials.length ? `typed as capital initials: ${named(shape.initials)}` : '',
      shape.shorthand.length ? `typed as two letters, first and last consonant: ${named(shape.shorthand)}` : '',
      shape.madeUp.length ? `made-up nouns from key rolls: ${shape.madeUp.map((j) => original[j]).join(', ')}` : '',
    ].filter(Boolean);
    const hint = pictured.join(' ');
    const score = scoreCold(password, hint);
    suggestions.push({
      password,
      hint,
      words: twisted.words.map((text, j) => ({ text, original: pictured[j]!, slot: shape.slots[j]! })),
      steps: shapeSteps,
      twists: twisted.applied,
      twistBits: score.twistBits,
      twistOptions: score.twistOptions,
      bits: score.bits,
      typing: score.typing,
      difficulty: score.difficulty,
      memorability: score.memorability.score,
      checks: checkRequirements(password, req, {
        separator: chosen.separator,
        endSymbol,
        uppercaseHow:
          shape.initials.length && countUpper(original.join('')) >= req.minUppercase
            ? `capital initials: ${shape.initials.map((j) => original[j]).join(' ')}`
            : undefined,
      }),
    });
  }
  const short = suggestions.filter((s) => s.twists.length < req.twists).length;
  if (short) warnings.push(fewerSwapsWarning(short, req.twists));
  return { plan: chosen, suggestions, warnings };
}

export function fewerSwapsWarning(count: number, minimum: number): string {
  return (
    `${count === 1 ? 'One password has' : `${count} passwords have`} fewer than ${minimum} swaps: not enough swappable ` +
    'letters left. Raise the maximum length, use fewer initials or two-letter words, or enable more mappings.'
  );
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
