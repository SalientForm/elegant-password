import { useId, useRef, useState } from 'react';

interface TipProps {
  /** What the tip shows. */
  content: React.ReactNode;
  /** Whether to open; defaults to always. */
  when?: (anchor: HTMLElement | null) => boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The app's own tip: appears at once on hover or focus (no browser delay),
 * stays while the pointer is over it, can be selected, and closes on leave
 * or Escape.
 */
export function InstantTip({ content, when = () => true, className, children }: TipProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const id = useId();
  const show = () => setOpen(when(anchor.current));
  return (
    <span
      ref={anchor}
      className={`pw-tip-anchor${className ? ` ${className}` : ''}`}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation(); // closing the tip is all Escape does here
          setOpen(false);
        }
      }}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} className="pw-tip">
          {content}
        </span>
      )}
    </span>
  );
}

/** Whether the password display inside the anchor is cut short by its column. */
export function isTruncated(anchor: HTMLElement | null): boolean {
  const el = anchor?.querySelector<HTMLElement>('.password') ?? anchor;
  return !!el && el.scrollWidth > el.clientWidth + 1;
}

/**
 * A full-password tip for a password cut short by its column. It opens only
 * when the text really is cut off: a password that fits gets no tip and no
 * rollover.
 */
export function PasswordTip({ password, children }: { password: string; children: React.ReactNode }) {
  return (
    <InstantTip content={<code>{password}</code>} when={isTruncated}>
      {children}
    </InstantTip>
  );
}
