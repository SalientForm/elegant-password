import { useRef, useState } from 'react';
import type { Requirements } from '../lib/generate';
import { applyParsedRules, parseRuleText } from '../lib/ruleText';
import { applyPreset, matchingPreset, SITE_PRESETS } from '../lib/sitePresets';

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
 * cut down: it is listed under "Not kept", with why.
 */
export function SiteRules({ value, onChange }: Props) {
  const active = matchingPreset(value);
  const [text, setText] = useState('');
  const [filled, setFilled] = useState<Filled | null>(null);
  const pasting = useRef(false);
  const [presetNote, setPresetNote] = useState<PresetNote | null>(null);
  const note = presetNote && JSON.stringify(presetNote.made) === JSON.stringify(value) ? presetNote.message : null;

  const fill = (source: string) => {
    const parsed = parseRuleText(source);
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

  const shown = filled && filled.text === text ? filled : null;
  const parsedPreview = text.trim() ? parseRuleText(text) : null;
  const preview = parsedPreview?.understood ?? null;
  const notKept = shown ? shown.notKept : (parsedPreview?.unsupported ?? []);
  const status = shown
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
          onPaste={() => (pasting.current = true)}
          onChange={(e) => {
            setText(e.target.value);
            // A paste fills the form at once; typed text waits for "Fill in".
            if (pasting.current) fill(e.target.value);
            pasting.current = false;
          }}
        />
        <div className="paste-actions">
          <div className="paste-status">
            <p className={shown && !shown.found ? 'field-error' : 'hint'} role="status">
              {status}
            </p>
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
}
