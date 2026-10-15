import { useEffect, useRef, useState } from 'react';
import { usePageFirstWheel } from './components/columnScroll';
import { NARROW, useMediaQuery } from './components/useMediaQuery';
import { ApplyBar } from './components/ApplyBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FunPage } from './components/FunPage';
import { RequirementsForm } from './components/RequirementsForm';
import { ScoringPage } from './components/ScoringPage';
import { SelectedList } from './components/SelectedList';
import { SentenceInput, SentenceStrength } from './components/SentenceMode';
import { StrengthPanel } from './components/StrengthPanel';
import { SuggestionCard, type CardContext } from './components/SuggestionCard';
import { TabPanel, Tabs } from './components/Tabs';
import { relevantTo, TwistsPanel } from './components/TwistsPanel';
import { TypingTest } from './components/TypingTest';
import type { Mode } from './lib/engine';
import { sortSuggestions, type SortOrder } from './lib/sort';
import { normalizeSentence } from './lib/text';
import { PasswordsProvider, usePasswords } from './state/PasswordsProvider';

type Page = 'main' | 'scoring' | 'fun';
const pageFromHash = (): Page => (window.location.hash === '#/fun' ? 'fun' : window.location.hash === '#/scoring' ? 'scoring' : 'main');

const TITLE = 'Thuh Eleg@nt Pa$$word!';
/** One line for the whole app, the same on every page. */
const DESCRIPTION = 'Passwords that read like a sentence, sit comfortably under your fingers, and are still hard to guess.';

type Column = 'options' | 'suggestions' | 'list';
const COLUMN_TABS: { id: Column; label: string }[] = [
  { id: 'options', label: 'Options' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'list', label: 'My list' },
];

const SORTS: { id: SortOrder; label: string; title: string }[] = [
  { id: 'memorability', label: 'Memorability', title: 'Most memorable first' },
  { id: 'difficulty', label: 'Difficulty', title: 'Easiest to type first' },
  { id: 'strength', label: 'Strength', title: 'Strongest first' },
];

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
        <header className="topbar">
          <div className="topbar-text">
            <h1>{TITLE}</h1>
            <p className="tagline">{DESCRIPTION}</p>
          </div>
          <span className="brand">
            brought to you by <strong>SalientForm</strong>
          </span>
        </header>
        <nav className="topnav" aria-label="Pages">
          <a href="#/" className={page === 'main' ? 'active' : ''} aria-current={page === 'main' ? 'page' : undefined}>
            Passwords
          </a>
          <a href="#/scoring" className={page === 'scoring' ? 'active' : ''} aria-current={page === 'scoring' ? 'page' : undefined}>
            Scoring
          </a>
          <a href="#/fun" className={page === 'fun' ? 'active' : ''} aria-current={page === 'fun' ? 'page' : undefined}>
            Fun
          </a>
        </nav>
        <PasswordsProvider>
          {/* Kept mounted so settings, the sentence and the typing test survive a visit to the other pages. */}
          <div hidden={page !== 'main'}>
            <ElegantPasswords />
          </div>
        </PasswordsProvider>
        {page === 'scoring' && <ScoringPage />}
        {page === 'fun' && <FunPage />}
      </div>
    </ErrorBoundary>
  );
}

export function ElegantPasswords() {
  const p = usePasswords();
  const { outcome, draft, applied } = p;
  const narrow = useMediaQuery(NARROW);
  const [column, setColumn] = useState<Column>('suggestions');
  // Desktop: the header scrolls away first, then the three columns stick and scroll on their own.
  const columns = useRef<HTMLElement>(null);
  usePageFirstWheel(columns, !narrow);
  const context: CardContext | undefined =
    outcome?.ok ? { separator: outcome.separator, minUppercase: applied.req.minUppercase, source: outcome.source } : undefined;
  const emptySentence = p.mode === 'sentence' && !applied.sentence.trim();
  const nothingToRun = p.mode === 'sentence' && !draft.sentence.trim();
  const ordered = outcome?.ok ? sortSuggestions(outcome.suggestions, p.sort) : [];
  // In sentence mode, swaps whose letters are not in the sentence cannot apply; show them disabled.
  const sentenceWords = p.mode === 'sentence' ? normalizeSentence(draft.sentence) : [];
  const relevant = sentenceWords.length ? relevantTo(sentenceWords) : undefined;
  // Keys follow the password so a card keeps its open "Why?" when the order changes; a repeated password gets a suffix.
  const seen = new Map<string, number>();
  const keys = ordered.map((s) => {
    const n = seen.get(s.password) ?? 0;
    seen.set(s.password, n + 1);
    return n ? `${s.password}#${n}` : s.password;
  });

  const options = (
    <>

        <RequirementsForm value={draft.req} onChange={p.setReq} />
        <TwistsPanel req={draft.req} onReqChange={p.setReq} settings={draft.mappingSettings} onSettingsChange={p.setMappingSettings} relevant={relevant} />
    </>
  );
  const centre = (
    <>

        <Tabs tabs={MODE_TABS} value={p.mode} onChange={p.setMode} label="How to make the sentence" idPrefix="mode" />

        <TabPanel idPrefix="mode" id="generated" active={p.mode === 'generated'}>
          <section className="panel sentence" aria-labelledby="generated-sentence-label">
            <span className="field-label" id="generated-sentence-label">
              Generated sentence
            </span>
            <p className="generated-sentence" data-testid="generated-sentence" aria-live="polite">
              {ordered[0]?.hint ?? '…'}
            </p>
            <p className="hint">
              The sentence behind the first suggestion below, drawn at random from the word lists and fitted to the rules on
              the left. Every card shows its own under Why?.
            </p>
          </section>
        </TabPanel>
        <TabPanel idPrefix="mode" id="sentence" active={p.mode === 'sentence'}>
          <SentenceInput value={draft.sentence} onChange={p.setSentence} options={draft.sentenceOptions} onOptionsChange={p.setSentenceOptions} onSubmit={p.apply} />
        </TabPanel>

        <h2>Suggestions</h2>
        <div className="results-tools">
          <div className="segmented sort" role="group" aria-label="Order">
            {SORTS.map((s) => (
              <button type="button" key={s.id} className={p.sort === s.id ? 'active' : ''} aria-pressed={p.sort === s.id} title={s.title} onClick={() => p.setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="actions">
            {p.busy && (
              <span className="working" role="status">
                Working…
              </span>
            )}
            <button type="button" className="primary" onClick={p.regenerate} disabled={nothingToRun} title={p.dirty ? 'Submits your changes too' : undefined}>
              Refresh
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
            {ordered.map((s, i) => (
              <SuggestionCard
                key={keys[i]}
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
              <SentenceStrength suggestions={outcome.suggestions} sentence={outcome.suggestions[0]?.hint ?? applied.sentence} />
            )}
          </div>
        )}
    </>
  );
  const aside = (
    <>

        <TypingTest />
        <SelectedList />
    </>
  );

  // On a phone the three columns become three tabs, siblings of each other,
  // so every option, suggestion and list entry stays reachable with nothing
  // scrolling sideways.
  if (narrow) {
    return (
      <main className="collapsed">
        <Tabs tabs={COLUMN_TABS} value={column} onChange={setColumn} label="Sections" idPrefix="section" className="section-tabs" />
        <TabPanel idPrefix="section" id="options" active={column === 'options'} className="sidebar">
          {options}
        </TabPanel>
        <TabPanel idPrefix="section" id="suggestions" active={column === 'suggestions'} className="results">
          {centre}
        </TabPanel>
        <TabPanel idPrefix="section" id="list" active={column === 'list'} className="aside">
          {aside}
        </TabPanel>
        <ApplyBar />
      </main>
    );
  }

  return (
    <main ref={columns} className="columns">
      <div className="sidebar">{options}</div>
      <div className="results" aria-busy={p.busy}>
        {centre}
      </div>
      <div className="aside">{aside}</div>
      <ApplyBar />
    </main>
  );
}
