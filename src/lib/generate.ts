// Turns a set of site requirements into sentence passwords plus the
// reasoning behind each one.

import type { Difficulty } from './difficulty';
import {
  initialPositions,
  initialsOf,
  isListWord,
  isMadeUpNoun,
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
import { isFarShift, isPinkyStretch, type TypingProfile } from './keyboard';
import { LengthModel } from './lengthModel';
import { cryptoRandom, randomInt, weightedIndex, type RandomSource } from './random';
import { scoreCold } from './score';
import { rawBits, strengthBits } from './strength';
import { easedText, plainOf } from './ease';
import { letterCount } from './text';
import { checkRequirements, countUpper } from './checks';
import { applyTwists, BUILT_IN_MAPPINGS, type AppliedTwist, type Mapping } from './twists';
import { allowedSymbolSet, isSymbol, MAX_DIGITS, MAX_TWISTS, RequirementsError, separatorProblem, validate } from './validation';

// The checks every password must pass, and crack-time estimates, live in checks.ts; re-exported so callers keep one import.
export { ATTACK_SCENARIOS, checkRequirements, countLower, countUpper, crackEstimates, formatDuration, type CheckContext, type CrackEstimate } from './checks';

// The rule checks live in validation.ts; re-exported so callers keep one import for requirements.
export {
  allowedSymbolSet,
  isSymbol,
  MAX_DIGITS,
  MAX_INITIALS,
  MAX_LOWERCASE,
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

export interface StrengthPreset {
  label: string;
  bits: number;
  hint: string;
}

export const STRENGTH_PRESETS: readonly StrengthPreset[] = [
  { label: 'Minimal', bits: 4, hint: "Just the site's rules: for Minimal-quick typing or a throwaway account" },
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
  /** The length window was cut to the shortest that meets the target (see Requirements.shortest). */
  shortest?: boolean;
  /** The longest password this plan makes: the narrowed window's top when `shortest`, else the maximum length. */
  maxLength: number;
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
  /** The session's figure, for an attacker who knows this tool and this session's swaps: scored cold from the password and hint over that list. Shown in the session only; not a score. */
  bits: number;
  /** Strength: for an attacker who knows English and the usual habits, not this tool. From the password alone (strength.ts). */
  strength: number;
  /** Raw: brute force over the characters used. From the password alone (strength.ts). */
  raw: number;
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
  /** The sentence every suggestion was built from: the one passed in, or a new draw. */
  sentence: GeneratedSentence;
}

/**
 * A made-up sentence, kept from batch to batch until the user draws a new
 * one: the template's slots with any number placed, and the words as
 * written, one per slot (the hint). Plain data, so it can be stored and
 * restored.
 */
export interface GeneratedSentence {
  slots: Slot[];
  words: string[];
}

// The Automatic separator. ";" comes first: it sits under the right pinky
// on the home row (no reach, no Shift), counts toward the symbol rule, and
// is what the defaults have always used. Then a space (the thumb) where the
// site takes one; then "." (a bottom-row key near the letters); "," measures
// cheap but reads badly between words; "-" is a pinky stretch and "_" also
// needs Shift, so those two only come up with the pinky rule off.
export const SEPARATOR_PREFERENCE = [';', '.', '-', ',', '_'] as const;
export const END_PREFERENCE = ['.', '!', '?'] as const;

/** Allowed symbols the tool may pick on its own, honouring the pinky rule and the Shift-reach rule. */
export function comfortableSymbols(req: Requirements): string[] {
  return allowedSymbolSet(req).filter((c) => !(req.avoidPinkyStretch && isPinkyStretch(c)) && !(req.shiftReach && isFarShift(c)));
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
/** Length models are about a megabyte each; the cache is emptied once it holds this many, like the scorer's caches. */
const MODEL_CACHE_LIMIT = 400;

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
    if (modelCache.size >= MODEL_CACHE_LIMIT) modelCache.clear();
    modelCache.set(key, model);
  }
  return model;
}

/** Positions typed as whole words: the only ones a deliberate swap may touch. */
const isWholeWord = (shape: Shape, i: number) =>
  shape.slots[i] !== 'num' && !shape.madeUp.includes(i) && !shape.initials.includes(i) && !shape.shorthand.includes(i);

const initialsCache = new WeakMap<readonly string[], readonly string[]>();
const twoLettersCache = new WeakMap<readonly string[], readonly string[]>();
const derived = (cache: WeakMap<readonly string[], readonly string[]>, pool: readonly string[], make: (p: readonly string[]) => string[]) => {
  let out = cache.get(pool);
  if (!out) {
    out = make(pool);
    cache.set(pool, out);
  }
  return out;
};

/** What a slot really chooses from, as typed: whole words (with their deliberate swaps when on), initials or two-letter forms. */
function slotPool(shape: Shape, i: number, comfort: Comfort, minDigits: number, eased = false): readonly string[] {
  const pool = pools(comfort, minDigits, eased)[shape.slots[i]!];
  if (shape.madeUp.includes(i)) return MADE_UP_NOUNS;
  if (shape.initials.includes(i)) return derived(initialsCache, pool, initialsOf);
  if (shape.shorthand.includes(i)) return derived(twoLettersCache, pool, twoLettersOf);
  return eased && isWholeWord(shape, i) ? typedPool(pool) : pool;
}

const boundsCache = new WeakMap<readonly string[], [number, number]>();
/** The shortest and longest word in a pool, as the length model counts them. */
function boundsOf(pool: readonly string[]): [number, number] {
  let b = boundsCache.get(pool);
  if (!b) {
    b = pool.reduce<[number, number]>(([lo, hi], w) => [Math.min(lo, w.length), Math.max(hi, w.length)], [Infinity, 0]);
    boundsCache.set(pool, b);
  }
  return b;
}

/**
 * Whether any sentence of this shape can be between lo and hi letters long:
 * false when even the shortest words overshoot or the longest fall short, in
 * which case its count is 0 and its length model need not be built.
 */
function mayFit(shape: Shape, lo: number, hi: number, comfort: Comfort, minDigits: number, eased: boolean): boolean {
  let min = 0;
  let max = 0;
  for (let i = 0; i < shape.slots.length; i++) {
    const [a, b] = boundsOf(slotPool(shape, i, comfort, minDigits, eased));
    min += a;
    max += b;
  }
  return min <= hi && max >= lo;
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
function minLettersOf(shape: Shape, comfort: Comfort, minDigits: number, eased = false): number {
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

/** What planning a template needs from the rules, worked out once. */
interface PlanContext {
  allowed: string[];
  separator: string;
  closing: string | undefined;
  withNumber: boolean;
}

function planContext(req: Requirements): PlanContext {
  validate(req);
  const allowed = allowedSymbolSet(req);
  const separator = resolveSeparator(req);
  return { allowed, separator, closing: closingSymbol(req, allowed, separator), withNumber: req.includeNumber || req.minDigits > 0 };
}

interface TemplateCandidate {
  candidate?: Candidate;
  /** A shape was skipped because its separators fall short with no closing mark to make up the rest. */
  noClosing: boolean;
  /** A shape was skipped because it cannot offer the uppercase rule enough letters. */
  tooFewLetters: boolean;
}

/** The plan for one template under these rules: its variants (one per number placement) and their exact count. */
function candidateFor(template: Template, req: Requirements, ctx: PlanContext): TemplateCandidate {
  const { separator, closing } = ctx;
  let noClosing = false;
  let tooFewLetters = false;
  const shapes = (ctx.withNumber ? numberPlacements(template) : [template]).map((t) => shapeOf(t, req));
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
    // One letter cannot be both a capital and a lowercase letter.
    if (minLettersOf(shape, req.comfort, req.minDigits, req.easeSwaps) < req.minUppercase + req.minLowercase) {
      tooFewLetters = true;
      continue;
    }
    if (!mayFit(shape, lo, hi, req.comfort, req.minDigits, req.easeSwaps)) continue; // its count would be 0
    const model = modelFor(shape, req.comfort, req.minDigits, req.easeSwaps);
    const count = model.count(lo, hi);
    if (count > 0) variants.push({ shape, model, count, endSymbol, lo, hi });
  }
  const maxLength = req.shortest ? narrowed(variants, req) : req.maxLength;
  const count = variants.reduce((sum, v) => sum + v.count, 0);
  if (count === 0) return { noClosing, tooFewLetters };

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
  return {
    noClosing,
    tooFewLetters,
    candidate: {
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
        shortest: req.shortest,
        maxLength,
      },
    },
  };
}

/**
 * The shortest window that meets the target: the variants' windows are cut,
 * together, to the fewest characters at which their summed count reaches
 * 2^targetBits (one length when the first that fits already does). Every
 * variant keeps the same password length, so the sum is taken length by
 * length. Returns the longest password the cut windows allow; when no cut
 * reaches the target the windows stay as they are and the maximum is the
 * rule's, so the plan is honest about falling short.
 */
function narrowed(variants: Variant[], req: Requirements): number {
  const need = 2 ** req.targetBits;
  let total = 0;
  for (let length = req.minLength; length <= req.maxLength; length++) {
    for (const v of variants) {
      const letters = length - (req.minLength - v.lo); // less this variant's separators and closing marks
      if (letters >= v.lo && letters <= v.hi) total += v.model.count(letters, letters);
    }
    if (total >= need) {
      for (const v of variants) {
        v.hi = Math.min(v.hi, length - (req.minLength - v.lo));
        v.count = v.model.count(v.lo, v.hi);
      }
      for (let i = variants.length - 1; i >= 0; i--) if (variants[i]!.count === 0) variants.splice(i, 1);
      return length;
    }
  }
  return req.maxLength;
}

export function plan(req: Requirements): Candidate {
  const ctx = planContext(req);
  let best: Candidate | undefined;
  let tooFewLetters = false;
  // A shape whose separators do not supply the symbols, with no closing mark to make up the rest, is skipped,
  // not fatal: a longer sentence has more separators ("only ;" and 5 symbols fits six words).
  let noClosing = false;
  for (const template of templates()) {
    const t = candidateFor(template, req, ctx);
    noClosing ||= t.noClosing;
    tooFewLetters ||= t.tooFewLetters;
    if (t.candidate && (!best || better(t.candidate.plan, best.plan))) best = t.candidate;
  }
  if (!best) throw new RequirementsError(noPlan(req, ctx, noClosing, tooFewLetters).message);
  return best;
}

/** " with 8 uppercase letters and a digit": the required characters that take room in the window, or nothing. */
function withCounts(req: Requirements): string {
  const parts = [
    [req.minUppercase, 'uppercase letter'],
    [req.minLowercase, 'lowercase letter'],
    [req.minDigits, 'digit'],
    [req.minSymbols, 'symbol'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, one]) => (n === 1 ? `${one === 'uppercase letter' ? 'an' : 'a'} ${one}` : `${n} ${one}s`));
  return parts.length ? ` with ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}` : '';
}

/** Why no shape fits, for plan's error and planProblem. */
function noPlan(req: Requirements, ctx: PlanContext, noClosing: boolean, tooFewLetters: boolean): PlanProblem {
  if (noClosing) return { code: 'no-closing', message: noClosingProblem(ctx.allowed, ctx.separator) };
  return tooFewLetters
    ? {
        code: 'too-few-letters',
        message:
          (req.minLowercase > 0
            ? `No sentence between ${req.minLength} and ${req.maxLength} characters has ${req.minUppercase + req.minLowercase} letters for ${req.minUppercase} capitals and ${req.minLowercase} lowercase letters. `
            : `No sentence between ${req.minLength} and ${req.maxLength} characters has ${req.minUppercase} letters to capitalise. `) +
          'Raise the maximum length or use fewer initials, two-letter words and made-up nouns.',
      }
    : {
        code: 'no-fit',
        message:
          `No sentence fits between ${req.minLength} and ${req.maxLength} characters${withCounts(req)}. Try widening the length range${req.minUppercase + req.minLowercase + req.minDigits + req.minSymbols > 0 ? ' or requiring fewer characters' : ''}, ` +
          'or use your own sentence (Use my sentence), which can be shortened further.',
      };
}

/** Why requirements that pass ruleProblems still cannot be planned. */
export interface PlanProblem {
  /**
   * 'no-fit': no sentence fits the length window; 'too-few-letters': none
   * has enough letters to capitalise; 'no-closing': symbols are required
   * and the only allowed one is the separator, which cannot end a
   * password; 'rules': ruleProblems would have said it first.
   */
  code: 'no-fit' | 'too-few-letters' | 'no-closing' | 'rules';
  message: string;
}

/**
 * Why `plan(req)` would throw, or undefined when it would not: the same
 * message, found faster, since it stops at the first shape that fits
 * instead of comparing them all. For callers that only need to know
 * whether the requirements can be planned at all (the CLI's wizard asks
 * this of every choice it offers).
 */
export function planProblem(req: Requirements): PlanProblem | undefined {
  let ctx: PlanContext;
  try {
    ctx = planContext(req);
  } catch (e) {
    if (e instanceof RequirementsError) return { code: 'rules', message: e.message };
    throw e;
  }
  let noClosing = false;
  let tooFewLetters = false;
  for (const template of templates()) {
    const t = candidateFor(template, req, ctx);
    if (t.candidate) return undefined;
    noClosing ||= t.noClosing;
    tooFewLetters ||= t.tooFewLetters;
  }
  return noPlan(req, ctx, noClosing, tooFewLetters);
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


/** True when the first lowercase letter of a word capitalises within one hand's reach of a Shift key. */
const nearCapital = (word: string) => !isFarShift((word.match(/[a-z]/)?.[0] ?? 'a').toUpperCase());

/**
 * The order words take the capitals in. With a random source it starts from
 * a random word (and wraps round), so a batch does not all capitalise the
 * same word; without one it is the first eligible word. With `nearShift`,
 * words whose first letter capitalises within one hand's reach of a Shift key
 * come first, so the capital lands on one of them whenever the sentence has
 * one; the rest follow, so the uppercase rule is met even when the words in
 * reach have too few letters for it. Neither choice is counted as bits.
 */
export function capitalOrder(
  words: readonly string[],
  /** Words whose case is part of what was chosen (made-up nouns); never recased. */
  fixedCase: (i: number) => boolean = () => false,
  rng?: RandomSource,
  nearShift = false,
): number[] {
  const any = words.flatMap((w, j) => (!fixedCase(j) && /[a-z]/.test(w) ? [j] : []));
  const near = nearShift ? any.filter((j) => nearCapital(words[j]!)) : [];
  const preferred = near.length ? near : any;
  const start = rng && preferred.length ? randomInt(preferred.length, rng) : 0;
  return [...preferred.slice(start), ...preferred.slice(0, start), ...any.filter((j) => !preferred.includes(j))];
}

/**
 * One capital goes on the first letter of a word, like a sentence. More than
 * one puts whole words in capitals ("SLEEPY-otters ..."), so Shift is held
 * once instead of the case flipping back and forth. The words are taken in
 * `capitalOrder`.
 */
export function applyUppercase(
  words: readonly string[],
  minUppercase: number,
  /** Words whose case is part of what was chosen (made-up nouns); never recased. */
  fixedCase: (i: number) => boolean = () => false,
  rng?: RandomSource,
  nearShift = false,
): string[] {
  const out = [...words];
  // Capital initials and ALL-CAPS made-up nouns already count toward the rule.
  const existing = countUpper(out.join(''));
  if (existing >= minUppercase) return out;
  const order = capitalOrder(out, fixedCase, rng, nearShift);
  if (order.length === 0) return out;
  if (minUppercase === 1) {
    const i = order[0]!;
    out[i] = out[i]!.replace(/[a-z]/, (c) => c.toUpperCase());
  } else {
    let upper = existing;
    for (const i of order) {
      if (upper >= minUppercase) break;
      upper -= countUpper(out[i]!);
      out[i] = out[i]!.toUpperCase();
      upper += countUpper(out[i]!);
    }
  }
  return out;
}

/**
 * The word that takes the opening capital, chosen from the words as typed,
 * before any swap: only when the rule needs one capital and the words have
 * none. Swaps keep its first character a letter, so the capital is always a
 * word's first character, never after a swapped-in symbol ("@Corns").
 */
function capitalWord(words: readonly string[], minUppercase: number, fixedCase: (i: number) => boolean, nearShift: boolean): number | undefined {
  if (minUppercase !== 1 || countUpper(words.join('')) > 0) return undefined;
  return capitalOrder(words, fixedCase, undefined, nearShift)[0];
}

function render(words: string[], variant: Variant, plan: Plan, endSymbol = variant.endSymbol, capitalAt?: number): string {
  const cased =
    capitalAt === undefined
      ? applyUppercase(words, plan.minUppercase, (i) => variant.shape.madeUp.includes(i))
      : words.map((w, j) => (j === capitalAt ? w.replace(/[a-z]/, (c) => c.toUpperCase()) : w));
  return trimSeparators(joinTokens(cased, variant.shape.glue, plan.separator) + endSymbol, plan.separator);
}

export interface GenerateOptions {
  rng?: RandomSource;
  /** Mappings twists are drawn from. Defaults to all built-in mappings. */
  mappings?: readonly Mapping[];
}

export interface MakeUpOptions extends GenerateOptions {
  /** The sentence to build the batch from. A new one is drawn only when there is none. */
  sentence?: GeneratedSentence;
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

const same = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

let drawnShapes: ReadonlySet<string> | undefined;

/**
 * Whether some settings draw this sentence: a template's shape, bare or with
 * its number placed; each word as written on its slot's full list, whatever
 * the comfort; a number from 2 to 99, or of up to MAX_DIGITS digits, without
 * a leading zero; made-up nouns only in the noun slots before the first real
 * noun. An empty word is on no list. It lives here rather than in grammar.ts
 * because it needs MAX_DIGITS, and takes the two arrays rather than a
 * GeneratedSentence, so grammar.ts never imports validation.ts.
 */
export function couldBeDrawn(slots: readonly Slot[], words: readonly string[]): boolean {
  drawnShapes ??= new Set(templates().flatMap((t) => [t, ...numberPlacements(t)].map((shape) => shape.slots.join(' '))));
  if (words.length !== slots.length || !drawnShapes.has(slots.join(' '))) return false;
  let realNoun = false;
  return slots.every((slot, i) => {
    const word = words[i]!;
    if (slot === 'num') return /^[1-9]\d*$/.test(word) && word.length <= MAX_DIGITS && Number(word) >= 2;
    if (slot === 'noun' && !realNoun && isMadeUpNoun(word)) return true;
    if (slot === 'noun') realNoun = true;
    return isListWord(slot, word);
  });
}

/**
 * The plan, variant and typed words for a kept sentence under these rules.
 * Initials, two-letter words and deliberate swaps are worked out again from
 * the words as written, so they follow the rules; the words themselves never
 * change. The sentence must be one this tool could have drawn. A
 * RequirementsError says why when the sentence cannot fit.
 */
function keptSentence(sentence: GeneratedSentence, req: Requirements): { candidate: Candidate; variant: Variant; typed: string[] } {
  plan(req); // rules no sentence can meet get the general message, not one about this sentence
  const ctx = planContext(req);
  const doesNotFit = (why: string) =>
    new RequirementsError(`The sentence does not fit these rules: ${why}. Draw a new sentence with the button beside it, or change the rules back.`);
  if (!couldBeDrawn(sentence.slots, sentence.words)) {
    throw new RequirementsError('The kept sentence is not one this tool makes: its shape, or a word in it, is not from the tool\'s lists. Draw a new sentence with the button beside it.');
  }
  const hasNumber = sentence.slots.includes('num');
  if (hasNumber && !ctx.withNumber) throw doesNotFit('it has a number, and these rules leave numbers out');
  if (!hasNumber && ctx.withNumber) throw doesNotFit('these rules need a number, and it has none');
  const template = templates().find((t) => same(t.slots, sentence.slots.filter((slot) => slot !== 'num')))!;
  const t = candidateFor(template, req, ctx);
  const variant = t.candidate?.variants.find((v) => same(v.shape.slots, sentence.slots));
  if (!t.candidate || !variant) {
    if (t.noClosing) throw new RequirementsError(noClosingProblem(ctx.allowed, ctx.separator));
    throw doesNotFit(t.tooFewLetters ? `it has too few letters for ${req.minUppercase} capitals${req.minLowercase ? ` and ${req.minLowercase} lowercase letters` : ''}` : `no sentence of its shape fits ${req.minLength}-${req.maxLength} characters`);
  }
  const { shape } = variant;
  const madeUp = sentence.words.flatMap((w, j) => (shape.slots[j] === 'noun' && isMadeUpNoun(w) ? [j] : []));
  if (!same(madeUp, shape.madeUp)) {
    throw doesNotFit(`it has ${madeUp.length} made-up noun${madeUp.length === 1 ? '' : 's'}, and these rules ask for ${shape.madeUp.length}`);
  }
  const typed = sentence.words.map((w, j) => {
    if (shape.initials.includes(j)) return w[0]!.toUpperCase();
    if (shape.shorthand.includes(j)) return twoLetter(w);
    return req.easeSwaps && isWholeWord(shape, j) ? easedText(w) : w;
  });
  const length = render(typed, variant, t.candidate.plan).length;
  if (length < req.minLength || length > req.maxLength) {
    throw doesNotFit(`it comes to ${length} characters, and these rules allow ${req.minLength}-${req.maxLength}`);
  }
  return { candidate: t.candidate, variant, typed };
}

/** No version of one sentence meets a rule (a lowercase minimum its capitals leave no room for): a newly drawn sentence is drawn again. */
class UnmetRule extends RequirementsError {}

/** Draws a new sentence at most this many times when every version of the one drawn misses a rule. */
const REDRAWS = 8;

export function generate(req: Requirements, options: MakeUpOptions = {}): GenerateResult {
  if (options.sentence) return generateOnce(req, options);
  for (let i = 1; ; i++) {
    try {
      return generateOnce(req, options);
    } catch (e) {
      if (!(e instanceof UnmetRule) || i >= REDRAWS) throw e;
    }
  }
}

function generateOnce(req: Requirements, options: MakeUpOptions): GenerateResult {
  const { rng = cryptoRandom, mappings = BUILT_IN_MAPPINGS, sentence: kept } = options;
  // One sentence per batch: every card is built from the same words and hint, so the cards differ only in
  // their swaps and closing marks. A kept sentence stays whatever the rules; a new one is drawn only without one.
  const drawn = kept ? keptSentence(kept, req) : undefined;
  const { plan: chosen, variants } = drawn?.candidate ?? plan(req);
  const p = pools(req.comfort, req.minDigits, req.easeSwaps);
  const warnings: string[] = [];
  const twistMappings = usableMappings(mappings, req, chosen.separator);
  if (req.twists > 0 && twistMappings.length === 0) {
    const because = [req.avoidPinkyStretch ? 'needs a pinky stretch' : '', req.shiftReach ? "needs a Shift key out of one hand's reach" : ''].filter(Boolean);
    warnings.push(`Twists are on, but every enabled mapping uses a symbol this site does not allow${because.length ? ` or that ${because.join(' or ')}` : ''}.`);
  }
  if (!chosen.meetsTarget) warnings.push(shortfallWarning(chosen.bits, req));
  if (chosen.endSymbol && req.avoidPinkyStretch && isPinkyStretch(chosen.endSymbol[0]!)) {
    warnings.push(`Every allowed symbol needs a pinky stretch, so the sentence ends with "${chosen.endSymbol}".`);
  }
  if (chosen.endSymbol && req.shiftReach && isFarShift(chosen.endSymbol[0]!)) {
    warnings.push(`Every allowed symbol needs a Shift key out of one hand's reach, so the sentence ends with "${chosen.endSymbol}".`);
  }
  if (chosen.separator === '' && chosen.template.slots.length > 1 && !req.glue) {
    warnings.push('No separator is available, so the words run together. Spaces or a symbol make it easier to read.');
  }

  const variant = drawn?.variant ?? variants[weightedIndex(variants.map((v) => v.count), rng)]!;
  const { shape, model } = variant;
  // Drawn as typed: with deliberate swaps on, awkward whole words come out already swapped ("wyse").
  const typed = drawn?.typed ?? model.sample(variant.lo, variant.hi, rng);
  const original = typed.map((w, j) => (req.easeSwaps && isWholeWord(shape, j) ? plainOf(w) : w));
  const length = render(typed, variant, chosen).length;
  // A kept sentence is never shortened (it stays until the user draws a new one), only said to be longer than the plan.
  if (drawn && req.shortest && length > chosen.maxLength) {
    warnings.push(`The kept sentence makes ${length} characters, longer than the ${chosen.maxLength} the shortest plan needs. Draw a new sentence for a shorter one.`);
  }
  const capitalAt = capitalWord(typed, chosen.minUppercase, (j) => shape.madeUp.includes(j), req.shiftReach);
  if (req.shiftReach && capitalAt !== undefined && !nearCapital(typed[capitalAt]!)) {
    warnings.push('No word in this sentence starts with a letter one hand can capitalise while holding Shift (T G B Y H N U J I are out of reach).');
  }
  // Twists never touch the number, initials, made-up nouns or two-letter
  // words, so what the card says about those stays true.
  const fixed = (j: number) => !isWholeWord(shape, j);
  // Letters the uppercase rule can count on without touching the twisted words.
  const fixedLetters = typed.reduce((n, w, j) => {
    if (!fixed(j) || shape.slots[j] === 'num') return n;
    if (shape.madeUp.includes(j)) return n + (w === w.toUpperCase() ? letterCount(w) : 0);
    return n + letterCount(w);
  }, 0);
  // Initials and two-letter forms only fix some letters; offer a word to picture so they are easy to remember.
  const pictured = kept?.words ?? original.map((w, j) => {
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

  // Each password draws its own closing symbol and swaps, so a batch does not all end in the same mark.
  // A draw that repeats a password already in the batch is skipped; a sentence with little to vary
  // (no swaps, one closing mark) gives fewer cards rather than copies.
  const closings = closingChoices(req, allowedSymbolSet(req), chosen.separator);
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  let unmet: string | undefined;
  for (let tries = 0; suggestions.length < req.count && tries < req.count * 10; tries++) {
    const endSymbol = variant.endSymbol ? closings[randomInt(closings.length, rng)]!.repeat(variant.endSymbol.length) : '';
    // Random swaps land on the words as typed, deliberate swaps included, and are counted from there.
    const twisted = applyTwists(
      typed,
      {
        // The minimum, or half the time one more (never above the setting's maximum): variety across a batch at no cost to the rules.
        count: Math.min(MAX_TWISTS, req.twists + (req.twists > 0 ? randomInt(2, rng) : 0)),
        mappings: twistMappings,
        skip: fixed,
        // The word that takes the opening capital keeps a letter first.
        capitalAt,
        minDelta: req.minLength - length,
        // The shortest plan never lets a swap lengthen the password ("f" to "ph").
        maxDelta: req.shortest ? 0 : req.maxLength - length,
        minLetters: Math.max(0, req.minUppercase - fixedLetters),
      },
      rng,
    );
    // The opening capital goes on the word chosen before the swaps: the first word, a sentence-like start, unless Shift reach moves it to a word in reach.
    const password = render(twisted.words, variant, chosen, endSymbol, capitalAt);
    if (seen.has(password)) continue;
    seen.add(password);
    const score = scoreCold(password, hint, mappings);
    const checks = checkRequirements(password, req, {
      separator: chosen.separator,
      endSymbol,
      uppercaseHow:
        shape.initials.length && countUpper(original.join('')) >= req.minUppercase
          ? `capital initials: ${shape.initials.map((j) => original[j]).join(' ')}`
          : shape.madeUp.length && countUpper(shape.madeUp.map((j) => original[j]).join('')) >= req.minUppercase
            ? `made-up nouns in capitals: ${shape.madeUp.filter((j) => /[A-Z]/.test(original[j]!)).map((j) => original[j]).join(' ')}`
            : undefined,
    });
    // A kept sentence can miss a rule it was not drawn for (a 2-digit minimum and its "5"); a drawn one should never
    // miss one, and if it does the card is dropped rather than shown breaking a rule.
    if (!checks.every((c) => c.met)) {
      unmet ??= checks.find((c) => !c.met)!.rule;
      continue;
    }
    suggestions.push({
      password,
      hint,
      words: twisted.words.map((text, j) => ({ text, original: pictured[j]!, slot: shape.slots[j]! })),
      steps: shapeSteps,
      twists: twisted.applied,
      twistBits: score.twistBits,
      twistOptions: score.twistOptions,
      bits: score.bits,
      strength: strengthBits(password),
      raw: rawBits(password),
      typing: score.typing,
      difficulty: score.difficulty,
      memorability: score.memorability.score,
      checks,
    });
  }
  if (suggestions.length === 0 && unmet) {
    throw new UnmetRule(
      `The sentence does not fit these rules: no version of it meets "${unmet}". Draw a new sentence with the button beside it, or change the rules back.`,
    );
  }
  if (suggestions.length < req.count) {
    warnings.push(`Only ${suggestions.length} different versions of this sentence fit; add swaps or allow more symbols for more variety.`);
  }
  const short = suggestions.filter((s) => s.twists.length < req.twists).length;
  if (short) warnings.push(fewerSwapsWarning(short, req.twists));
  return { plan: chosen, suggestions, warnings, sentence: { slots: [...shape.slots], words: [...pictured] } };
}

/** The warning for a plan short of the target, so a front end that says it its own way can tell it apart. */
export function shortfallWarning(bits: number, req: Requirements): string {
  return (
    `The length limits allow at most ${bits.toFixed(1)} bits, below the ${req.targetBits}-bit target. ` +
    `Raise the maximum length${req.comfort === 'relaxed' ? '' : ', relax typing comfort'}` +
    `${req.includeNumber || req.minDigits > 0 ? '' : ', or add a leading number'}.`
  );
}

export function fewerSwapsWarning(count: number, minimum: number): string {
  return (
    `${count === 1 ? 'One password has' : `${count} passwords have`} fewer than ${minimum} swaps: not enough swappable ` +
    'letters left. Raise the maximum length, use fewer initials or two-letter words, or enable more mappings.'
  );
}
