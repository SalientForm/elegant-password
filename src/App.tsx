import { useEffect, useMemo, useState } from 'react';
import { RubricPanel } from './components/Difficulty';
import { FunPage } from './components/FunPage';
import { RequirementsForm } from './components/RequirementsForm';
import { SentenceInput, SentenceStrength } from './components/SentenceMode';
import { StrengthPanel } from './components/StrengthPanel';
import { SuggestionCard, type CardContext } from './components/SuggestionCard';
import { TwistsPanel } from './components/TwistsPanel';
import { DEFAULT_SENTENCE_OPTIONS, fromSentence, type SentenceOptions } from './lib/fromSentence';
import { DEFAULT_REQUIREMENTS, generate, RequirementsError, type GenerateResult, type Requirements, type Suggestion } from './lib/generate';
import { activeMappings, loadMappingSettings, saveMappingSettings, type MappingSettings } from './lib/mappingStore';

type Mode = 'generated' | 'sentence';

type Outcome =
  | { ok: true; suggestions: Suggestion[]; warnings: string[]; context: CardContext; generated?: GenerateResult }
  | { ok: false; error: string };

type Page = 'main' | 'fun';
const pageFromHash = (): Page => (window.location.hash === '#/fun' ? 'fun' : 'main');

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="app">
      <nav className="topnav">
        <a href="#/" className={page === 'main' ? 'active' : ''}>
          Elegant Passwords
        </a>
        <a href="#/fun" className={page === 'fun' ? 'active' : ''}>
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
      {/* Kept mounted so settings and the sentence survive a visit to Fun. */}
      <div hidden={page !== 'main'}>
        <ElegantPasswords />
      </div>
      {page === 'fun' && <FunPage />}
    </div>
  );
}

function ElegantPasswords() {
  const [req, setReq] = useState<Requirements>(DEFAULT_REQUIREMENTS);
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState<Mode>('generated');
  // The sentence is the secret, so it lives only in memory, never in storage.
  const [sentence, setSentence] = useState('');
  const [sentenceOptions, setSentenceOptions] = useState<SentenceOptions>(DEFAULT_SENTENCE_OPTIONS);
  const [mappingSettings, setMappingSettings] = useState<MappingSettings>(() => loadMappingSettings());
  useEffect(() => saveMappingSettings(mappingSettings), [mappingSettings]);
  const mappings = useMemo(() => activeMappings(mappingSettings), [mappingSettings]);

  const outcome = useMemo<Outcome>(() => {
    try {
      if (mode === 'sentence') {
        const r = fromSentence(sentence, req, sentenceOptions, { mappings });
        return {
          ok: true,
          suggestions: r.suggestions,
          warnings: r.warnings,
          context: { separator: r.separator, minUppercase: req.minUppercase, source: 'sentence' },
        };
      }
      const r = generate(req, { mappings });
      return {
        ok: true,
        suggestions: r.suggestions,
        warnings: r.warnings,
        context: { separator: r.plan.separator, minUppercase: req.minUppercase, source: 'generated' },
        generated: r,
      };
    } catch (e) {
      if (e instanceof RequirementsError) return { ok: false, error: e.message };
      throw e;
    }
    // `round` forces a fresh draw when the user asks for new passwords.
  }, [mode, sentence, sentenceOptions, req, mappings, round]);

  return (
      <main>
        <div className="sidebar">
          <RequirementsForm value={req} onChange={setReq} />
          <TwistsPanel req={req} onReqChange={setReq} settings={mappingSettings} onSettingsChange={setMappingSettings} />
        </div>

        <div className="results">
          <div className="mode-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'generated'} onClick={() => setMode('generated')}>
              Make up a sentence
            </button>
            <button type="button" role="tab" aria-selected={mode === 'sentence'} onClick={() => setMode('sentence')}>
              Use my sentence
            </button>
          </div>

          {mode === 'sentence' && (
            <SentenceInput value={sentence} onChange={setSentence} options={sentenceOptions} onOptionsChange={setSentenceOptions} />
          )}

          <div className="results-head">
            <h2>Suggestions</h2>
            <button type="button" className="primary" onClick={() => setRound((r) => r + 1)} disabled={!outcome.ok}>
              New passwords
            </button>
          </div>

          {!outcome.ok && <p className={mode === 'sentence' && !sentence.trim() ? 'hint' : 'error'}>{outcome.error}</p>}

          {outcome.ok && (
            <>
              {outcome.warnings.map((w) => (
                <p className="warning" key={w}>
                  {w}
                </p>
              ))}
              {outcome.suggestions.map((s, i) => (
                <SuggestionCard key={`${round}-${i}-${s.password}`} suggestion={s} context={outcome.context} index={i} />
              ))}
              {outcome.generated ? (
                <StrengthPanel plan={outcome.generated.plan} count={req.count} target={req.targetBits} />
              ) : (
                <SentenceStrength suggestions={outcome.suggestions} />
              )}
              <RubricPanel />
            </>
          )}
        </div>
      </main>
  );
}
