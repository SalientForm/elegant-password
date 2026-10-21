// "Test a password": record every keystroke as it is typed, with its time,
// and turn the run into a result when Enter is pressed. The first run sets
// the password being tested (the text in the field at Enter); later runs
// are checked against it. With the lock on, the target never changes, even
// if Enter is pressed on a mistyped attempt. Nothing here is stored.

export interface KeyPress {
  /** The key as the browser names it: a character, "Backspace", "Delete", ... */
  key: string;
  /** Milliseconds, from any monotonic clock. */
  at: number;
}

export interface Recording {
  keys: KeyPress[];
}

export interface Attempt {
  /** The password this attempt was checked against. */
  target: string;
  /** What the field held when Enter was pressed. */
  typed: string;
  matched: boolean;
  /** From the first keystroke to Enter. */
  seconds: number;
  /** Keys pressed, Enter excluded, corrections included. */
  keystrokes: number;
  /** Backspace and Delete presses. */
  corrections: number;
  /** Characters typed per second, over the final text. */
  charsPerSecond: number;
  /** Words per minute at five characters a word. */
  wpm: number;
  /** Share of keystrokes that were not corrections or corrected characters (0-1). */
  accuracy: number;
}

export const CORRECTION_KEYS = new Set(['Backspace', 'Delete']);

/** Keys that are not typing: modifiers, navigation, AltGr, dead and IME keys, function keys. Every named key except Backspace and Delete, which are corrections. */
const ignored = (key: string) => key.length > 1 && key !== 'Backspace' && key !== 'Delete';

export const startRecording = (): Recording => ({ keys: [] });

/** Record a key press; returns the same recording for convenience. Ignores modifiers and Enter. */
export function recordKey(recording: Recording, key: string, at: number): Recording {
  if (key === 'Enter' || ignored(key)) return recording;
  recording.keys.push({ key, at });
  return recording;
}

/**
 * Keys a soft keyboard reports when it does not say which key was pressed
 * (Android's keyboards send "Unidentified", or "Process" while composing).
 * For those the typing is read from how the field's text changed instead
 * (recordChange).
 */
export const UNNAMED_KEYS: ReadonlySet<string> = new Set(['Unidentified', 'Process']);

/**
 * Record a change to the field's text that no named key explains: each
 * character taken out as a Backspace, each one put in as its key. A soft
 * keyboard composing a word sends the whole word again with every letter,
 * so the change is worked out from the text before and after, not from the
 * event, and each letter is counted once.
 */
export function recordChange(recording: Recording, before: string, after: string, at: number): Recording {
  const a = [...before];
  const b = [...after];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  for (let i = 0; i < a.length - start - end; i++) recordKey(recording, 'Backspace', at);
  for (const c of b.slice(start, b.length - end)) recordKey(recording, c, at);
  return recording;
}

/**
 * The password to test from pasted text, exactly as pasted: spaces at
 * either end are part of it. One line break at the end (copying a whole
 * line brings one) is dropped; a paste of more than one line is refused,
 * since a password is one line, and so are spaces alone (a slip, not a
 * password) and anything longer than `maxLength`. Nothing pasted: undefined.
 */
export function pastedTarget(text: string, maxLength: number): { password: string } | { problem: string } | undefined {
  const line = text.replace(/\r?\n$/, '');
  if (line === '') return undefined;
  if (!line.trim()) return { problem: 'Not set: the pasted text is only spaces.' };
  if (/[\r\n]/.test(line)) return { problem: 'Not set: the pasted text has more than one line. A password is one line; copy just the password and paste again.' };
  if ([...line].length > maxLength) return { problem: `Not set: the pasted text is longer than ${maxLength} characters.` };
  return { password: line };
}

/**
 * Turn a recording into a result. `typed` is the field's text at Enter,
 * `target` the password being tested (use `typed` itself for a first run),
 * `at` the time of Enter.
 */
export function finishAttempt(recording: Recording, typed: string, target: string, at: number): Attempt {
  const keys = recording.keys;
  const first = keys[0]?.at ?? at;
  const seconds = Math.max(0, (at - first) / 1000);
  const corrections = keys.filter((k) => CORRECTION_KEYS.has(k.key)).length;
  const keystrokes = keys.length;
  const length = [...typed].length;
  const charsPerSecond = seconds > 0 ? length / seconds : 0;
  const good = Math.max(0, keystrokes - 2 * corrections);
  return {
    target,
    typed,
    matched: typed === target,
    seconds,
    keystrokes,
    corrections,
    charsPerSecond,
    wpm: seconds > 0 ? (length / 5) / (seconds / 60) : 0,
    accuracy: keystrokes > 0 ? good / keystrokes : 1,
  };
}

/**
 * Which password the next run is checked against. Unlocked: whatever was
 * just entered becomes the target. Locked: the target stays, mistakes or
 * not. Before any run, the first entry is the target either way.
 */
export function nextTarget(current: string | undefined, typed: string): string {
  return current || typed;
}
