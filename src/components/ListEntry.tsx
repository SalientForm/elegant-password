import { memo, useMemo, useRef } from 'react';
import { zxcvbnLine } from '../lib/zxcvbnReading';
import { difficultyIn, type TypingMode } from '../lib/difficulty';
import { scoreCold } from '../lib/score';
import { rawBits, strengthBits } from '../lib/strength';
import type { SelectedEntry } from '../state/selectedStore';
import { CopyButton } from './CopyButton';
import { KeyboardIcon, TrashIcon } from './icons';
import { PasswordText } from './PasswordText';
import { ScoreBadges } from './SuggestionCard';
import { TOUCH, useMediaQuery } from './useMediaQuery';

interface Props {
  entry: SelectedEntry;
  onRemove: (password: string) => void;
  typingMode: TypingMode;
  practise: (entry: SelectedEntry) => void;
  /** Whether its zxcvbn reading could not be worked out (the library did not load). */
  failed: boolean;
}

/**
 * One row of My list. It reads no context: it takes what it shows as props,
 * so a change elsewhere on the page does not render it. A module of its own,
 * so the render-count tests can wrap the component My list renders.
 */
export const ListEntry = memo(function ListEntry({ entry, onRemove, typingMode, practise, failed }: Props) {
  const touch = useMediaQuery(TOUCH);
  const score = useMemo(() => scoreCold(entry.password, entry.hint), [entry.password, entry.hint]);
  const difficulty = useMemo(() => difficultyIn(entry.password, score.difficulty, typingMode), [entry.password, score, typingMode]);
  const code = useRef<HTMLElement>(null);
  // addedAt is kept in storage but not shown.
  return (
    <li className="entry">
      <div className="entry-main">
        <PasswordText password={entry.password} className="password entry-password" ref={code} />
        <p className="entry-hint">
          <span className="field-label">Hint:</span> {entry.hint || <em>none</em>}
        </p>
        {entry.zxcvbn && <p className="entry-hint zxcvbn-line">{zxcvbnLine(entry.zxcvbn)}</p>}
      </div>
      <div className="actions">
        <ScoreBadges
          strength={strengthBits(entry.password)}
          raw={rawBits(entry.password)}
          difficulty={difficulty}
          zxcvbn={entry.zxcvbn ?? (failed ? 'failed' : 'pending')}
          memorability={score.memorability.score}
        />
        {touch && <CopyButton text={entry.password} fallback={code} icon />}
        <button type="button" className="icon-button ghost" onClick={() => practise(entry)} aria-label={`Practise ${entry.password}`} title="Practise typing it in the typing test">
          <KeyboardIcon />
        </button>
        <button type="button" className="icon-button ghost" onClick={() => onRemove(entry.password)} aria-label={`Remove ${entry.password} from my list`} title="Remove from my list">
          <TrashIcon />
        </button>
      </div>
    </li>
  );
});
