import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { copyText } from './clipboard';

interface Props {
  text: string;
  className?: string;
  /** How long the "Copied!" bubble stays, in ms. */
  showFor?: number;
  /** The element, for a Copy button's selection fallback. */
  ref?: React.Ref<HTMLElement>;
  children: React.ReactNode;
}

interface Bubble {
  x: number;
  y: number;
  message: string;
}

/**
 * Click the password to copy it. A small "Copied!" bubble appears next to
 * the cursor and goes away after two seconds. When the clipboard is
 * unavailable the text is selected instead and the bubble says so.
 */
export function ClickToCopy({ text, className, showFor = 2000, ref, children }: Props) {
  const [bubble, setBubble] = useState<Bubble>();
  const timer = useRef<number>(undefined);
  const el = useRef<HTMLElement>(null);
  const setEl = (node: HTMLElement | null) => {
    el.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async (e: React.MouseEvent<HTMLElement>) => {
    const { clientX: x, clientY: y } = e;
    const ok = await copyText(text, el.current);
    setBubble({ x, y, message: ok ? 'Copied!' : 'Selected: press Ctrl+C' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBubble(undefined), showFor);
  };

  return (
    <>
      <code
        ref={setEl}
        className={`${className ?? ''} click-to-copy`.trim()}
        role="button"
        tabIndex={0}
        aria-label={`Copy ${text}`}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            void onClick({ clientX: r.left + r.width / 2, clientY: r.top } as React.MouseEvent<HTMLElement>);
          }
        }}
      >
        {children}
      </code>
      {bubble &&
        createPortal(
          <span className="copy-bubble" role="status" style={{ left: bubble.x + 12, top: bubble.y - 8 }}>
            {bubble.message}
          </span>,
          document.body,
        )}
    </>
  );
}
