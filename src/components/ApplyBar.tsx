import { useEffect } from 'react';
import { usePasswords } from '../state/PasswordsProvider';

/** Controls where Enter already means something else; the global shortcut leaves them alone. */
const OWN_ENTER = new Set(['BUTTON', 'A', 'SELECT', 'TEXTAREA']);

/**
 * Two buttons that float over the page while there are unapplied changes:
 * Discard throws them away, Submit changes saves them and regenerates.
 * While they are showing, Enter anywhere submits (except on a button, link
 * or select, where Enter has its own job) and Escape discards. Gone as soon
 * as there is nothing to submit. Never disabled: submitting while a batch
 * is still being made simply supersedes that batch.
 */
export function ApplyBar() {
  const { dirty, apply, discard } = usePasswords();

  useEffect(() => {
    if (!dirty) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !OWN_ENTER.has(tag))) {
        e.preventDefault();
        // An input commits its own value on this same key press; let that render first, then apply what it left.
        if (tag === 'INPUT') queueMicrotask(apply);
        else apply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        discard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, apply, discard]);

  if (!dirty) return null;
  return (
    <div className="apply-bar" role="region" aria-label="Unapplied changes">
      <button type="button" className="floating ghost" onClick={discard} title="Escape">
        Discard
      </button>
      <button type="button" className="floating primary" onClick={apply} title="Enter">
        Submit changes
      </button>
    </div>
  );
}
