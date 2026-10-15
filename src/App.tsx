import { useEffect, useState } from 'react';
import { ApplyBar } from './components/ApplyBar';
import { RubricPanel } from './components/Difficulty';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FunPage } from './components/FunPage';
import { RequirementsForm } from './components/RequirementsForm';
import { SelectedList } from './components/SelectedList';
import { SentenceInput, SentenceStrength } from './components/SentenceMode';
import { StrengthPanel } from './components/StrengthPanel';
import { SuggestionCard, type CardContext } from './components/SuggestionCard';
import { TabPanel, Tabs } from './components/Tabs';
import { TwistsPanel } from './components/TwistsPanel';
import type { Mode } from './lib/engine';
import { PasswordsProvider, usePasswords } from './state/PasswordsProvider';

type Page = 'main' | 'fun';
const pageFromHash = (): Page => (window.location.hash === '#/fun' ? 'fun' : 'main');

const MODE_TABS: { id: Mode; label: string }[] = [
  { id: 'generated', label: 'Make up a sentence' },
  { id: 'sentence', label: 'Use my sentence' },
];

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app">
        <nav className="topnav" aria-label="Pages">
          <a href="#/" className={page === 'main' ? 'active' : ''} aria-current={page === 'main' ? 'page' : undefined}>
            Elegant Passwords
          </a>
          <a href="#/fun" className={page === 'fun' ? 'active' : ''} aria-current={page === 'fun' ? 'page' : undefined}>
            Fun
          </a>
        </nav>
        <header>
          <h1>{page === 'fun' ? 'Fun' : 'Elegant Passwords'}</h1>
          <p>
            {page === 'fun'
              ? 'The whole app, described as one prompt.'
              : 'Passwords that read like a sentence, sit comfortably under your fingers, and are still hard to guess. Everything is generated in this browser tab; nothing is sent anywhere.'}
          </p>
        </header>
        <PasswordsProvider>
          {/* Kept mounted so settings and the sentence survive a visit to Fun. */}
          <div hidden={page !== 'main'}>
            <ElegantPasswords />
          </div>
        </PasswordsProvider>
        {page === 'fun' && <FunPage />}
      </div>
    </ErrorBoundary>
  );
}

export function ElegantPasswords() {
  const p = usePasswords();
  const { outcome, draft, applied } = p;
  const context: CardContext | undefined =
    outcome?.ok ? { separator: outcome.separator, minUppercase: applied.req.minUppercase, source: outcome.source } : undefined;
  const emptySentence = p.mode === 'sentence' && !applied.sentence.trim();
  const nothingToRun = p.mode === 'sentence' && !draft.sentence.trim();

  return (
    <main>
      <div className="sidebar">
        <RequirementsForm value={draft.req} onChange={p.setReq} />
        <TwistsPanel req={draft.req} onReqChange={p.setReq} settings={draft.mappingSettings} onSettingsChange={p.setMappingSettings} />
      </div>

      <div className="results" aria-busy={p.busy}>
        <Tabs tabs={MODE_TABS} value={p.mode} onChange={p.setMode} label="How to make the sentence" idPrefix="mode" />

        <TabPanel idPrefix="mode" id="generated" active={p.mode === 'generated'}>
          <p className="hint">A random sentence from the word lists, fitted to the rules on the left.</p>
        </TabPanel>
        <TabPanel idPrefix="mode" id="sentence" active={p.mode === 'sentence'}>
          <SentenceInput value={draft.sentence} onChange={p.setSentence} options={draft.sentenceOptions} onOptionsChange={p.setSentenceOptions} />
        </TabPanel>

        <div className="results-head">
          <h2>Suggestions</h2>
          <div className="actions">
            {p.busy && (
              <span className="working" role="status">
                Working…
              </span>
            )}
            <button type="button" className="primary" onClick={p.regenerate} disabled={nothingToRun} title={p.dirty ? 'Applies your changes too' : undefined}>
              New passwords
            </button>
          </div>
        </div>

        {emptySentence && !outcome?.ok && <p className="hint">Type a sentence to turn into a password, then apply it.</p>}
        {outcome && !outcome.ok && !emptySentence && (
          <p className="error" role="alert">
            {outcome.unexpected ? `Unexpected error: ${outcome.error}` : outcome.error}
          </p>
        )}

        {outcome?.ok && context && (
          <div className={p.stale ? 'batch stale' : 'batch'}>
            {outcome.warnings.map((w) => (
              <p className="warning" key={w}>
                {w}
              </p>
            ))}
            {outcome.suggestions.map((s, i) => (
              <SuggestionCard
                key={`${i}-${s.password}`}
                suggestion={s}
                context={context}
                index={i}
                selected={p.isSelected(s.password)}
                onAdd={p.addSelected}
              />
            ))}
            {outcome.plan ? (
              <StrengthPanel plan={outcome.plan} target={applied.req.targetBits} />
            ) : (
              <SentenceStrength suggestions={outcome.suggestions} />
            )}
            <RubricPanel />
          </div>
        )}

        <SelectedList />
      </div>
      <ApplyBar />
    </main>
  );
}
