import { useId, useRef, useState } from 'react';

interface Props {
  password: string;
  /** The truncated display element. */
  children: React.ReactNode;
}

/** Whether the password display inside the anchor is cut short by its column. */
export function isTruncated(anchor: HTMLElement | null): boolean {
  const el = anchor?.querySelector<HTMLElement>('.password') ?? anchor;
  return !!el && el.scrollWidth > el.clientWidth + 1;
}

/**
 * A full-password tip for a password cut short by its column. It opens only
 * when the text really is cut off: a password that fits gets no tip and no
 * rollover. Unlike the browser's own tooltip it appears at once on hover or
 * focus, stays while the pointer is over it, and its text can be selected
 * and copied. Escape closes it.
 */
export function PasswordTip({ password, children }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const id = useId();
  const show = () => setOpen(isTruncated(anchor.current));
  return (
    <span
      ref={anchor}
      className="pw-tip-anchor"
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
          <code>{password}</code>
        </span>
      )}
    </span>
  );
}
