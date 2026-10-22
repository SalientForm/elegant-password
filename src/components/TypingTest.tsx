import { useEffect, useMemo, useRef, useState } from 'react';
import { commonPasswordProblem, commonRank } from '../lib/common';
import { criterionOf, DEFAULT_TYPING_MODE, difficultyIn } from '../lib/difficulty';
import { difficultyAlone, scoreCold } from '../lib/score';
import { rawBits, strengthBits } from '../lib/strength';
import { MAX_HINT_LENGTH, plural } from '../lib/text';
import { MAX_LENGTH } from '../lib/validation';
import { finishAttempt, nextTarget, pastedTarget, recordChange, recordKey, startRecording, UNNAMED_KEYS, type Attempt, type Recording } from '../lib/typingTest';
import { usePasswordsOptional } from '../state/PasswordsProvider';
import { timed } from '../state/slow';
import { CancelIcon } from './icons';
import { PasswordText } from './PasswordText';
import { ScoreBadges } from './SuggestionCard';
import { useZxcvbn } from './useZxcvbn';

/** What the slow-work notice names when scoring the password under test takes too long. */
const SCORING = 'Scoring the password under test';

interface Props {
  /** Clock in milliseconds; injectable for tests. */
  now?: () => number;
  /** How many past runs to keep on screen. */
  keep?: number;
}

/**
 * Attributes that tell password managers (Bitwarden, 1Password, LastPass,
 * Dashlane) to ignore the field. On top of that, nothing about the field
 * says "password": its name, id, label and placeholder are about practice,
 * it is never a password-type input (hiding masks the text with CSS), and
 * it sits in no form.
 */
export const MANAGER_OPT_OUT = { 'data-bwignore': 'true', 'data-1p-ignore': 'true', 'data-lpignore': 'true', 'data-form-type': 'other' } as const;

/**
 * Test a password by typing it. Every keystroke is timed as it is typed, so
 * the first run can be scored too: Enter makes the text in the field the
 * password under test. The password most recently added to the list also
 * becomes the one under test, with its hint, so all three badges can be
 * scored; a password typed in by hand has no hint, so its difficulty comes
 * from the text alone and memorability is not available (Strength and Raw
 * never need a hint).
 * "Practise" on a card or a My list entry makes that password the one under
 * test too, with its hint, without adding or removing anything.
 * Later runs are checked against the target until "Clear" drops it, a paste
 * replaces it, another password is added to the list or picked to practise,
 * or the session is forgotten. A hint can be typed in for a password that
 * has none, so memorability can be scored too. A pasted password is kept
 * exactly as pasted, spaces and all. On a soft keyboard that does not name
 * its keys, the typing is read from how the text changes. Nothing leaves
 * this component.
 */
export function TypingTest({ now = () => performance.now(), keep = 5 }: Props) {
  const passwords = usePasswordsOptional();
  const latest = passwords?.selected.at(-1);
  const listSize = passwords?.selected.length ?? 0;
  /** The hint for a password we know about: from the list, or from the suggestions on screen. */
  const hintFor = (password: string): string | undefined =>
    passwords?.selected.find((e) => e.password === password)?.hint ??
    (passwords?.outcome?.ok ? passwords.outcome.suggestions.find((s) => s.password === password)?.hint : undefined);
  const [value, setValue] = useState('');
  const [target, setTarget] = useState<string | undefined>(latest?.password);
  const [hint, setHint] = useState<string | undefined>(latest?.hint);
  /** A hint can only be typed in for a password that arrived without one (typed or pasted after a clear). */
  const [hintEditable, setHintEditable] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [shown, setShown] = useState(true);
  /** Why the last paste did not set a password, until the next paste or run. */
  const [pasteProblem, setPasteProblem] = useState<string | undefined>();
  const recording = useRef<Recording>(startRecording());
  /** The last key down was one the keyboard did not name, so the next change of text is the typing. */
  const unnamed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const lastLatest = useRef(latest?.password);
  const lastSize = useRef(listSize);

  // A password just added to the list is the one to practise, hint and all. Only an addition: removing the
  // last entry must not swap the password under test (and the runs made on it) for an older entry.
  useEffect(() => {
    const grew = listSize > lastSize.current;
    lastSize.current = listSize;
    if (!latest || latest.password === lastLatest.current || !grew) return;
    lastLatest.current = latest.password;
    setTarget(latest.password);
    setHint(latest.hint);
    setHintEditable(false);
    setAttempts([]);
    recording.current = startRecording();
    setValue('');
  }, [latest, listSize]);

  /** Make a password the one under test, with the hint that came with it (none: one may be typed in). */
  const testThis = (password: string, known: string | undefined) => {
    setTarget(password);
    setHint(known);
    setHintEditable(known === undefined);
    setAttempts([]);
    setPasteProblem(undefined);
    recording.current = startRecording();
    setValue('');
  };

  // "Practise" on a card or an entry picks the password to test.
  const practice = passwords?.practice;
  const lastPractice = useRef(practice?.id);
  useEffect(() => {
    if (!practice || practice.id === lastPractice.current) return;
    lastPractice.current = practice.id;
    testThis(practice.password, practice.hint);
    input.current?.focus();
  }, [practice]);

  // Forgetting the session forgets the password under test and the runs on it.
  const epoch = passwords?.sessionEpoch ?? 0;
  const lastEpoch = useRef(epoch);
  useEffect(() => {
    if (epoch === lastEpoch.current) return;
    lastEpoch.current = epoch;
    clear();
  }, [epoch]);

  const hintText = hint?.trim() ? hint.trim() : undefined;
  const cold = useMemo(() => (target !== undefined && hintText !== undefined ? timed(SCORING, () => scoreCold(target, hintText)) : undefined), [target, hintText]);
  /** The password as displayed: masked unless shown. Too long for the column, it ends in an ellipsis and a click shows the whole of it, like My list. */
  const shownTarget = target === undefined ? undefined : shown ? target : '•'.repeat([...target].length);
  const typingMode = passwords?.typingMode ?? DEFAULT_TYPING_MODE;
  const base = useMemo(() => cold?.difficulty ?? (target !== undefined ? timed(SCORING, () => difficultyAlone(target)) : undefined), [cold, target]);
  const difficulty = useMemo(() => (target !== undefined && base ? difficultyIn(target, base, typingMode) : undefined), [target, base, typingMode]);
  /** The figures from the password alone, worked out once per password under test, not on every keystroke. */
  const alone = useMemo(() => (target === undefined ? undefined : timed(SCORING, () => ({ strength: strengthBits(target), raw: rawBits(target), rank: commonRank(target) }))), [target]);
  const last = attempts[0];
  const zxcvbn = useZxcvbn(target, passwords?.selected.find((e) => e.password === target)?.zxcvbn);

  /** Drop the password under test; the next run starts afresh. */
  function clear() {
    setTarget(undefined);
    setHint(undefined);
    setHintEditable(false);
    setAttempts([]);
    setPasteProblem(undefined);
    recording.current = startRecording();
    setValue('');
  }

  /** Pasting selects a password to test, as adding one from the list does; it is not typed into the field. Exactly as pasted, or refused with the reason. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = pastedTarget(e.clipboardData.getData('text'), MAX_LENGTH);
    if (!pasted) return;
    if ('problem' in pasted) return setPasteProblem(pasted.problem);
    testThis(pasted.password, hintFor(pasted.password)); // a known password keeps its hint; an unknown one may be given one
  };

  /** A soft keyboard's typing, read from the change of text when its key down named no key. */
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH);
    if (unnamed.current) recordChange(recording.current, value, next, now());
    unnamed.current = false;
    setValue(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const at = now();
    if (e.nativeEvent.isComposing) {
      unnamed.current = true; // an IME at work: its Enter accepts a candidate, and its text arrives as a change
      return;
    }
    unnamed.current = UNNAMED_KEYS.has(e.key);
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Enter here is a run, not "Submit changes"
      const typed = value;
      if (!typed) return;
      // The password under test stays until cleared: the first run sets it, later runs are checked against it.
      const checkAgainst = nextTarget(target, typed);
      const attempt = finishAttempt(recording.current, typed, checkAgainst, at);
      if (target === undefined) {
        setHint(undefined); // a password typed in by hand has no hint until one is added
        setHintEditable(true);
      }
      setTarget(checkAgainst);
      setPasteProblem(undefined);
      setAttempts((list) => [attempt, ...list].slice(0, keep));
      recording.current = startRecording();
      setValue('');
      return;
    }
    recordKey(recording.current, e.key, at);
  };

  return (
    <section className="panel typing-test" aria-labelledby="typing-test-heading">
      <h2 id="typing-test-heading">Test a password</h2>
      <p className="hint">
        Type it and press Enter. Speed and corrections are measured as you type; the first run, the password you last
        added to your list, one you pick with Practise, or one you paste here (exactly as pasted) sets the one under test
        until you clear it. Nothing is saved.
      </p>
      <input
        ref={input}
        type="text"
        className={shown ? 'mono' : 'mono masked'}
        aria-label="Typing test"
        name="practice-text"
        id="practice-text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        {...MANAGER_OPT_OUT}
        placeholder="type it here, then Enter"
        value={value}
        maxLength={MAX_LENGTH}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {pasteProblem && (
        <p className="warning" role="alert">
          {pasteProblem}
        </p>
      )}
      <div className="typing-test-controls">
        <label className="check">
          <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
          Show as typed
        </label>
      </div>
      {shownTarget !== undefined && difficulty && (
        <div className="typing-result" role="status">
          <div className="testing-row">
            <p>
              <span className="field-label">Testing:</span>{' '}
              <PasswordText password={shownTarget} />
            </p>
            <button type="button" className="icon-button" onClick={clear} aria-label="Clear" title="Clear the password under test">
              <CancelIcon />
            </button>
          </div>
          {hintEditable ? (
            <label className="field inline hint-field">
              <span>Hint</span>
              <input
                type="text"
                aria-label="Hint for the password under test"
                placeholder="none yet: type one to score memorability"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={hint ?? ''}
                maxLength={MAX_HINT_LENGTH}
                onChange={(e) => setHint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.stopPropagation();
                    input.current?.focus();
                  }
                }}
              />
            </label>
          ) : (
            <p className="hint entry-hint">
              <span className="field-label">Hint:</span> {hintText ?? <em>none</em>}
            </p>
          )}
          {alone?.rank !== undefined && (
            <p className="error" role="alert">
              {commonPasswordProblem(alone.rank)}.
            </p>
          )}
          <div className="actions">
            <ScoreBadges strength={alone!.strength} raw={alone!.raw} difficulty={difficulty} {...(zxcvbn ? { zxcvbn } : {})} {...(cold ? { memorability: cold.memorability.score } : {})} />
          </div>
          {last && (
            <ul className="typing-stats">
              <li className={last.matched ? 'met' : 'unmet'}>
                {last.matched ? 'Typed correctly' : 'Did not match the password under test'}
              </li>
              <li>
                {last.seconds.toFixed(1)} s for {[...last.typed].length} characters ({last.wpm.toFixed(0)} wpm); the model expected
                about {criterionOf('seconds', typingMode).format(difficulty.measurements.seconds)}
              </li>
              <li>
                {last.corrections === 0
                  ? 'No corrections'
                  : `${plural(last.corrections, 'correction')} (Backspace or Delete)`}
                , {Math.round(last.accuracy * 100)}% accuracy over {last.keystrokes} keystrokes
              </li>
            </ul>
          )}
          {attempts.length > 1 && (
            <p className="hint">
              Previous runs:{' '}
              {attempts
                .slice(1)
                .map((a) => `${a.seconds.toFixed(1)} s, ${plural(a.corrections, 'fix', 'fixes')}${a.matched ? '' : ', mismatch'}`)
                .join(' · ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
