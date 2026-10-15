import { useMemo, useRef, useState } from 'react';
import { scoreCold } from '../lib/score';
import type { SelectedEntry } from '../lib/selectedStore';
import { usePasswords } from '../state/PasswordsProvider';
import { CopyButton } from './CopyButton';
import { memorabilityLevel } from './SuggestionCard';

function Entry({ entry, onRemove }: { entry: SelectedEntry; onRemove: () => void }) {
  const score = useMemo(() => scoreCold(entry.password, entry.hint), [entry.password, entry.hint]);
  const code = useRef<HTMLElement>(null);
  const added = new Date(entry.addedAt);
  return (
    <li className="entry">
      <div className="entry-main">
        <code className="password" ref={code}>
          {entry.password}
        </code>
        <p className="entry-hint">
          <span className="field-label">Hint:</span> {entry.hint || <em>none</em>}
        </p>
      </div>
      <div className="actions">
        <span className="bits-label" title="Scored from the password and hint alone, so it is the same every time">
          ≈{score.bits.toFixed(0)} bits
        </span>
        <span className={`badge difficulty level-${score.difficulty.level}`} title="Difficulty score, 0 effortless to 100 hard">
          Difficulty {score.difficulty.score} · {score.difficulty.label.toLowerCase()}
        </span>
        <span className={`badge memorability memo-${memorabilityLevel(score.memorability.score)}`} title="Memorability, 0 to 100">
          Memorability {score.memorability.score}
        </span>
        <CopyButton text={entry.password} fallback={code} />
        <button type="button" className="ghost" onClick={onRemove} aria-label={`Remove ${entry.password} from my list`}>
          Remove
        </button>
      </div>
      {!Number.isNaN(added.getTime()) && added.getTime() > 0 && (
        <small className="entry-date">
          Added <time dateTime={entry.addedAt}>{added.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
        </small>
      )}
    </li>
  );
}

/** The user's own list of chosen passwords with their hints, kept in this browser. */
export function SelectedList() {
  const { selected, removeSelected, clearSelected } = usePasswords();
  const [confirm, setConfirm] = useState(false);

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
      <p className="hint">
        Passwords you add, each with its hint, kept in this browser’s storage only and never sent anywhere. Each one is scored
        from the password and hint alone, so it reads the same every time.
      </p>
      {selected.length === 0 ? (
        <p className="hint">Nothing yet. Use “Add to my list” on a suggestion.</p>
      ) : (
        <ul className="selected-list" aria-label="My passwords">
          {selected.map((entry) => (
            <Entry key={entry.password} entry={entry} onRemove={() => removeSelected(entry.password)} />
          ))}
        </ul>
      )}
    </section>
  );
}
