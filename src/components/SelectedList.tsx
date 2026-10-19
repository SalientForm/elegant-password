import { useMemo, useRef, useState } from 'react';
import { difficultyIn } from '../lib/difficulty';
import { scoreCold } from '../lib/score';
import type { SelectedEntry } from '../lib/selectedStore';
import { usePasswords } from '../state/PasswordsProvider';
import { ClickToCopy } from './ClickToCopy';
import { CopyButton } from './CopyButton';
import { TrashIcon } from './icons';
import { PasswordTip } from './PasswordTip';
import { ScoreBadges } from './SuggestionCard';

function Entry({ entry, onRemove }: { entry: SelectedEntry; onRemove: () => void }) {
  const { typingMode } = usePasswords();
  const score = useMemo(() => scoreCold(entry.password, entry.hint), [entry.password, entry.hint]);
  const difficulty = useMemo(() => difficultyIn(entry.password, score.difficulty, typingMode), [entry.password, score, typingMode]);
  const code = useRef<HTMLElement>(null);
  // addedAt is kept in storage but not shown.
  return (
    <li className="entry">
      <div className="entry-main">
        <PasswordTip password={entry.password}>
          <ClickToCopy text={entry.password} className="password entry-password" ref={code}>
            {entry.password}
          </ClickToCopy>
        </PasswordTip>
        <p className="entry-hint">
          <span className="field-label">Hint:</span> {entry.hint || <em>none</em>}
        </p>
      </div>
      <div className="actions">
        <ScoreBadges bits={score.bits} difficulty={difficulty} memorability={score.memorability.score} />
        <CopyButton text={entry.password} fallback={code} icon />
        <button type="button" className="icon-button ghost" onClick={onRemove} aria-label={`Remove ${entry.password} from my list`} title="Remove from my list">
          <TrashIcon />
        </button>
      </div>
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
        from the password and hint alone (difficulty for the chosen mode), so it reads the same every time.
      </p>
      {selected.length === 0 ? (
        <p className="hint">Nothing yet. Use “Add” on a suggestion.</p>
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
