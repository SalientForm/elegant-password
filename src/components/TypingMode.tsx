import { TYPING_MODES } from '../lib/difficulty';
import { matchesProfile, modeLabel, withProfile } from '../lib/modeProfiles';
import { usePasswords } from '../state/PasswordsProvider';

/**
 * How the passwords will be typed: the first part of the Presets card. Picking a mode fills in the options that
 * suit it (strength, comfort and style; never the site's rules) in the
 * Requirement options, as a draft: every difficulty score on screen (cards,
 * My list, the typing test) previews the mode at once, and Submit applies
 * the mode and its options together, drawing a new sentence (the options
 * reshape it). While the options have been edited away from the mode's, a
 * button puts them back.
 */
export function TypingMode() {
  const { typingMode, setTypingMode, draft, setReq } = usePasswords();
  const matches = matchesProfile(draft.req, typingMode);
  return (
    <section className="typing-mode" aria-labelledby="typing-mode-heading">
      <h3 id="typing-mode-heading">Mode</h3>
      <div className="segmented two" role="group" aria-labelledby="typing-mode-heading">
        {TYPING_MODES.map((m) => (
          <button type="button" key={m.id} className={typingMode === m.id ? 'active' : ''} aria-pressed={typingMode === m.id} onClick={() => setTypingMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">
        {TYPING_MODES.find((m) => m.id === typingMode)!.hint} Difficulty scores are for this mode. Picking a mode fills in its options under Requirement
        options; Submit applies them and draws a new sentence.
      </p>
      {!matches && (
        <div className="mode-options-differ">
          <p className="hint">The options differ from this mode's.</p>
          <button type="button" className="ghost" onClick={() => setReq(withProfile(draft.req, typingMode).req)}>
            Use {modeLabel(typingMode)} options
          </button>
        </div>
      )}
    </section>
  );
}
