import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePageFirstWheel } from './components/columnScroll';
import { MEDIUM, NARROW, PHONE, useMediaQuery } from './components/useMediaQuery';
import { ApplyBar } from './components/ApplyBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequirementsForm } from './components/RequirementsForm';
import { SelectedList } from './components/SelectedList';
import { SiteRules } from './components/SiteRules';
import { CopyButton } from './components/CopyButton';
import { GeneratedSentenceField, SentenceInput, SentenceStrength } from './components/SentenceMode';
import { StrengthPanel } from './components/StrengthPanel';
import { SuggestionCard, type CardContext } from './components/SuggestionCard';
import { MenuIcon, RefreshIcon } from './components/icons';
import { panelId, TabPanel, Tabs, tabId } from './components/Tabs';
import { relevantTo, TwistsPanel } from './components/TwistsPanel';
import { TypingMode } from './components/TypingMode';
import { TypingTest } from './components/TypingTest';
import type { Mode } from './lib/engine';
import { SORT_CHOICES } from './lib/choices';
import { presentSuggestions } from './lib/pipeline';
import { normalizeSentence } from './lib/text';
import { PasswordsProvider, usePasswords } from './state/PasswordsProvider';

// The Scoring and Fun pages carry their own text (the rubric tables, the rebuild prompts); they load when first visited.
const ScoringPage = lazy(() => import('./components/ScoringPage').then((m) => ({ default: m.ScoringPage })));
const FunPage = lazy(() => import('./components/FunPage').then((m) => ({ default: m.FunPage })));

type Page = 'main' | 'scoring' | 'fun';
const pageFromHash = (): Page => (window.location.hash === '#/fun' ? 'fun' : window.location.hash === '#/scoring' ? 'scoring' : 'main');
const PAGES: { id: Page; href: string; label: string }[] = [
  { id: 'main', href: '#/', label: 'Passwords' },
  { id: 'scoring', href: '#/scoring', label: 'Scoring' },
  { id: 'fun', href: '#/fun', label: 'Fun' },
];

const TITLE = '7he Eleg@nt Pa$$word!';
const LICENSE_URL = 'https://github.com/SalientForm/elegant-password/blob/main/LICENSE';
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
              <div className="credits">
                <span className="brand">
                  brought to you by <strong>SalientForm</strong>
                </span>
                <a className="license" href={LICENSE_URL} target="_blank" rel="noreferrer">
                  MIT License
                </a>
              </div>
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
        <Suspense fallback={<p className="hint">Loading…</p>}>
          {page === 'scoring' && <ScoringPage />}
          {page === 'fun' && <FunPage />}
        </Suspense>
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
 * centred, index tabs standing on its bottom edge. On the Scoring and Fun pages the page's name stands where the
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
  // From the floating bar: open the options and put focus on the field the first problem is shown beside.
  const showProblems = () => {
    open('options');
    const field = p.problems[0]?.fields[0];
    requestAnimationFrame(() => {
      const form = columns.current?.querySelector(`#${columnId('options')}`);
      (form?.querySelector<HTMLElement>(`[data-field="${field}"]`) ?? form?.querySelector<HTMLElement>('[aria-invalid="true"]'))?.focus();
    });
  };
  const blocked = p.problems.length > 0;
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
  // The made-up sentence as the draft holds it: as drawn, or as the user edited it.
  const madeUp = draft.editedSentence ?? p.generated?.words.join(' ') ?? '';
  const madeUpField = useRef<HTMLTextAreaElement>(null);
  const emptySentence = p.mode === 'sentence' && !applied.sentence.trim();
  const nothingToRun = p.mode === 'sentence' && !draft.sentence.trim();
  // Difficulty is for the chosen typing mode, so "Difficulty" order follows it too.
  const typingMode = p.typingMode;
  const ordered = useMemo(() => (outcome?.ok ? presentSuggestions(outcome.suggestions, typingMode, p.sort) : []), [outcome, typingMode, p.sort]);
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
        {p.notice && (
          <p className="warning" role="status">
            {p.notice}
          </p>
        )}
        {/* The Presets card: the typing mode, then the site's rules (one tap, or pasted); each fills in the options below. */}
        <section className="panel presets-card" aria-labelledby="presets-heading">
          <h2 id="presets-heading">Presets</h2>
          <TypingMode />
          <SiteRules value={draft.req} onChange={p.setReq} />
        </section>
        <RequirementsForm value={draft.req} onChange={p.setReq} typingMode={draft.typingMode} />
        <TwistsPanel req={draft.req} onReqChange={p.setReq} settings={draft.mappingSettings} onSettingsChange={p.setMappingSettings} relevant={relevant} />
    </>
  );
  const centre = (
    <>
      {/* The sentence card: how to make the sentence, and the sentence itself (generated, or the user's own). */}
      <section className="panel sentence-card" aria-labelledby="source-text">
        <h2 id="source-text">Source Text</h2>
        <Tabs tabs={MODE_TABS} value={p.mode} onChange={p.setMode} label="How to make the sentence" idPrefix="mode" />
        <TabPanel idPrefix="mode" id="generated" active={p.mode === 'generated'}>
          <div className="sentence">
            <label className="field-label" htmlFor="generated-sentence">
              Generated sentence
            </label>
            <div className="generated-row">
              <GeneratedSentenceField
                value={madeUp}
                disabled={!p.generated}
                onChange={p.setEditedSentence}
                onSubmit={p.apply}
                ref={madeUpField}
              />
              <CopyButton text={madeUp} fallback={madeUpField} label="Copy sentence" icon />
              <button
                type="button"
                className="icon-button"
                onClick={p.newSentence}
                disabled={blocked}
                aria-label="New sentence"
                title={blocked ? 'Fix the problems in the options first' : p.dirty ? 'Draw a new sentence (submits your changes too)' : 'Draw a new sentence'}
              >
                <RefreshIcon />
              </button>
            </div>
            <p className="hint">
              The sentence behind every suggestion below, drawn at random from the word lists. It stays the same until you
              draw a new one with the button beside it or apply a new Mode; changing the rules or refreshing the suggestions keeps it.
              You can edit it and apply the change (Enter submits): an edited sentence is no longer a random draw, so it is built and
              scored like your own sentence, with the options under “Use my sentence”. Clear it and submit to go back to the drawn one.
            </p>
          </div>
        </TabPanel>
        <TabPanel idPrefix="mode" id="sentence" active={p.mode === 'sentence'}>
          <SentenceInput value={draft.sentence} onChange={p.setSentence} options={draft.sentenceOptions} onOptionsChange={p.setSentenceOptions} onSubmit={p.apply} req={draft.req} />
        </TabPanel>
      </section>

      {/* The suggestions card: the heading, the order and Refresh row, messages, and a card per password. */}
      <section className="panel suggestions">
        <h2>Suggestions</h2>
        <div className="results-tools">
          <span className="field-label" id="order-by">
            Order by
          </span>
          <div className="segmented sort" role="group" aria-labelledby="order-by">
            {SORT_CHOICES.map((s) => (
              <button type="button" key={s.value} className={p.sort === s.value ? 'active' : ''} aria-pressed={p.sort === s.value} title={s.hint} onClick={() => p.setSort(s.value)}>
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
            <button
              type="button"
              className="icon-button primary"
              onClick={p.regenerate}
              disabled={nothingToRun || blocked}
              aria-label="Refresh"
              title={
                blocked
                  ? 'Fix the problems in the options first'
                  : `New versions of the same sentence${p.dirty ? ' (submits your changes too)' : ''}`
              }
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {emptySentence && !outcome?.ok && <p className="hint">Type a sentence to turn into a password, then submit it.</p>}
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
      <ApplyBar onShowProblems={showProblems} />
    </main>
  );
}
