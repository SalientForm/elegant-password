// Difficulty rubric: scores how hard a password is to type and carry in your
// head, from 0 (effortless) to 100 (hard).
//
// Each criterion measures one thing and lands on a level from 0 to 4 using
// fixed cut-points. A criterion's points are weight x level / 4, and the
// weights add up to 100. Cut-points were calibrated on generated passwords
// so the default settings land in the easy-to-moderate range.

import { isPinkyStretch, isRoll, lookupKey, transitionCost } from './keyboard';

export const LEVELS = ['Effortless', 'Easy', 'Moderate', 'Demanding', 'Hard'] as const;
export type Level = 0 | 1 | 2 | 3 | 4;

export interface Measurements {
  characters: number;
  seconds: number;
  averageReach: number;
  rowJumpShare: number;
  sameFingerPer10: number;
  rollShare: number;
  shiftAndCase: number;
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

const fixed = (digits: number, unit = '') => (v: number) => `${v.toFixed(digits)}${unit}`;
const percent = (v: number) => `${Math.round(v * 100)}%`;

export const RUBRIC: readonly Criterion[] = [
  {
    id: 'characters',
    name: 'Size',
    measures: 'Total characters to type',
    weight: 15,
    cutPoints: [20, 32, 44, 56],
    format: fixed(0),
  },
  {
    id: 'seconds',
    name: 'Speed',
    measures: 'Estimated seconds for an average typist, from key travel and Shift',
    weight: 15,
    cutPoints: [5, 8, 11, 15],
    format: fixed(1, ' s'),
  },
  {
    id: 'averageReach',
    name: 'Reach',
    measures: 'Average distance between consecutive keys, in key widths',
    weight: 10,
    cutPoints: [2.6, 3.1, 3.6, 4.2],
    format: fixed(1),
  },
  {
    id: 'rowJumpShare',
    name: 'Row jumps',
    measures: 'Share of key-to-key moves that change keyboard row',
    weight: 10,
    cutPoints: [0.5, 0.6, 0.7, 0.8],
    format: percent,
  },
  {
    id: 'rollShare',
    name: 'Finger rolls',
    measures: 'Share of moves that roll to the neighbouring key on the same row, like a-s-d-f (more is easier)',
    weight: 10,
    cutPoints: [0.3, 0.2, 0.12, 0.05],
    higherIsEasier: true,
    format: percent,
  },
  {
    id: 'sameFingerPer10',
    name: 'Same finger',
    measures: 'One finger moving between rows (like e-d), per 10 keystrokes',
    weight: 10,
    cutPoints: [0.4, 0.8, 1.2, 1.8],
    format: fixed(1),
  },
  {
    id: 'shiftAndCase',
    name: 'Shift & case',
    measures: 'Shift presses plus twice the number of case flips',
    weight: 10,
    cutPoints: [2, 4, 6, 9],
    format: fixed(0),
  },
  {
    id: 'offLetterKeys',
    name: 'Off-letter keys',
    measures: 'Digits and symbols, which pull the hands off the letters',
    weight: 10,
    cutPoints: [3, 6, 9, 12],
    format: fixed(0),
  },
  {
    id: 'pinkyStretches',
    name: 'Pinky stretches',
    measures: 'Keys more than one key from where a pinky rests',
    weight: 5,
    cutPoints: [1, 3, 6, 9],
    format: fixed(0),
  },
  {
    id: 'chunks',
    name: 'Memory load',
    measures: 'Things to remember: words, the number and each twist',
    weight: 5,
    cutPoints: [6, 8, 10, 13],
    format: fixed(0),
  },
];

/** One criterion's result. Refers to the criterion by id so a score is plain data that can be stored. */
export interface CriterionScore {
  id: keyof Measurements;
  value: number;
  level: Level;
  points: number;
}

/** The rubric entry a score refers to. */
export function criterionOf(id: keyof Measurements): Criterion {
  return RUBRIC.find((c) => c.id === id)!;
}

export interface Difficulty {
  score: number;
  level: Level;
  label: (typeof LEVELS)[number];
  criteria: CriterionScore[];
  measurements: Measurements;
}

// Typing-time model: a base time per keystroke plus a share of the travel
// cost, plus extra time for each Shift. About 55-60 wpm on easy text.
export const SECONDS = { keystroke: 0.12, perCost: 0.05, shift: 0.12 } as const;

export function measure(password: string, chunks: number): Measurements {
  const presses = [...password].map((c) => {
    const k = lookupKey(c);
    if (!k) throw new Error(`Character ${JSON.stringify(c)} is not on the QWERTY model`);
    return { ...k, char: c };
  });

  let seconds = presses.length * SECONDS.keystroke;
  let reach = 0;
  let moves = 0;
  let rowJumps = 0;
  let sameFinger = 0;
  let rolls = 0;
  for (let i = 1; i < presses.length; i++) {
    const a = presses[i - 1]!.key;
    const b = presses[i]!.key;
    seconds += transitionCost(a, b) * SECONDS.perCost;
    if (a.finger === 8 || b.finger === 8) continue; // thumb on space
    moves++;
    reach += Math.hypot(a.x - b.x, a.y - b.y);
    if (a.y !== b.y) rowJumps++;
    if (isRoll(a, b)) rolls++;
    else if (a !== b && a.finger === b.finger) sameFinger++;
  }
  const shifts = presses.filter((p) => p.shifted).length;
  seconds += shifts * SECONDS.shift;

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
    seconds,
    averageReach: moves ? reach / moves : 0,
    rowJumpShare: moves ? rowJumps / moves : 0,
    sameFingerPer10: presses.length ? (sameFinger * 10) / presses.length : 0,
    rollShare: moves ? rolls / moves : 0,
    shiftAndCase: shifts + 2 * caseFlips,
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

export function overallLevel(score: number): Level {
  return Math.min(4, Math.floor(score / 20.0001)) as Level;
}

/** Score a password against the rubric. `chunks` is how many pieces there are to remember. */
export function scoreDifficulty(password: string, chunks: number): Difficulty {
  const measurements = measure(password, chunks);
  const criteria = RUBRIC.map((criterion) => {
    const value = measurements[criterion.id];
    const level = levelFor(value, criterion.cutPoints, criterion.higherIsEasier);
    return { id: criterion.id, value, level, points: (criterion.weight * level) / 4 };
  });
  const score = Math.round(criteria.reduce((sum, c) => sum + c.points, 0));
  const level = overallLevel(score);
  return { score, level, label: LEVELS[level], criteria, measurements };
}
