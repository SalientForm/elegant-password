import { TYPING_MODES } from '../lib/difficulty';
import { formatProfileValue, MODE_MEASURES, MODE_PROFILES, PROFILE_KEYS, PROFILE_LABELS, unusedIn } from '../lib/modeProfiles';

/**
 * The options each typing mode fills in, one column per mode, and what they
 * measure. An option a mode does not use shows "—" with a numbered footnote
 * giving the reason.
 */
export function ModeOptionsTable() {
  // Each distinct reason gets one footnote number, in column order.
  const footnotes: string[] = [];
  for (const m of TYPING_MODES) for (const u of unusedIn(m.id)) if (!footnotes.includes(u.reason)) footnotes.push(u.reason);
  const note = (reason: string) => footnotes.indexOf(reason) + 1;
  return (
    <>
      <div className="table-scroll">
        <table className="rubric stack" aria-label="Options by mode">
          <thead>
            <tr>
              <th>Option</th>
              {TYPING_MODES.map((m) => (
                <th key={m.id}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROFILE_KEYS.map((key) => (
              <tr key={key}>
                <td data-label="Option">{PROFILE_LABELS[key]}</td>
                {TYPING_MODES.map((m) => {
                  const unused = MODE_PROFILES[m.id].unused.find((u) => u.key === key);
                  return (
                    <td key={m.id} data-label={m.label}>
                      {/* One child beside the stacked label, so the footnote mark stays on the value's line on a phone. */}
                      <span>
                        {formatProfileValue(key, m.id)}
                        {unused && <sup> {note(unused.reason)}</sup>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnotes.length > 0 && (
        <ol className="footnotes">
          {footnotes.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ol>
      )}
    </>
  );
}

/** What each mode's options measure at the Typical site rules, from the committed measurement. */
export function ModeMeasuresTable() {
  const { asOf, n, rules, byMode, defaults } = MODE_MEASURES;
  return (
    <>
      <p className="hint">
        At the {rules} rules, {n.toLocaleString('en')} suggestions per mode, measured {asOf}. Difficulty is the mean in the mode's own
        rubric; "defaults" is the ten-finger options scored in that mode, the figure a mode's options have to beat.
      </p>
      <div className="table-scroll">
        <table className="rubric stack" aria-label="Measured by mode">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Difficulty</th>
              <th>Defaults, in this mode</th>
              <th>Bits</th>
              <th>Memorability</th>
              <th>Length</th>
            </tr>
          </thead>
          <tbody>
            {TYPING_MODES.map((m) => {
              const r = byMode[m.id];
              return (
                <tr key={m.id}>
                  <td data-label="Mode">{m.label}</td>
                  <td data-label="Difficulty">{r.difficulty.toFixed(1)}</td>
                  <td data-label="Defaults, in this mode">{defaults[m.id].toFixed(1)}</td>
                  <td data-label="Bits">{r.bits.toFixed(1)}</td>
                  <td data-label="Memorability">{r.memorability.toFixed(1)}</td>
                  <td data-label="Length">{r.length.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
