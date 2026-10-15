import { useEffect } from 'react';
import { usePasswords } from '../state/PasswordsProvider';

/**
 * Floats in the corner while there are unapplied changes. Apply saves them
 * and regenerates; Discard throws them away. Ctrl+Enter (⌘+Enter) applies.
 * Gone as soon as there is nothing to apply. Never disabled: applying while
 * a batch is still being made simply supersedes that batch.
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
      <span>Changes not applied yet.</span>
      <button type="button" className="ghost" onClick={discard}>
        Discard
      </button>
      <button type="button" className="primary" onClick={apply} title="Ctrl+Enter">
        Apply changes
      </button>
    </div>
  );
}
