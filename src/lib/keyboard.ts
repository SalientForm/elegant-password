// A QWERTY model used to score how quickly a string can be typed.
//
// The scoring rewards what the brief asked for: keys close together and
// runs along the same row. It penalises long reaches, jumps between rows,
// hitting two different keys with the same finger, and pressing Shift.

export type Finger = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // L pinky..R pinky, 8 = thumb

export interface Key {
  /** Base (unshifted) character for this key. */
  base: string;
  x: number;
  y: number; // 0 = number row, 1 = top letters, 2 = home, 3 = bottom, 4 = space
  finger: Finger;
}

interface RowSpec {
  base: string;
  shifted: string;
  offset: number;
}

// Offsets follow a standard staggered board: Tab is 1.5u, Caps 1.75u, Shift 2.25u.
const ROWS: readonly RowSpec[] = [
  { base: '`1234567890-=', shifted: '~!@#$%^&*()_+', offset: 0 },
  { base: 'qwertyuiop[]\\', shifted: 'QWERTYUIOP{}|', offset: 1.5 },
  { base: "asdfghjkl;'", shifted: 'ASDFGHJKL:"', offset: 1.75 },
  { base: 'zxcvbnm,./', shifted: 'ZXCVBNM<>?', offset: 2.25 },
];

const FINGERS: Record<Finger, string> = {
  0: '`1qaz',
  1: '2wsx',
  2: '3edc',
  3: '45rtfgvb',
  4: '67yuhjnm',
  5: '8ik,',
  6: '9ol.',
  7: "0-=p[]\\;'/",
  8: ' ',
};

const fingerOf = (base: string): Finger => {
  for (const [finger, keys] of Object.entries(FINGERS)) {
    if (keys.includes(base)) return Number(finger) as Finger;
  }
  throw new Error(`No finger assigned to key ${JSON.stringify(base)}`);
};

const KEYS = new Map<string, { key: Key; shifted: boolean }>();
for (const [y, row] of ROWS.entries()) {
  [...row.base].forEach((base, i) => {
    const key: Key = { base, x: row.offset + i, y, finger: fingerOf(base) };
    KEYS.set(base, { key, shifted: false });
    KEYS.set(row.shifted[i]!, { key, shifted: true });
  });
}
const SPACE: Key = { base: ' ', x: 6.5, y: 4, finger: 8 };
KEYS.set(' ', { key: SPACE, shifted: false });

/** Keyboard rows for drawing, base characters only. */
export const KEYBOARD_ROWS: readonly { keys: readonly string[]; offset: number }[] = ROWS.map((r) => ({
  keys: [...r.base],
  offset: r.offset,
}));

export function lookupKey(char: string): { key: Key; shifted: boolean } | undefined {
  return KEYS.get(char);
}

/**
 * A character the US layout has no key for (é, £, a tab) is charged as a
 * shifted press of the key furthest from home, since it takes a dead key,
 * AltGr or a compose sequence; scoring never throws on text a user pastes.
 */
export const OFF_MODEL_PRESS: { key: Key; shifted: boolean } = { key: KEYS.get('`')!.key, shifted: true };
export const pressFor = (char: string): { key: Key; shifted: boolean } => KEYS.get(char) ?? OFF_MODEL_PRESS;

// Where each pinky rests on the home row.
const PINKY_HOME = { 0: lookupKey('a')!.key, 7: lookupKey(';')!.key } as const;

/** Furthest a pinky may reach from home, in key widths, before it counts as a stretch. */
export const PINKY_REACH = 1.3;

/**
 * True for a key the pinky has to stretch more than one key away from home
 * to reach: the number row and the far-right keys ("1 0 - = ] \\ `" and their
 * Shift symbols). Keys next to home, like "p [ ' /", are fine.
 */
export function isPinkyStretch(char: string): boolean {
  const k = lookupKey(char)?.key;
  if (!k || (k.finger !== 0 && k.finger !== 7)) return false;
  const home = PINKY_HOME[k.finger];
  return Math.hypot(k.x - home.x, k.y - home.y) > PINKY_REACH;
}

// Where a pinky holds each Shift key: the part of the key next to "z" and next to "/".
const SHIFT_KEYS = [
  { x: 1.25, y: 3 },
  { x: 12.25, y: 3 },
] as const;

/** Furthest a key may be from a Shift key, in key widths, for one hand to hold Shift and press it. */
export const ONE_HAND_SHIFT_REACH = 4;

/** Distance in key widths from the nearer Shift key to the key that types `char`. */
export function shiftDistance(char: string): number {
  const k = pressFor(char).key;
  return Math.min(...SHIFT_KEYS.map((s) => Math.hypot(k.x - s.x, k.y - s.y)));
}

/**
 * True for a shifted character one hand cannot type alone: its key is more
 * than four keys from both Shift keys ("T", "H", "%", "&"), so the hand
 * holding Shift cannot reach it. "Z", "Q", "!", "?" and ":" are in reach.
 */
export function isFarShift(char: string): boolean {
  return pressFor(char).shifted && shiftDistance(char) > ONE_HAND_SHIFT_REACH;
}

export const COST = {
  roll: 0.2, // neighbouring key on the same row and hand, e.g. "as", "df", "fg"
  repeat: 0.4, // same key twice, e.g. "ll"
  distance: 0.5, // per key-width of travel
  rowChange: 1.0, // per row crossed
  sameFinger: 2.0, // one finger moving between rows, e.g. "ed"
  thumb: 0.5, // space is hit by the thumb, independent of the fingers
  shift: 1.0, // extra cost for a shifted character
} as const;

/** Cost of moving from one key to the next. Lower is faster. */
const hand = (k: Key) => (k.finger <= 3 ? 'L' : k.finger <= 7 ? 'R' : 'T');

/**
 * A roll: the neighbouring key on the same row, typed by the same hand, like
 * each step of "asdf" or "ert". Includes the index finger's sideways step
 * ("fg", "rt"), which stays on the row and is quick.
 */
export function isRoll(a: Key, b: Key): boolean {
  return a !== b && a.y === b.y && Math.abs(a.x - b.x) === 1 && hand(a) === hand(b) && hand(a) !== 'T';
}

export function transitionCost(a: Key, b: Key): number {
  if (a.finger === 8 || b.finger === 8) return COST.thumb;
  if (a === b) return COST.repeat;
  if (isRoll(a, b)) return COST.roll;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return (
    Math.hypot(dx, dy) * COST.distance +
    Math.abs(dy) * COST.rowChange +
    (a.finger === b.finger ? COST.sameFinger : 0)
  );
}

export interface TypingProfile {
  /** Mean cost per keystroke transition. Lower is faster. */
  averageCost: number;
  /** Mean travel distance between consecutive keys, in key widths. */
  averageDistance: number;
  /** Share of letter-to-letter transitions that stay on one row (0-1). */
  sameRowShare: number;
  shiftPresses: number;
  sameFingerPairs: number;
  /** Share of letter-to-letter moves that are rolls, like "as" or "df" (0-1). */
  rollShare: number;
  /** Times the case flips between letters (always 0 for generated passwords). */
  caseChanges: number;
  rowsUsed: number[];
}

export function typingProfile(text: string): TypingProfile {
  const presses = [...text].map((c) => {
    return pressFor(c);
  });

  let cost = 0;
  let distance = 0;
  let distanceCount = 0;
  let sameRow = 0;
  let rowPairs = 0;
  let sameFinger = 0;
  let rolls = 0;
  for (let i = 1; i < presses.length; i++) {
    const a = presses[i - 1]!.key;
    const b = presses[i]!.key;
    cost += transitionCost(a, b);
    if (a.finger !== 8 && b.finger !== 8) {
      distance += Math.hypot(a.x - b.x, a.y - b.y);
      distanceCount++;
      rowPairs++;
      if (a.y === b.y) sameRow++;
      if (isRoll(a, b)) rolls++;
      else if (a !== b && a.finger === b.finger) sameFinger++;
    }
  }
  const shiftPresses = presses.filter((p) => p.shifted).length;
  cost += shiftPresses * COST.shift;

  let caseChanges = 0;
  let lastCase: 'upper' | 'lower' | undefined;
  for (const c of text) {
    const kind = c >= 'a' && c <= 'z' ? 'lower' : c >= 'A' && c <= 'Z' ? 'upper' : undefined;
    if (!kind) continue;
    if (lastCase && kind !== lastCase) caseChanges++;
    lastCase = kind;
  }

  const transitions = Math.max(1, presses.length - 1);
  return {
    averageCost: cost / transitions,
    averageDistance: distanceCount ? distance / distanceCount : 0,
    sameRowShare: rowPairs ? sameRow / rowPairs : 1,
    shiftPresses,
    sameFingerPairs: sameFinger,
    rollShare: rowPairs ? rolls / rowPairs : 0,
    caseChanges,
    rowsUsed: [...new Set(presses.map((p) => p.key.y))].sort(),
  };
}

/** Mean transition cost inside a single word. Used to rank the word pools. */
export function wordCost(word: string): number {
  return typingProfile(word).averageCost;
}
