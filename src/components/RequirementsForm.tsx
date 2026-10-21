import { memo } from 'react';
import { DEFAULT_TYPING_MODE, type TypingMode } from '../lib/difficulty';
import { COMFORT_CHOICES, isSymbolSeparator, MUST_CONTAIN, SEPARATOR_KINDS, separatorChoices, separatorNote } from '../lib/choices';
import { MAX_INITIALS, MAX_MADE_UP, MAX_SHORTHAND, SEPARATOR_PREFERENCE, STRENGTH_PRESETS, type Requirements } from '../lib/generate';
import { MADE_UP_NOUNS, pools } from '../lib/grammar';
import { FAR_SHIFT_LETTERS, FAR_SHIFT_SYMBOLS, ONE_HAND_SHIFT_REACH, PINKY_STRETCH_SYMBOLS, pressFor } from '../lib/keyboard';
import { MINIMAL_BITS, PROFILE_LABELS, unusedIn, type ProfileKey } from '../lib/modeProfiles';
import { ignoredSymbols, MAX_COUNT, MAX_LENGTH, MAX_TARGET_BITS, MIN_COUNT, MIN_LENGTH, ruleProblems, type RuleProblem } from '../lib/validation';
import { useShownProblems } from './useShownProblems';
import { NumberField } from './NumberField';

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
  /** The draft's typing mode: options that have no meaning in it are disabled, with the reason. */
  typingMode?: TypingMode;
}

/** Where in the form a problem shows: beside the first field it names. */
type Anchor = 'length' | 'must' | 'allows' | 'strength' | 'separator' | 'style' | 'other';
const ANCHORS: Partial<Record<keyof Requirements, Anchor>> = {
  minLength: 'length',
  maxLength: 'length',
  minUppercase: 'must',
  minLowercase: 'must',
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

/** Characters as they sit on the keyboard, left to right: "T G B Y H N U J I" rather than "B G H I J N T U Y". */
const keyboardOrder = (chars: readonly string[]) => [...chars].sort((a, b) => pressFor(a).key.x - pressFor(b).key.x).join(' ');
const PINKY_STRETCHES = keyboardOrder(PINKY_STRETCH_SYMBOLS);
const FAR_SYMBOLS = keyboardOrder(FAR_SHIFT_SYMBOLS);
const FAR_LETTERS = keyboardOrder(FAR_SHIFT_LETTERS);
/** The strength preset that is just the site's rules. */
const MINIMAL_LABEL = STRENGTH_PRESETS.find((p) => p.bits === MINIMAL_BITS)!.label;
/** What a made-up noun is worth: one pick from every made-up noun. */
const MADE_UP_BITS = Math.round(Math.log2(MADE_UP_NOUNS.length));

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

export const RequirementsForm = memo(function RequirementsForm({ value, onChange, typingMode = DEFAULT_TYPING_MODE }: Props) {
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

  const symbolSeparator = isSymbolSeparator(value.separator);
  const note = separatorNote(value);
  const separatorBlocked = problems.some((p) => p.fields[0] === 'separator');
  const ignored = ignoredSymbols(value.allowedSymbols);
  // Whether these rules rule out a space as the separator: the core's separator check, the one the error below comes from.
  const spaceRuledOut = !!separatorChoices(value).find((c) => c.value === ' ')?.problem;
  // What the number is worth: one pick from the number pool at this comfort (where it goes adds a little more).
  const numberBits = Math.round(Math.log2(pools(value.comfort).num.length));

  return (
    <form className="panel form" onSubmit={(e) => e.preventDefault()}>
      <h2>Requirement options</h2>
      <Problems list={problems} anchor="other" />

      <fieldset>
        <legend>Length</legend>
        <div className="row">
          <label className="field">
            <span>Minimum</span>
            <NumberField {...num('minLength', MIN_LENGTH, MAX_LENGTH)} {...mark('minLength')} />
          </label>
          <label className="field">
            <span>Maximum</span>
            <NumberField {...num('maxLength', MIN_LENGTH, MAX_LENGTH)} {...mark('maxLength')} />
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
          <span>{PROFILE_LABELS.targetBits} in bits</span>
          <NumberField {...num('targetBits', 0, MAX_TARGET_BITS)} {...mark('targetBits')} />
        </label>
        <label className="check">
          <input type="checkbox" checked={value.shortest} onChange={(e) => set('shortest', e.target.checked)} />
          {PROFILE_LABELS.shortest}
        </label>
        <p className="hint">
          Cuts each sentence shape to the fewest characters that still reach the target, so the password is as short as
          the target allows. At {MINIMAL_LABEL} it is the shortest sentence the site's rules allow.
        </p>
        <Problems list={problems} anchor="strength" />
      </fieldset>

      <fieldset>
        <legend>{PROFILE_LABELS.comfort}</legend>
        <div className="segmented">
          {COMFORT_CHOICES.map((c) => (
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
        <p className="hint">{COMFORT_CHOICES.find((c) => c.value === value.comfort)?.hint}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={value.avoidPinkyStretch}
            disabled={!!unused('avoidPinkyStretch')}
            onChange={(e) => set('avoidPinkyStretch', e.target.checked)}
          />
          {PROFILE_LABELS.avoidPinkyStretch}
        </label>
        <p className="hint">
          {unused('avoidPinkyStretch') ?? (
            <>
              Skips symbols more than one key from where your pinkies rest (<code>{PINKY_STRETCHES}</code>) in twists
              and closing marks.
            </>
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={value.shiftReach} disabled={!!unused('shiftReach')} onChange={(e) => set('shiftReach', e.target.checked)} />
          {PROFILE_LABELS.shiftReach}
        </label>
        <p className="hint">
          {unused('shiftReach') ?? (
            <>
              For one hand holding Shift: skips symbols more than {ONE_HAND_SHIFT_REACH} keys from both Shift keys
              (<code>{FAR_SYMBOLS}</code>) in twists and closing marks, and puts the capital on a word that does not start
              with <code>{FAR_LETTERS}</code> when the sentence has one.
            </>
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={value.easeSwaps} disabled={!!unused('easeSwaps')} onChange={(e) => set('easeSwaps', e.target.checked)} />
          {PROFILE_LABELS.easeSwaps}
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
            {SEPARATOR_KINDS.map((c) => {
              const chosen = value.separator === c.value;
              // A space the site forbids cannot be picked; one picked before spaces were ruled out stays, with the error below.
              const ruledOut = c.value === ' ' && spaceRuledOut;
              return (
                <button
                  type="button"
                  key={c.label}
                  className={chosen ? 'active' : ''}
                  aria-pressed={chosen}
                  disabled={ruledOut && !chosen}
                  title={ruledOut ? 'The site does not allow spaces' : c.hint}
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
            placeholder={`or ${SEPARATOR_PREFERENCE[0]}`}
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
            {note.kind === 'symbol' ? `${note.text} Clear the box for Auto.` : note.text}
            {spaceRuledOut && value.separator !== ' ' ? ' Space is not available: the site does not allow spaces.' : ''}
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={value.includeNumber || value.minDigits > 0}
            disabled={value.minDigits > 0}
            onChange={(e) => set('includeNumber', e.target.checked)}
          />
          {PROFILE_LABELS.includeNumber}, placed at random (about {numberBits} bits for two keystrokes, plus its place)
        </label>
        {value.minDigits > 0 && <p className="hint">Always on while digits are required under Must contain.</p>}
        <span className="field-label">{PROFILE_LABELS.initials}</span>
        <div className="segmented four">
          {Array.from({ length: MAX_INITIALS + 1 }, (_, n) => (
            <button type="button" key={n} className={value.initials === n ? 'active' : ''} aria-pressed={value.initials === n} onClick={() => set('initials', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">Words typed as one capital letter: “brings” → B. Shorter, but each counts for less.</p>
        <span className="field-label">{PROFILE_LABELS.shorthand}</span>
        <div className="segmented four">
          {Array.from({ length: MAX_SHORTHAND + 1 }, (_, n) => (
            <button type="button" key={n} className={value.shorthand === n ? 'active' : ''} aria-pressed={value.shorthand === n} onClick={() => set('shorthand', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">First letter and last consonant: “gently” → gy, “jupiter” → jr.</p>
        <span className="field-label">{PROFILE_LABELS.madeUp}</span>
        <div className="segmented four">
          {Array.from({ length: MAX_MADE_UP + 1 }, (_, n) => (
            <button type="button" key={n} className={value.madeUp === n ? 'active' : ''} aria-pressed={value.madeUp === n} onClick={() => set('madeUp', n)}>
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
        <p className="hint">
          Nouns made of up to two key rolls, all lowercase or ALL CAPS: “ert” + “dfg” → ertdfg. Fast, and each is worth
          about {MADE_UP_BITS} bits.
        </p>
        <label className="check">
          <input type="checkbox" checked={value.glue} onChange={(e) => set('glue', e.target.checked)} />
          Glue numbers and small words to the next word (5ls, Fp33z)
        </label>
        <label className="field inline">
          <span>Suggestions</span>
          <NumberField {...num('count', MIN_COUNT, MAX_COUNT)} {...mark('count')} />
        </label>
        <Problems list={problems} anchor="style" />
      </fieldset>
    </form>
  );
});
