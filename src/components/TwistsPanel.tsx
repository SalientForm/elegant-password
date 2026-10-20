import { useState } from 'react';
import { MAX_TWISTS, type Requirements, resolveSeparator } from '../lib/generate';
import { isFarShift, isPinkyStretch } from '../lib/keyboard';
import { DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../lib/mappingSettings';
import { BUILT_IN_MAPPINGS, MAPPING_KIND_LABELS, mappingKey, validateMapping, type Mapping, type MappingKind } from '../lib/twists';

interface Props {
  req: Requirements;
  onReqChange: (next: Requirements) => void;
  settings: MappingSettings;
  onSettingsChange: (next: MappingSettings) => void;
  /**
   * Whether a mapping can apply at all to what is being made (its "replace"
   * letters occur somewhere). Mappings that cannot are shown disabled. Omit
   * when any word could come up, as when a sentence is made up.
   */
  relevant?: (m: Pick<Mapping, 'from'>) => boolean;
}

/** Whether a mapping's letters occur in any of these words. */
export const relevantTo = (words: readonly string[]) => (m: Pick<Mapping, 'from'>) => words.some((w) => w.includes(m.from));

const show = (to: string) => (to === '' ? '–' : to);

/** The separator the requirements resolve to, or undefined while they are invalid or the separator is a space. */
function separatorInUse(req: Requirements): string | undefined {
  try {
    const s = resolveSeparator(req);
    return s.trim() ? s : undefined;
  } catch {
    return undefined;
  }
}

export function TwistsPanel({ req, onReqChange, settings, onSettingsChange, relevant }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string>();

  const disabled = new Set(settings.disabled);
  const allowed = new Set(req.allowedSymbols);
  const separator = separatorInUse(req);

  /** Why a mapping cannot be used with the current requirements, if it cannot. */
  const blocked = (m: Pick<Mapping, 'to'>): string | undefined => {
    for (const c of m.to) {
      if (/[a-z0-9]/.test(c)) continue;
      if (!allowed.has(c)) return `"${c}" is not an allowed symbol`;
      if (c === separator) return `"${c}" is the separator, which never comes from a swap`;
      if (req.avoidPinkyStretch && isPinkyStretch(c)) return `"${c}" needs a pinky stretch`;
      if (req.shiftReach && isFarShift(c)) return `"${c}" needs a Shift key out of one hand's reach`;
    }
    return undefined;
  };

  const toggle = (key: string) =>
    onSettingsChange({
      ...settings,
      disabled: disabled.has(key) ? settings.disabled.filter((k) => k !== key) : [...settings.disabled, key],
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const f = from.trim().toLowerCase();
    const problem = validateMapping(f, to);
    const exists = [...BUILT_IN_MAPPINGS, ...settings.custom].some((m) => mappingKey(m) === mappingKey({ from: f, to }));
    if (problem || exists) {
      setError(problem ?? 'That mapping already exists.');
      return;
    }
    onSettingsChange({ ...settings, custom: [...settings.custom, { from: f, to }] });
    setFrom('');
    setTo('');
    setError(undefined);
  };

  const groups = (['symbol', 'digit', 'spelling'] as MappingKind[]).map((kind) => ({
    kind,
    mappings: BUILT_IN_MAPPINGS.filter((m) => m.kind === kind),
  }));
  // On: switched on, usable under these rules, and able to apply to what is being made.
  const usable = (m: Mapping) => !blocked(m) && (relevant ? relevant(m) : true);
  const enabledCount = BUILT_IN_MAPPINGS.filter((m) => !disabled.has(mappingKey(m)) && usable(m)).length + settings.custom.filter((m) => usable({ ...m, kind: 'custom' })).length;

  return (
    <section className="panel twists">
      <h2>Swaps</h2>
      <p className="hint">
        Symbol swaps and misspellings dropped onto random letters, like <code>amber → @mber</code>. Where they land is
        random, so each one adds strength.
      </p>

      <fieldset>
        <legend>Minimum swaps</legend>
        <div className="segmented four">
          {Array.from({ length: MAX_TWISTS + 1 }, (_, n) => (
            <button
              type="button"
              key={n}
              className={req.twists === n ? 'active' : ''}
              aria-pressed={req.twists === n}
              onClick={() => onReqChange({ ...req, twists: n })}
            >
              {n === 0 ? 'None' : n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Mappings <span className="count">{enabledCount} on</span>
        </legend>
        {relevant && <p className="hint">A greyed swap's letters are not in your sentence, so it cannot apply.</p>}
        {groups.map((g) => (
          <div className="mapping-group" key={g.kind}>
            <h3>{MAPPING_KIND_LABELS[g.kind]}</h3>
            <div className="mappings">
              {g.mappings.map((m) => {
                const key = mappingKey(m);
                const why = blocked(m);
                const applies = relevant ? relevant(m) : true;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`mapping${disabled.has(key) ? '' : ' on'}${why ? ' blocked' : ''}${applies ? '' : ' irrelevant'}`}
                    aria-pressed={!disabled.has(key)}
                    disabled={!applies}
                    title={!applies ? `“${m.from}” is not in your sentence` : why ? `Skipped: ${why}` : disabled.has(key) ? 'Off: click to use' : 'On: click to skip'}
                    onClick={() => toggle(key)}
                  >
                    {m.from}→{show(m.to)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mapping-group">
          <h3>{MAPPING_KIND_LABELS.custom}</h3>
          {settings.custom.length > 0 && (
            <div className="mappings">
              {settings.custom.map((m) => {
                const why = blocked(m);
                const applies = relevant ? relevant(m) : true;
                return (
                  <span key={mappingKey(m)} className={`mapping on custom${why ? ' blocked' : ''}${applies ? '' : ' irrelevant'}`} title={!applies ? `“${m.from}” is not in your sentence` : why && `Skipped: ${why}`}>
                    {m.from}→{show(m.to)}
                    <button
                      type="button"
                      aria-label={`Remove ${m.from} to ${show(m.to)}`}
                      onClick={() =>
                        onSettingsChange({ ...settings, custom: settings.custom.filter((c) => mappingKey(c) !== mappingKey(m)) })
                      }
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <form
            className="add-mapping"
            onSubmit={add}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.stopPropagation(); // Enter here adds the mapping, never submits the draft
            }}
          >
            <input aria-label="Replace" placeholder="replace" value={from} onChange={(e) => setFrom(e.target.value)} spellCheck={false} />
            <span>→</span>
            <input aria-label="With" placeholder="with" value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} />
            <button type="submit">Add</button>
          </form>
          {error && <p className="field-error">{error}</p>}
          <p className="hint">Leave “with” empty to drop the letters. Saved in this browser.</p>
        </div>
      </fieldset>

      <button
        type="button"
        className="ghost reset"
        onClick={() => onSettingsChange(DEFAULT_MAPPING_SETTINGS)}
        disabled={settings.disabled.length === 0 && settings.custom.length === 0}
      >
        Reset mappings to defaults
      </button>
    </section>
  );
}
