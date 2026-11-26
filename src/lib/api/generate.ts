// Generating from resolved settings (spec §5.3), and scoring a password
// already made (§5.4). The same shared calls the web app and tep make:
// inputsFor, runInputs and presentSuggestions to generate, scoreCold and
// the strength figures to score, scoreReadings to read the scores.

import { lookup, MODE_NAMES } from '../config/names';
import { DEFAULT_TYPING_MODE, difficultyIn } from '../difficulty';
import { runInputs } from '../engine';
import type { GeneratedSentence, RequirementCheck } from '../generate';
import { inputsFor, presentSuggestions, type GenerationSettings } from '../pipeline';
import { scoreReadings, type ScoreReadings } from '../readings';
import { difficultyAlone, scoreCold } from '../score';
import { DEFAULT_SORT } from '../sort';
import { rawBits, strengthBits } from '../strength';
import { sentenceProblem } from '../text';
import { MAX_COUNT, MIN_COUNT } from '../validation';
import { settingsData, type Problem, type Settings } from './config';

/** A password's four readings: Strength, Raw, Difficulty (for a typing mode) and Memorability, each with its figure, colour band and sentence. */
export type Readings = ScoreReadings;

declare const drawnBrand: unique symbol;
/**
 * A made-up sentence a previous outcome drew: pass it back to keep it, for
 * Refresh. `text` is the sentence to show. Plain data; the rest of it is
 * the package's own.
 */
export type DrawnSentence = { readonly text: string; readonly [drawnBrand]: true };

/** What a DrawnSentence holds. */
type DrawnData = GeneratedSentence & { text: string };

export interface Suggestion {
  password: string;
  /** What to remember: the sentence it was made from. */
  hint: string;
  /** Each of the site's rules, whether it is met, and how. */
  checks: RequirementCheck[];
  readings: Readings;
  /** For a made-up sentence only: its bits for an attacker who knows this tool and these settings. */
  bits?: number;
}

export type Outcome = { ok: true; sentence?: DrawnSentence; suggestions: Suggestion[]; warnings: string[] } | { ok: false; problem: Problem };

export interface GenerateRequest {
  /** Absent: draw a made-up sentence. A DrawnSentence: keep it. A string: the user's own sentence, or a drawn one they edited. */
  sentence?: DrawnSentence | string;
  /** How many passwords, 1 to 20; 1 when left out. */
  count?: number;
}

const failed = (message: string, keys: string[] = []): Outcome => ({ ok: false, problem: { keys, message } });

const isDrawn = (x: unknown): x is DrawnData => {
  const d = x as Partial<DrawnData> | null;
  return !!d && typeof d === 'object' && Array.isArray(d.slots) && Array.isArray(d.words) && d.slots.length === d.words.length && d.words.every((w) => typeof w === 'string');
};

/**
 * Passwords from settings `resolveConfig` gave. A drawn sentence gives
 * exact bits; a string is fitted as the user's own and scored from its
 * text. Never throws for the settings: a sentence or a count that cannot
 * be used, or rules no sentence fits, come back as a problem.
 */
export function generate(settings: Settings, request: GenerateRequest = {}): Outcome {
  const { req, sentenceOptions, mappingSettings, typingMode } = settingsData(settings);
  const count = request.count ?? 1;
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) return failed(`count must be a whole number from ${MIN_COUNT} to ${MAX_COUNT}; found ${String(count)}.`);

  const given = request.sentence;
  const own = typeof given === 'string' ? given : undefined;
  if (own !== undefined) {
    const problem = sentenceProblem(own);
    if (problem) return failed(problem);
  } else if (given !== undefined && !isDrawn(given)) {
    return failed('sentence must be a string, or a DrawnSentence from an earlier outcome.');
  }
  const drawn = own === undefined && given !== undefined ? (given as unknown as DrawnData) : null;

  const generation: GenerationSettings = { mode: own === undefined ? 'generated' : 'sentence', req: { ...req, count }, sentence: own ?? '', sentenceOptions, mappingSettings };
  const outcome = runInputs(inputsFor(generation, drawn ? { slots: [...drawn.slots], words: [...drawn.words] } : null));
  if (!outcome.ok) return failed(outcome.error);

  const exact = outcome.source === 'generated';
  const suggestions = presentSuggestions(outcome.suggestions, typingMode, DEFAULT_SORT).map(
    (s): Suggestion => ({
      password: s.password,
      hint: s.hint,
      checks: s.checks.map((c) => ({ ...c })),
      readings: scoreReadings({ strength: s.strength, raw: s.raw, difficulty: s.difficulty, memorability: s.memorability }),
      ...(exact ? { bits: s.bits } : {}),
    }),
  );
  const sentence = outcome.generated ? ({ slots: [...outcome.generated.slots], words: [...outcome.generated.words], text: outcome.generated.words.join(' ') } satisfies DrawnData as unknown as DrawnSentence) : undefined;
  return { ok: true, ...(sentence ? { sentence } : {}), suggestions, warnings: [...outcome.warnings] };
}

/**
 * A password's readings from the password and its hint alone, as My list
 * scores a saved one, so it reads the same in a year. Difficulty is for
 * `typingMode` (a typing mode's name), ten-finger when left out. With no
 * hint, Memorability has nothing to compare with. Throws a RangeError for
 * a typing mode that does not exist.
 */
export function scorePassword(password: string, hint: string, typingMode?: string): Readings {
  let mode = DEFAULT_TYPING_MODE;
  if (typingMode !== undefined) {
    const found = lookup('typing mode', MODE_NAMES, typingMode);
    if (!found.ok) throw new RangeError(found.error);
    mode = found.value;
  }
  const own = hint.trim();
  const cold = own ? scoreCold(password, own) : undefined;
  const difficulty = difficultyIn(password, cold?.difficulty ?? difficultyAlone(password), mode);
  return scoreReadings({ strength: strengthBits(password), raw: rawBits(password), difficulty, ...(cold ? { memorability: cold.memorability.score } : {}) });
}
