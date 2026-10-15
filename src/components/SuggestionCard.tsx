import { useState } from 'react';
import { roleLabel, type Suggestion } from '../lib/generate';
import { isMadeUpNoun } from '../lib/grammar';
import { isPinkyStretch } from '../lib/keyboard';
import { MAPPING_KIND_LABELS } from '../lib/twists';
import { DifficultyTable } from './Difficulty';
import { KeyboardMap } from './KeyboardMap';

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

export interface CardContext {
  separator: string;
  minUppercase: number;
  /** 'sentence' when built from the user's own sentence. */
  source: 'generated' | 'sentence';
}

export function SuggestionCard({ suggestion, context, index }: { suggestion: Suggestion; context: CardContext; index: number }) {
  const mine = context.source === 'sentence';
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(index === 0);
  const { password, words, typing, checks, twists, difficulty } = suggestion;

  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const letterRows = typing.rowsUsed.filter((r) => r > 0 && r < 4);

  return (
    <article className="card">
      <div className="card-head">
        <code className="password">{password}</code>
        <div className="actions">
          <span
            className="bits-label"
            title={mine ? 'Random bits added by twists; your sentence adds an unknown amount' : 'Sentence plus twists'}
          >
            {mine ? `+${suggestion.bits.toFixed(0)} random bits` : `${suggestion.bits.toFixed(0)} bits`}
          </span>
          <span className={`badge level-${difficulty.level}`} title="Difficulty score, 0 effortless to 100 hard">
            Difficulty {difficulty.score} · {difficulty.label.toLowerCase()}
          </span>
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Hide why' : 'Why?'}
          </button>
        </div>
      </div>

      {open && (
        <div className="why">
          <section>
            <h3>Easy to remember</h3>
            <div className="chips">
              {words.map((w, i) => (
                <span
                  className={`chip ${w.slot}${/^[A-Z]$/.test(w.text) ? ' initial' : w.text !== w.original ? ' twisted' : ''}`}
                  key={i}
                  title={w.text !== w.original ? `changed from "${w.original}"` : undefined}
                >
                  <span>{w.text}</span>
                  <small>
                    {(() => {
                      const label = roleLabel(w, !mine && w.slot === 'noun' && isMadeUpNoun(w.original));
                      return w.text !== w.original ? `${label}: ${w.original}` : label;
                    })()}
                  </small>
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
              </>
            )}
            {twists.length > 0 && (
              <>
                <ul className="twist-list">
                  {twists.map((t, i) => (
                    <li key={i}>
                      <code>{t.mapping.from}</code> → <code>{t.mapping.to || '–'}</code> in “{t.before}”
                      <small> ({MAPPING_KIND_LABELS[t.mapping.kind].toLowerCase().replace(/s$/, '')})</small>
                    </li>
                  ))}
                </ul>
                <p>
                  Remember the sentence first, then the {twists.length === 1 ? 'random twist' : `${twists.length} random twists`}.
                  This was one of {suggestion.twistOptions.toLocaleString('en')} ways to twist these words, which adds{' '}
                  {suggestion.twistBits.toFixed(1)} bits.
                </p>
              </>
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
