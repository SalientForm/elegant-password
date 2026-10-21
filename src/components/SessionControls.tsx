import { useState } from 'react';
import { usePasswords } from '../state/PasswordsProvider';

/** Where the session is kept, in words. */
const WHERE = {
  saved: 'The passwords on screen and your sentences are kept through a reload of this tab, and gone when it closes.',
  'visit-only': 'The passwords on screen and your sentences are kept in memory only, and gone when this tab reloads or closes.',
  failed: 'The passwords on screen and your sentences could not be saved for a reload (this browser’s storage is full or blocked): a reload loses them.',
} as const;

/**
 * Where this session is kept, and a deliberate way to forget it: the
 * passwords on screen, the made-up sentence and your own sentence, and the
 * password under test, from memory and from this tab's storage. My list and
 * the settings stay; My list has its own Remove all.
 */
export function SessionControls() {
  const { persistence, forgetSession, retrySaving } = usePasswords();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <section className="panel session" aria-labelledby="session-heading">
      <h2 id="session-heading">This session</h2>
      <p className="hint">
        {WHERE[persistence.session]} Forgetting the session clears them and the password under test, and draws a new
        sentence; My list and your settings stay.
      </p>
      <div className="actions">
        <button
          type="button"
          className={confirm ? 'danger' : ''}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            forgetSession();
            setConfirm(false);
            setDone(true);
          }}
          onBlur={() => setConfirm(false)}
        >
          {confirm ? 'Really forget?' : 'Forget this session'}
        </button>
        {persistence.session === 'failed' && (
          <button type="button" className="ghost" onClick={retrySaving}>
            Try saving again
          </button>
        )}
      </div>
      <p className="sr-only" role="status">
        {done ? 'Session forgotten: the passwords, sentences and password under test are cleared.' : ''}
      </p>
    </section>
  );
}
