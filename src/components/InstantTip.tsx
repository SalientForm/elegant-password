import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TipProps {
  /** What the tip shows. */
  content: React.ReactNode;
  /** Whether to open; defaults to always. */
  when?: (anchor: HTMLElement | null) => boolean;
  className?: string;
  /** Whether the anchor itself is a tab stop; false when it wraps something already focusable. */
  focusable?: boolean;
  children: React.ReactNode;
}

const EDGE = 8; // px kept clear of the viewport edges
const GAP = 4; // px between the anchor and the tip

/**
 * The app's own tip: appears at once on hover or focus (no browser delay),
 * stays while the pointer is over it, can be selected, and closes on leave,
 * scroll or Escape. It is rendered at the document level with fixed
 * positioning, so no card or column can clip it, and it is kept inside
 * the viewport: shifted left near the right edge, flipped above the anchor
 * when there is no room below.
 */
export function InstantTip({ content, when = () => true, className, focusable = true, children }: TipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const closing = useRef<number>(undefined);
  const id = useId();

  const show = () => {
    window.clearTimeout(closing.current);
    setOpen(when(anchor.current));
  };
  const hide = () => setOpen(false);
  /** Leaving the anchor gives the pointer a moment to reach the tip. */
  const leaveSoon = () => {
    window.clearTimeout(closing.current);
    closing.current = window.setTimeout(hide, 120);
  };
  useEffect(() => () => window.clearTimeout(closing.current), []);

  // Place the tip once it exists, then keep it on screen.
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    let left = a.left;
    let top = a.bottom + GAP;
    if (left + t.width > window.innerWidth - EDGE) left = window.innerWidth - EDGE - t.width;
    if (left < EDGE) left = EDGE;
    if (top + t.height > window.innerHeight - EDGE) top = Math.max(EDGE, a.top - GAP - t.height);
    setPos({ left, top });
  }, [open, content]);

  // Anything scrolling moves the anchor away from a fixed tip: close it.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [open]);

  return (
    <span
      ref={anchor}
      className={`pw-tip-anchor${className ? ` ${className}` : ''}`}
      tabIndex={focusable ? 0 : -1}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={leaveSoon}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation(); // closing the tip is all Escape does here
          hide();
        }
      }}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tip}
            role="tooltip"
            id={id}
            className="pw-tip"
            style={pos ? { left: pos.left, top: pos.top, visibility: 'visible' } : { left: 0, top: 0, visibility: 'hidden' }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
