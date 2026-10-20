// How a password's three scores read wherever they are shown: the badge
// label, the figure, its colour band and the full sentence. The web app's
// badges and the CLI's table both print these, so they cannot disagree.

import { typingModeLabel, type Difficulty } from './difficulty';
import { STRENGTH_PRESETS } from './generate';
import { MEMORABILITY_BANDS, STRENGTH_BANDS } from './score';

export type Band = 'high' | 'mid' | 'low';

/** Colour band for a memorability score: green above 75, yellow above 45, red below. */
export const memorabilityLevel = (score: number): Band => (score > MEMORABILITY_BANDS.green ? 'high' : score > MEMORABILITY_BANDS.yellow ? 'mid' : 'low');

/** Colour band for strength in bits: green from the "Strong" preset up, yellow from "Everyday", red below. */
export const strengthLevel = (bits: number): Band => (bits >= STRENGTH_BANDS.green ? 'high' : bits >= STRENGTH_BANDS.yellow ? 'mid' : 'low');

/** The preset a strength reaches: "master password", "very strong", "strong", "everyday", or "weak" (below the yellow band; the Minimal preset is not a strength). */
export const strengthWord = (bits: number) =>
  [...STRENGTH_PRESETS]
    .filter((p) => p.bits >= STRENGTH_BANDS.yellow)
    .reverse()
    .find((p) => bits >= p.bits)
    ?.label.toLowerCase() ?? 'weak';

export interface Reading {
  /** The badge's word: "Strength", "Difficulty", "Memorability". */
  label: string;
  /** The figure as shown: "48", "44", "71", or "n/a". */
  value: string;
  /** The colour band; null when there is nothing to colour (no hint to compare with). */
  band: Band | null;
  /** The whole reading in a sentence, for a tooltip or a screen reader. */
  text: string;
}

export interface ScoreReadings {
  strength: Reading;
  /** `band` is null: difficulty is coloured by its level (Difficulty.level), not a band. */
  difficulty: Reading & { level: Difficulty['level'] };
  memorability: Reading;
}

export const READING_LABELS = { strength: 'Strength', difficulty: 'Difficulty', memorability: 'Memorability' } as const;

/** The three readings for a password's scores. `memorability` is undefined when there is no hint to compare with. */
export function scoreReadings({
  bits,
  difficulty,
  memorability,
}: {
  bits: number;
  difficulty: Pick<Difficulty, 'score' | 'level' | 'label' | 'mode'>;
  memorability?: number;
}): ScoreReadings {
  return {
    strength: {
      label: READING_LABELS.strength,
      value: bits.toFixed(0),
      band: strengthLevel(bits),
      text: `Strength ${bits.toFixed(0)} bits, ${strengthWord(bits)}; scored from the password and its hint alone`,
    },
    difficulty: {
      label: READING_LABELS.difficulty,
      value: String(difficulty.score),
      band: null,
      level: difficulty.level,
      text: `Difficulty ${difficulty.score}, ${difficulty.label.toLowerCase()} (${typingModeLabel(difficulty.mode).toLowerCase()})`,
    },
    memorability: {
      label: READING_LABELS.memorability,
      value: memorability === undefined ? 'n/a' : String(memorability),
      band: memorability === undefined ? null : memorabilityLevel(memorability),
      text:
        memorability === undefined
          ? 'Memorability needs a hint: it measures how closely the password still looks like its sentence'
          : `Memorability ${memorability} of 100: how closely it still looks like its hint`,
    },
  };
}
