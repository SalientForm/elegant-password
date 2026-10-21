// Difficulty rubric: scores how hard a password is to type and carry in your
// head, from 0 (effortless) to 100 (hard).
//
// Each criterion measures one thing and lands on a level from 0 to 4 using
// fixed cut-points. A criterion's points are weight x level / 4, and the
// weights add up to 100. Cut-points were calibrated on generated passwords
// so the default settings land in the easy-to-moderate range.
//
// The typing mode is the context the password is typed in: ten fingers on
// the home row (the standard rubric), two fingers hunting for keys, one hand
// while the other is busy, or as fast as possible. Each mode has
// its own weights, cut-points and typing-time model, so the same password
// scores differently in each; a score is a pure function of the password,
// its memory load and the mode.

import { isFarShift, isPinkyStretch, isRoll, pressFor, transitionCost, type Key } from './keyboard';

export const LEVELS = ['Effortless', 'Easy', 'Moderate', 'Demanding', 'Hard'] as const;
export type Level = 0 | 1 | 2 | 3 | 4;
/** The top level, Hard: a criterion's points are weight x level / MAX_LEVEL. */
export const MAX_LEVEL = (LEVELS.length - 1) as Level;

export interface Measurements {
  characters: number;
  seconds: number;
  averageReach: number;
  rowJumpShare: number;
  sameFingerPer10: number;
  rollShare: number;
  shiftAndCase: number;
  farShifts: number;
  offLetterKeys: number;
  pinkyStretches: number;
  chunks: number;
}

export interface Criterion {
  id: keyof Measurements;
  name: string;
  measures: string;
  weight: number;
  /**
   * Level boundaries. Normally a value at or above cutPoints[i] reaches level
   * i + 1; when `higherIsEasier`, a value at or below it does.
   */
  cutPoints: readonly [number, number, number, number];
  higherIsEasier?: boolean;
  format: (value: number) => string;
}

const TWO_FINGER_SECONDS_CUTS = [8, 11, 14, 18] as const;
const ONE_HAND_SECONDS_CUTS = [7, 10, 13, 17] as const;
const QUICK_ROW_CUTS = [0.45, 0.55, 0.65, 0.75] as const;
const QUICK_ROLL_CUTS = [0.3, 0.2, 0.12, 0.05] as const;

const fixed = (digits: number, unit = '') => (v: number) => `${v.toFixed(digits)}${unit}`;
const percent = (v: number) => `${Math.round(v * 100)}%`;

export type TypingMode = 'two-finger' | 'ten-finger' | 'one-handed' | 'quick';

export const TYPING_MODES: readonly { id: TypingMode; label: string; hint: string }[] = [
  {
    id: 'two-finger',
    label: 'Two-finger',
    hint: 'One finger of each hand looks for every key: length, travel and symbols count most; rolls and same-finger moves no longer matter.',
  },
  { id: 'ten-finger', label: 'Ten-finger', hint: 'Touch typing, both hands on the home row: the standard rubric.' },
  {
    id: 'one-handed',
    label: 'One-handed',
    hint: 'One hand on the keyboard. That hand holds Shift too, so each capital or symbol counts, and one more than 4 keys from either Shift key counts most.',
  },
  {
    id: 'quick',
    label: 'Minimal-quick',
    hint: 'As fast as possible: rolls along a row and staying on it (“dadsad”, “you;poop”) count most, and every row jump costs.',
  },
];
/** A mode's label; a score stored before modes existed was ten-finger. */
export const typingModeLabel = (mode: TypingMode = DEFAULT_TYPING_MODE) => TYPING_MODES.find((m) => m.id === mode)!.label;
export const TYPING_MODE_IDS: readonly TypingMode[] = TYPING_MODES.map((m) => m.id);
export const DEFAULT_TYPING_MODE: TypingMode = 'ten-finger';

/** What each criterion measures and how it reads; the weight and cut-points come from the mode. */
const CRITERIA: Record<keyof Measurements, Omit<Criterion, 'weight' | 'cutPoints'>> = {
  characters: { id: 'characters', name: 'Size', measures: 'Total characters to type', format: fixed(0) },
  seconds: { id: 'seconds', name: 'Speed', measures: 'Estimated seconds for an average typist, from key travel and Shift', format: fixed(1, ' s') },
  averageReach: { id: 'averageReach', name: 'Reach', measures: 'Average distance between consecutive keys, in key widths', format: fixed(1) },
  rowJumpShare: { id: 'rowJumpShare', name: 'Row jumps', measures: 'Share of key-to-key moves that change keyboard row', format: percent },
  rollShare: {
    id: 'rollShare',
    name: 'Finger rolls',
    measures: 'Share of moves that roll to the neighbouring key on the same row, like a-s-d-f (more is easier)',
    higherIsEasier: true,
    format: percent,
  },
  sameFingerPer10: { id: 'sameFingerPer10', name: 'Same finger', measures: 'One finger moving between rows (like e-d), per 10 keystrokes', format: fixed(1) },
  shiftAndCase: { id: 'shiftAndCase', name: 'Shift & case', measures: 'Shift presses plus twice the number of case flips', format: fixed(0) },
  farShifts: {
    id: 'farShifts',
    name: 'One-hand Shift',
    measures: 'Capitals and symbols more than 4 keys from both Shift keys, out of reach of the hand holding Shift',
    format: fixed(0),
  },
  offLetterKeys: { id: 'offLetterKeys', name: 'Off-letter keys', measures: 'Digits and symbols, which pull the hands off the letters', format: fixed(0) },
  pinkyStretches: { id: 'pinkyStretches', name: 'Pinky stretches', measures: 'Keys more than one key from where a pinky rests', format: fixed(0) },
  chunks: {
    id: 'chunks',
    name: 'Memory load',
    measures: 'Things to remember: words, the number and each random swap (a deliberate swap comes with its word)',
    format: fixed(0),
  },
};

type Weighting = Pick<Criterion, 'weight' | 'cutPoints'> & { measures?: string };

/** Each mode's criteria, in display order, with their weights (adding up to 100) and cut-points. */
const WEIGHTINGS: Record<TypingMode, Partial<Record<keyof Measurements, Weighting>>> = {
  'ten-finger': {
    characters: { weight: 15, cutPoints: [20, 32, 44, 56] },
    seconds: { weight: 15, cutPoints: [5, 8, 11, 15] },
    averageReach: { weight: 10, cutPoints: [2.6, 3.1, 3.6, 4.2] },
    rowJumpShare: { weight: 10, cutPoints: [0.5, 0.6, 0.7, 0.8] },
    rollShare: { weight: 10, cutPoints: [0.3, 0.2, 0.12, 0.05] },
    sameFingerPer10: { weight: 10, cutPoints: [0.4, 0.8, 1.2, 1.8] },
    shiftAndCase: { weight: 10, cutPoints: [2, 4, 6, 9] },
    offLetterKeys: { weight: 10, cutPoints: [3, 6, 9, 12] },
    pinkyStretches: { weight: 5, cutPoints: [1, 3, 6, 9] },
    chunks: { weight: 5, cutPoints: [6, 8, 10, 13] },
  },
  'two-finger': {
    characters: { weight: 25, cutPoints: [20, 28, 36, 48] },
    seconds: { weight: 25, cutPoints: TWO_FINGER_SECONDS_CUTS, measures: 'Estimated seconds hunting for each key with one finger of each hand, from finger travel and Shift' },
    averageReach: { weight: 15, cutPoints: [2.6, 3.1, 3.6, 4.2] },
    rowJumpShare: { weight: 5, cutPoints: [0.5, 0.6, 0.7, 0.8] },
    shiftAndCase: { weight: 10, cutPoints: [2, 4, 6, 9] },
    offLetterKeys: { weight: 15, cutPoints: [2, 4, 7, 10] },
    chunks: { weight: 5, cutPoints: [6, 8, 10, 13] },
  },
  'one-handed': {
    characters: { weight: 15, cutPoints: [16, 24, 32, 44] },
    seconds: { weight: 10, cutPoints: ONE_HAND_SECONDS_CUTS, measures: 'Estimated seconds typing with one hand, from hand travel and Shift' },
    averageReach: { weight: 15, cutPoints: [2.6, 3.1, 3.6, 4.2] },
    rollShare: { weight: 5, cutPoints: [0.3, 0.2, 0.12, 0.05] },
    shiftAndCase: { weight: 15, cutPoints: [1, 2, 4, 6] },
    farShifts: { weight: 20, cutPoints: [1, 2, 3, 4] },
    offLetterKeys: { weight: 15, cutPoints: [2, 4, 7, 10] },
    chunks: { weight: 5, cutPoints: [6, 8, 10, 13] },
  },
  quick: {
    characters: { weight: 10, cutPoints: [20, 32, 44, 56] },
    seconds: { weight: 10, cutPoints: [5, 8, 11, 15] },
    averageReach: { weight: 5, cutPoints: [2.6, 3.1, 3.6, 4.2] },
    rowJumpShare: { weight: 25, cutPoints: QUICK_ROW_CUTS },
    rollShare: { weight: 25, cutPoints: QUICK_ROLL_CUTS },
    sameFingerPer10: { weight: 10, cutPoints: [0.4, 0.8, 1.2, 1.8] },
    shiftAndCase: { weight: 5, cutPoints: [2, 4, 6, 9] },
    offLetterKeys: { weight: 5, cutPoints: [3, 6, 9, 12] },
    pinkyStretches: { weight: 5, cutPoints: [1, 3, 6, 9] },
  },
};

const rubricFor = (mode: TypingMode): Criterion[] =>
  Object.entries(WEIGHTINGS[mode]).map(([id, w]) => ({ ...CRITERIA[id as keyof Measurements], ...w }));

export const RUBRICS: Record<TypingMode, readonly Criterion[]> = {
  'two-finger': rubricFor('two-finger'),
  'ten-finger': rubricFor('ten-finger'),
  'one-handed': rubricFor('one-handed'),
  quick: rubricFor('quick'),
};

/** The standard rubric: ten-finger touch typing. */
export const RUBRIC: readonly Criterion[] = RUBRICS[DEFAULT_TYPING_MODE];

/** One criterion's result. Refers to the criterion by id so a score is plain data that can be stored. */
export interface CriterionScore {
  id: keyof Measurements;
  value: number;
  level: Level;
  points: number;
}

/** The rubric entry a score refers to, in a mode. */
export function criterionOf(id: keyof Measurements, mode: TypingMode = DEFAULT_TYPING_MODE): Criterion {
  return RUBRICS[mode].find((c) => c.id === id) ?? { ...CRITERIA[id], weight: 0, cutPoints: [0, 0, 0, 0] };
}

export interface Difficulty {
  /** The typing mode scored for; absent on scores stored before modes existed, which were ten-finger. */
  mode?: TypingMode;
  score: number;
  level: Level;
  label: (typeof LEVELS)[number];
  criteria: CriterionScore[];
  measurements: Measurements;
}

// Typing-time model: a base time per keystroke plus a share of the travel
// cost, plus extra time for each Shift. About 55-60 wpm on easy text.
export const SECONDS = { keystroke: 0.12, perCost: 0.05, shift: 0.12 } as const;
/**
 * Two fingers, one per hand, each looking for its key: a longer base time
 * per key, plus each finger's own travel from the last key it pressed (from
 * F and J at the start), plus Shift pressed by the other finger.
 */
export const TWO_FINGER_SECONDS = { keystroke: 0.3, perKey: 0.08, shift: 0.35 } as const;
/**
 * One hand: a base time per key, plus the hand's travel from key to key (a
 * roll or a repeat travels least), plus Shift held by the same hand, which
 * takes a regrip for a key out of its reach.
 */
export const ONE_HAND_SECONDS = { keystroke: 0.2, perKey: 0.07, shift: 0.25, farShift: 0.8 } as const;

const hypot = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Seconds to type the presses in a mode, on that mode's time model. */
function secondsFor(presses: readonly { key: Key; shifted: boolean; char: string }[], mode: TypingMode): number {
  if (mode === 'two-finger') {
    const at = { L: pressFor('f').key, R: pressFor('j').key };
    let seconds = presses.length * TWO_FINGER_SECONDS.keystroke;
    for (const { key, shifted } of presses) {
      if (shifted) seconds += TWO_FINGER_SECONDS.shift;
      if (key.finger === 8) continue; // a thumb, or either finger, takes the space bar without moving off its keys
      const hand = key.finger <= 3 ? 'L' : 'R';
      seconds += hypot(at[hand], key) * TWO_FINGER_SECONDS.perKey;
      at[hand] = key;
    }
    return seconds;
  }
  if (mode === 'one-handed') {
    let at = pressFor('f').key;
    let seconds = presses.length * ONE_HAND_SECONDS.keystroke;
    for (const { key, shifted, char } of presses) {
      if (shifted) seconds += isFarShift(char) ? ONE_HAND_SECONDS.farShift : ONE_HAND_SECONDS.shift;
      if (key.finger === 8) continue;
      seconds += (isRoll(at, key) ? 0.5 : hypot(at, key)) * ONE_HAND_SECONDS.perKey;
      at = key;
    }
    return seconds;
  }
  let seconds = presses.length * SECONDS.keystroke;
  for (let i = 1; i < presses.length; i++) seconds += transitionCost(presses[i - 1]!.key, presses[i]!.key) * SECONDS.perCost;
  return seconds + presses.filter((p) => p.shifted).length * SECONDS.shift;
}

export function measure(password: string, chunks: number, mode: TypingMode = DEFAULT_TYPING_MODE): Measurements {
  const presses = [...password].map((c) => {
    return { ...pressFor(c), char: c };
  });

  let reach = 0;
  let moves = 0;
  let rowJumps = 0;
  let sameFinger = 0;
  let rolls = 0;
  for (let i = 1; i < presses.length; i++) {
    const a = presses[i - 1]!.key;
    const b = presses[i]!.key;
    if (a.finger === 8 || b.finger === 8) continue; // thumb on space
    moves++;
    reach += hypot(a, b);
    if (a.y !== b.y) rowJumps++;
    if (isRoll(a, b)) rolls++;
    else if (a !== b && a.finger === b.finger) sameFinger++;
  }
  const shifts = presses.filter((p) => p.shifted).length;

  let caseFlips = 0;
  let last: boolean | undefined;
  for (const { char } of presses) {
    if (!/[a-z]/i.test(char)) continue;
    const upper = char !== char.toLowerCase();
    if (last !== undefined && upper !== last) caseFlips++;
    last = upper;
  }

  return {
    characters: presses.length,
    seconds: secondsFor(presses, mode),
    averageReach: moves ? reach / moves : 0,
    rowJumpShare: moves ? rowJumps / moves : 0,
    sameFingerPer10: presses.length ? (sameFinger * 10) / presses.length : 0,
    rollShare: moves ? rolls / moves : 0,
    shiftAndCase: shifts + 2 * caseFlips,
    farShifts: presses.filter((p) => isFarShift(p.char)).length,
    offLetterKeys: presses.filter((p) => /[^a-z ]/i.test(p.char)).length,
    pinkyStretches: presses.filter((p) => isPinkyStretch(p.char)).length,
    chunks,
  };
}

export function levelFor(value: number, cutPoints: Criterion['cutPoints'], higherIsEasier = false): Level {
  let level = 0;
  for (const cut of cutPoints) if (higherIsEasier ? value <= cut : value >= cut) level++;
  return level as Level;
}

/** Each level spans this many points: 0-20, 21-40, 41-60, 61-80, 81-100. */
export const LEVEL_WIDTH = 20;

/** The totals a level covers: 0-20 for Effortless, 21-40 for Easy, up to 81-100 for Hard. */
export const levelRange = (level: Level) => ({ min: level === 0 ? 0 : level * LEVEL_WIDTH + 1, max: (level + 1) * LEVEL_WIDTH });

export function overallLevel(score: number): Level {
  return Math.min(4, Math.floor(score / (LEVEL_WIDTH + 0.0001))) as Level;
}

/** Score a password against a mode's rubric. `chunks` is how many pieces there are to remember. */
export function scoreDifficulty(password: string, chunks: number, mode: TypingMode = DEFAULT_TYPING_MODE): Difficulty {
  const measurements = measure(password, chunks, mode);
  const criteria = RUBRICS[mode].map((criterion) => {
    const value = measurements[criterion.id];
    const level = levelFor(value, criterion.cutPoints, criterion.higherIsEasier);
    return { id: criterion.id, value, level, points: (criterion.weight * level) / 4 };
  });
  const score = Math.round(criteria.reduce((sum, c) => sum + c.points, 0));
  const level = overallLevel(score);
  return { mode, score, level, label: LEVELS[level], criteria, measurements };
}

/**
 * The same password's difficulty in another typing mode. The memory load
 * carries over from the score given, so a password scored once (cold, from
 * its hint) can be shown in whichever mode is chosen without scoring again.
 */
export function difficultyIn(password: string, difficulty: Difficulty, mode: TypingMode): Difficulty {
  if ((difficulty.mode ?? DEFAULT_TYPING_MODE) === mode) return difficulty;
  return scoreDifficulty(password, difficulty.measurements.chunks, mode);
}
