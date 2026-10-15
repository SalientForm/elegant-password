import { useMemo, useRef, useState } from 'react';
import { roleLabel, type Suggestion } from '../lib/generate';
import { isMadeUpNoun } from '../lib/grammar';
import { isPinkyStretch } from '../lib/keyboard';
import { MEMORABILITY, scoreCold } from '../lib/score';
import { MAPPING_KIND_LABELS } from '../lib/twists';
import { ClickToCopy } from './ClickToCopy';
import { CopyButton } from './CopyButton';
import { DifficultyTable } from './Difficulty';
import { CheckIcon, ChevronUpIcon, InfoIcon, PlusIcon } from './icons';
import { KeyboardMap } from './KeyboardMap';
import { PasswordTip } from './PasswordTip';

const ROW_NAMES = ['number row', 'top row', 'home row', 'bottom row', 'space bar'];

function shiftReasons(password: string, minUppercase: number, initials: number): string {
  const reasons = initials
    ? [`${initials} capital initial${initials > 1 ? 's' : ''}`]
    : minUppercase === 1
      ? ['the opening capital']
      : minUppercase > 1
        ? ['held once for the word in capitals']
        : [];
  const shiftedSymbols = [...new Set(password.match(/[!@#$%^&*()_+{}|:"<>?~]/g) ?? [])];
  if (shiftedSymbols.length) reasons.push(shiftedSymbols.map((c) => `"${c}"`).join(' '));
  return reasons.join(' and ');
}

function separatorPhrase(sep: string): string {
  if (sep === ' ') return 'Spaces between words go to your thumb, so your fingers never leave the letters.';
  if (sep === '') return 'Words run together with no separator keys at all.';
  const stretch = isPinkyStretch(sep) ? ' It is a pinky stretch, kept because you chose it.' : '';
  return `Words are joined with "${sep}", the same key every time, so it becomes a rhythm.${stretch}`;
}

/** Colour band for a memorability score: green above 75, yellow above 45, red below. */
export const MEMORABILITY_BANDS = { green: 75, yellow: 45 } as const;
export const memorabilityLevel = (score: number) => (score > MEMORABILITY_BANDS.green ? 'high' : score > MEMORABILITY_BANDS.yellow ? 'mid' : 'low');

/** The two score badges: "D 44" and "M 71", with the full reading in the tooltip. */
export function ScoreBadges({ difficulty, memorability }: { difficulty: { score: number; level: number; label: string }; memorability: number }) {
  return (
    <>
      <span className={`badge difficulty level-${difficulty.level}`} title={`Difficulty ${difficulty.score}, ${difficulty.label.toLowerCase()}`} aria-label={`Difficulty ${difficulty.score}, ${difficulty.label.toLowerCase()}`}>
        D {difficulty.score}
      </span>
      <span className={`badge memorability memo-${memorabilityLevel(memorability)}`} title={`Memorability ${memorability} of 100: how closely it still looks like its hint`} aria-label={`Memorability ${memorability}`}>
        M {memorability}
      </span>
    </>
  );
}

export interface CardContext {
  separator: string;
  minUppercase: number;
  /** 'sentence' when built from the user's own sentence. */
  source: 'generated' | 'sentence';
}

interface Props {
  suggestion: Suggestion;
  context: CardContext;
  index: number;
  /** Whether this password is already in the user's list. */
  selected?: boolean;
  onAdd?: (s: Suggestion) => void;
}

export function SuggestionCard({ suggestion, context, index, selected = false, onAdd }: Props) {
  const mine = context.source === 'sentence';
  const [open, setOpen] = useState(false); // every "Why?" starts closed
  const code = useRef<HTMLElement>(null);
  const { password, hint, words, typing, checks, twists, difficulty } = suggestion;
  const whyId = `why-${index}`;
  // The memorability breakdown comes from the same cold score as the badge.
  const cold = useMemo(() => scoreCold(password, hint), [password, hint]);
  const memo = cold.memorability;
  const changedWords = cold.words.filter((w) => w.form === 'dropped' || [...w.text].length < [...w.word].length);

  const letterRows = typing.rowsUsed.filter((r) => r > 0 && r < 4);

  return (
    <article className="card" aria-label={`Suggestion ${index + 1}`}>
      <div className="card-head">
        <div className="card-row">
          <PasswordTip password={password}>
            <ClickToCopy text={password} className="password" ref={code}>
              {password}
            </ClickToCopy>
          </PasswordTip>
          <div className="actions card-buttons">
            <button type="button" className="icon-button ghost" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={whyId} aria-label={open ? 'Hide why' : 'Why?'} title={open ? 'Hide why' : 'Why?'}>
              {open ? <ChevronUpIcon /> : <InfoIcon />}
            </button>
            <CopyButton text={password} fallback={code} icon />
            {onAdd && (
              <button
                type="button"
                className="icon-button"
                onClick={() => onAdd(suggestion)}
                disabled={selected}
                aria-pressed={selected}
                aria-label={selected ? 'Added' : 'Add'}
                title={selected ? 'Already in my list' : 'Add to my list'}
              >
                {selected ? <CheckIcon /> : <PlusIcon />}
              </button>
            )}
          </div>
        </div>
        <div className="card-row">
          <div className="actions">
            <span className="bits-label" title={mine ? 'Bits from the random initials and swaps, scored from the password and your sentence alone' : 'Scored from the password and its hint alone, so it is the same every time'}>
              ≈{suggestion.bits.toFixed(0)} bits
            </span>
            <ScoreBadges difficulty={difficulty} memorability={suggestion.memorability} />
          </div>
        </div>
      </div>

      {open && (
        <div className="why" id={whyId}>
          <section>
            <h3>Easy to remember</h3>
            <p className="hint-line">
              <span className="field-label">Hint:</span> {hint}
            </p>
            <div className="chips">
              {words.map((w, i) => (
                <span
                  className={`chip ${w.slot}${/^[A-Z]$/.test(w.text) ? ' initial' : w.text !== w.original ? ' twisted' : ''}`}
                  key={i}
                  title={w.text !== w.original ? `changed from "${w.original}"` : undefined}
                >
                  <span>{w.text}</span>
                  {(() => {
                    // Your own words need no part-of-speech label; only show what they were when they changed.
                    const label = w.slot === 'yours' ? '' : roleLabel(w, !mine && w.slot === 'noun' && isMadeUpNoun(w.original));
                    const text = w.text !== w.original ? (label ? `${label}: ${w.original}` : w.original) : label;
                    return text ? <small>{text}</small> : null;
                  })()}
                </span>
              ))}
            </div>
            {mine ? (
              <>
                <p>It is your own sentence, so you already know it. Remember how it was changed:</p>
                {suggestion.steps.length > 0 && (
                  <ul className="twist-list">
                    {suggestion.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p>
                  It is a complete sentence, so you remember one picture instead of a string of characters. Imagine the
                  scene once: who is doing what, to what
                  {words.some((w) => w.slot === 'end' || w.slot === 'prep') ? ', and where or when' : ''}. Grammar keeps
                  the words in order for you.
                </p>
                {words.some((w) => /^[A-Z]$/.test(w.text)) && (
                  <p>
                    Capital letters stand for whole words: picture{' '}
                    {words
                      .filter((w) => /^[A-Z]$/.test(w.text))
                      .map((w) => `“${w.original}” for ${w.text}`)
                      .join(', ')}
                    . Any word with that letter works.
                  </p>
                )}
                {suggestion.steps.length > 0 && (
                  <ul className="twist-list">
                    {suggestion.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {twists.length > 0 && (
              <ul className="twist-list">
                {twists.map((t, i) => (
                  <li key={i}>
                    <code>{t.mapping.from}</code> → <code>{t.mapping.to || '–'}</code> in “{t.before}”
                    <small> ({MAPPING_KIND_LABELS[t.mapping.kind].toLowerCase().replace(/s$/, '')})</small>
                  </li>
                ))}
              </ul>
            )}
            {suggestion.twistOptions > 1 && (
              <p>
                Remember the sentence first, then the swaps. Where they landed was one of{' '}
                {suggestion.twistOptions.toLocaleString('en')} possibilities, which adds {suggestion.twistBits.toFixed(1)} bits.
              </p>
            )}
          </section>

          <section>
            <h3>Fast to type</h3>
            <ul>
              <li>
                {typing.shiftPresses === 0
                  ? 'All lowercase: no Shift key at all.'
                  : `${typing.shiftPresses} Shift press${typing.shiftPresses > 1 ? 'es' : ''} (${shiftReasons(password, context.minUppercase, words.filter((w) => /^[A-Z]$/.test(w.text)).length)}).${typing.caseChanges <= 1 ? ' Case never alternates.' : ` Capital initials flip the case ${typing.caseChanges} times.`}`}
              </li>
              <li>{Math.round(typing.sameRowShare * 100)}% of letter-to-letter moves stay on the same keyboard row.</li>
              <li>
                Average reach is {typing.averageDistance.toFixed(1)} key widths, with {typing.sameFingerPairs} same-finger
                {typing.sameFingerPairs === 1 ? ' pair' : ' pairs'}.
              </li>
              <li>
                Letters come from the {letterRows.map((r) => ROW_NAMES[r]).join(', ')}
                {typing.rowsUsed.includes(0) ? ', plus short trips to the number row' : ''}.
              </li>
              <li>{separatorPhrase(context.separator)}</li>
            </ul>
            <KeyboardMap text={password} />
          </section>

          <section>
            <h3>
              Difficulty score: {difficulty.score} / 100 ({difficulty.label.toLowerCase()})
            </h3>
            <DifficultyTable difficulty={difficulty} />
          </section>

          <section>
            <h3>Memorability: {memo.score} / 100</h3>
            <p>
              How closely it still looks like its hint, and how short it is. Words that keep their full length count in
              full, shortened words count the fraction kept, dropped words nothing; shorter is better; a spelling that
              differs from the hint costs a little.
            </p>
            <ul>
              <li>
                {memo.sameSize} of {cold.words.length} hint words keep their full length
                {changedWords.length
                  ? `: ${changedWords
                      .map((w) => (w.form === 'dropped' ? `“${w.word}” was dropped` : `“${w.word}” became “${w.text}” (${[...w.text].length} of ${[...w.word].length} letters)`))
                      .join(', ')}`
                  : ''}
                . Fidelity {Math.round(memo.fidelity * 100)}%, worth {MEMORABILITY.fidelityWeight * 100}% of the score.
              </li>
              <li>
                {[...password].length} characters: brevity {Math.round(memo.brevity * 100)}% (full marks at {MEMORABILITY.shortAt} or fewer, none at{' '}
                {MEMORABILITY.longAt} or more), worth {MEMORABILITY.brevityWeight * 100}%.
              </li>
              <li>
                {memo.swappedWords === 0
                  ? 'No spelling differs from the hint, so no penalty.'
                  : `${memo.swappedWords} spelling${memo.swappedWords === 1 ? '' : 's'} differ${memo.swappedWords === 1 ? 's' : ''} from the hint: −${Math.min(MEMORABILITY.maxSwapPenalty, memo.swappedWords * MEMORABILITY.swapPenalty)} points.`}
              </li>
            </ul>
          </section>

          <section>
            <h3>Meets the requirements</h3>
            <ul className="checks">
              {checks.map((c) => (
                <li key={c.rule} className={c.met ? 'met' : 'unmet'}>
                  <strong>{c.rule}</strong>: {c.how}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}
