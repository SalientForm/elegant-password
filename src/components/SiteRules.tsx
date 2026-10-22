import { memo, useMemo, useRef, useState } from 'react';
import type { Requirements } from '../lib/generate';
import { applyParsedRules, MAX_RULES_TEXT_LENGTH, parseRuleText, rulesTextLengthProblem, type ParsedRules } from '../lib/ruleText';
import { applyPreset, matchingPreset, SITE_PRESETS } from '../lib/sitePresets';
import { timed } from '../state/slow';

/**
 * The last text read and what it said. A paste fills in and then previews
 * the same text, and "Fill in" applies the text already previewed: one
 * reading serves both. The parser is pure, so the entry is never stale.
 */
let lastRead: { text: string; parsed: ParsedRules } | undefined;
function read(text: string): ParsedRules {
  if (lastRead?.text !== text) lastRead = { text, parsed: timed('Reading the pasted rules', () => parseRuleText(text)) };
  return lastRead.parsed;
}

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
}

interface Filled {
  /** The text it was filled from: the message holds until the text changes. */
  text: string;
  message: string;
  found: boolean;
  /** Rules the text states that the tool cannot keep, each with why; none of them was applied. */
  notKept: string[];
}

/** What a preset tap had to fix, kept while the form still holds what that tap made. */
interface PresetNote {
  made: Requirements;
  message: string;
}

/**
 * The site's rules, in the Presets card under the typing mode: one-tap rule
 * sets, and a box for the site's own wording, always open. Both change the
 * rule fields, and only in the draft, like any other edit: nothing sticks
 * until it is submitted. Neither ever leaves the form contradicting itself:
 * a separator the new rules forbid becomes Automatic, and each such fix is
 * said (beside the presets, or in the paste box's message). A pasted rule
 * the tool cannot keep (a length past 128, "no digits") is never applied
 * cut down: it is listed under "Not kept", with why. The box holds at most
 * MAX_RULES_TEXT_LENGTH characters; a paste that would pass it is refused
 * whole, and said, rather than cut.
 */
export const SiteRules = memo(function SiteRules({ value, onChange }: Props) {
  const active = matchingPreset(value);
  const [text, setText] = useState('');
  const [filled, setFilled] = useState<Filled | null>(null);
  /** Why the last paste was refused, while the text is still what it was then. */
  const [refused, setRefused] = useState<{ text: string; message: string } | null>(null);
  const pasting = useRef(false);
  const [presetNote, setPresetNote] = useState<PresetNote | null>(null);
  const note = presetNote && JSON.stringify(presetNote.made) === JSON.stringify(value) ? presetNote.message : null;

  const fill = (source: string) => {
    const parsed = read(source);
    const notKept = parsed.unsupported;
    if (!parsed.understood.length) {
      setFilled({ text: source, found: false, notKept, message: notKept.length ? 'Nothing this tool can keep; nothing changed.' : 'No password rules found in that text; nothing changed.' });
      return;
    }
    const { req, notes } = applyParsedRules(value, parsed);
    setPresetNote(null);
    onChange(req);
    setFilled({ text: source, found: true, notKept, message: `Filled in: ${[...parsed.understood, ...notes].join(', ')}.` });
  };

  /** Refuses a change that would take the text past the cap: the text stays as it was, and the status says why. */
  const tooLong = (next: string) => {
    const problem = rulesTextLengthProblem(next);
    if (problem) setRefused({ text, message: `Not pasted. ${problem}` });
    return problem !== undefined;
  };

  const shown = filled && filled.text === text ? filled : null;
  const refusal = refused && refused.text === text ? refused.message : null;
  // Read when the text changes, not on every render: a fill renders again with the same text.
  const parsedPreview = useMemo(() => (text.trim() ? read(text) : null), [text]);
  const preview = parsedPreview?.understood ?? null;
  const notKept = shown ? shown.notKept : (parsedPreview?.unsupported ?? []);
  const status = refusal
    ? refusal
    : shown
      ? shown.message
      : preview === null
        ? 'Paste the rules from the sign-up page; whatever they do not mention stays as it is.'
        : preview.length
          ? `Understood: ${preview.join(', ')}.`
          : notKept.length
            ? 'Nothing this tool can keep yet.'
            : 'No password rules recognised yet.';

  return (
    <section className="site-rules" aria-labelledby="site-rules-heading">
      <h3 id="site-rules-heading">Site rules</h3>
      <div className="presets">
        {SITE_PRESETS.map((p) => (
          <button
            type="button"
            key={p.label}
            className={p === active ? 'preset active' : 'preset'}
            aria-pressed={p === active}
            onClick={() => {
              const { req, notes } = applyPreset(value, p.rules);
              setPresetNote(notes.length ? { made: req, message: `${p.label}: ${notes.join(', ')}.` } : null);
              onChange(req);
            }}
            title={p.hint}
          >
            <strong>{p.label}</strong>
            <small>{p.note}</small>
          </button>
        ))}
      </div>
      {note && (
        <p className="hint preset-note" role="status">
          {note}
        </p>
      )}
      <div className="paste-rules" id="paste-rules">
        <h3>Paste the site's rules</h3>
        <textarea
          aria-label="The site's password rules"
          rows={3}
          spellCheck={false}
          placeholder="Must be 8-20 characters and include at least one number and one of !@#$%"
          value={text}
          maxLength={MAX_RULES_TEXT_LENGTH}
          onPaste={(e) => {
            // The text as it would be once pasted, the selection replaced; past the cap, nothing is pasted.
            const box = e.currentTarget;
            const next = box.value.slice(0, box.selectionStart) + (e.clipboardData?.getData('text') ?? '') + box.value.slice(box.selectionEnd);
            if (tooLong(next)) e.preventDefault();
            else pasting.current = true;
          }}
          onChange={(e) => {
            const next = e.target.value;
            const paste = pasting.current;
            pasting.current = false;
            if (tooLong(next)) return; // a drop or an input past maxLength: refused as a paste is
            setText(next);
            // A paste fills the form at once; typed text waits for "Fill in".
            if (paste) fill(next);
          }}
        />
        <div className="paste-actions">
          <div className="paste-status">
            <p className={(shown && !shown.found) || refusal ? 'field-error' : 'hint'} role="status">
              {status}
            </p>
            {text.length >= MAX_RULES_TEXT_LENGTH && !refusal && <p className="hint">The box is full: it holds at most {MAX_RULES_TEXT_LENGTH} characters.</p>}
            {notKept.length > 0 && (
              <p className="field-error" role="alert" data-testid="rules-not-kept">
                Not kept: {notKept.join('; ')}.
              </p>
            )}
          </div>
          <button type="button" disabled={!text.trim()} onClick={() => fill(text)}>
            Fill in
          </button>
        </div>
      </div>
    </section>
  );
});
