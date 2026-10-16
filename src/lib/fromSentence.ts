// "Use my sentence": turn a sentence the user typed into a password that
// fits the requirements, e.g. "jupiter brings 5 leds for piece" aimed at 12
// characters -> "jr;B;5ls;Fpc".
//
// Steps, in order:
//   1. Normalise: lowercase, strip accents and punctuation, split into words.
//   2. Initials: small words ("for") and N random words become one capital
//      letter ("F", "B"), never taking the letters the uppercase rule needs.
//   3. Shorten: long words are shrunk in the chosen style, either dropping
//      inner vowels ("sweets" -> "swts") or keeping just the first and last
//      consonant ("jupiter" -> "jr"). If still over the target length, keep
//      compressing the longest words: drop vowels, trim interior consonants
//      ("jptr" -> "jpr" -> "jr"), drop small words, turn words into initials,
//      and as a last resort drop words entirely. The least-compressed state
//      that fits and keeps every rule is found by binary search over that
//      ladder; a sentence is refused only when no state keeps every rule.
//   4. Deliberate swaps for typing ease, when on: each word still whole
//      gets its fixed misspelling ("wise" -> "wyse"; see ease.ts). Then
//      fill required digits and symbols with matching twists ("e" -> "3",
//      "a" -> "@"); anything twists cannot supply is appended.
//   5. Apply the user's random twists.
//   6. Capitalise if still needed, join (numbers and small-word initials can
//      glue onto the next word: "5ls", "Fpc"), add closing marks.
//   7. If the sentence is still under the site's minimum even with every
//      word kept whole, pad it: a word when more than 3 short, a repeated
//      digit or symbol, a run of digits, closing marks, and a length tag
//      last ("%50": 50 characters in all). Planned exactly; see fluff.ts.
//
// Strength: the sentence is the user's secret and its guessability cannot be
// measured here. The card's figure is scored cold from the password and the
// sentence, so it counts only the random initials and twists: a lower bound
// on what this tool adds.

import { applyRepeat, describeFluff, planFluff, type FluffPlan, type LengthTag } from './fluff';
import {
  allowedSymbolSet,
  applyUppercase,
  checkRequirements,
  closingChoices,
  closingSymbol,
  MAX_TWISTS,
  noClosingProblem,
  comfortableSymbols,
  countUpper,
  fewerSwapsWarning,
  isSymbol,
  joinTokens,
  RequirementsError,
  resolveSeparator,
  trimSeparators,
  usableMappings,
  validate,
  type GenerateOptions,
  type Requirements,
  type Suggestion,
} from './generate';
import { pools, twoLetter } from './grammar';
import { easedText } from './ease';
import { cryptoRandom, randomInt, type RandomSource } from './random';
import { scoreCold } from './score';
import { dropVowels, letterCount, normalizeSentence, SMALL_WORDS, trimInterior } from './text';
import { applyTwists, BUILT_IN_MAPPINGS, type AppliedTwist, type Mapping } from './twists';

export { dropVowels, normalizeSentence, SMALL_WORDS, trimInterior } from './text';

export type ShrinkStyle = 'none' | 'vowels' | 'ends';

export interface SentenceOptions {
  /** How long words are shrunk: kept, vowels dropped, or first + last consonant. */
  shrink: ShrinkStyle;
  /** Shrink words this long or longer. */
  shrinkFrom: number;
  /** When compressing toward the target, words may be dropped entirely. */
  allowDropping: boolean;
  /** Small words like "for", "the", "of" become one capital letter. */
  smallWordInitials: boolean;
  /** Compress toward this many characters (null = only the site maximum). */
  targetLength: number | null;
  /** Pad a sentence that is under the site's minimum, after every word has been kept whole. */
  padding: boolean;
  /** The self-describing tag that ends the padding: "%50" (total length), "@3" (a factor of the length before it), or none. */
  lengthTag: LengthTag;
}

export const DEFAULT_SENTENCE_OPTIONS: SentenceOptions = {
  shrink: 'vowels',
  shrinkFrom: 6,
  allowDropping: true,
  smallWordInitials: true,
  targetLength: null,
  padding: true,
  lengthTag: 'total',
};

export interface SentenceResult {
  words: string[];
  separator: string;
  suggestions: Suggestion[];
  warnings: string[];
}

type Kind = 'word' | 'number' | 'initial' | 'fluff';

interface Token {
  text: string;
  original: string;
  kind: Kind;
  small: boolean;
}

/** The usable mappings, and the subsets that supply a digit or a symbol. Built once per call. */
interface MappingSets {
  all: readonly Mapping[];
  digit: readonly Mapping[];
  symbol: readonly Mapping[];
}

/** Everything one call to fromSentence shares between its attempts. */
interface Context {
  /** The normalised sentence words. */
  base: readonly string[];
  /** The sentence to remember, as typed. */
  hint: string;
  req: Requirements;
  opts: SentenceOptions;
  separator: string;
  closing: string | undefined;
  /** The symbols a password's closing mark is drawn from. */
  closingChoices: string[];
  /** The message when closing marks are needed but none can be used. */
  closingProblem: string;
  mappings: MappingSets;
  rng: RandomSource;
  /** Compression ladders by starting state, shared across attempts. */
  ladderCache: Map<string, Token[][]>;
}

/** The symbols each length tag may start with, in order of preference. */
export const TAG_SYMBOLS: Record<Exclude<LengthTag, 'none'>, readonly string[]> = { total: ['%', '$', '#'], factor: ['@'] };

/**
 * The symbol a length tag starts with under these rules, or undefined when
 * the site allows none of them comfortably: then the padding simply goes
 * without its tag, and the form says so.
 */
export function lengthTagSymbol(tag: LengthTag, comfortable: readonly string[]): string | undefined {
  return tag === 'none' ? undefined : TAG_SYMBOLS[tag].find((s) => comfortable.includes(s));
}

/** Digit and symbol swaps made for a rule stop here; the rest of the rule comes from an appended number or closing marks (every extra swap multiplies the choices to search). */
const MAX_RULE_TWISTS = 3;

const toInitial = (t: Token): Token => ({ ...t, text: t.original[0]!.toUpperCase(), kind: 'initial' });

const digitCount = (words: readonly string[]) => words.join('').replace(/[^0-9]/g, '').length;
const symbolCount = (words: readonly string[]) => [...words.join('')].filter(isSymbol).length;
const describeTwist = (t: AppliedTwist) => `${t.mapping.from} → ${t.mapping.to || '–'} in “${t.before}”`;
const tokenLetters = (ts: readonly Token[]) => ts.reduce((n, t) => n + letterCount(t.text), 0);

/**
 * Deliberate swaps for typing ease on the words still whole: a shortened
 * word is already changed, and an initial, number or padding is not a word
 * to swap. Skipped altogether if the swaps would leave too few letters for
 * the uppercase rule ("bricks" -> "brix" drops two).
 */
function easeWhole(state: readonly Token[], req: Requirements): readonly Token[] {
  if (!req.easeSwaps) return state;
  const eased = state.map((t) => (t.kind === 'word' && t.text === t.original ? { ...t, text: easedText(t.original) } : t));
  return tokenLetters(eased) >= req.minUppercase ? eased : state;
}

/**
 * Make `count` of the words capital initials, drawn uniformly among the sets
 * that keep at least `minLetters` letters. A set is drawn at random and
 * redrawn while it leaves too few letters (no enumeration, so a pasted
 * paragraph costs nothing); after enough misses the words that cost the
 * fewest letters are taken, and if even those leave too few, fewer initials.
 */
function randomInitials(tokens: Token[], count: number, minLetters: number, rng: RandomSource): Token[] {
  const eligible = tokens.flatMap((t, i) => (t.kind === 'word' ? [i] : []));
  const k = Math.min(count, eligible.length);
  if (k === 0) return tokens;
  const letters = letterCount(tokens.map((t) => t.text).join(''));
  const cost = (i: number) => letterCount(tokens[i]!.text) - 1; // letters lost when a word becomes its initial
  const keeps = (chosen: readonly number[]) => letters - chosen.reduce((n, i) => n + cost(i), 0) >= minLetters;
  const cheapest = [...eligible].sort((a, b) => cost(a) - cost(b)).slice(0, k);
  if (!keeps(cheapest)) return count > 1 ? randomInitials(tokens, count - 1, minLetters, rng) : tokens;
  let chosen = cheapest;
  for (let tries = 0; tries < 64; tries++) {
    const pool = [...eligible];
    const draw: number[] = [];
    for (let j = 0; j < k; j++) draw.push(pool.splice(randomInt(pool.length, rng), 1)[0]!); // a uniform k-subset
    if (keeps(draw)) {
      chosen = draw;
      break;
    }
  }
  return tokens.map((t, i) => (chosen.includes(i) ? toInitial(t) : t));
}

interface Attempt {
  suggestion?: Suggestion;
  problem?: string;
  missedTarget?: boolean;
  /** The least compressed state was already under the minimum length. */
  tooShort?: boolean;
}

/**
 * The compression ladder, one small change at a time, from least to most
 * compressed. Each state is a full token list. Stops when nothing more can
 * be done. Never removes the last letters the uppercase rule needs.
 */
export function* compressions(start: Token[], req: Requirements, opts: SentenceOptions): Generator<Token[]> {
  const minLetters = Math.max(1, req.minUppercase);
  let tokens = start;
  const longestWords = () =>
    tokens
      .map((t, i) => [t, i] as const)
      .filter(([t]) => t.kind === 'word')
      .sort((a, b) => b[0].text.length - a[0].text.length);
  const replace = (i: number, t: Token) => tokens.map((x, j) => (j === i ? t : x));
  const without = (i: number) => tokens.filter((_, j) => j !== i);
  const lettersOk = (ts: Token[]) => tokenLetters(ts) >= minLetters;

  const actions: (() => Token[] | undefined)[] = [
    // Drop vowels from the longest word that can spare them.
    () => {
      for (const [t, i] of longestWords()) {
        const next = replace(i, { ...t, text: dropVowels(t.text) });
        if (dropVowels(t.text) !== t.text && lettersOk(next)) return next;
      }
      return undefined;
    },
    // Trim an interior letter from the longest word, down to two letters.
    () => {
      for (const [t, i] of longestWords()) {
        const next = replace(i, { ...t, text: trimInterior(t.text) });
        if (trimInterior(t.text) !== t.text && lettersOk(next)) return next;
      }
      return undefined;
    },
    // Long numbers keep their leading digits ("2026" -> "20").
    () => {
      const nums = tokens.map((t, i) => [t, i] as const).filter(([t]) => t.kind === 'number' && t.text.length > 1);
      const hit = nums.sort((a, b) => b[0].text.length - a[0].text.length)[0];
      return hit && replace(hit[1], { ...hit[0], text: hit[0].text.slice(0, -1) });
    },
    // Small words carry the least meaning, so they go first.
    () => {
      if (!opts.allowDropping || tokens.length <= 1) return undefined;
      const i = tokens.findIndex((t) => t.small);
      return i >= 0 && lettersOk(without(i)) ? without(i) : undefined;
    },
    // The longest word becomes a capital initial.
    () => {
      for (const [t, i] of longestWords()) {
        const next = replace(i, toInitial(t));
        if (t.text.length > 1 && lettersOk(next)) return next;
      }
      return undefined;
    },
    // Last resort: drop the shortest piece, keeping at least two. Prefer
    // spare numbers (beyond the digits rule) over words with letters.
    () => {
      if (!opts.allowDropping || tokens.length <= 2) return undefined;
      const digits = digitCount(tokens.map((t) => t.text));
      const order = tokens
        .map((t, i) => [t, i] as const)
        .filter(([, i]) => lettersOk(without(i)))
        .sort(
          (a, b) =>
            a[0].text.length - b[0].text.length ||
            Number(b[0].kind === 'number' && digits - b[0].text.length >= req.minDigits) -
              Number(a[0].kind === 'number' && digits - a[0].text.length >= req.minDigits),
        );
      return order[0] && without(order[0][1]);
    },
  ];

  yield tokens;
  for (;;) {
    let next: Token[] | undefined;
    for (const action of actions) {
      next = action();
      if (next) break;
    }
    if (!next) return;
    tokens = next;
    yield tokens;
  }
}

function attempt(ctx: Context): Attempt {
  const { base, req, opts, rng } = ctx;
  // 1-2. Tokens and initials.
  let start: Token[] = base.map((w) => ({
    text: w,
    original: w,
    kind: /^[0-9]+$/.test(w) ? 'number' : 'word',
    small: SMALL_WORDS.has(w),
  }));
  if (opts.smallWordInitials) {
    // Small words become initials, but never the letters the uppercase rule needs: the longest stay whole until enough remain.
    const small = start.flatMap((t, i) => (t.kind === 'word' && t.small ? [i] : [])).sort((x, y) => start[y]!.text.length - start[x]!.text.length);
    const minLetters = Math.max(1, req.minUppercase);
    let keep = 0;
    const shaped = () => start.map((t, i) => (small.indexOf(i) >= keep ? toInitial(t) : t));
    while (keep < small.length && tokenLetters(shaped()) < minLetters) keep++;
    start = shaped();
  }
  // Random initials and the shrink style are deliberate, but if together they
  // leave the sentence under the minimum length, back off: first keep the
  // longest words whole, then use fewer initials.
  const shrink = opts.shrink === 'vowels' ? dropVowels : opts.shrink === 'ends' ? twoLetter : undefined;
  // 3. Shrink long words in the chosen style, keeping the `keepWhole` longest ones whole.
  const shrinkableOf = (whole: Token[]) =>
    whole
      .map((t, i) => [t, i] as const)
      .filter(([t]) => shrink && t.kind === 'word' && t.text.length >= opts.shrinkFrom && shrink(t.text) !== t.text)
      .sort((a, b) => b[0].text.length - a[0].text.length)
      .map(([, i]) => i);
  const shaped = (whole: Token[], keepWhole: number) => {
    const shrinkable = shrinkableOf(whole);
    // Shrinking never removes the letters the uppercase rule needs: keep more long words whole until enough remain.
    for (let keep = keepWhole; ; keep++) {
      const out = whole.map((t, i) => (shrinkable.indexOf(i) >= keep && shrink ? { ...t, text: shrink(t.text) } : t));
      if (keep >= shrinkable.length || letterCount(out.map((t) => t.text).join('')) >= req.minUppercase) return out;
    }
  };
  let result: Attempt = { problem: 'Could not fit this sentence to the requirements.' };
  for (let count = req.initials; count >= 0; count--) {
    const initials = randomInitials(start, count, Math.max(1, req.minUppercase), rng);
    const shrinkable = shrinkableOf(initials);
    for (let keepWhole = 0; keepWhole <= shrinkable.length; keepWhole++) {
      result = fitLength(shaped(initials, keepWhole), ctx);
      if (result.suggestion && keepWhole > 0) result.suggestion.steps.push('kept some long words whole to reach the minimum length');
      if (result.suggestion && count < req.initials) result.suggestion.steps.push('used fewer random initials to reach the minimum length');
      if (!result.tooShort) return result;
    }
  }
  // 7. The sentence cannot supply the minimum on its own: keep every word
  // whole, keep the chosen initials, and pad the rest.
  if (result.tooShort && opts.padding) {
    const initials = randomInitials(start, req.initials, Math.max(1, req.minUppercase), rng);
    result = fitLength(shaped(initials, Infinity), ctx, true);
  }
  return result;
}

interface Finished {
  suggestion: Suggestion;
  length: number;
}

interface Problem {
  problem: string;
  /** The state was already under the minimum length; more compression cannot help. */
  tooShort?: boolean;
  /** How long the state came out when another rule failed, so the search can still steer by length. */
  length?: number;
}

/** How many ladder states a fit finished; exposed for tests of the search. */
export const searchStats = { finishes: 0, states: 0 };

function fitLength(start: Token[], ctx: Context, pad = false): Attempt {
  const { req, opts, separator, ladderCache } = ctx;
  // Compress one step at a time and keep the least-compressed state whose
  // finished password fits. Finishing is exact, so there is no guessing.
  const limit = Math.max(req.minLength, Math.min(req.maxLength, opts.targetLength ?? req.maxLength));
  // Finishing is the costly part, so skip states whose bare joined length is
  // still clearly too long. Finishing can shorten by at most a few
  // characters (digit twists like "for" -> "4"), hence the slack.
  const slack = 2 * (req.minDigits + req.minSymbols) + 4;
  const bare = (ts: readonly Token[]) => easeWhole(ts, req).reduce((n, t) => n + t.text.length, 0) + Math.max(0, ts.length - 1) * separator.length;
  const key = start.map((t) => `${t.kind}:${t.text}`).join(' ');
  let states = ladderCache.get(key);
  if (!states) {
    states = [];
    for (const state of compressions(start, req, opts)) {
      states.push(state);
      if (bare(state) < req.minLength - slack) break; // nothing shorter can be useful
    }
    ladderCache.set(key, states);
  }
  const candidates = states.filter((st) => bare(st) <= limit + slack);
  // If every state is far too long, finish the most compressed one for an exact message.
  if (candidates.length === 0) candidates.push(states.at(-1)!);
  searchStats.states += candidates.length;

  // Binary search for the least-compressed state that fits. Each state is
  // finished at most once (finishing places swaps at random, so the result
  // is kept and reused). Along the ladder a state is either still too long,
  // or short enough: it fits, or it is already under the minimum. The
  // boundary between the two is what we want, and whatever is returned
  // always fits. A state can also break another rule (too few letters to
  // capitalise, or fewer separators than the symbol rule needs with no
  // closing mark allowed); the search steers by its length all the same,
  // and the pick below passes over it to the nearest state that keeps
  // every rule, so a sentence is refused only when no state does.
  const finished = new Map<number, Finished | Problem>();
  const fin = (i: number): Finished | Problem => {
    let f = finished.get(i);
    if (!f) {
      searchStats.finishes++;
      f = finish(candidates[i]!, limit, ctx, pad);
      finished.set(i, f);
    }
    return f;
  };
  const fits = (f: Finished | Problem): f is Finished => !('problem' in f) && f.length <= limit;
  const shortEnough = (f: Finished | Problem) => ('problem' in f ? !!f.tooShort || (f.length !== undefined && f.length <= limit) : f.length <= limit);

  // The first state that is short enough; past the end when even the most compressed is over the target.
  let lo = 0;
  let hi = candidates.length - 1;
  if (!shortEnough(fin(hi))) lo = hi = candidates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (shortEnough(fin(mid))) hi = mid;
    else lo = mid + 1;
  }

  let best: Finished | undefined;
  let short: Problem | undefined;
  let broken: Problem | undefined;
  // The least compressed state that fits: from the boundary on, until the states are under the minimum.
  for (let i = hi; i < candidates.length && !best; i++) {
    const f = fin(i);
    if (fits(f)) best = f;
    else if ('problem' in f && f.tooShort) {
      short = f;
      break;
    } else if ('problem' in f) broken ??= f;
  }
  // Else the most compressed state still over the target that keeps every rule. A less compressed one is longer
  // still, so the first found decides: within the maximum it is kept, over it the sentence needs padding or fewer words.
  for (let i = hi - 1; i >= 0 && !best; i--) {
    const f = fin(i);
    if (!('problem' in f)) {
      if (f.length > req.maxLength && short) return { problem: short.problem, tooShort: true }; // the state under the minimum is the one padding can complete
      best = f;
    } else broken ??= f;
  }
  if (!best) return short ? { problem: short.problem, tooShort: true } : { problem: broken!.problem };
  if (best.length > req.maxLength) {
    return {
      problem: `Even compressed, your sentence makes ${best.length} characters, over the ${req.maxLength} maximum. Use fewer words or raise the maximum.`,
    };
  }
  return { suggestion: best.suggestion, missedTarget: opts.targetLength !== null && best.length > limit };
}

/** Steps 4-7 on one compression state: deliberate swaps, required digits and symbols, random twists, case and joining, and padding when asked. */
function finish(state: readonly Token[], limit: number, ctx: Context, pad = false): Finished | Problem {
  const { base, req, opts, separator, mappings, rng } = ctx;
  // This password's own closing mark, drawn from the allowed comfortable symbols other than the separator.
  const closing = ctx.closingChoices.length ? ctx.closingChoices[randomInt(ctx.closingChoices.length, rng)] : undefined;
  let { hint } = ctx;
  // Deliberate swaps first, so random swaps land on the words as typed.
  const typed = easeWhole(state, req);
  // Capitalise next: twists only match lowercase letters, so the capitals
  // the uppercase rule needs can never be swapped away.
  const capitalised = applyUppercase(typed.map((t) => t.text), req.minUppercase, undefined, rng); // a random word, for variety
  let tokens = typed.map((t, i) => ({ ...t, text: capitalised[i]! }));
  const texts = () => tokens.map((t) => t.text);
  const glueOf = (ts: readonly Token[]) =>
    ts.map((t, i) => req.glue && i < ts.length - 1 && ts[i + 1]!.kind !== 'fluff' && (t.kind === 'number' || (t.kind === 'initial' && t.small))); // never onto padding: the padding plan budgeted a separator before each piece
  const setTexts = (words: string[]) => {
    tokens = words.map((text, i) => (tokens[i] ? { ...tokens[i]!, text } : { text, original: text, kind: 'number', small: false }));
  };
  const twistOpts = {
    skip: (i: number) => tokens[i]?.kind !== 'word',
    protectFirstLetter: false,
    minDelta: -1000,
    maxDelta: 1000,
  };
  const steps: string[] = [];

  // 4a. Required digits: half the time digit twists first, then a random number, at the start or the end.
  let digitTwists: AppliedTwist[] = [];
  if (req.minDigits > digitCount(texts())) {
    const need = req.minDigits - digitCount(texts());
    if (randomInt(2, rng) === 0) {
      const r = applyTwists(texts(), { ...twistOpts, count: Math.min(need, MAX_RULE_TWISTS), mappings: mappings.digit }, rng);
      setTexts(r.words);
      digitTwists = r.applied;
    }
    const missing = Math.max(0, req.minDigits - digitCount(texts()));
    if (missing > 0) {
      // A comfortable number of exactly the missing length: close-together digits. It goes in front or at the end,
      // and into the hint at the same place, since it is part of what there is to remember.
      const options = pools(req.comfort, missing).num.filter((x) => x.length === missing);
      const n = options[randomInt(options.length, rng)]!;
      const token: Token = { text: n, original: n, kind: 'number', small: false };
      const inFront = randomInt(2, rng) === 0;
      tokens = inFront ? [token, ...tokens] : [...tokens, token];
      hint = inFront ? `${n} ${hint}` : `${hint} ${n}`;
      steps.push(`added ${n} ${inFront ? 'in front' : 'at the end'} for the digit rule`);
    }
  }

  // 4b. Required symbols: separators count, then symbol twists, then closing marks.
  const glue = glueOf(tokens);
  const sepSymbols = isSymbol(separator) ? glue.slice(0, -1).filter((g) => !g).length : 0;
  let symbolTwists: AppliedTwist[] = [];
  if (req.minSymbols > sepSymbols + symbolCount(texts())) {
    const need = req.minSymbols - sepSymbols - symbolCount(texts());
    // Some of the rule by swaps, the rest by closing marks: how many swaps is drawn at random, up to the cap.
    const count = randomInt(Math.min(need, MAX_RULE_TWISTS) + 1, rng);
    if (count > 0) {
      const r = applyTwists(texts(), { ...twistOpts, count, mappings: mappings.symbol }, rng);
      setTexts(r.words);
      symbolTwists = r.applied;
    }
  }
  const stillNeeded = Math.max(0, req.minSymbols - sepSymbols - symbolCount(texts()));
  if (stillNeeded > 0 && !closing) return { problem: ctx.closingProblem, length: joinTokens(texts(), glue, separator).length };
  const endSymbol = closing?.repeat(stillNeeded) ?? '';

  // 5. The user's random twists, kept inside the length limits (and the target).
  const current = joinTokens(texts(), glue, separator).length + endSymbol.length;
  const random = applyTwists(
    texts(),
    {
      ...twistOpts,
      count: Math.min(MAX_TWISTS, req.twists + (req.twists > 0 ? randomInt(2, rng) : 0)), // the minimum, or half the time one more, never above the maximum
      mappings: mappings.all,
      minDelta: req.minLength - current,
      maxDelta: Math.max(limit, current) - current,
    },
    rng,
  );
  setTexts(random.words);

  // 6. Case, join, closing marks.
  let ending = endSymbol;
  let password = trimSeparators(joinTokens(texts(), glue, separator) + ending, separator);
  let length = [...password].length;

  // 7. Padding, when the sentence cannot supply the minimum on its own.
  let fluff: FluffPlan | undefined;
  if (length < req.minLength && pad) {
    const comfortable = comfortableSymbols(req);
    const repeatIndex = tokens.findIndex((t) => t.kind === 'word' && /[0-9]/.test(t.text));
    const symbolIndex = repeatIndex < 0 ? tokens.findIndex((t) => t.kind === 'word' && /[^a-zA-Z0-9]/.test(t.text)) : -1;
    const repeatAt = repeatIndex >= 0 ? repeatIndex : symbolIndex;
    const p = pools(req.comfort, 1);
    fluff = planFluff({
      length,
      min: req.minLength,
      max: req.maxLength,
      separator,
      tag: opts.lengthTag,
      totalSymbol: lengthTagSymbol('total', comfortable),
      factorSymbol: lengthTagSymbol('factor', comfortable),
      mark: comfortable.includes('!') ? '!' : closing,
      repeatable: repeatAt >= 0 ? { tokenIndex: repeatAt, char: tokens[repeatAt]!.text.match(/[0-9]/)?.[0] ?? tokens[repeatAt]!.text.match(/[^a-zA-Z0-9]/)![0] } : undefined,
      words: [...p.adj, ...p.noun],
      rng,
    });
    if (fluff) {
      const remembered: string[] = [];
      for (const piece of fluff.pieces) {
        if (piece.kind === 'repeat') {
          const t = tokens[piece.tokenIndex!]!;
          tokens[piece.tokenIndex!] = { ...t, text: applyRepeat(t.text, piece.char!, piece.text) };
        } else if (piece.kind === 'word' || piece.kind === 'sequence') {
          tokens.push({ text: piece.text, original: piece.text, kind: 'fluff', small: false });
          remembered.push(piece.text);
        } else {
          ending += piece.text;
          if (piece.kind === 'tag') remembered.push(piece.text);
        }
      }
      password = trimSeparators(joinTokens(texts(), glueOf(tokens), separator) + ending, separator);
      length = [...password].length;
      if (remembered.length) hint = `${hint} ${remembered.join(' ')}`;
    }
  }
  if (length < req.minLength) {
    return {
      problem: `Your sentence makes ${length} characters, under the ${req.minLength} minimum. Add a few words or lower the minimum.`,
      tooShort: true,
    };
  }
  if (countUpper(password) < req.minUppercase) {
    return { problem: `Your sentence does not have ${req.minUppercase} letters to capitalise. Add a word.`, length };
  }

  const dropped = base.filter((w) => !state.some((t) => t.original === w));
  if (dropped.length) steps.unshift(`dropped to fit: ${dropped.map((w) => `“${w}”`).join(', ')}`);
  const shortened = state.filter((t) => t.kind !== 'initial' && t.text !== t.original);
  const inits = state.filter((t) => t.kind === 'initial');
  const shapeSteps = [
    shortened.length ? `shortened: ${shortened.map((t) => `“${t.original}” → “${t.text}”`).join(', ')}` : '',
    inits.length ? `capital initials: ${inits.map((t) => `“${t.original}” → “${t.text}”`).join(', ')}` : '',
  ].filter(Boolean);
  steps.unshift(...shapeSteps);
  const forced = [...digitTwists, ...symbolTwists];
  if (forced.length) {
    const rules = [digitTwists.length && 'digit', symbolTwists.length && 'symbol'].filter(Boolean).join(' and ');
    steps.push(`for the ${rules} rule: ${forced.map(describeTwist).join(', ')}`);
  }
  if (endSymbol) steps.push(`ended with “${endSymbol}” for the symbol rule`);
  if (fluff) steps.push(describeFluff(fluff, req.minLength));

  const score = scoreCold(password, hint);
  return {
    length,
    suggestion: {
      password,
      hint,
      words: tokens.map((t) => ({ text: t.text, original: t.original, slot: t.kind === 'fluff' ? ('fluff' as const) : ('yours' as const) })),
      steps,
      twists: random.applied,
      twistBits: score.twistBits,
      twistOptions: score.twistOptions,
      bits: score.bits,
      typing: score.typing,
      difficulty: score.difficulty,
      memorability: score.memorability.score,
      checks: checkRequirements(password, req, {
        separator,
        endSymbol: ending,
        uppercaseHow: inits.length ? `capital initials: ${inits.map((t) => t.text).join(' ')}` : undefined,
        digitsHow: digitTwists.length ? `twisted ${digitTwists.map(describeTwist).join(', ')}` : undefined,
        symbolsHow: symbolTwists.length ? `twisted ${symbolTwists.map(describeTwist).join(', ')}` : undefined,
      }),
    },
  };
}

/** The sentence as the user typed it, with whitespace tidied: what they should remember. */
export const hintOf = (sentence: string) => sentence.trim().replace(/\s+/g, ' ');

export function fromSentence(
  sentence: string,
  req: Requirements,
  opts: SentenceOptions = DEFAULT_SENTENCE_OPTIONS,
  options: GenerateOptions = {},
): SentenceResult {
  const { rng = cryptoRandom, mappings = BUILT_IN_MAPPINGS } = options;
  validate(req);
  const words = normalizeSentence(sentence);
  if (words.length === 0) throw new RequirementsError('Type a sentence to turn into a password.');

  const allowed = allowedSymbolSet(req);
  const separator = resolveSeparator(req);
  const closing = closingSymbol(req, allowed, separator);
  const usable = usableMappings(mappings, req, separator);
  const ctx: Context = {
    base: words,
    hint: hintOf(sentence),
    req,
    opts,
    separator,
    closing,
    closingChoices: closingChoices(req, allowed, separator),
    closingProblem: noClosingProblem([...allowed], separator),
    mappings: {
      all: usable,
      digit: usable.filter((m) => /[0-9]/.test(m.to)),
      symbol: usable.filter((m) => [...m.to].some(isSymbol)),
    },
    rng,
    ladderCache: new Map(),
  };

  const warnings: string[] = [];
  if (words.length < 4) {
    warnings.push('Short sentences are easier to guess. Four or more words, ideally not a famous quote or lyric, is much safer.');
  }

  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  let problem: string | undefined;
  let missedTarget = false;
  for (let tries = 0; suggestions.length < req.count && tries < req.count * 10; tries++) {
    const a = attempt(ctx);
    if (a.problem) problem = a.problem;
    if (!a.suggestion || seen.has(a.suggestion.password)) continue;
    missedTarget ||= !!a.missedTarget;
    seen.add(a.suggestion.password);
    suggestions.push(a.suggestion);
  }
  if (suggestions.length === 0) throw new RequirementsError(problem ?? 'Could not fit this sentence to the requirements.');
  const short = suggestions.filter((s) => s.twists.length < req.twists).length;
  if (short) warnings.push(fewerSwapsWarning(short, req.twists));
  if (missedTarget) {
    warnings.push(`Some versions could not get down to ${opts.targetLength} characters while keeping the required digits and symbols.`);
  }
  if (suggestions.length < req.count) {
    warnings.push(`Only ${suggestions.length} different versions fit; add twists or initials for more variety.`);
  }
  return { words, separator, suggestions, warnings };
}
