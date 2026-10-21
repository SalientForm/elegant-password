// How a password's four scores read wherever they are shown: the badge
// label, the figure, its colour band and the full sentence. The web app's
// badges and the CLI's table both print these, so they cannot disagree.

import { typingModeLabel, type Difficulty } from './difficulty';
import { MEMORABILITY_BANDS, STRENGTH_BANDS } from './score';

export type Band = 'high' | 'mid' | 'low';

/** Colour band for a memorability score: green above 75, yellow above 45, red below. */
export const memorabilityLevel = (score: number): Band => (score > MEMORABILITY_BANDS.green ? 'high' : score > MEMORABILITY_BANDS.yellow ? 'mid' : 'low');

/** Colour band for strength in bits: green from 50 bits, yellow from 40, red below. Give it the figure as shown (rounded), so a badge reading 50 is never yellow. */
export const strengthLevel = (bits: number): Band => (bits >= STRENGTH_BANDS.green ? 'high' : bits >= STRENGTH_BANDS.yellow ? 'mid' : 'low');

/** The word for each strength band, the colour said in words. */
export const STRENGTH_WORDS: Record<Band, string> = { high: 'high', mid: 'fair', low: 'low' };

/**
 * The word a strength reads: its band's, never a preset's. The presets are
 * targets for the bits, which assume an attacker who knows this tool;
 * Strength assumes one who does not, so it reads higher and the presets'
 * words would overstate it. Give it the figure as shown, as for the colour.
 */
export const strengthWord = (bits: number) => STRENGTH_WORDS[strengthLevel(bits)];

export interface Reading {
  /** The badge's word: "Strength", "Raw", "Difficulty", "Memorability". */
  label: string;
  /** The figure as shown: "48", "184", "44", "71", or "n/a". */
  value: string;
  /** The colour band; null when there is nothing to colour (Raw, or no hint to compare with). */
  band: Band | null;
  /** The whole reading in a sentence, for a tooltip or a screen reader. */
  text: string;
}

export interface ScoreReadings {
  strength: Reading;
  raw: Reading;
  /** `band` is null: difficulty is coloured by its level (Difficulty.level), not a band. */
  difficulty: Reading & { level: Difficulty['level'] };
  memorability: Reading;
}

export const READING_LABELS = { strength: 'Strength', raw: 'Raw', difficulty: 'Difficulty', memorability: 'Memorability' } as const;

/** The badges in the order they are shown. */
export const READING_ORDER = ['strength', 'raw', 'difficulty', 'memorability'] as const satisfies readonly (keyof ScoreReadings)[];

/** The four readings for a password's scores. `memorability` is undefined when there is no hint to compare with. */
export function scoreReadings({
  strength,
  raw,
  difficulty,
  memorability,
}: {
  strength: number;
  raw: number;
  difficulty: Pick<Difficulty, 'score' | 'level' | 'label' | 'mode'>;
  memorability?: number;
}): ScoreReadings {
  const shown = Math.round(strength);
  return {
    strength: {
      label: READING_LABELS.strength,
      value: String(shown),
      band: strengthLevel(shown),
      text: `Strength ${shown} bits, ${strengthWord(shown)}: for an attacker who knows English and the usual habits but not this tool; from the password alone`,
    },
    raw: {
      label: READING_LABELS.raw,
      value: String(Math.round(raw)),
      band: null,
      text: `Raw ${Math.round(raw)} bits: brute force over the characters used, a repeated character counted once; what a naive meter reads`,
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
