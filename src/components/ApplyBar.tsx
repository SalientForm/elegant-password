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
  /** Whether the Passwords page is the one showing. It stays mounted behind Scoring and Fun, and its keys must not act there. Defaults to true. */
  active?: boolean;
}

/**
 * A snackbar at the foot of the page while there are unapplied changes: a
 * card, 1.5 rem above the bottom, saying so at its left (or naming the first
 * problem, with Show) and holding the two buttons at its right. Discard
 * throws the changes away, Submit changes saves them and regenerates.
 * While they are showing, Enter anywhere submits (except on a button, link
 * or select, where Enter has its own job) and Escape discards; in a text
 * field Escape means back: it leaves the field and discards nothing, so the
 * next Escape discards. Keys that are part of an IME composition are left
 * alone, and so is every key while another page is showing. Gone as soon as there is nothing to submit. Submitting while a batch is still being
 * made simply supersedes that batch; the one thing that disables Submit is a
 * contradiction in the rules, said above the buttons until it is fixed.
 */
export function ApplyBar({ onShowProblems, active = true }: Props) {
  const { dirty, apply, discard, problems: live } = usePasswords();
  const problems = useShownProblems(live); // apply() itself still refuses any draft with problems

  useEffect(() => {
    if (!dirty || !active) return undefined;
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
  }, [dirty, active, apply, discard]);

  if (!dirty) return null;
  const blocked = problems.length > 0;
  return (
    <div className="apply-bar" role="region" aria-label="Unapplied changes">
      <div className={blocked ? 'snackbar blocked' : 'snackbar'}>
        {blocked ? (
          <p className="snackbar-text" id="apply-problems" role="alert">
            <strong>{problems.length === 1 ? 'Fix this to submit:' : `Fix ${problems.length} problems to submit:`}</strong> {problems[0]!.message}
          </p>
        ) : (
          <p className="snackbar-text">Unapplied changes</p>
        )}
        <div className="snackbar-actions">
          {blocked && onShowProblems && (
            <button type="button" className="ghost" onClick={onShowProblems}>
              Show
            </button>
          )}
          <button type="button" className="ghost" onClick={discard} title="Escape (outside a text field; in one, Escape leaves the field first)">
            Discard
          </button>
          <button
            type="button"
            className="primary"
            onClick={apply}
            disabled={blocked}
            aria-describedby={blocked ? 'apply-problems' : undefined}
            title={blocked ? 'Fix the problems in the options first' : 'Enter'}
          >
            Submit changes
          </button>
        </div>
      </div>
    </div>
  );
}
