import { useEffect, useMemo, useRef, useState } from 'react';
import { criterionOf } from '../lib/difficulty';
import { scoreAlone, scoreCold } from '../lib/score';
import { finishAttempt, nextTarget, recordKey, startRecording, type Attempt, type Recording } from '../lib/typingTest';
import { usePasswordsOptional } from '../state/PasswordsProvider';
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
 * scored; a password typed in by hand has no hint, so its strength and
 * difficulty come from the text alone and memorability is not available.
 * Later runs are checked against the target; "Lock password" keeps it even
 * when Enter is pressed on a mistyped run. Nothing leaves this component.
 */
export function TypingTest({ now = () => performance.now(), keep = 5 }: Props) {
  const passwords = usePasswordsOptional();
  const latest = passwords?.selected.at(-1);
  /** The hint for a password we know about: from the list, or from the suggestions on screen. */
  const hintFor = (password: string): string | undefined =>
    passwords?.selected.find((e) => e.password === password)?.hint ??
    (passwords?.outcome?.ok ? passwords.outcome.suggestions.find((s) => s.password === password)?.hint : undefined);
  const [value, setValue] = useState('');
  const [target, setTarget] = useState<string | undefined>(latest?.password);
  const [hint, setHint] = useState<string | undefined>(latest?.hint);
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [shown, setShown] = useState(true);
  const recording = useRef<Recording>(startRecording());
  const input = useRef<HTMLInputElement>(null);
  const lastLatest = useRef(latest?.password);

  // A password just added to the list is the one to practise, hint and all.
  useEffect(() => {
    if (!latest || latest.password === lastLatest.current) return;
    lastLatest.current = latest.password;
    setTarget(latest.password);
    setHint(latest.hint);
    setAttempts([]);
    recording.current = startRecording();
    setValue('');
  }, [latest]);

  const cold = useMemo(() => (target !== undefined && hint !== undefined ? scoreCold(target, hint) : undefined), [target, hint]);
  const alone = useMemo(() => (target !== undefined && hint === undefined ? scoreAlone(target) : undefined), [target, hint]);
  const difficulty = cold?.difficulty ?? alone?.difficulty;
  const last = attempts[0];

  /** Pasting selects a password to test, as adding one from the list does; it is not typed into the field. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').split(/\r?\n/)[0]?.trim() ?? '';
    e.preventDefault();
    if (!pasted) return;
    setTarget(pasted);
    setHint(hintFor(pasted));
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
      const checkAgainst = nextTarget(target, typed, locked);
      const attempt = finishAttempt(recording.current, typed, checkAgainst, at);
      if (checkAgainst !== target) setHint(undefined); // a password typed in by hand has no hint
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
        added to your list, or one you paste here sets the one under test. Nothing is saved.
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
          <input type="checkbox" checked={locked} disabled={!target} onChange={(e) => setLocked(e.target.checked)} />
          Lock password
        </label>
        <label className="check">
          <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
          Show as typed
        </label>
      </div>
      {target !== undefined && difficulty && (
        <div className="typing-result" role="status">
          <p>
            <span className="field-label">Testing:</span> <code className="password">{shown ? target : '•'.repeat([...target].length)}</code>
            {locked && <small> (locked)</small>}
          </p>
          <p className="hint entry-hint">
            <span className="field-label">Hint:</span> {hint ?? '(hint n/a)'}
          </p>
          <div className="actions">
            {cold ? (
              <ScoreBadges bits={cold.bits} difficulty={cold.difficulty} memorability={cold.memorability.score} />
            ) : (
              <ScoreBadges bits={alone!.bits} difficulty={alone!.difficulty} />
            )}
          </div>
          {last && (
            <ul className="typing-stats">
              <li className={last.matched ? 'met' : 'unmet'}>
                {last.matched ? 'Typed correctly' : 'Did not match the password under test'}
              </li>
              <li>
                {last.seconds.toFixed(1)} s for {[...last.typed].length} characters ({last.wpm.toFixed(0)} wpm); the model expected
                about {criterionOf('seconds').format(difficulty.measurements.seconds)}
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
