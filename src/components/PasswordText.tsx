import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observeResize } from './resize';

interface Props {
  password: string;
  className?: string;
  /** The element, for a Copy button's selection fallback. */
  ref?: React.Ref<HTMLElement>;
}

/**
 * A password on screen. Cut short by its column, it ends in an ellipsis and
 * becomes a button: a click or tap (Enter or Space from the keyboard) shows
 * the whole of it, wrapped onto as many lines as it needs, and the same
 * click folds it back. One that fits is plain text. Nothing here copies:
 * that is the Copy button's job on a touch screen, and the selection's on a
 * desktop.
 */
export function PasswordText({ password, className = 'password', ref }: Props) {
  const el = useRef<HTMLElement>(null);
  const setEl = (node: HTMLElement | null) => {
    el.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
  };
  const [cut, setCut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // A new password starts folded.
  useEffect(() => setRevealed(false), [password]);
  // Whether the column cuts it, measured again whenever it is resized; while it is shown whole there is nothing to measure.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || revealed) return undefined;
    const measure = () => setCut(node.scrollWidth > node.clientWidth + 1);
    measure();
    return observeResize(node, measure);
  }, [password, revealed]);
  const toggle = () => setRevealed((r) => !r);
  const button = cut || revealed;
  return (
    <code
      ref={setEl}
      className={`${className}${revealed ? ' revealed' : ''}${button ? ' can-reveal' : ''}`}
      {...(button
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-expanded': revealed,
            title: revealed ? 'Show less' : 'Show the whole password',
            onClick: toggle,
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggle();
              }
            },
          }
        : {})}
    >
      {password}
    </code>
  );
}
