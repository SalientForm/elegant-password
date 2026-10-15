import type { Comfort } from '../lib/grammar';
import { MAX_DIGITS, MAX_INITIALS, MAX_MADE_UP, MAX_SHORTHAND, MAX_SYMBOLS, MAX_UPPERCASE, STRENGTH_PRESETS, type Requirements, type Separator } from '../lib/generate';
import { isPinkyStretch } from '../lib/keyboard';

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
}

const SEPARATORS: { value: Separator; label: string }[] = [
  { value: 'auto', label: 'Fastest allowed' },
  { value: ' ', label: 'Space' },
  { value: ';', label: 'Semicolon  ; (home row)' },
  { value: '.', label: 'Dot  .' },
  { value: '-', label: 'Dash  -' },
  { value: ',', label: 'Comma  ,' },
  { value: '_', label: 'Underscore  _' },
  { value: '', label: 'None (run together)' },
];

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
  const num = (key: 'minLength' | 'maxLength' | 'targetBits' | 'count') => ({
    value: Number.isFinite(value[key]) ? value[key] : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value === '' ? NaN : Number(e.target.value)),
  });
  const sepAllowed = (s: Separator) =>
    s === 'auto' || s === '' || (s === ' ' ? value.allowSpaces : value.allowedSymbols.includes(s));

  return (
    <form className="panel form" onSubmit={(e) => e.preventDefault()}>
      <h2>Site requirements</h2>

      <fieldset>
        <legend>Length</legend>
        <div className="row">
          <label className="field">
            <span>Minimum</span>
            <input type="number" min={1} {...num('minLength')} />
          </label>
          <label className="field">
            <span>Maximum</span>
            <input type="number" min={1} {...num('maxLength')} />
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
              <input
                type="number"
                min={1}
                max={max}
                disabled={value[key] === 0}
                aria-label={`Minimum ${label.toLowerCase()}`}
                value={value[key] > 0 ? value[key] : ''}
                onChange={(e) => set(key, e.target.value === '' ? NaN : Number(e.target.value))}
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
          <input type="number" min={0} max={128} {...num('targetBits')} />
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
      </fieldset>

      <fieldset>
        <legend>Style</legend>
        <label className="field">
          <span>Between words</span>
          <select value={value.separator} onChange={(e) => set('separator', e.target.value as Separator)}>
            {SEPARATORS.map((s) => (
              <option key={s.label} value={s.value} disabled={!sepAllowed(s.value)}>
                {s.label}
                {value.avoidPinkyStretch && s.value !== 'auto' && s.value !== '' && isPinkyStretch(s.value) ? ' (pinky stretch)' : ''}
              </option>
            ))}
          </select>
        </label>
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
            <button type="button" key={n} className={value.initials === n ? 'active' : ''} onClick={() => set('initials', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">Words typed as one capital letter: “brings” → B. Shorter, but each counts for less.</p>
        <span className="field-label">Two-letter words</span>
        <div className="segmented four">
          {Array.from({ length: MAX_SHORTHAND + 1 }, (_, n) => (
            <button type="button" key={n} className={value.shorthand === n ? 'active' : ''} onClick={() => set('shorthand', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">First letter and last consonant: “gently” → gy, “jupiter” → jr.</p>
        <span className="field-label">Made-up nouns</span>
        <div className="segmented four">
          {Array.from({ length: MAX_MADE_UP + 1 }, (_, n) => (
            <button type="button" key={n} className={value.madeUp === n ? 'active' : ''} onClick={() => set('madeUp', n)}>
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
          <input type="number" min={1} max={20} {...num('count')} />
        </label>
      </fieldset>
    </form>
  );
}
