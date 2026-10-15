// Turns a set of site requirements into sentence passwords plus the
// reasoning behind each one.

import { scoreDifficulty, type Difficulty } from './difficulty';
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
  type Comfort,
  type Slot,
  type Template,
} from './grammar';
import { isPinkyStretch, lookupKey, typingProfile, type TypingProfile } from './keyboard';
import { LengthModel } from './lengthModel';
import { cryptoRandom, randomInt, weightedIndex, type RandomSource } from './random';
import { applyTwists, BUILT_IN_MAPPINGS, type AppliedTwist, type Mapping } from './twists';

export type Separator = 'auto' | ' ' | ';' | '-' | '.' | '_' | ',' | '';

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
  count: number;
}

export const MAX_TWISTS = 3;
export const MAX_INITIALS = 3;
export const MAX_SHORTHAND = 3;
export const MAX_MADE_UP = 3;
export const MAX_UPPERCASE = 8;
export const MAX_DIGITS = 4;
export const MAX_SYMBOLS = 8;

export const DEFAULT_REQUIREMENTS: Requirements = {
  minLength: 12,
  maxLength: 32,
  minUppercase: 1,
  minDigits: 1,
  minSymbols: 1,
  allowedSymbols: '!@#$%^&*-_.,?;',
  allowSpaces: true,
  separator: '-',
  includeNumber: true,
  targetBits: 40,
  comfort: 'balanced',
  twists: 2,
  initials: 0,
  shorthand: 0,
  madeUp: 0,
  glue: false,
  avoidPinkyStretch: true,
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
}

/** A generated word's part of speech, or 'yours' for a word from the user's own sentence. */
export type WordRole = Slot | 'yours';

export const ROLE_LABELS: Record<WordRole, string> = { ...SLOT_LABELS, yours: 'your word' };

/** Label for a word chip: made-up nouns get their own label. */
export function roleLabel(word: { text: string; original: string; slot: WordRole }, madeUp: boolean): string {
  return madeUp ? 'made-up noun' : ROLE_LABELS[word.slot];
}

export interface RequirementCheck {
  rule: string;
  met: boolean;
  how: string;
}

export interface Suggestion {
  password: string;
  /** Words as typed, after twists, with the word they came from. */
  words: { text: string; original: string; slot: WordRole }[];
  /** Plain-language log of changes made to fit the requirements (sentence mode). */
  steps: string[];
  twists: AppliedTwist[];
  /** Bits added by where the twists landed; varies per password. */
  twistBits: number;
  /** Number of distinct ways the twists could have landed on these words. */
  twistOptions: number;
  /** Sentence bits plus twist bits. */
  bits: number;
  typing: TypingProfile;
  difficulty: Difficulty;
  checks: RequirementCheck[];
}

export interface GenerateResult {
  plan: Plan;
  suggestions: Suggestion[];
  warnings: string[];
}

export class RequirementsError extends Error {}

// For the automatic separator when spaces are not allowed. ";" sits under
// the right pinky on the home row (no reach, no Shift); "." is a bottom-row
// key near the letters; "," measures cheap but reads badly between words;
// "-" is a pinky stretch and "_" also needs Shift.
export const SEPARATOR_PREFERENCE = [';', '.', '-', ',', '_'] as const;
export const END_PREFERENCE = ['.', '!', '?'] as const;

export const isSymbol = (c: string) => /[^A-Za-z0-9\s]/.test(c);

export function allowedSymbolSet(req: Requirements): string[] {
  return [...new Set(req.allowedSymbols)].filter((c) => isSymbol(c) && lookupKey(c));
}

/** Allowed symbols the tool may pick on its own, honouring the pinky rule. */
export function comfortableSymbols(req: Requirements): string[] {
  const allowed = allowedSymbolSet(req);
  return req.avoidPinkyStretch ? allowed.filter((c) => !isPinkyStretch(c)) : allowed;
}

export function resolveSeparator(req: Requirements, allowed: string[]): string {
  if (req.separator === 'auto') {
    if (req.allowSpaces) return ' ';
    const comfortable = comfortableSymbols(req);
    return SEPARATOR_PREFERENCE.find((s) => comfortable.includes(s)) ?? '';
  }
  if (req.separator === ' ' && !req.allowSpaces) {
    throw new RequirementsError('Space is chosen as the separator, but spaces are not allowed.');
  }
  if (isSymbol(req.separator) && !allowed.includes(req.separator)) {
    throw new RequirementsError(`"${req.separator}" is chosen as the separator, but it is not an allowed symbol.`);
  }
  return req.separator;
}

/** The symbol used to close the sentence when separators do not supply enough. */
export function closingSymbol(req: Requirements, allowed: string[]): string | undefined {
  // If every allowed symbol is a pinky stretch, a stretch beats failing the rule.
  const comfortable = comfortableSymbols(req);
  const pool = comfortable.length ? comfortable : allowed;
  return END_PREFERENCE.find((s) => pool.includes(s)) ?? pool[0];
}

/** Closing marks a template needs: whatever symbols its separators do not supply. */
function endSymbolFor(separators: number, separator: string, req: Requirements, closing: string | undefined): string | undefined {
  const fromSeparators = isSymbol(separator) ? separators : 0;
  const needed = Math.max(0, req.minSymbols - fromSeparators);
  if (needed === 0) return '';
  return closing?.repeat(needed);
}

export function validate(req: Requirements): void {
  if (!Number.isInteger(req.minLength) || req.minLength < 1) {
    throw new RequirementsError('Minimum length must be a whole number of at least 1.');
  }
  if (!Number.isInteger(req.maxLength) || req.maxLength < req.minLength) {
    throw new RequirementsError('Maximum length must be at least the minimum length.');
  }
  if (!(req.targetBits >= 0)) throw new RequirementsError('Target strength must be zero or more bits.');
  if (!Number.isInteger(req.initials) || req.initials < 0 || req.initials > MAX_INITIALS) {
    throw new RequirementsError(`Capital initials must be between 0 and ${MAX_INITIALS}.`);
  }
  if (!Number.isInteger(req.madeUp) || req.madeUp < 0 || req.madeUp > MAX_MADE_UP) {
    throw new RequirementsError(`Made-up nouns must be between 0 and ${MAX_MADE_UP}.`);
  }
  if (!Number.isInteger(req.shorthand) || req.shorthand < 0 || req.shorthand > MAX_SHORTHAND) {
    throw new RequirementsError(`Two-letter words must be between 0 and ${MAX_SHORTHAND}.`);
  }
  if (!Number.isInteger(req.twists) || req.twists < 0 || req.twists > MAX_TWISTS) {
    throw new RequirementsError(`Minimum swaps must be between 0 and ${MAX_TWISTS}.`);
  }
  const counts: [keyof Requirements, string, number][] = [
    ['minUppercase', 'Uppercase letters', MAX_UPPERCASE],
    ['minDigits', 'Digits', MAX_DIGITS],
    ['minSymbols', 'Symbols', MAX_SYMBOLS],
  ];
  for (const [key, label, max] of counts) {
    const n = req[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > max) {
      throw new RequirementsError(`${label} must be a whole number from 0 to ${max}.`);
    }
  }
  if (!Number.isInteger(req.count) || req.count < 1 || req.count > 20) {
    throw new RequirementsError('Number of suggestions must be between 1 and 20.');
  }
}

const modelCache = new Map<string, LengthModel>();

function modelFor(shape: Shape, comfort: Comfort, minDigits: number): LengthModel {
  const key = `${comfort}:${minDigits}:${shape.slots.join(' ')}:${shape.initials.join(',')}:${shape.shorthand.join(',')}:${shape.madeUp.join(',')}`;
  let model = modelCache.get(key);
  if (!model) {
    model = new LengthModel(shape.slots.map((_, i) => slotPool(shape, i, comfort, minDigits)));
    modelCache.set(key, model);
  }
  return model;
}

/** What a slot really chooses from: whole words, initials or two-letter forms. */
function slotPool(shape: Shape, i: number, comfort: Comfort, minDigits: number): readonly string[] {
  const pool = pools(comfort, minDigits)[shape.slots[i]!];
  if (shape.madeUp.includes(i)) return MADE_UP_NOUNS;
  if (shape.initials.includes(i)) return initialsOf(pool);
  if (shape.shorthand.includes(i)) return twoLettersOf(pool);
  return pool;
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

/** Join tokens with the separator, except after glued tokens. */
export function joinTokens(words: readonly string[], glue: readonly boolean[], separator: string): string {
  return words.map((w, i) => (i < words.length - 1 && !glue[i] ? w + separator : w)).join('');
}

export function plan(req: Requirements): Candidate {
  validate(req);
  const allowed = allowedSymbolSet(req);
  const separator = resolveSeparator(req, allowed);
  const closing = closingSymbol(req, allowed);

  const withNumber = req.includeNumber || req.minDigits > 0;
  let best: Candidate | undefined;
  for (const template of templates()) {
    const shapes = (withNumber ? numberPlacements(template) : [template]).map((t) => shapeOf(t, req));
    const variants: Variant[] = [];
    for (const shape of shapes) {
      const separators = shape.slots.length - 1 - shape.glue.filter(Boolean).length;
      const endSymbol = endSymbolFor(separators, separator, req, closing);
      if (endSymbol === undefined) {
        throw new RequirementsError('Symbols are required, but no allowed symbols are listed.');
      }
      const overhead = separators * separator.length + endSymbol.length;
      const lo = req.minLength - overhead;
      const hi = req.maxLength - overhead;
      if (hi <= 0) continue;
      const model = modelFor(shape, req.comfort, req.minDigits);
      const count = model.count(lo, hi);
      if (count > 0) variants.push({ shape, model, count, endSymbol, lo, hi });
    }
    const count = variants.reduce((sum, v) => sum + v.count, 0);
    if (count === 0) continue;

    const first = shapes[0]!;
    const bits = Math.log2(count);
    const breakdown: SlotBreakdown[] = first.slots.map((slot, i) => {
      const size = slotPool(first, i, req.comfort, req.minDigits).length;
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
      },
    };
    if (!best || better(candidate.plan, best.plan)) best = candidate;
  }
  if (!best) {
    throw new RequirementsError(
      `No sentence fits between ${req.minLength} and ${req.maxLength} characters. Try widening the length range.`,
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
 * One capital goes on the first letter, like a sentence. More than one puts
 * whole words in capitals from the start ("SLEEPY-otters ..."), so Shift is
 * held once instead of the case flipping back and forth.
 */
export function applyUppercase(
  words: readonly string[],
  minUppercase: number,
  /** Words whose case is part of what was chosen (made-up nouns); never recased. */
  fixedCase: (i: number) => boolean = () => false,
): string[] {
  const out = [...words];
  // Capital initials and ALL-CAPS made-up nouns already count toward the rule.
  const existing = countUpper(out.join(''));
  if (existing >= minUppercase) return out;
  if (minUppercase === 1) {
    const i = out.findIndex((w, j) => !fixedCase(j) && /[a-z]/.test(w));
    if (i >= 0) out[i] = out[i]!.replace(/[a-z]/, (c) => c.toUpperCase());
  } else {
    let upper = existing;
    for (let i = 0; i < out.length && upper < minUppercase; i++) {
      if (fixedCase(i) || !/[a-z]/.test(out[i]!)) continue;
      upper -= countUpper(out[i]!);
      out[i] = out[i]!.toUpperCase();
      upper += countUpper(out[i]!);
    }
  }
  return out;
}

function render(words: string[], variant: Variant, plan: Plan): string {
  const cased = applyUppercase(words, plan.minUppercase, (i) => variant.shape.madeUp.includes(i));
  return joinTokens(cased, variant.shape.glue, plan.separator) + variant.endSymbol;
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
          ? 'the first word is capitalised, one Shift press, like the start of a sentence'
          : `${n} capitals from writing the opening word${n > 8 ? 's' : ''} in capitals: hold Shift once, no back-and-forth`),
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

/** Mappings whose output only uses characters the site accepts. */
export function usableMappings(mappings: readonly Mapping[], req: Requirements): Mapping[] {
  const allowed = new Set(comfortableSymbols(req));
  return mappings.filter((m) => [...m.to].every((c) => /[a-z0-9]/.test(c) || allowed.has(c)));
}

export function generate(req: Requirements, options: GenerateOptions = {}): GenerateResult {
  const { rng = cryptoRandom, mappings = BUILT_IN_MAPPINGS } = options;
  const { plan: chosen, variants } = plan(req);
  const p = pools(req.comfort, req.minDigits);
  const warnings: string[] = [];
  const twistMappings = usableMappings(mappings, req);
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

  const suggestions: Suggestion[] = [];
  for (let i = 0; i < req.count; i++) {
    const variant = variants[weightedIndex(variants.map((v) => v.count), rng)]!;
    const { shape, model } = variant;
    const original = model.sample(variant.lo, variant.hi, rng);
    const length = render(original, variant, chosen).length;
    const twisted = applyTwists(
      original,
      {
        count: req.twists,
        mappings: twistMappings,
        skip: (j) => shape.slots[j] === 'num' || shape.initials.includes(j) || shape.madeUp.includes(j),
        // The opening capital goes on the first ordinary word (twists skip made-up nouns and initials).
        protectFirstLetter: chosen.minUppercase === 1 && shape.initials.length === 0,
        minDelta: req.minLength - length,
        maxDelta: req.maxLength - length,
      },
      rng,
    );
    const password = render(twisted.words, variant, chosen);
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
    suggestions.push({
      password,
      words: twisted.words.map((text, j) => ({ text, original: pictured[j]!, slot: shape.slots[j]! })),
      steps: shapeSteps,
      twists: twisted.applied,
      twistBits: twisted.bits,
      twistOptions: twisted.options,
      bits: chosen.bits + twisted.bits,
      typing: typingProfile(password),
      difficulty: scoreDifficulty(password, twisted.words.length + twisted.applied.length),
      checks: checkRequirements(password, req, {
        separator: chosen.separator,
        endSymbol: variant.endSymbol,
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
