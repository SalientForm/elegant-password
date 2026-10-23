import { useEffect, useRef, useState } from 'react';
import { ZXCVBN_URL, zxcvbnLine } from '../lib/zxcvbnReading';
import { usePasswords } from '../state/PasswordsProvider';
import { ListEntry } from './ListEntry';

/** Where My list is, in words, for each way it can be kept. */
const WHERE = {
  saved: 'kept in this browser’s storage only and never sent anywhere, until you remove them.',
  'visit-only':
    'kept for this visit only: this site’s address is shared with other sites, which could read this browser’s storage, so nothing is saved here until the app has an address of its own.',
  failed: 'meant to be kept in this browser’s storage, but the last save did not work.',
} as const;

/** The user's own short list of chosen passwords with their hints, kept in this browser. */
export function SelectedList() {
  const { selected, removeSelected, clearSelected, persistence, retrySaving, typingMode, practise, zxcvbnFailed } = usePasswords();
  const [confirm, setConfirm] = useState(false);
  // Said once the reading of a password just added is in: what zxcvbn says about it.
  const [announced, setAnnounced] = useState('');
  const added = useRef<string | undefined>(undefined);
  const size = useRef(selected.length);
  useEffect(() => {
    if (selected.length > size.current) added.current = selected.at(-1)?.password;
    size.current = selected.length;
    const entry = selected.find((e) => e.password === added.current);
    if (entry?.zxcvbn) {
      setAnnounced(`Added. ${zxcvbnLine(entry.zxcvbn)}.`);
      added.current = undefined;
    }
  }, [selected]);

  return (
    <section className="panel selected" aria-labelledby="selected-heading">
      <div className="results-head">
        <h2 id="selected-heading">My list</h2>
        {selected.length > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (!confirm) return setConfirm(true);
              clearSelected();
              setConfirm(false);
            }}
            onBlur={() => setConfirm(false)}
          >
            {confirm ? 'Really remove all?' : 'Remove all'}
          </button>
        )}
      </div>
      {persistence.list === 'failed' && (
        <div className="warning storage-failed" role="alert">
          <p>
            My list could not be saved: this browser’s storage is full or blocked. The passwords below last only until this
            tab closes; copy any you need into your password manager now.
          </p>
          <button type="button" onClick={retrySaving}>
            Try again
          </button>
        </div>
      )}
      <p className="hint">
        A shortlist of passwords you are choosing between, each with its hint, {WHERE[persistence.list]} Each one is scored
        from the password and hint alone (difficulty for the chosen mode), so it reads the same every time, and carries what
        the{' '}
        <a href={ZXCVBN_URL} target="_blank" rel="noreferrer">
          zxcvbn
        </a>{' '}
        library says about it: worked out here when you add it, and kept with it. Keep the one you pick in a
        password manager; this list is not one.
      </p>
      <p className="sr-only" role="status">
        {announced}
      </p>
      {selected.length === 0 ? (
        <p className="hint">Nothing yet. Use “Add” on a suggestion.</p>
      ) : (
        <ul className="selected-list" aria-label="My passwords">
          {selected.map((entry) => (
            <ListEntry key={entry.password} entry={entry} onRemove={removeSelected} typingMode={typingMode} practise={practise} failed={zxcvbnFailed.has(entry.password)} />
          ))}
        </ul>
      )}
    </section>
  );
}
