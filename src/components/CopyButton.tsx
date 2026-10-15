import { useEffect, useRef, useState } from 'react';
import { COPY_MESSAGES, copyText, type CopyState } from './clipboard';
import { CheckIcon, CopyIcon } from './icons';

interface Props {
  text: string;
  /** Element whose text is selected when the clipboard is unavailable. */
  fallback?: React.RefObject<Element | null>;
  label?: string;
  className?: string;
  /** Show an icon instead of the label; the label becomes the accessible name and tooltip. */
  icon?: boolean;
}

/** A Copy button that reports success or, when the clipboard is blocked, selects the text instead. */
export function CopyButton({ text, fallback, label = 'Copy', className, icon = false }: Props) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(text, fallback?.current);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1500 : 4000);
  };

  const name = state === 'copied' ? 'Copied' : label;
  return (
    <>
      <button type="button" className={icon ? `icon-button${className ? ` ${className}` : ''}` : className} onClick={copy} aria-label={icon ? name : undefined} title={icon ? name : undefined}>
        {icon ? state === 'copied' ? <CheckIcon /> : <CopyIcon /> : name}
      </button>
      <span role="status" className={state === 'failed' ? 'copy-status failed' : 'copy-status'}>
        {state === 'failed' ? COPY_MESSAGES.failed : ''}
      </span>
    </>
  );
}
