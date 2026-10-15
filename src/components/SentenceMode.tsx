import type { SentenceOptions, ShrinkStyle } from '../lib/fromSentence';
import type { Suggestion } from '../lib/generate';

interface InputProps {
  value: string;
  onChange: (next: string) => void;
  options: SentenceOptions;
  onOptionsChange: (next: SentenceOptions) => void;
}

const SHRINK: { value: ShrinkStyle; label: string; example: string }[] = [
  { value: 'none', label: 'Keep', example: 'Words stay whole unless the target length needs them shorter.' },
  { value: 'vowels', label: 'Drop vowels', example: 'sweets → swts, jupiter → jptr' },
  { value: 'ends', label: 'First + last', example: 'Two letters, first and last consonant: jupiter → jr, piece → pc' },
];

export function SentenceInput({ value, onChange, options, onOptionsChange }: InputProps) {
  return (
    <section className="panel sentence">
      <label className="field">
        <span>Your sentence</span>
        <textarea
          rows={2}
          spellCheck={false}
          autoComplete="off"
          placeholder="Sally eats sweets on Sundays"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="shrink">
        <span className="field-label">Shrink words of</span>
        <input
          type="number"
          min={2}
          max={20}
          aria-label="Shrink words of this many letters or more"
          value={options.shrinkFrom}
          onChange={(e) => onOptionsChange({ ...options, shrinkFrom: Math.max(2, Number(e.target.value) || 2) })}
        />
        <span className="field-label">+ letters</span>
        <div className="segmented">
          {SHRINK.map((s) => (
            <button
              type="button"
              key={s.value}
              className={options.shrink === s.value ? 'active' : ''}
              onClick={() => onOptionsChange({ ...options, shrink: s.value })}
              title={s.example}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">{SHRINK.find((s) => s.value === options.shrink)?.example}</p>
      <label className="check">
        <input
          type="checkbox"
          checked={options.smallWordInitials}
          onChange={(e) => onOptionsChange({ ...options, smallWordInitials: e.target.checked })}
        />
        Small words become a capital letter (for → F, the → T)
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={options.allowDropping}
          onChange={(e) => onOptionsChange({ ...options, allowDropping: e.target.checked })}
        />
        Short targets may drop words entirely (small words first)
      </label>
      <label className="field inline">
        <span>Compress toward (characters)</span>
        <input
          type="number"
          min={1}
          placeholder="max"
          value={options.targetLength ?? ''}
          onChange={(e) => onOptionsChange({ ...options, targetLength: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </label>
      <p className="hint">
        Your sentence is changed to fit the requirements on the left. Digits and symbols come from twists where possible.
        To reach the length, the longest words lose vowels, then inner consonants (jupiter → jptr → jpr → jr), then small
        words drop, then words become initials, and finally words drop. A symbol between words is optional: pick “None”
        under Style. Random initials and twists add strength. It is never saved.
      </p>
    </section>
  );
}

export function SentenceStrength({ suggestions }: { suggestions: Suggestion[] }) {
  const bits = suggestions.map((s) => s.bits);
  const lo = Math.min(...bits);
  const hi = Math.max(...bits);
  return (
    <section className="panel strength">
      <h2>How strong is it?</h2>
      <p>
        Mostly as strong as your sentence is hard to guess, and this tool cannot measure that. A private, slightly odd
        sentence of five or more words is good. Quotes, lyrics, proverbs and anything about you (names, pets, teams) are
        weak, because attackers try them first, along with the usual swaps like <code>a → @</code>.
      </p>
      <p className="hint">
        The random initials and twists add at least {lo === hi ? lo.toFixed(1) : `${lo.toFixed(1)}–${hi.toFixed(1)}`} bits on top,
        counted the same strict way as in “Make up a sentence”. Add more twists for more. Changes made to meet the
        rules (like the digit and symbol) are not counted, so the real figure is a little higher.
      </p>
    </section>
  );
}
