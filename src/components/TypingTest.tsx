import { useMemo, useRef, useState } from 'react';
import { criterionOf } from '../lib/difficulty';
import { scoreAlone } from '../lib/score';
import { finishAttempt, nextTarget, recordKey, startRecording, type Attempt, type Recording } from '../lib/typingTest';

interface Props {
  /** Clock in milliseconds; injectable for tests. */
  now?: () => number;
  /** How many past runs to keep on screen. */
  keep?: number;
}

/** Attributes that tell password managers (Bitwarden, 1Password, LastPass, Dashlane) to ignore the field. */
export const MANAGER_OPT_OUT = { 'data-bwignore': 'true', 'data-1p-ignore': 'true', 'data-lpignore': 'true', 'data-form-type': 'other' } as const;

/**
 * Test a password by typing it. Every keystroke is timed as it is typed, so
 * the first run can be scored too: Enter makes the text in the field the
 * password under test. Later runs are checked against it. "Lock password"
 * keeps that target even when Enter is pressed on a mistyped run. Nothing
 * leaves this component: no storage, no network.
 */
export function TypingTest({ now = () => performance.now(), keep = 5 }: Props) {
  const [value, setValue] = useState('');
  const [target, setTarget] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [shown, setShown] = useState(true);
  const recording = useRef<Recording>(startRecording());
  const input = useRef<HTMLInputElement>(null);

  const score = useMemo(() => (target ? scoreAlone(target) : undefined), [target]);
  const last = attempts[0];
  const estimatedSeconds = score?.difficulty.measurements.seconds;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const at = now();
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Ctrl+Enter here is a run, not "Submit changes"
      const typed = value;
      if (!typed) return;
      const checkAgainst = nextTarget(target, typed, locked);
      const attempt = finishAttempt(recording.current, typed, checkAgainst, at);
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
        Type it and press Enter. Speed and corrections are measured as you type; the first run sets the password under
        test. Nothing is saved.
      </p>
      <input
        ref={input}
        type={shown ? 'text' : 'password'}
        aria-label="Password to test"
        name="typing-test-scratch"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        // Password managers must leave this field alone: it is a typing test, not a login.
        data-bwignore="true"
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        className="mono"
        placeholder="type a password, then Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
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
      {target && score && (
        <div className="typing-result" role="status">
          <p>
            <span className="field-label">Testing:</span> <code className="password">{shown ? target : '•'.repeat([...target].length)}</code>
            {locked && <small> (locked)</small>}
          </p>
          <div className="actions">
            <span className="bits-label" title="Estimated from the text alone: words from this tool's lists count as one pick from the list; other letters count as English-like text">
              ≈{score.bits.toFixed(0)} bits
            </span>
            <span className={`badge level-${score.difficulty.level}`} title="Difficulty score, 0 effortless to 100 hard">
              Difficulty {score.difficulty.score} · {score.difficulty.label.toLowerCase()}
            </span>
          </div>
          {last && (
            <ul className="typing-stats">
              <li className={last.matched ? 'met' : 'unmet'}>
                {last.matched ? 'Typed correctly' : 'Did not match the password under test'}
              </li>
              <li>
                {last.seconds.toFixed(1)} s for {[...last.typed].length} characters ({last.wpm.toFixed(0)} wpm)
                {estimatedSeconds !== undefined ? `; the model expected about ${criterionOf('seconds').format(estimatedSeconds)}` : ''}
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
