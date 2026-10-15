// One provider owns everything the app knows: the settings, the mode, the
// sentence, the current passwords, and the user's own list. Edits are a
// draft until the user applies them; applied settings are what generation
// uses and what is persisted, so a reload brings back exactly what was
// applied. Generation runs off the render path (in a worker when the browser
// has one), keeping the old passwords on screen until the new batch is ready.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { inputsKey, type GenerateInputs, type Mode, type Outcome } from '../lib/engine';
import type { SentenceOptions } from '../lib/fromSentence';
import type { Requirements, Suggestion } from '../lib/generate';
import { createGenerator, type Generator } from '../lib/generator';
import { activeMappings, loadMappingSettings, saveMappingSettings, type MappingSettings } from '../lib/mappingStore';
import { loadSelected, saveSelected, withEntry, withoutEntry, type SelectedEntry } from '../lib/selectedStore';
import { loadSession, saveSession } from '../lib/sessionStore';
import { loadMode, loadRequirements, loadSentenceOptions, loadSort, saveMode, saveRequirements, saveSentenceOptions, saveSort } from '../lib/settingsStore';
import type { SortOrder } from '../lib/sort';
import { browserStore, type KeyValueStore } from '../lib/storage';
import type { Mapping } from '../lib/twists';

/** The inputs the user edits. A draft until applied. */
export interface Settings {
  req: Requirements;
  sentenceOptions: SentenceOptions;
  mappingSettings: MappingSettings;
  sentence: string;
}

export interface PasswordsContextValue {
  /** What the forms show: the user's edits, applied or not. */
  draft: Settings;
  /** What generation and persistence use. */
  applied: Settings;
  /** True when the draft differs from what is applied. */
  dirty: boolean;
  /** Make the draft the applied settings: persist it and regenerate. */
  apply: () => void;
  /** Throw the draft away. */
  discard: () => void;
  setReq: (next: Requirements) => void;
  setSentenceOptions: (next: SentenceOptions) => void;
  setMappingSettings: (next: MappingSettings) => void;
  setSentence: (next: string) => void;
  /** Every mapping switched on in the draft. */
  mappings: Mapping[];
  /** Which mode is open. Takes effect at once; it is navigation, not a setting. */
  mode: Mode;
  setMode: (next: Mode) => void;
  /** How suggestions are ordered on screen. Takes effect at once. */
  sort: SortOrder;
  setSort: (next: SortOrder) => void;
  /** The last finished batch, kept on screen while the next one is made. */
  outcome: Outcome | null;
  /** True while a batch is being generated. */
  busy: boolean;
  /** True when the batch on screen was made from different inputs than the applied ones. */
  stale: boolean;
  /** Apply any draft and ask for a fresh batch. */
  regenerate: () => void;
  selected: SelectedEntry[];
  addSelected: (s: Pick<Suggestion, 'password' | 'hint'>) => void;
  removeSelected: (password: string) => void;
  clearSelected: () => void;
  isSelected: (password: string) => boolean;
}

const PasswordsContext = createContext<PasswordsContextValue | null>(null);

export interface PasswordsProviderProps {
  children: ReactNode;
  /** Where generation runs. Defaults to a worker when available, else inline. */
  generator?: Generator;
  /** Settings and the list. Defaults to localStorage. */
  local?: KeyValueStore;
  /** The current passwords and sentence. Defaults to sessionStorage. */
  session?: KeyValueStore;
  /** How long to wait after a change before generating. */
  debounceMs?: number;
}

interface Result {
  key: string;
  round: number;
  outcome: Outcome;
}

const sameSettings = (a: Settings, b: Settings) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function PasswordsProvider({ children, generator: given, local, session, debounceMs = 120 }: PasswordsProviderProps) {
  const [localStore] = useState(() => local ?? browserStore('local'));
  const [sessionStore] = useState(() => session ?? browserStore('session'));
  const [restored] = useState(() => loadSession(sessionStore));

  const [applied, setApplied] = useState<Settings>(() => ({
    req: loadRequirements(localStore),
    sentenceOptions: loadSentenceOptions(localStore),
    mappingSettings: loadMappingSettings(localStore),
    sentence: restored?.sentence ?? '',
  }));
  const [draft, setDraft] = useState<Settings>(applied);
  const [mode, setMode] = useState(() => loadMode(localStore));
  const [sort, setSort] = useState(() => loadSort(localStore));
  const [selected, setSelected] = useState(() => loadSelected(localStore));
  const [round, setRound] = useState(restored?.round ?? 0);
  const [result, setResult] = useState<Result | null>(
    restored?.outcome ? { key: restored.key, round: restored.round, outcome: restored.outcome } : null,
  );
  const [busy, setBusy] = useState(false);

  // The worker is made on first use and again after dispose, so StrictMode's
  // extra cleanup in development cannot leave us talking to a dead worker.
  const [generator] = useState(() => given ?? createGenerator());
  useEffect(() => {
    if (given) return undefined; // the caller owns it
    return () => generator.dispose();
  }, [generator, given]);

  const dirty = useMemo(() => !sameSettings(draft, applied), [draft, applied]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const apply = useCallback(() => setApplied((current) => (sameSettings(current, draftRef.current) ? current : draftRef.current)), []);
  const discard = useCallback(() => setDraft(applied), [applied]);
  const edit = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value })), []);
  const setReq = useCallback((next: Requirements) => edit('req', next), [edit]);
  const setSentenceOptions = useCallback((next: SentenceOptions) => edit('sentenceOptions', next), [edit]);
  const setMappingSettings = useCallback((next: MappingSettings) => edit('mappingSettings', next), [edit]);
  const setSentence = useCallback((next: string) => edit('sentence', next), [edit]);

  const mappings = useMemo(() => activeMappings(draft.mappingSettings), [draft.mappingSettings]);
  const appliedMappings = useMemo(() => activeMappings(applied.mappingSettings), [applied.mappingSettings]);
  const inputs = useMemo<GenerateInputs>(
    () => ({ mode, req: applied.req, sentence: applied.sentence, sentenceOptions: applied.sentenceOptions, mappings: appliedMappings }),
    [mode, applied, appliedMappings],
  );
  const key = useMemo(() => inputsKey(inputs), [inputs]);

  // Applied settings and the list survive for good; they hold no secrets.
  useEffect(() => void saveRequirements(localStore, applied.req), [localStore, applied.req]);
  useEffect(() => void saveSentenceOptions(localStore, applied.sentenceOptions), [localStore, applied.sentenceOptions]);
  useEffect(() => saveMappingSettings(applied.mappingSettings, localStore), [localStore, applied.mappingSettings]);
  useEffect(() => void saveMode(localStore, mode), [localStore, mode]);
  useEffect(() => void saveSort(localStore, sort), [localStore, sort]);
  useEffect(() => void saveSelected(localStore, selected), [localStore, selected]);

  // Generate when the applied inputs or the round change, unless the batch on
  // screen was already made from exactly these (as after a reload).
  const latest = useRef(0);
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const resultRef = useRef(result);
  resultRef.current = result;
  useEffect(() => {
    const current = resultRef.current;
    if (current && current.key === key && current.round === round) {
      setBusy(false);
      return undefined;
    }
    const id = ++latest.current;
    setBusy(true);
    const timer = setTimeout(() => {
      void generator.run({ id, ...inputsRef.current }).then((outcome) => {
        if (id !== latest.current) return; // superseded
        setResult({ key, round, outcome });
        setBusy(false);
      });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, round, generator, debounceMs]);

  // The current passwords and the applied sentence survive a reload, in this tab only.
  useEffect(() => {
    void saveSession(sessionStore, {
      key: result?.key ?? key,
      round: result?.round ?? round,
      sentence: applied.sentence,
      outcome: result?.outcome ?? null,
    });
  }, [sessionStore, result, applied.sentence, key, round]);

  const regenerate = useCallback(() => {
    apply();
    setRound((r) => r + 1);
  }, [apply]);
  const addSelected = useCallback(
    (s: Pick<Suggestion, 'password' | 'hint'>) =>
      setSelected((list) => withEntry(list, { password: s.password, hint: s.hint, addedAt: new Date().toISOString() })),
    [],
  );
  const removeSelected = useCallback((password: string) => setSelected((list) => withoutEntry(list, password)), []);
  const clearSelected = useCallback(() => setSelected([]), []);
  const isSelected = useCallback((password: string) => selected.some((e) => e.password === password), [selected]);

  const value = useMemo<PasswordsContextValue>(
    () => ({
      draft,
      applied,
      dirty,
      apply,
      discard,
      setReq,
      setSentenceOptions,
      setMappingSettings,
      setSentence,
      mappings,
      mode,
      setMode,
      sort,
      setSort,
      outcome: result?.outcome ?? null,
      busy,
      stale: !!result && result.key !== key,
      regenerate,
      selected,
      addSelected,
      removeSelected,
      clearSelected,
      isSelected,
    }),
    [draft, applied, dirty, apply, discard, setReq, setSentenceOptions, setMappingSettings, setSentence, mappings, mode, sort, result, busy, key, regenerate, selected, addSelected, removeSelected, clearSelected, isSelected],
  );

  return <PasswordsContext.Provider value={value}>{children}</PasswordsContext.Provider>;
}

/** The context when inside a provider, null otherwise (the typing test works on its own too). */
export function usePasswordsOptional(): PasswordsContextValue | null {
  return useContext(PasswordsContext);
}

export function usePasswords(): PasswordsContextValue {
  const ctx = useContext(PasswordsContext);
  if (!ctx) throw new Error('usePasswords must be used inside PasswordsProvider');
  return ctx;
}
