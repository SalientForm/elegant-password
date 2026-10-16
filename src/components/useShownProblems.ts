import { useEffect, useReducer, useRef } from 'react';
import type { RuleProblem } from '../lib/validation';

/** How long typing in a number field must pause before a new problem shows. */
export const SETTLE_MS = 700;

/**
 * The rule problems to show. A number field commits every valid prefix as it
 * is typed, so "16" passes through "1" and would flash "minimum above
 * maximum"; while a number is being typed, new problems wait for a pause or
 * for the field to lose focus. Problems that are fixed go at once. This only
 * delays what is shown: submitting still refuses any draft with problems.
 *
 * Typing is noted in a ref, not state: a re-render between the browser
 * changing a controlled input and React's change handler reading it would
 * put the old value back ("10" typed over "5" became "510").
 */
export function useShownProblems(live: RuleProblem[]): RuleProblem[] {
  const typing = useRef(false);
  const held = useRef(live);
  const timer = useRef<number | undefined>(undefined);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const isNumber = (t: EventTarget | null) => t instanceof HTMLInputElement && t.type === 'number';
    const settle = () => {
      window.clearTimeout(timer.current);
      if (!typing.current) return;
      typing.current = false;
      rerender();
    };
    const onInput = (e: Event) => {
      if (!isNumber(e.target)) return;
      typing.current = true; // read by the render the field's own change handler causes
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(settle, SETTLE_MS);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isNumber(e.target)) settle();
    };
    // Capture, so typing is noted before the field's own change handler commits the value.
    document.addEventListener('input', onInput, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!typing.current) {
    held.current = live;
    return live;
  }
  const still = new Set(live.map((p) => p.message));
  return held.current.filter((p) => still.has(p.message));
}
