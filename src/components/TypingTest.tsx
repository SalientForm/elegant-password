import { useEffect, useMemo, useRef, useState } from 'react';
import { criterionOf, DEFAULT_TYPING_MODE, difficultyIn } from '../lib/difficulty';
import { difficultyAlone, scoreCold } from '../lib/score';
import { rawBits, strengthBits } from '../lib/strength';
import { finishAttempt, nextTarget, recordKey, startRecording, type Attempt, type Recording } from '../lib/typingTest';
import { usePasswordsOptional } from '../state/PasswordsProvider';
import { CancelIcon } from './icons';
import { PasswordTip } from './PasswordTip';
import { ScoreBadges } from './SuggestionCard';

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
 * Later runs are checked against the target until "Clear" drops it, a paste
 * replaces it, or another password is added to the list. A hint can be
 * typed in for a password that has none, so memorability can be scored too.
 * Nothing leaves this component.
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
  const recording = useRef<Recording>(startRecording());
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

  const hintText = hint?.trim() ? hint.trim() : undefined;
  const cold = useMemo(() => (target !== undefined && hintText !== undefined ? scoreCold(target, hintText) : undefined), [target, hintText]);
  /** The password as displayed: masked unless shown. Too long for the column, it ends in an ellipsis with the full text as a tip, like My list. */
  const shownTarget = target === undefined ? undefined : shown ? target : '•'.repeat([...target].length);
  const typingMode = passwords?.typingMode ?? DEFAULT_TYPING_MODE;
  const base = useMemo(() => cold?.difficulty ?? (target !== undefined ? difficultyAlone(target) : undefined), [cold, target]);
  const difficulty = useMemo(() => (target !== undefined && base ? difficultyIn(target, base, typingMode) : undefined), [target, base, typingMode]);
  const last = attempts[0];

  /** Drop the password under test; the next run starts afresh. */
  const clear = () => {
    setTarget(undefined);
    setHint(undefined);
    setHintEditable(false);
    setAttempts([]);
    recording.current = startRecording();
    setValue('');
  };

  /** Pasting selects a password to test, as adding one from the list does; it is not typed into the field. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').split(/\r?\n/)[0]?.trim() ?? '';
    e.preventDefault();
    if (!pasted) return;
    const known = hintFor(pasted);
    setTarget(pasted);
    setHint(known);
    setHintEditable(known === undefined); // a known password keeps its hint; an unknown one may be given one
    setAttempts([]);
    recording.current = startRecording();
    setValue('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const at = now();
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Enter here is a run, not "Submit changes"
      const typed = value;
      if (!typed) return;
      // The password under test stays until cleared: the first run sets it, later runs are checked against it.
      const checkAgainst = nextTarget(target, typed, true);
      const attempt = finishAttempt(recording.current, typed, checkAgainst, at);
      if (target === undefined) {
        setHint(undefined); // a password typed in by hand has no hint until one is added
        setHintEditable(true);
      }
      setTarget(checkAgainst);
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
        added to your list, or one you paste here sets the one under test until you clear it. Nothing is saved.
      </p>
      <input
        ref={input}
        type="text"
        className={shown ? 'mono' : 'mono masked'}
        aria-label="Test and practice"
        name="practice-text"
        id="practice-text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        {...MANAGER_OPT_OUT}
        placeholder="type it here, then Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
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
              <PasswordTip password={shownTarget}>
                <code className="password">{shownTarget}</code>
              </PasswordTip>
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
                placeholder="(hint n/a)"
                autoComplete="off"
                spellCheck={false}
                value={hint ?? ''}
                onChange={(e) => setHint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    input.current?.focus();
                  }
                }}
              />
            </label>
          ) : (
            <p className="hint entry-hint">
              <span className="field-label">Hint:</span> {hintText ?? '(hint n/a)'}
            </p>
          )}
          <div className="actions">
            <ScoreBadges strength={strengthBits(target!)} raw={rawBits(target!)} difficulty={difficulty} {...(cold ? { memorability: cold.memorability.score } : {})} />
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
                  : `${last.corrections} correction${last.corrections === 1 ? '' : 's'} (Backspace or Delete)`}
                , {Math.round(last.accuracy * 100)}% accuracy over {last.keystrokes} keystrokes
              </li>
            </ul>
          )}
          {attempts.length > 1 && (
            <p className="hint">
              Previous runs:{' '}
              {attempts
                .slice(1)
                .map((a) => `${a.seconds.toFixed(1)} s, ${a.corrections} fix${a.corrections === 1 ? '' : 'es'}${a.matched ? '' : ', mismatch'}`)
                .join(' · ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
