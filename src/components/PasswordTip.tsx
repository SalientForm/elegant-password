import { useId, useState } from 'react';

interface Props {
  password: string;
  /** The truncated display element. */
  children: React.ReactNode;
}

/**
 * A full-password tip for a password cut short by its column. Unlike the
 * browser's own tooltip it appears at once on hover or focus, stays while
 * the pointer is over it, and its text can be selected and copied. Escape
 * closes it.
 */
export function PasswordTip({ password, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="pw-tip-anchor"
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
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
