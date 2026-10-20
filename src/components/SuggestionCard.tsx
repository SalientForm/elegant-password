import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { typingModeLabel, type Difficulty } from '../lib/difficulty';
import { describeRemoved } from '../lib/ease';
import { changedWordsOf, easedOf, twistKind, twistOptionsLine, typingLines } from '../lib/explain';
import { roleLabel, type Suggestion } from '../lib/generate';
import { isMadeUpNoun } from '../lib/grammar';
import { READING_ORDER, scoreReadings } from '../lib/readings';
import { MEMORABILITY, scoreCold } from '../lib/score';
import { CopyButton } from './CopyButton';
import { DifficultyTable } from './Difficulty';
import { CheckIcon, ChevronUpIcon, InfoIcon, PlusIcon } from './icons';
import { KeyboardMap } from './KeyboardMap';
import { InstantTip } from './InstantTip';
import { PasswordText } from './PasswordText';
import { observeResize } from './resize';
import { TOUCH, useMediaQuery } from './useMediaQuery';

interface BadgeProps {
  /** Strength: for an attacker who knows English and the usual habits, not this tool. */
  strength: number;
  /** Raw: brute force over the characters used. */
  raw: number;
  difficulty: Pick<Difficulty, 'score' | 'level' | 'label' | 'mode'>;
  /** Undefined when there is no hint to compare with (a password typed in by hand). */
  memorability?: number;
}

/** The four score badges, "Strength 63", "Raw 184", "Difficulty 44" and "Memorability 71", with the full reading in each tooltip (src/lib/readings.ts). */
export function ScoreBadges({ strength, raw, difficulty, memorability }: BadgeProps) {
  const r = scoreReadings({ strength, raw, difficulty, memorability });
  const colour = { strength: `memo-${r.strength.band}`, raw: 'memo-none', difficulty: `level-${r.difficulty.level}`, memorability: `memo-${r.memorability.band ?? 'none'}` };
  // Each badge opens the app's instant tip with its full reading; no browser tooltip. The badge is an image to a screen reader: its name is the whole reading.
  return (
    <>
      {READING_ORDER.map((key) => (
        <InstantTip key={key} content={r[key].text} className="badge-tip">
          <span className={`badge ${key} ${colour[key]}`} role="img" aria-label={r[key].text}>
            {r[key].label} {r[key].value}
          </span>
        </InstantTip>
      ))}
    </>
  );
}

/** This session's figure for an attacker who knows the tool and the swaps in force; shown dim beside the badges and never saved. */
export function BitsFigure({ bits }: { bits: number }) {
  const text = `${bits.toFixed(1)} bits for an attacker who knows this tool and this session's swaps: the words drawn and where the swaps landed. This session only; not saved with the password`;
  return (
    <InstantTip content={text} className="badge-tip">
      <span className="bits" role="img" aria-label={text}>
        {bits.toFixed(1)} bits
      </span>
    </InstantTip>
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

/** The width of an element's content as laid out, whatever its own box is stretched or clipped to. */
function contentWidth(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  return typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect().width : 0;
}

/**
 * Whether a card's password at its full width and its buttons cannot share
 * the first row; undefined while the card has no layout (its column is
 * hidden), when the last answer should stand. Both widths come from content,
 * never from boxes the stacked layout itself stretches or centres, so the
 * answer never depends on the state it decides.
 */
export function needsStack(head: HTMLElement): boolean | undefined {
  const row = head.querySelector<HTMLElement>('.card-row');
  const password = head.querySelector<HTMLElement>('.password');
  const buttons = head.querySelector<HTMLElement>('.card-buttons');
  if (!row || !password || !buttons || row.clientWidth === 0) return undefined;
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  return contentWidth(password) + contentWidth(buttons) + gap > row.clientWidth + 1;
}

export function SuggestionCard({ suggestion, context, index, selected = false, onAdd }: Props) {
  const mine = context.source === 'sentence';
  const touch = useMediaQuery(TOUCH); // a Copy button only where selecting text is hard
  const [open, setOpen] = useState(false); // every "Why?" starts closed
  const code = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const { password, hint, words, checks, twists, difficulty } = suggestion;
  // Too narrow for the password and its buttons on one row: the password, the badges and the buttons each take a row, centred.
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return undefined;
    const measure = () => {
      const next = needsStack(el);
      if (next !== undefined) setStacked(next);
    };
    measure();
    return observeResize(el, measure); // one observer serves every card; a hidden column's cards measure again once shown
  }, [password]);
  const whyId = `why-${index}`;
  // The memorability breakdown comes from the same cold score as the badge.
  const cold = useMemo(() => scoreCold(password, hint), [password, hint]);
  const memo = cold.memorability;
  // A deliberately swapped word is whole as typed ("cool" as "cul"), so only shortened and dropped words count as changed.
  const changedWords = changedWordsOf(cold.words);
  // Deliberate swaps are read from the password and hint, like everything else the card says.
  const eased = easedOf(cold.words);

  return (
    <article className="card" aria-label={`Suggestion ${index + 1}`}>
      <div className={stacked ? 'card-head stacked' : 'card-head'} ref={head}>
        <div className="card-row">
          <PasswordText password={password} ref={code} />
          <div className="actions card-buttons">
            <button type="button" className="icon-button ghost" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={whyId} aria-label={open ? 'Hide why' : 'Why?'} title={open ? 'Hide why' : 'Why?'}>
              {open ? <ChevronUpIcon /> : <InfoIcon />}
            </button>
            {touch && <CopyButton text={password} fallback={code} icon />}
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
            <ScoreBadges strength={suggestion.strength} raw={suggestion.raw} difficulty={difficulty} memorability={suggestion.memorability} />
            <BitsFigure bits={suggestion.bits} />
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
            {eased.length > 0 && (
              <>
                <p>
                  Deliberate swaps make awkward words easier to type. They follow a fixed rule, so they add no
                  strength and nothing to remember: each comes with its word:
                </p>
                <ul className="twist-list eased-list">
                  {eased.map((e) => (
                    <li key={e.word}>
                      <code>{e.rule.from}</code> → <code>{e.rule.to}</code> in “{e.word}” ({e.text}) removes {describeRemoved(e)}
                      <small> (deliberate swap)</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {twists.length > 0 && (
              <ul className="twist-list">
                {twists.map((t, i) => (
                  <li key={i}>
                    <code>{t.mapping.from}</code> → <code>{t.mapping.to || '–'}</code> in “{t.before}”
                    <small> ({twistKind(t)})</small>
                  </li>
                ))}
              </ul>
            )}
            {twistOptionsLine(suggestion) && <p>{twistOptionsLine(suggestion)}</p>}
          </section>

          <section>
            <h3>Fast to type</h3>
            <ul>
              {typingLines(suggestion, context).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <KeyboardMap text={password} />
          </section>

          <section>
            <h3>
              Difficulty score: {difficulty.score} / 100 ({difficulty.label.toLowerCase()}), {typingModeLabel(difficulty.mode).toLowerCase()}
            </h3>
            <DifficultyTable difficulty={difficulty} />
          </section>

          <section>
            <h3>Memorability: {memo.score} / 100</h3>
            <p>
              How closely it still looks like its hint, and how short it is. Words that keep their full length count in
              full, shortened words count the fraction kept, dropped words nothing; shorter is better; a random swap
              costs a little, a deliberate swap nothing.
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
                  ? 'No random swaps, so no penalty.'
                  : `${memo.swappedWords} word${memo.swappedWords === 1 ? ' has' : 's have'} random swaps: −${Math.min(MEMORABILITY.maxSwapPenalty, memo.swappedWords * MEMORABILITY.swapPenalty)} points.`}
                {eased.length > 0 && ` ${eased.length === 1 ? 'The deliberate swap costs' : `The ${eased.length} deliberate swaps cost`} nothing: ${eased.length === 1 ? 'it comes' : 'each comes'} with its word.`}
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
