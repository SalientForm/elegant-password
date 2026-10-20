import { describe, expect, it } from 'vitest';
import { finishAttempt, nextTarget, recordKey, startRecording } from './typingTest';

/** Type a string one key per `gap` ms, with a mistake and a Backspace where the text has "<". */
function type(text: string, gap = 100, start = 1000) {
  const rec = startRecording();
  let at = start;
  for (const ch of text) {
    at += gap;
    recordKey(rec, ch === '<' ? 'Backspace' : ch, at);
  }
  return { rec, at: at + gap };
}

describe('typing test', () => {
  it('times from the first keystroke to Enter and counts corrections', () => {
    const { rec, at } = type('abx<c'); // a b x Backspace c
    const a = finishAttempt(rec, 'abc', 'abc', at);
    expect(a).toMatchObject({ typed: 'abc', target: 'abc', matched: true, keystrokes: 5, corrections: 1 });
    expect(a.seconds).toBeCloseTo(0.5); // first key to Enter: 4 gaps between 5 keys, plus one more to Enter
    expect(a.charsPerSecond).toBeCloseTo(3 / 0.5);
    expect(a.wpm).toBeCloseTo((3 / 5) / (0.5 / 60));
    expect(a.accuracy).toBeCloseTo(3 / 5); // the wrong key and its removal were wasted
  });

  it('ignores modifiers and Enter, and copes with an empty run', () => {
    const rec = startRecording();
    recordKey(rec, 'Shift', 1);
    recordKey(rec, 'A', 2);
    recordKey(rec, 'Enter', 3);
    recordKey(rec, 'ArrowLeft', 4);
    expect(rec.keys.map((k) => k.key)).toEqual(['A']);
    const empty = finishAttempt(startRecording(), '', '', 50);
    expect(empty).toMatchObject({ seconds: 0, keystrokes: 0, corrections: 0, wpm: 0, accuracy: 1, matched: true });
  });

  it('checks later runs against the target and reports mismatches', () => {
    const { rec, at } = type('abd');
    const a = finishAttempt(rec, 'abd', 'abc', at);
    expect(a.matched).toBe(false);
    expect(a.target).toBe('abc');
  });

  it('locks the target when asked: a mistyped Enter does not replace it', () => {
    expect(nextTarget(undefined, 'first')).toBe('first'); // the first entry is always the target
    expect(nextTarget('first', 'secnod')).toBe('first'); // and it stays, mistyped runs included, until cleared
  });
});

describe('keys that are not typing', () => {
  it('ignores AltGr, dead, IME, function and navigation keys, but counts Backspace and Delete as corrections', () => {
    let rec = startRecording();
    for (const key of ['AltGraph', 'Dead', 'Process', 'Compose', 'Insert', 'NumLock', 'PageUp', 'PageDown', 'F1', 'Unidentified', 'Shift', 'ArrowLeft']) rec = recordKey(rec, key, 10);
    expect(rec.keys).toHaveLength(0);
    rec = recordKey(rec, '@', 20);
    rec = recordKey(rec, 'Backspace', 30);
    rec = recordKey(rec, 'Delete', 40);
    expect(rec.keys.map((k) => k.key)).toEqual(['@', 'Backspace', 'Delete']);
  });
});
