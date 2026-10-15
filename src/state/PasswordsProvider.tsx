// One provider owns everything the app knows: the settings, the mode, the
// sentence, the current passwords, and the user's own list. It persists
// what should survive a reload, and it runs generation off the render path
// (in a worker when the browser has one), keeping the old passwords on
// screen until the new batch is ready.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { inputsKey, type GenerateInputs, type Mode, type Outcome } from '../lib/engine';
import type { SentenceOptions } from '../lib/fromSentence';
import type { Requirements, Suggestion } from '../lib/generate';
import { createGenerator, type Generator } from '../lib/generator';
import { activeMappings, loadMappingSettings, saveMappingSettings, type MappingSettings } from '../lib/mappingStore';
import { loadSelected, saveSelected, withEntry, withoutEntry, type SelectedEntry } from '../lib/selectedStore';
import { loadSession, saveSession } from '../lib/sessionStore';
import { loadMode, loadRequirements, loadSentenceOptions, saveMode, saveRequirements, saveSentenceOptions } from '../lib/settingsStore';
import { browserStore, type KeyValueStore } from '../lib/storage';
import type { Mapping } from '../lib/twists';

export interface PasswordsContextValue {
  req: Requirements;
  setReq: (next: Requirements) => void;
  sentenceOptions: SentenceOptions;
  setSentenceOptions: (next: SentenceOptions) => void;
  mappingSettings: MappingSettings;
  setMappingSettings: (next: MappingSettings) => void;
  /** Every mapping currently switched on. */
  mappings: Mapping[];
  mode: Mode;
  setMode: (next: Mode) => void;
  sentence: string;
  setSentence: (next: string) => void;
  /** The last finished batch, kept on screen while the next one is made. */
  outcome: Outcome | null;
  /** True while a batch is being generated. */
  busy: boolean;
  /** True when the batch on screen was made from different inputs than the current ones. */
  stale: boolean;
  /** Ask for a fresh batch with the same inputs. */
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
  /** How long to wait after the last change before generating. */
  debounceMs?: number;
}

interface Result {
  key: string;
  round: number;
  outcome: Outcome;
}

export function PasswordsProvider({ children, generator: given, local, session, debounceMs = 120 }: PasswordsProviderProps) {
  const [localStore] = useState(() => local ?? browserStore('local'));
  const [sessionStore] = useState(() => session ?? browserStore('session'));

  const [req, setReq] = useState(() => loadRequirements(localStore));
  const [sentenceOptions, setSentenceOptions] = useState(() => loadSentenceOptions(localStore));
  const [mode, setMode] = useState(() => loadMode(localStore));
  const [mappingSettings, setMappingSettings] = useState(() => loadMappingSettings(localStore));
  const [selected, setSelected] = useState(() => loadSelected(localStore));

  const [restored] = useState(() => loadSession(sessionStore));
  const [sentence, setSentence] = useState(restored?.sentence ?? '');
  const [round, setRound] = useState(restored?.round ?? 0);
  const [result, setResult] = useState<Result | null>(
    restored?.outcome ? { key: restored.key, round: restored.round, outcome: restored.outcome } : null,
  );
  const [busy, setBusy] = useState(false);

  const [generator] = useState(() => given ?? createGenerator());
  useEffect(() => {
    if (given) return undefined; // the caller owns it
    return () => generator.dispose();
  }, [generator, given]);

  const mappings = useMemo(() => activeMappings(mappingSettings), [mappingSettings]);
  const inputs = useMemo<GenerateInputs>(() => ({ mode, req, sentence, sentenceOptions, mappings }), [mode, req, sentence, sentenceOptions, mappings]);
  const key = useMemo(() => inputsKey(inputs), [inputs]);

  // Settings and the list survive for good; they hold no secrets.
  useEffect(() => void saveRequirements(localStore, req), [localStore, req]);
  useEffect(() => void saveSentenceOptions(localStore, sentenceOptions), [localStore, sentenceOptions]);
  useEffect(() => void saveMode(localStore, mode), [localStore, mode]);
  useEffect(() => saveMappingSettings(mappingSettings, localStore), [localStore, mappingSettings]);
  useEffect(() => void saveSelected(localStore, selected), [localStore, selected]);

  // Generate when the inputs or the round change, unless the batch on screen
  // was already made from exactly these (as after a reload).
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

  // The current passwords and sentence survive a reload, in this tab only.
  useEffect(() => {
    void saveSession(sessionStore, { key: result?.key ?? key, round: result?.round ?? round, sentence, outcome: result?.outcome ?? null });
  }, [sessionStore, result, sentence, key, round]);

  const regenerate = useCallback(() => setRound((r) => r + 1), []);
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
      req,
      setReq,
      sentenceOptions,
      setSentenceOptions,
      mappingSettings,
      setMappingSettings,
      mappings,
      mode,
      setMode,
      sentence,
      setSentence,
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
    [req, sentenceOptions, mappingSettings, mappings, mode, sentence, result, busy, key, regenerate, selected, addSelected, removeSelected, clearSelected, isSelected],
  );

  return <PasswordsContext.Provider value={value}>{children}</PasswordsContext.Provider>;
}

export function usePasswords(): PasswordsContextValue {
  const ctx = useContext(PasswordsContext);
  if (!ctx) throw new Error('usePasswords must be used inside PasswordsProvider');
  return ctx;
}
