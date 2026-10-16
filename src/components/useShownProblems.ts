import { useEffect, useRef, useState } from 'react';
import type { RuleProblem } from '../lib/validation';

/** How long typing in a number field must pause before a new problem shows. */
export const SETTLE_MS = 700;

/**
 * The rule problems to show. A number field commits every valid prefix as it
 * is typed, so "16" passes through "1" and would flash "minimum above
 * maximum"; while a number is being typed, new problems wait for a pause or
 * for the field to lose focus. Problems that are fixed go at once. This only
 * delays what is shown: submitting still refuses any draft with problems.
 */
export function useShownProblems(live: RuleProblem[]): RuleProblem[] {
  const [typing, setTyping] = useState(false);
  const [held, setHeld] = useState(live);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const isNumber = (t: EventTarget | null) => t instanceof HTMLInputElement && t.type === 'number';
    const onInput = (e: Event) => {
      if (!isNumber(e.target)) return;
      setTyping(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setTyping(false), SETTLE_MS);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!isNumber(e.target)) return;
      window.clearTimeout(timer.current);
      setTyping(false);
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

  // Keyed on the messages: the caller builds a new list every render, and storing each one would render forever.
  const key = live.map((p) => p.message).join('\n');
  useEffect(() => {
    if (!typing) setHeld(live);
  }, [typing, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!typing) return live;
  const still = new Set(live.map((p) => p.message));
  return held.filter((p) => still.has(p.message));
}
