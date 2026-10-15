import { useMemo, useRef } from 'react';
import { buildSpecPrompt } from '../lib/specPrompt';
import { CopyButton } from './CopyButton';

/** How long a download link's blob URL stays valid after the click. Some browsers start the download asynchronously. */
export const REVOKE_DELAY_MS = 10_000;

/** Offer `text` as a file download. The object URL is revoked later, not synchronously, so the download is never cancelled. */
export function downloadText(text: string, filename: string, type = 'text/markdown'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function FunPage() {
  const prompt = useMemo(() => buildSpecPrompt(), []);
  const pre = useRef<HTMLPreElement>(null);

  return (
    <section className="fun">
      <div className="fun-head">
        <div>
          <h2>Rebuild this app from one prompt</h2>
          <p className="hint">
            A full spec of every option and feature and how each works, generated from the app’s own settings, so it
            always matches. Paste it into an AI coding assistant to build Elegant Passwords from scratch.
          </p>
        </div>
        <div className="actions">
          <span className="bits-label">
            {prompt.split(/\s+/).length.toLocaleString('en')} words
          </span>
          <CopyButton text={prompt} fallback={pre} label="Copy prompt" />
          <button type="button" onClick={() => downloadText(prompt, 'elegant-passwords-spec.md')}>
            Download .md
          </button>
        </div>
      </div>
      <pre className="prompt" ref={pre}>
        {prompt}
      </pre>
    </section>
  );
}
