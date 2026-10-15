import { useEffect } from 'react';
import { usePasswords } from '../state/PasswordsProvider';

/**
 * Two buttons that float over the page while there are unapplied changes:
 * Discard throws them away, Submit changes saves them and regenerates
 * (Ctrl+Enter or ⌘+Enter does the same). Gone as soon as there is nothing
 * to submit. Never disabled: submitting while a batch is still being made
 * simply supersedes that batch.
 */
export function ApplyBar() {
  const { dirty, apply, discard } = usePasswords();

  useEffect(() => {
    if (!dirty) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        apply();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, apply]);

  if (!dirty) return null;
  return (
    <div className="apply-bar" role="region" aria-label="Unapplied changes">
      <button type="button" className="floating ghost" onClick={discard}>
        Discard
      </button>
      <button type="button" className="floating primary" onClick={apply} title="Ctrl+Enter">
        Submit changes
      </button>
    </div>
  );
}
