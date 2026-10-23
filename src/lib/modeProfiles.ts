// The options that suit each typing mode. Picking a mode fills these in
// (as a draft, like a site preset); the site's rules, the number of
// suggestions and the swap mappings are never touched. Some options have no
// meaning in a mode (two index fingers have no pinky): the profile sets
// them to their neutral value and the form disables them, with the reason.
// The generator never reads the mode: it reads these options.

import { comfortLabel } from './choices';
import { TYPING_MODES, type TypingMode } from './difficulty';
import { DEFAULT_REQUIREMENTS, STRENGTH_PRESETS, type Requirements } from './generate';
import type { Comfort } from './grammar';
import { settleRules, type Settled } from './sitePresets';

/** The options a mode sets, in the order the Scoring page lists them. */
export const PROFILE_KEYS = [
  'targetBits',
  'shortest',
  'comfort',
  'avoidPinkyStretch',
  'shiftReach',
  'easeSwaps',
  'separator',
  'includeNumber',
  'twists',
  'initials',
  'shorthand',
  'madeUp',
  'glue',
] as const satisfies readonly (keyof Requirements)[];
export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type ProfileFields = Pick<Requirements, ProfileKey>;

/** A profile's separator: Automatic, or a space where the site allows one (else Automatic). */
export type ProfileSeparator = 'auto' | 'space-if-allowed';
export type ProfileValues = Omit<ProfileFields, 'separator'> & { separator: ProfileSeparator };

export interface Unused {
  key: ProfileKey;
  /** Why the option has no meaning in the mode, for the form's hint. */
  reason: string;
}

export interface ModeProfile {
  values: ProfileValues;
  unused: readonly Unused[];
}

export const PROFILE_LABELS: Record<ProfileKey, string> = {
  targetBits: 'Strength target',
  shortest: 'Shortest that meets the target',
  comfort: 'Typing comfort',
  avoidPinkyStretch: 'Avoid pinky stretches',
  shiftReach: 'Keep Shift within reach',
  easeSwaps: 'Ease awkward words with deliberate swaps',
  separator: 'Separator',
  includeNumber: 'Include a number',
  twists: 'Minimum swaps',
  initials: 'Capital initials',
  shorthand: 'Two-letter words',
  madeUp: 'Made-up nouns',
  glue: 'Glue',
};

const d = DEFAULT_REQUIREMENTS;
/** Ten-finger is exactly the defaults: nothing changes for anyone who never picks a mode. */
const TEN_FINGER: ProfileValues = {
  targetBits: d.targetBits,
  shortest: d.shortest,
  comfort: d.comfort,
  avoidPinkyStretch: d.avoidPinkyStretch,
  shiftReach: d.shiftReach,
  easeSwaps: d.easeSwaps,
  separator: 'auto',
  includeNumber: d.includeNumber,
  twists: d.twists,
  initials: d.initials,
  shorthand: d.shorthand,
  madeUp: d.madeUp,
  glue: d.glue,
};

/** The smallest strength preset: just the site's rules, for Minimal-quick. */
export const MINIMAL_BITS = Math.min(...STRENGTH_PRESETS.map((p) => p.bits));

// Each value below was kept only if it lowered the mode's mean difficulty in
// its own rubric at the Typical site rules (600 suggestions, seeded; see the
// measurement in modeProfiles.test.ts) with bits at or above the target and
// memorability holding up. No mode uses made-up nouns: they are left to the
// user to choose (decided 2026-10-22, first asked for by Dossier). Findings: a space separator (thumb, no travel)
// beats ";" for two fingers, one hand and quick typing alike; a two-letter
// word and glue help two fingers; capital initials helped two fingers only
// beside a made-up noun, and glue helped Minimal-quick only with them, so
// both went with the made-up nouns; strict comfort costs two fingers length
// (smaller pools, longer sentences for the target) but suits one hand; a
// minimum of one swap keeps the cards in a batch different.
export const MODE_PROFILES: Record<TypingMode, ModeProfile> = {
  'ten-finger': { values: TEN_FINGER, unused: [] },
  'two-finger': {
    values: { ...TEN_FINGER, avoidPinkyStretch: false, easeSwaps: false, separator: 'space-if-allowed', twists: 1, shorthand: 1, glue: true },
    unused: [
      { key: 'avoidPinkyStretch', reason: 'Two index fingers have no pinky to stretch.' },
      { key: 'easeSwaps', reason: 'The awkward moves these swaps remove, same-finger jumps and long reaches, are for ten fingers on the home row.' },
    ],
  },
  'one-handed': {
    values: { ...TEN_FINGER, comfort: 'strict', shiftReach: true, separator: 'space-if-allowed', twists: 1, shorthand: 1, glue: true },
    unused: [],
  },
  quick: {
    values: { ...TEN_FINGER, targetBits: MINIMAL_BITS, shortest: true, comfort: 'strict', separator: 'space-if-allowed', includeNumber: false, twists: 1 },
    unused: [],
  },
};

/** A mode's option values under these rules: the separator resolved by whether the site allows spaces. */
export function profileValues(mode: TypingMode, req: Pick<Requirements, 'allowSpaces'>): ProfileFields {
  const { separator, ...rest } = MODE_PROFILES[mode].values;
  return { ...rest, separator: separator === 'space-if-allowed' && req.allowSpaces ? ' ' : 'auto' };
}

/** The requirements with a mode's options in place, settled like a preset so the form never contradicts itself. */
export function withProfile(req: Requirements, mode: TypingMode): Settled {
  return settleRules({ ...req, ...profileValues(mode, req) }, new Set<keyof Requirements>(PROFILE_KEYS));
}

/** True while the options still hold what the mode set. */
export function matchesProfile(req: Requirements, mode: TypingMode): boolean {
  const values = profileValues(mode, req);
  return PROFILE_KEYS.every((key) => req[key] === values[key]);
}

/** The options that have no meaning in a mode, with the reason. */
export const unusedIn = (mode: TypingMode): readonly Unused[] => MODE_PROFILES[mode].unused;


/** How a profile's value reads in the Scoring page's table; "—" for an option the mode does not use. */
export function formatProfileValue(key: ProfileKey, mode: TypingMode): string {
  if (unusedIn(mode).some((u) => u.key === key)) return '—';
  const value = MODE_PROFILES[mode].values[key];
  switch (key) {
    case 'targetBits': {
      const preset = STRENGTH_PRESETS.find((p) => p.bits === value);
      return preset ? `${value} bits (${preset.label})` : `${value} bits`;
    }
    case 'comfort':
      return comfortLabel(value as Comfort);
    case 'separator':
      return value === 'space-if-allowed' ? 'Space if allowed, else Auto' : 'Auto';
    case 'initials':
    case 'shorthand':
    case 'madeUp':
      return value === 0 ? 'None' : String(value);
    case 'twists':
      return String(value);
    default:
      return value ? 'On' : 'Off';
  }
}

export interface ModeMeasure {
  /** Mean difficulty in the mode's own rubric. */
  difficulty: number;
  /** The same passwords scored ten-finger, for comparison. */
  tenFinger: number;
  bits: number;
  memorability: number;
  length: number;
}

/**
 * What each mode's options measure at the Typical site rules: the means
 * over `n` suggestions per mode, from the measurement in
 * modeProfiles.test.ts (`pnpm measure:modes` reruns it and prints the
 * figures to paste here). `defaults` is the ten-finger options scored in
 * each mode, the yardstick a profile has to beat.
 */
export const MODE_MEASURES: {
  asOf: string;
  n: number;
  rules: string;
  defaults: Record<TypingMode, number>;
  byMode: Record<TypingMode, ModeMeasure>;
} = {
  asOf: '2026-10-22',
  n: 600,
  rules: 'Typical site',
  defaults: { 'two-finger': 55.3, 'ten-finger': 41.6, 'one-handed': 53.5, quick: 49.8 },
  byMode: {
    'two-finger': { difficulty: 38.6, tenFinger: 33.2, bits: 41.4, memorability: 73.8, length: 25.4 },
    'ten-finger': { difficulty: 41.6, tenFinger: 41.6, bits: 42.7, memorability: 73.7, length: 28.7 },
    'one-handed': { difficulty: 38, tenFinger: 29.3, bits: 44.9, memorability: 68.9, length: 30.3 },
    quick: { difficulty: 38.2, tenFinger: 23, bits: 17.4, memorability: 93, length: 16 },
  },
};

/** A mode's label, for tables and hints. */
export const modeLabel = (mode: TypingMode) => TYPING_MODES.find((m) => m.id === mode)!.label;
