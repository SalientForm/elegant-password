import { useEffect } from 'react';
import { usePasswords } from '../state/PasswordsProvider';
import { useShownProblems } from './useShownProblems';

/** Controls where Enter already means something else; the global shortcut leaves them alone. */
const OWN_ENTER = new Set(['BUTTON', 'A', 'SELECT', 'TEXTAREA']);

/** Whether the key went to a text field, where Escape means "leave the field", not "discard the draft". */
const inTextField = (el: HTMLElement | null) =>
  !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes((el as HTMLInputElement).type)));

interface Props {
  /** Opens the options column at the first problem, wherever it is on screen. */
  onShowProblems?: () => void;
}

/**
 * Two buttons that float over the page while there are unapplied changes:
 * Discard throws them away, Submit changes saves them and regenerates.
 * While they are showing, Enter anywhere submits (except on a button, link
 * or select, where Enter has its own job) and Escape discards; in a text
 * field Escape means back: it leaves the field and discards nothing, so the
 * next Escape discards. Keys that are part of an IME composition are left
 * alone. Gone as soon as there is nothing to submit. Submitting while a batch is still being
 * made simply supersedes that batch; the one thing that disables Submit is a
 * contradiction in the rules, said above the buttons until it is fixed.
 */
export function ApplyBar({ onShowProblems }: Props) {
  const { dirty, apply, discard, problems: live } = usePasswords();
  const problems = useShownProblems(live); // apply() itself still refuses any draft with problems

  useEffect(() => {
    if (!dirty) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !OWN_ENTER.has(tag))) {
        e.preventDefault();
        // An input commits its own value on this same key press; let that render first, then apply what it left.
        if (tag === 'INPUT') queueMicrotask(apply);
        else apply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (inTextField(target)) target!.blur();
        else discard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, apply, discard]);

  if (!dirty) return null;
  const blocked = problems.length > 0;
  return (
    <div className="apply-bar" role="region" aria-label="Unapplied changes">
      {blocked && (
        <div className="apply-problems floating" id="apply-problems" role="alert">
          <p>
            <strong>{problems.length === 1 ? 'Fix this to submit:' : `Fix ${problems.length} problems to submit:`}</strong> {problems[0]!.message}
          </p>
          {onShowProblems && (
            <button type="button" className="ghost" onClick={onShowProblems}>
              Show
            </button>
          )}
        </div>
      )}
      <div className="apply-buttons">
        <button type="button" className="floating ghost" onClick={discard} title="Escape (outside a text field; in one, Escape leaves the field first)">
          Discard
        </button>
        <button
          type="button"
          className="floating primary"
          onClick={apply}
          disabled={blocked}
          aria-describedby={blocked ? 'apply-problems' : undefined}
          title={blocked ? 'Fix the problems in the options first' : 'Enter'}
        >
          Submit changes
        </button>
      </div>
    </div>
  );
}
