import { describe, expect, it } from 'vitest';
import { difficultyIn } from './difficulty';
import { runInputs } from './engine';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS, type Suggestion } from './generate';
import { activeMappings } from './mappingSettings';
import { inputsFor, presentSuggestions, type GenerationSettings } from './pipeline';
import { sortSuggestions } from './sort';

const settings: GenerationSettings = {
  mode: 'generated',
  req: { ...DEFAULT_REQUIREMENTS, count: 6 },
  sentence: '',
  sentenceOptions: DEFAULT_SENTENCE_OPTIONS,
  mappingSettings: { disabled: ['a>@'], custom: [{ from: 'cat', to: 'k@' }] },
};

describe('inputsFor', () => {
  it('passes the settings through and turns mapping settings into the active mappings', () => {
    const inputs = inputsFor(settings);
    expect(inputs).toEqual({ ...settings, mappingSettings: undefined, mappings: activeMappings(settings.mappingSettings), generated: null });
    expect(inputs.mappings.some((m) => m.from === 'a' && m.to === '@')).toBe(false);
    expect(inputs.mappings.at(-1)).toEqual({ from: 'cat', to: 'k@', kind: 'custom' });
  });

  it('keeps a made-up sentence when given one', () => {
    const generated = { slots: ['adj' as const], words: ['sleepy'] };
    expect(inputsFor(settings, generated).generated).toBe(generated);
  });
});

describe('presentSuggestions', () => {
  const outcome = runInputs(inputsFor(settings));
  const suggestions = outcome.ok ? outcome.suggestions : ([] as Suggestion[]);

  it('rescores difficulty for the typing mode, then orders by it', () => {
    expect(suggestions.length).toBe(6);
    const shown = presentSuggestions(suggestions, 'two-finger', 'difficulty');
    const expected = sortSuggestions(
      suggestions.map((s) => ({ ...s, difficulty: difficultyIn(s.password, s.difficulty, 'two-finger') })),
      'difficulty',
    );
    expect(shown).toEqual(expected);
    expect(shown.every((s) => s.difficulty.mode === 'two-finger')).toBe(true);
    for (let i = 1; i < shown.length; i++) expect(shown[i]!.difficulty.score).toBeGreaterThanOrEqual(shown[i - 1]!.difficulty.score);
  });

  it('leaves ten-finger scores as the engine made them', () => {
    const shown = presentSuggestions(suggestions, 'ten-finger', 'strength');
    expect(new Set(shown.map((s) => s.difficulty))).toEqual(new Set(suggestions.map((s) => s.difficulty)));
  });
});
