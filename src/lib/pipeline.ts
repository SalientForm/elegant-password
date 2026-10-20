// The one path from a user's settings to the passwords they are shown, for
// every front end. The web app and the CLI both build the engine's inputs
// with inputsFor, run them with runInputs (engine.ts), and order what
// comes back with presentSuggestions, so a change to any step reaches both
// or neither. src/boundaries.test.ts holds both front ends to it.

import { difficultyIn, type TypingMode } from './difficulty';
import type { GenerateInputs, Mode } from './engine';
import type { SentenceOptions } from './fromSentence';
import type { GeneratedSentence, Requirements, Suggestion } from './generate';
import { activeMappings, type MappingSettings } from './mappingSettings';
import { sortSuggestions, type SortOrder } from './sort';

/** Everything that decides which passwords are made. */
export interface GenerationSettings {
  /** Make up a sentence, or use the user's own. */
  mode: Mode;
  req: Requirements;
  /** The user's own sentence (sentence mode only). */
  sentence: string;
  sentenceOptions: SentenceOptions;
  mappingSettings: MappingSettings;
}

/** The engine's inputs for these settings. `generated` keeps a made-up sentence; null draws a new one. */
export function inputsFor(settings: GenerationSettings, generated: GeneratedSentence | null = null): GenerateInputs {
  return {
    mode: settings.mode,
    req: settings.req,
    sentence: settings.sentence,
    sentenceOptions: settings.sentenceOptions,
    mappings: activeMappings(settings.mappingSettings),
    generated,
  };
}

/**
 * Suggestions as shown: difficulty scored for the typing mode the user
 * chose (the engine scores ten-finger), then put in the chosen order, so
 * "easiest first" follows the mode too.
 */
export function presentSuggestions<T extends Suggestion>(suggestions: readonly T[], typingMode: TypingMode, order: SortOrder): T[] {
  return sortSuggestions(
    suggestions.map((s) => ({ ...s, difficulty: difficultyIn(s.password, s.difficulty, typingMode) })),
    order,
  );
}
