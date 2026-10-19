import { TYPING_MODES } from '../lib/difficulty';
import { usePasswords } from '../state/PasswordsProvider';

/**
 * How the passwords will be typed. Every difficulty score (cards, My list,
 * the typing test) is for the chosen mode, and "Difficulty" order follows
 * it; the passwords themselves do not change. Takes effect at once.
 */
export function TypingModeCard() {
  const { typingMode, setTypingMode } = usePasswords();
  return (
    <section className="panel typing-mode" aria-labelledby="typing-mode-heading">
      <h2 id="typing-mode-heading">Mode</h2>
      <div className="segmented two" role="group" aria-labelledby="typing-mode-heading">
        {TYPING_MODES.map((m) => (
          <button type="button" key={m.id} className={typingMode === m.id ? 'active' : ''} aria-pressed={typingMode === m.id} onClick={() => setTypingMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">{TYPING_MODES.find((m) => m.id === typingMode)!.hint} Difficulty scores are for this mode.</p>
    </section>
  );
}
