import { DEFAULT_TYPING_MODE, type TypingMode } from '../lib/difficulty';
import type { Comfort } from '../lib/grammar';
import { automaticSeparator, MAX_DIGITS, MAX_INITIALS, MAX_MADE_UP, MAX_SHORTHAND, MAX_SYMBOLS, MAX_UPPERCASE, SEPARATOR_PREFERENCE, STRENGTH_PRESETS, type Requirements } from '../lib/generate';
import { isFarShift, isPinkyStretch } from '../lib/keyboard';
import { unusedIn, type ProfileKey } from '../lib/modeProfiles';
import { ignoredSymbols, ruleProblems, type RuleProblem } from '../lib/validation';
import { useShownProblems } from './useShownProblems';
import { NumberField } from './NumberField';

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
  /** The draft's typing mode: options that have no meaning in it are disabled, with the reason. */
  typingMode?: TypingMode;
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

const SEPARATORS: { value: string; label: string; title: string }[] = [
  { value: 'auto', label: 'Auto', title: 'Automatic: whatever the site allows: ";" if it can, else a space, else "." or ","' },
  { value: ' ', label: 'Space', title: 'A space, typed with the thumb' },
  { value: '', label: 'None', title: 'The words run together' },
];

/** How a resolved separator reads in a sentence. */
const describe = (separator: string) => (separator === ' ' ? 'a space' : separator === '' ? 'none, so the words run together' : `"${separator}"`);

/** Where in the form a problem shows: beside the first field it names. */
type Anchor = 'length' | 'must' | 'allows' | 'strength' | 'separator' | 'style' | 'other';
const ANCHORS: Partial<Record<keyof Requirements, Anchor>> = {
  minLength: 'length',
  maxLength: 'length',
  minUppercase: 'must',
  minDigits: 'must',
  minSymbols: 'must',
  allowedSymbols: 'allows',
  allowSpaces: 'allows',
  targetBits: 'strength',
  separator: 'separator',
  initials: 'style',
  shorthand: 'style',
  madeUp: 'style',
  count: 'style',
};
const anchorOf = (p: RuleProblem): Anchor => ANCHORS[p.fields[0]!] ?? 'other';

function Problems({ list, anchor }: { list: RuleProblem[]; anchor: Anchor }) {
  const here = list.filter((p) => anchorOf(p) === anchor);
  if (!here.length) return null;
  return (
    <div id={`problems-${anchor}`} className="field-errors">
      {here.map((p) => (
        <p className="field-error" key={p.message}>
          {p.message}
        </p>
      ))}
    </div>
  );
}

export function RequirementsForm({ value, onChange, typingMode = DEFAULT_TYPING_MODE }: Props) {
  const set = <K extends keyof Requirements>(key: K, v: Requirements[K]) => onChange({ ...value, [key]: v });
  /** Why an option has no meaning in the typing mode, when it has none; its control is disabled and the hint says why. */
  const unused = (key: ProfileKey) => unusedIn(typingMode).find((u) => u.key === key)?.reason;
  const num = (key: 'minLength' | 'maxLength' | 'targetBits' | 'count', min: number, max: number) => ({
    value: value[key],
    min,
    max,
    onCommit: (n: number | null) => n !== null && set(key, n),
  });
  // Every contradiction shows beside the first field it names, and every field it names is marked and points at it.
  const problems = useShownProblems(ruleProblems(value));
  const mark = (field: keyof Requirements) => {
    const p = problems.find((x) => x.fields.includes(field));
    return p ? { 'aria-invalid': true as const, 'aria-describedby': `problems-${anchorOf(p)}`, 'data-field': field } : {};
  };

  const symbolSeparator = !SEPARATORS.some((c) => c.value === value.separator);
  const separatorStretch = value.avoidPinkyStretch && symbolSeparator && isPinkyStretch(value.separator);
  const separatorFar = value.shiftReach && symbolSeparator && isFarShift(value.separator);
  /** Whether the tool may pick a symbol on its own under the comfort rules: the pinky rule and Shift reach. */
  const comfortable = (c: string) => !(value.avoidPinkyStretch && isPinkyStretch(c)) && !(value.shiftReach && isFarShift(c));
  const separatorBlocked = problems.some((p) => p.fields[0] === 'separator');
  const ignored = ignoredSymbols(value.allowedSymbols);

  return (
    <form className="panel form" onSubmit={(e) => e.preventDefault()}>
      <h2>Requirement options</h2>
      <Problems list={problems} anchor="other" />

      <fieldset>
        <legend>Length</legend>
        <div className="row">
          <label className="field">
            <span>Minimum</span>
            <NumberField {...num('minLength', 1, 256)} {...mark('minLength')} />
          </label>
          <label className="field">
            <span>Maximum</span>
            <NumberField {...num('maxLength', 1, 256)} {...mark('maxLength')} />
          </label>
        </div>
        <Problems list={problems} anchor="length" />
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
                {...mark(key)}
              />
            </label>
          </div>
        ))}
        <Problems list={problems} anchor="must" />
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
            {...mark('allowedSymbols')}
          />
        </label>
        <Problems list={problems} anchor="allows" />
        {ignored.length > 0 && (
          <p className="hint">
            Not used: {ignored.map((c) => (c === ' ' ? 'space' : `"${c}"`)).join(' ')}. Only keyboard symbols count here; letters
            and digits are always allowed{ignored.includes(' ') ? ', and spaces go by the Spaces box' : ''}.
          </p>
        )}
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
          <NumberField {...num('targetBits', 0, 256)} {...mark('targetBits')} />
        </label>
        <label className="check">
          <input type="checkbox" checked={value.shortest} onChange={(e) => set('shortest', e.target.checked)} />
          Shortest that meets the target
        </label>
        <p className="hint">
          Cuts each sentence shape to the fewest characters that still reach the target, so the password is as short as
          the target allows. At Minimal it is the shortest sentence the site's rules allow.
        </p>
        <Problems list={problems} anchor="strength" />
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
            disabled={!!unused('avoidPinkyStretch')}
            onChange={(e) => set('avoidPinkyStretch', e.target.checked)}
          />
          Avoid pinky stretches
        </label>
        <p className="hint">
          {unused('avoidPinkyStretch') ?? (
            <>
              Skips symbols more than one key from where your pinkies rest, like <code>! - _ = + ) |</code>, in twists and
              closing marks.
            </>
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={value.shiftReach} disabled={!!unused('shiftReach')} onChange={(e) => set('shiftReach', e.target.checked)} />
          Keep Shift within reach
        </label>
        <p className="hint">
          {unused('shiftReach') ?? (
            <>
              For one hand holding Shift: skips symbols more than 4 keys from both Shift keys, like <code>$ % ^ &amp; *</code>,
              in twists and closing marks, and puts the capital on a word that does not start with <code>T G B Y H N U J I</code>{' '}
              when the sentence has one.
            </>
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={value.easeSwaps} disabled={!!unused('easeSwaps')} onChange={(e) => set('easeSwaps', e.target.checked)} />
          Ease awkward words with deliberate swaps
        </label>
        <p className="hint">
          {unused('easeSwaps') ??
            'A word with a same-finger jump or a long reach gets one fixed misspelling that removes it: “wise” → wyse, “cool” → cul. Comfort then ranks words as typed. A fixed rule that comes with the word, so it adds no strength and nothing to remember, and the hint keeps the word as written.'}
        </p>
      </fieldset>

      <fieldset>
        <legend>Style</legend>
        <span className="field-label" id="separator-label">
          Separator between words
        </span>
        <div className="separator-row">
          <div className="segmented" role="group" aria-labelledby="separator-label">
            {SEPARATORS.map((c) => {
              const chosen = value.separator === c.value;
              // A space the site forbids cannot be picked; one picked before spaces were ruled out stays, with the error below.
              const ruledOut = c.value === ' ' && !value.allowSpaces;
              return (
                <button
                  type="button"
                  key={c.label}
                  className={chosen ? 'active' : ''}
                  aria-pressed={chosen}
                  disabled={ruledOut && !chosen}
                  title={ruledOut ? 'The site does not allow spaces' : c.title}
                  onClick={() => set('separator', c.value)}
                  {...(chosen ? mark('separator') : {})}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            className={symbolSeparator ? 'mono separator-symbol active' : 'mono separator-symbol'}
            maxLength={1}
            spellCheck={false}
            autoComplete="off"
            placeholder="or ;"
            aria-label="Separator symbol"
            value={symbolSeparator ? value.separator : ''}
            onChange={(e) => {
              const typed = [...e.target.value].slice(-1).join('');
              set('separator', typed === '' ? 'auto' : typed); // emptied: back to Automatic
            }}
            {...(symbolSeparator ? mark('separator') : {})}
          />
        </div>
        <Problems list={problems} anchor="separator" />
        {!separatorBlocked && (
          <p className="hint">
            {value.separator === 'auto'
              ? `Auto: ${describe(automaticSeparator(value))} under these rules. It is ";" whenever the site allows it (home row, no Shift, and it counts as a symbol), else a space, else the first allowed of ${SEPARATOR_PREFERENCE.slice(1)
                  .filter(comfortable)
                  .map((c) => `"${c}"`)
                  .join(' ')}, else none.`
              : value.separator === ' '
                ? 'A space: typed with the thumb.'
                : value.separator === ''
                  ? 'None: the words run together.'
                  : separatorStretch
                    ? `"${value.separator}" is a pinky stretch; kept because you chose it.`
                    : separatorFar
                      ? `"${value.separator}" needs a Shift key out of one hand's reach; kept because you chose it.`
                      : `Words are joined with "${value.separator}". Clear the box for Auto.`}
          </p>
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
          <NumberField {...num('count', 1, 20)} {...mark('count')} />
        </label>
        <Problems list={problems} anchor="style" />
      </fieldset>
    </form>
  );
}
