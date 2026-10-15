import { useMemo, useState } from 'react';
import { buildSpecPrompt } from '../lib/specPrompt';

export function FunPage() {
  const prompt = useMemo(() => buildSpecPrompt(), []);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'elegant-passwords-spec.md' });
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <button type="button" onClick={download}>
            Download .md
          </button>
        </div>
      </div>
      <pre className="prompt">{prompt}</pre>
    </section>
  );
}
