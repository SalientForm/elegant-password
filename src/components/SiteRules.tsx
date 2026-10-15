import { useRef, useState } from 'react';
import { separatorProblem, type Requirements } from '../lib/generate';
import { applyParsedRules, parseRuleText } from '../lib/ruleText';
import { matchingPreset, SITE_PRESETS, withRules } from '../lib/sitePresets';

interface Props {
  value: Requirements;
  onChange: (next: Requirements) => void;
}

interface Filled {
  /** The text it was filled from: the message holds until the text changes. */
  text: string;
  message: string;
  found: boolean;
}

/**
 * One-tap rule sets, and a box for the site's own wording. Both only change
 * the rule fields, and only in the draft, like any other edit: nothing sticks
 * until it is submitted.
 */
export function SiteRules({ value, onChange }: Props) {
  const active = matchingPreset(value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [filled, setFilled] = useState<Filled | null>(null);
  const pasting = useRef(false);
  // Set when a preset or the pasted rules ruled out the chosen separator, so the warning shows where the change was made.
  const [brokeSeparator, setBrokeSeparator] = useState(false);
  const separatorIssue = brokeSeparator ? separatorProblem(value.separator, value) : undefined;
  const change = (next: Requirements) => {
    setBrokeSeparator(!separatorProblem(value.separator, value) && !!separatorProblem(next.separator, next));
    onChange(next);
  };

  const fill = (source: string) => {
    const parsed = parseRuleText(source);
    if (!parsed.understood.length) {
      setFilled({ text: source, found: false, message: 'No password rules found in that text; nothing changed.' });
      return;
    }
    const { req, notes } = applyParsedRules(value, parsed);
    change(req);
    setFilled({ text: source, found: true, message: `Filled in: ${[...parsed.understood, ...notes].join(', ')}.` });
  };

  const shown = filled && filled.text === text ? filled : null;
  const preview = text.trim() ? parseRuleText(text).understood : null;
  const status = shown
    ? shown.message
    : preview === null
      ? 'Paste the rules from the sign-up page; whatever they do not mention stays as it is.'
      : preview.length
        ? `Understood: ${preview.join(', ')}.`
        : 'No password rules recognised yet.';

  return (
    <fieldset className="site-rules">
      <legend>Site rules</legend>
      <div className="presets">
        {SITE_PRESETS.map((p) => (
          <button
            type="button"
            key={p.label}
            className={p === active ? 'preset active' : 'preset'}
            aria-pressed={p === active}
            onClick={() => change(withRules(value, p.rules))}
            title={p.hint}
          >
            <strong>{p.label}</strong>
            <small>{p.note}</small>
          </button>
        ))}
      </div>
      {separatorIssue && <p className="field-error">{separatorIssue} Pick another under Style, or leave it empty for the fastest allowed.</p>}
      <button type="button" className="ghost paste-toggle" aria-expanded={open} aria-controls={open ? 'paste-rules' : undefined} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> Paste the site's rules
      </button>
      {open && (
        <div className="paste-rules" id="paste-rules">
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
            <p className={shown && !shown.found ? 'field-error' : 'hint'} role="status">
              {status}
            </p>
            <button type="button" disabled={!text.trim()} onClick={() => fill(text)}>
              Fill in
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
