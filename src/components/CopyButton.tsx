import { useEffect, useRef, useState } from 'react';
import { COPY_MESSAGES, copyText, type CopyState } from './clipboard';

interface Props {
  text: string;
  /** Element whose text is selected when the clipboard is unavailable. */
  fallback?: React.RefObject<Element | null>;
  label?: string;
  className?: string;
}

/** A Copy button that reports success or, when the clipboard is blocked, selects the text instead. */
export function CopyButton({ text, fallback, label = 'Copy', className }: Props) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(text, fallback?.current);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1500 : 4000);
  };

  return (
    <>
      <button type="button" className={className} onClick={copy}>
        {state === 'copied' ? 'Copied' : label}
      </button>
      <span role="status" className={state === 'failed' ? 'copy-status failed' : 'copy-status'}>
        {state === 'failed' ? COPY_MESSAGES.failed : ''}
      </span>
    </>
  );
}
