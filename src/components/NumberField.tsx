import { useEffect, useState } from 'react';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'type'>;

interface Props extends InputProps {
  value: number | null;
  min: number;
  max: number;
  /** Called with every valid whole number typed, and with the clamped value on blur. */
  onCommit: (value: number | null) => void;
  /** An empty field means "no value" and commits null. */
  allowEmpty?: boolean;
}

/**
 * A number input you can type through. The text is kept as typed, so "1"
 * on the way to "10" is not snapped to the minimum; only valid whole
 * numbers in range are committed as you type, and leaving the field clamps
 * whatever is there into range (or restores the last value).
 */
export function NumberField({ value, min, max, onCommit, allowEmpty = false, onFocus, onBlur, onKeyDown, ...rest }: Props) {
  const show = (v: number | null) => (v === null ? '' : String(v));
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);

  // Changes from outside (a preset button, a reset) show up unless the user is mid-edit.
  useEffect(() => {
    if (!editing) setText(show(value));
  }, [value, editing]);

  const parse = (s: string): number | null | undefined => {
    if (s.trim() === '') return allowEmpty ? null : undefined;
    const n = Number(s);
    return Number.isInteger(n) ? n : undefined;
  };
  /** Clamp whatever is typed into range (or restore the last value) and commit it. */
  const commit = () => {
    const n = parse(text);
    if (n === null) {
      onCommit(null);
      setText('');
    } else if (n === undefined) {
      setText(show(value));
    } else {
      const clamped = Math.min(max, Math.max(min, n));
      onCommit(clamped);
      setText(String(clamped));
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      {...rest}
      onFocus={(e) => {
        setEditing(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const s = e.target.value;
        setText(s);
        const n = parse(s);
        if (n === null) onCommit(null);
        else if (n !== undefined && n >= min && n <= max) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(); // so what Enter submits is what the field shows, clamped, not an earlier valid prefix
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        commit();
        onBlur?.(e);
      }}
    />
  );
}
