import type { SentenceOptions, ShrinkStyle } from '../lib/fromSentence';
import type { Suggestion } from '../lib/generate';
import { NumberField } from './NumberField';

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
          autoCapitalize="off"
          placeholder="Sally eats sweets on Sundays"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="shrink">
        <label className="field-label" htmlFor="shrink-from">
          Shrink words of
        </label>
        <NumberField
          id="shrink-from"
          value={options.shrinkFrom}
          min={2}
          max={20}
          onCommit={(n) => n !== null && onOptionsChange({ ...options, shrinkFrom: n })}
        />
        <span className="field-label">+ letters</span>
        <div className="segmented">
          {SHRINK.map((s) => (
            <button
              type="button"
              key={s.value}
              className={options.shrink === s.value ? 'active' : ''}
              aria-pressed={options.shrink === s.value}
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
        <NumberField
          value={options.targetLength}
          min={1}
          max={256}
          allowEmpty
          placeholder="max"
          onCommit={(n) => onOptionsChange({ ...options, targetLength: n })}
        />
      </label>
      <p className="hint">
        Your sentence is changed to fit the requirements on the left. Digits and symbols come from swaps where possible.
        To reach the length, the longest words lose vowels, then inner consonants (jupiter → jptr → jpr → jr), then small
        words drop, then words become initials, and finally words drop. A symbol between words is optional: pick “None”
        under Style. Random initials and swaps add strength. The sentence stays in this tab until you close it and is
        never sent anywhere; it is only kept longer if you add a password to your list, as that password’s hint.
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
        The random initials and swaps add about {lo === hi ? lo.toFixed(1) : `${lo.toFixed(1)}–${hi.toFixed(1)}`} bits on
        top, scored from each password and your sentence alone, the same way as in “Make up a sentence”. Add more swaps
        for more. Your own choice of sentence is the one bias that cannot be counted, and it is already in the sentence
        you typed.
      </p>
    </section>
  );
}
