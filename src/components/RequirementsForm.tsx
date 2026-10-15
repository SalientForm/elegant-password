import type { Comfort } from '../lib/grammar';
import { MAX_DIGITS, MAX_INITIALS, MAX_MADE_UP, MAX_SHORTHAND, MAX_SYMBOLS, MAX_UPPERCASE, separatorProblem, STRENGTH_PRESETS, type Requirements } from '../lib/generate';
import { useState } from 'react';
import { isPinkyStretch } from '../lib/keyboard';
import { NumberField } from './NumberField';

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
}

const MUST_CONTAIN: { key: 'minUppercase' | 'minDigits' | 'minSymbols'; label: string; max: number }[] = [
  { key: 'minUppercase', label: 'Uppercase letters', max: MAX_UPPERCASE },
  { key: 'minDigits', label: 'Digits', max: MAX_DIGITS },
  { key: 'minSymbols', label: 'Symbols', max: MAX_SYMBOLS },
];

const COMFORT: { value: Comfort; label: string; hint: string }[] = [
  { value: 'strict', label: 'Strict', hint: 'Only the easiest 40% of words. Smoothest to type, a little longer.' },
  { value: 'balanced', label: 'Balanced', hint: 'Drops the 30% of words with the most awkward reaches.' },
  { value: 'relaxed', label: 'Relaxed', hint: 'Every word. Shortest for a given strength.' },
];

export function RequirementsForm({ value, onChange }: Props) {
  const set = <K extends keyof Requirements>(key: K, v: Requirements[K]) => onChange({ ...value, [key]: v });
  const num = (key: 'minLength' | 'maxLength' | 'targetBits' | 'count', min: number, max: number) => ({
    value: value[key],
    min,
    max,
    onCommit: (n: number | null) => n !== null && set(key, n),
  });
  // The last separator character chosen, so unticking and re-ticking "Use a separator" brings it back.
  const [lastSeparator, setLastSeparator] = useState(value.separator === '' ? ';' : value.separator);
  const useSeparator = value.separator !== '';
  const separatorIssue = separatorProblem(value.separator, value);
  const separatorStretch = value.avoidPinkyStretch && value.separator !== 'auto' && value.separator !== '' && isPinkyStretch(value.separator);

  return (
    <form className="panel form" onSubmit={(e) => e.preventDefault()}>
      <h2>Requirement options</h2>

      <fieldset>
        <legend>Length</legend>
        <div className="row">
          <label className="field">
            <span>Minimum</span>
            <NumberField {...num('minLength', 1, 256)} />
          </label>
          <label className="field">
            <span>Maximum</span>
            <NumberField {...num('maxLength', 1, 256)} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Must contain</legend>
        {MUST_CONTAIN.map(({ key, label, max }) => (
          <div className="must" key={key}>
            <label className="check">
              <input type="checkbox" checked={value[key] > 0} onChange={(e) => set(key, e.target.checked ? 1 : 0)} />
              {label}
            </label>
            <label className="at-least">
              <span>at least</span>
              <NumberField
                min={1}
                max={max}
                disabled={value[key] === 0}
                aria-label={`Minimum ${label.toLowerCase()}`}
                value={value[key] > 0 ? value[key] : null}
                onCommit={(n) => n !== null && set(key, n)}
              />
            </label>
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Site allows</legend>
        <label className="check">
          <input type="checkbox" checked={value.allowSpaces} onChange={(e) => set('allowSpaces', e.target.checked)} />
          Spaces
        </label>
        <label className="field">
          <span>Symbols</span>
          <input
            type="text"
            spellCheck={false}
            className="mono"
            value={value.allowedSymbols}
            onChange={(e) => set('allowedSymbols', e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Strength</legend>
        <div className="presets">
          {STRENGTH_PRESETS.map((p) => (
            <button
              type="button"
              key={p.bits}
              className={value.targetBits === p.bits ? 'preset active' : 'preset'}
              aria-pressed={value.targetBits === p.bits}
              onClick={() => set('targetBits', p.bits)}
              title={p.hint}
            >
              <strong>{p.label}</strong>
              <small>{p.bits} bits</small>
            </button>
          ))}
        </div>
        <label className="field inline">
          <span>Custom target (bits)</span>
          <NumberField {...num('targetBits', 0, 256)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Typing comfort</legend>
        <div className="segmented">
          {COMFORT.map((c) => (
            <button
              type="button"
              key={c.value}
              className={value.comfort === c.value ? 'active' : ''}
              aria-pressed={value.comfort === c.value}
              onClick={() => set('comfort', c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="hint">{COMFORT.find((c) => c.value === value.comfort)?.hint}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={value.avoidPinkyStretch}
            onChange={(e) => set('avoidPinkyStretch', e.target.checked)}
          />
          Avoid pinky stretches
        </label>
        <p className="hint">
          Skips symbols more than one key from where your pinkies rest, like <code>! - _ = + ) |</code>, in twists and
          closing marks.
        </p>
        <label className="check">
          <input type="checkbox" checked={value.easeSwaps} onChange={(e) => set('easeSwaps', e.target.checked)} />
          Ease awkward words with deliberate swaps
        </label>
        <p className="hint">
          A word with a same-finger jump or a long reach gets one fixed misspelling that removes it: “wise” → wyse,
          “cool” → cul. Comfort then ranks words as typed. A fixed rule, so it adds no strength, and the hint keeps the
          word as written.
        </p>
      </fieldset>

      <fieldset>
        <legend>Style</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={useSeparator}
            onChange={(e) => set('separator', e.target.checked ? lastSeparator : '')}
          />
          Use a separator between words
        </label>
        {useSeparator && (
          <>
            <label className="field inline">
              <span>Separator character</span>
              <input
                type="text"
                className="mono"
                maxLength={1}
                spellCheck={false}
                autoComplete="off"
                placeholder="auto"
                aria-label="Separator character"
                value={value.separator === 'auto' ? '' : value.separator}
                onChange={(e) => {
                  const next = e.target.value === '' ? 'auto' : [...e.target.value].slice(-1).join('');
                  setLastSeparator(next);
                  set('separator', next);
                }}
              />
            </label>
            <p className={separatorIssue ? 'field-error' : 'hint'}>
              {separatorIssue ??
                (value.separator === 'auto'
                  ? 'Empty: the fastest the site allows (a space, else ; . - , _).'
                  : separatorStretch
                    ? `"${value.separator}" is a pinky stretch; kept because you chose it.`
                    : value.separator === ' '
                      ? 'A space: typed with the thumb.'
                      : `Words are joined with "${value.separator}".`)}
            </p>
          </>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={value.includeNumber || value.minDigits > 0}
            disabled={value.minDigits > 0}
            onChange={(e) => set('includeNumber', e.target.checked)}
          />
          Include a number, placed at random (about 8 bits for two keystrokes)
        </label>
        <span className="field-label">Capital initials</span>
        <div className="segmented four">
          {Array.from({ length: MAX_INITIALS + 1 }, (_, n) => (
            <button type="button" key={n} className={value.initials === n ? 'active' : ''} aria-pressed={value.initials === n} onClick={() => set('initials', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">Words typed as one capital letter: “brings” → B. Shorter, but each counts for less.</p>
        <span className="field-label">Two-letter words</span>
        <div className="segmented four">
          {Array.from({ length: MAX_SHORTHAND + 1 }, (_, n) => (
            <button type="button" key={n} className={value.shorthand === n ? 'active' : ''} aria-pressed={value.shorthand === n} onClick={() => set('shorthand', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">First letter and last consonant: “gently” → gy, “jupiter” → jr.</p>
        <span className="field-label">Made-up nouns</span>
        <div className="segmented four">
          {Array.from({ length: MAX_MADE_UP + 1 }, (_, n) => (
            <button type="button" key={n} className={value.madeUp === n ? 'active' : ''} aria-pressed={value.madeUp === n} onClick={() => set('madeUp', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">
          Nouns made of up to two key rolls, all lowercase or ALL CAPS: “ert” + “dfg” → ertdfg. Fast, and each is worth
          about 14 bits.
        </p>
        <label className="check">
          <input type="checkbox" checked={value.glue} onChange={(e) => set('glue', e.target.checked)} />
          Glue numbers and small words to the next word (5ls, Fp33z)
        </label>
        <label className="field inline">
          <span>Suggestions</span>
          <NumberField {...num('count', 1, 20)} />
        </label>
      </fieldset>
    </form>
  );
}
