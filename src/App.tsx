import { useEffect, useRef, useState } from 'react';
import { usePageFirstWheel } from './components/columnScroll';
import { MEDIUM, NARROW, PHONE, useMediaQuery } from './components/useMediaQuery';
import { ApplyBar } from './components/ApplyBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FunPage } from './components/FunPage';
import { RequirementsForm } from './components/RequirementsForm';
import { ScoringPage } from './components/ScoringPage';
import { SelectedList } from './components/SelectedList';
import { SentenceInput, SentenceStrength } from './components/SentenceMode';
import { StrengthPanel } from './components/StrengthPanel';
import { SuggestionCard, type CardContext } from './components/SuggestionCard';
import { MenuIcon } from './components/icons';
import { panelId, TabPanel, Tabs, tabId } from './components/Tabs';
import { relevantTo, TwistsPanel } from './components/TwistsPanel';
import { TypingTest } from './components/TypingTest';
import type { Mode } from './lib/engine';
import { sortSuggestions, type SortOrder } from './lib/sort';
import { normalizeSentence } from './lib/text';
import { PasswordsProvider, usePasswords } from './state/PasswordsProvider';

type Page = 'main' | 'scoring' | 'fun';
const pageFromHash = (): Page => (window.location.hash === '#/fun' ? 'fun' : window.location.hash === '#/scoring' ? 'scoring' : 'main');
const PAGES: { id: Page; href: string; label: string }[] = [
  { id: 'main', href: '#/', label: 'Passwords' },
  { id: 'scoring', href: '#/scoring', label: 'Scoring' },
  { id: 'fun', href: '#/fun', label: 'Fun' },
];

const TITLE = 'Thuh Eleg@nt Pa$$word!';
/** One line for the whole app, the same on every page. */
const DESCRIPTION = 'Passwords that read like a sentence, sit comfortably under your fingers, and are still hard to guess.';

type Column = 'options' | 'suggestions' | 'list';
/** The three columns in order, each with the label of the button it shrinks to when there is no room for all three. */
const COLUMNS: { id: Column; label: string }[] = [
  { id: 'options', label: 'Options' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'list', label: 'Testing' },
];
/** A column's element id: the panel the matching tab in the phone bar controls. */
const columnId = (id: Column) => panelId('section', id);

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
  const [column, setColumn] = useState<Column>('suggestions');
  const phone = useMediaQuery(PHONE);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app">
        {/* The header: the title area and the three primary tabs (on a phone the tabs fold into the bar below, which sticks on its own). */}
        <header className="app-header">
          <div className="header-inner">
            <div className="topbar">
              <div className="topbar-text">
                <h1>{TITLE}</h1>
                <p className="tagline">{DESCRIPTION}</p>
              </div>
              <span className="brand">
                brought to you by <strong>SalientForm</strong>
              </span>
            </div>
            {!phone && (
              <nav className="topnav" aria-label="Pages">
                <PageLinks page={page} />
              </nav>
            )}
          </div>
        </header>
        {phone && <PhoneBar page={page} column={column} onColumn={setColumn} />}
        <PasswordsProvider>
          {/* Kept mounted so settings, the sentence and the typing test survive a visit to the other pages. */}
          <div hidden={page !== 'main'}>
            <ElegantPasswords column={column} onColumn={setColumn} />
          </div>
        </PasswordsProvider>
        {page === 'scoring' && <ScoringPage />}
        {page === 'fun' && <FunPage />}
      </div>
    </ErrorBoundary>
  );
}

/** The three page links: the desktop nav, and the phone menu behind the hamburger. */
function PageLinks({ page, onPick }: { page: Page; onPick?: () => void }) {
  return (
    <>
      {PAGES.map((pg) => (
        <a key={pg.id} href={pg.href} className={page === pg.id ? 'active' : ''} aria-current={page === pg.id ? 'page' : undefined} onClick={onPick}>
          {pg.label}
        </a>
      ))}
    </>
  );
}

/**
 * On a phone a bar stuck to the top acts as the header: the page links fold
 * into a menu behind a hamburger at its left, and the three column tabs sit
 * centred. On the Scoring and Fun pages the page's name stands where the
 * tabs would be.
 */
function PhoneBar({ page, column, onColumn }: { page: Page; column: Column; onColumn: (next: Column) => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // closing the menu is all Escape does here (it would otherwise discard unapplied changes)
      if (menu.current?.contains(document.activeElement)) menu.current.querySelector('button')?.focus(); // focus never drops to the body
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [open]);
  useEffect(() => {
    setOpen(false); // choosing a page closes the menu
  }, [page]);
  return (
    <div className="phone-bar">
      <div className="phone-menu" ref={menu}>
        <button type="button" className="icon-button ghost" aria-label="Pages" aria-expanded={open} aria-controls="phone-pages" title="Pages" onClick={() => setOpen(!open)}>
          <MenuIcon />
        </button>
        {/* Always in the document, hidden while closed, so the button's aria-controls always has a target. */}
        <nav id="phone-pages" aria-label="Pages" hidden={!open}>
          <PageLinks page={page} onPick={() => setOpen(false)} />
        </nav>
      </div>
      {page === 'main' ? (
        <Tabs tabs={COLUMNS} value={column} onChange={onColumn} label="Sections" idPrefix="section" className="section-tabs" />
      ) : (
        <span className="phone-page">{PAGES.find((pg) => pg.id === page)!.label}</span>
      )}
    </div>
  );
}

interface ColumnsProps {
  /** The column that is open where there is no room for all three. */
  column: Column;
  onColumn: (next: Column) => void;
}

export function ElegantPasswords({ column, onColumn }: ColumnsProps) {
  const p = usePasswords();
  const { outcome, draft, applied } = p;
  const fewer = useMediaQuery(MEDIUM); // fewer than three columns fit
  const narrow = useMediaQuery(NARROW); // only one
  const phone = useMediaQuery(PHONE);
  const medium = fewer && !narrow; // two: Suggestions and one outer column
  // In the medium range Options starts open and Testing shrunk, whenever the page loads or the width enters the range; the choice is not kept.
  const [outer, setOuter] = useState<Column>('options');
  useEffect(() => {
    if (medium) setOuter('options');
  }, [medium]);
  const isOpen = (id: Column) => (!fewer ? true : medium ? id === 'suggestions' || id === outer : id === column);
  const shrunk = (id: Column) => !isOpen(id);
  // Desktop and the medium range: the header scrolls away first, then the open columns stick and scroll on their own.
  const columns = useRef<HTMLElement>(null);
  usePageFirstWheel(columns, !narrow);
  // A column opened from its button takes keyboard focus: the button it was on is gone.
  const opened = useRef<Column>(undefined);
  useEffect(() => {
    const id = opened.current;
    if (id === undefined || !isOpen(id)) return;
    opened.current = undefined;
    columns.current?.querySelector<HTMLElement>(`#${columnId(id)}`)?.focus({ preventScroll: true });
  });
  const open = (id: Column) => {
    opened.current = id;
    if (medium) setOuter(id);
    else onColumn(id);
  };
  /** A shrunken column is a button in a strip, except on a phone, where the tabs in the bar stand in. */
  const strips = fewer && !phone;
  const columnProps = (id: Column) => ({
    id: columnId(id),
    tabIndex: -1,
    hidden: shrunk(id),
    ...(phone ? { role: 'tabpanel', 'aria-labelledby': tabId('section', id) } : {}),
  });
  const index = (id: Column) => COLUMNS.findIndex((c) => c.id === id);
  const firstOpen = COLUMNS.find((c) => isOpen(c.id))!.id;
  // A strip left of the open columns reads bottom to top, one right of them top to bottom (like a book spine either side).
  const strip = (id: Column) => (
    <div className={index(id) < index(firstOpen) ? 'strip left' : 'strip right'}>
      <button type="button" className="strip-button" aria-expanded={false} aria-controls={columnId(id)} onClick={() => open(id)}>
        {COLUMNS[index(id)]!.label}
      </button>
    </div>
  );
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
      {/* The sentence card: how to make the sentence, and the sentence itself (generated, or the user's own). */}
      <section className="panel sentence-card" aria-label="Sentence">
        <Tabs tabs={MODE_TABS} value={p.mode} onChange={p.setMode} label="How to make the sentence" idPrefix="mode" />
        <TabPanel idPrefix="mode" id="generated" active={p.mode === 'generated'}>
          <div className="sentence">
            <span className="field-label">Generated sentence</span>
            <p className="generated-sentence" data-testid="generated-sentence" aria-live="polite">
              {ordered[0]?.hint ?? '…'}
            </p>
            <p className="hint">
              The sentence behind the first suggestion below, drawn at random from the word lists and fitted to the rules on
              the left. Every card shows its own under Why?.
            </p>
          </div>
        </TabPanel>
        <TabPanel idPrefix="mode" id="sentence" active={p.mode === 'sentence'}>
          <SentenceInput value={draft.sentence} onChange={p.setSentence} options={draft.sentenceOptions} onOptionsChange={p.setSentenceOptions} onSubmit={p.apply} />
        </TabPanel>
      </section>

      {/* The suggestions card: the heading, the order and Refresh row, messages, and a card per password. */}
      <section className="panel suggestions">
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
          </div>
        )}
      </section>

      {/* The strength panel stays a card of its own. */}
      {outcome?.ok && context && (
        <div className={p.stale ? 'batch stale' : 'batch'}>
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

  // Fewer than three columns fit: in the medium range Suggestions and one
  // outer column stay open and the third shrinks to a button; narrower still,
  // one column stays open in normal flow and the other two shrink. A shrunken
  // column is a button in a thin sticky strip, in column order, centred so it
  // is always in reach. On a phone the open column takes the whole width and
  // the bar's tabs choose it. Shrunken columns stay mounted, hidden, so
  // nothing in them is lost.
  return (
    <main ref={columns} className={medium ? `columns medium outer-${outer}` : narrow ? `columns narrow${phone ? ' phone' : ''} focus-${column}` : 'columns'}>
      {strips && shrunk('options') && strip('options')}
      <div className="sidebar" {...columnProps('options')}>
        {options}
      </div>
      {strips && shrunk('suggestions') && strip('suggestions')}
      <div className="results" aria-busy={p.busy} {...columnProps('suggestions')}>
        {centre}
      </div>
      {strips && shrunk('list') && strip('list')}
      <div className="aside" {...columnProps('list')}>
        {aside}
      </div>
      <ApplyBar />
    </main>
  );
}
