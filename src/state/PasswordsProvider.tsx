// One provider owns everything the app knows: the settings (the typing mode
// among them), the mode, the sentence, the current passwords, and the user's
// own list. Edits are a draft until the user applies them; applied settings
// are what generation uses and what is persisted, so a reload brings back
// exactly what was applied. Picking a typing mode is a draft too: it fills
// in the options that suit the mode, and Submit applies both. Generation
// runs off the render path (in a worker when the browser has one), keeping
// the old passwords on screen until the new batch is ready.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TypingMode } from '../lib/difficulty';
import { inputsKey, type GenerateInputs, type Mode, type Outcome } from '../lib/engine';
import type { SentenceOptions } from '../lib/fromSentence';
import type { GeneratedSentence, Requirements, Suggestion } from '../lib/generate';
import { createGenerator, type Generator } from './generator';
import { activeMappings, type MappingSettings } from '../lib/mappingSettings';
import { loadMappingSettings, saveMappingSettings } from './mappingStore';
import { withProfile } from '../lib/modeProfiles';
import { inputsFor } from '../lib/pipeline';
import { loadSelected, saveSelected, withEntry, withoutEntry, type SelectedEntry } from './selectedStore';
import { loadSession, saveSession } from './sessionStore';
import {
  loadMode,
  loadRequirementsReport,
  loadSentenceOptions,
  loadSort,
  loadTypingMode,
  resetNotice,
  saveMode,
  saveRequirements,
  saveSentenceOptions,
  saveSort,
  saveTypingMode,
} from './settingsStore';
import type { SortOrder } from '../lib/sort';
import { browserStore, type KeyValueStore } from './storage';
import type { Mapping } from '../lib/twists';
import { ruleProblems, type RuleProblem } from '../lib/validation';

/** The inputs the user edits. A draft until applied. */
export interface Settings {
  req: Requirements;
  sentenceOptions: SentenceOptions;
  mappingSettings: MappingSettings;
  sentence: string;
  /** The made-up sentence as the user edited it; null while it is as drawn. A new draw clears it. */
  editedSentence: string | null;
  /** How the passwords will be typed. Generation never reads it; the options it fills in are what change the passwords. */
  typingMode: TypingMode;
}

export interface PasswordsContextValue {
  /** What the forms show: the user's edits, applied or not. */
  draft: Settings;
  /** What generation and persistence use. */
  applied: Settings;
  /** True when the draft differs from what is applied. */
  dirty: boolean;
  /** What contradicts itself in the draft's rules. While there is anything, nothing can be applied. */
  problems: RuleProblem[];
  /** Saved settings that had to be reset on load, said once until the next submit; else null. */
  notice: string | null;
  /** Make the draft the applied settings: persist it and regenerate. Refused (false) while the draft has problems. */
  apply: () => boolean;
  /** Throw the draft away. */
  discard: () => void;
  setReq: (next: Requirements) => void;
  setSentenceOptions: (next: SentenceOptions) => void;
  setMappingSettings: (next: MappingSettings) => void;
  setSentence: (next: string) => void;
  /** Edit the made-up sentence, in the draft. Back to the words as drawn, it is unedited again. */
  setEditedSentence: (next: string) => void;
  /** Every mapping switched on in the draft. */
  mappings: Mapping[];
  /** Which mode is open. Takes effect at once; it is navigation, not a setting. */
  mode: Mode;
  setMode: (next: Mode) => void;
  /** How suggestions are ordered on screen. Takes effect at once. */
  sort: SortOrder;
  setSort: (next: SortOrder) => void;
  /**
   * The draft's typing mode, which every difficulty score on screen is for
   * (shown at once, a preview). Picking one also fills in the options that
   * suit it, in the draft; Submit applies both, Discard reverts both.
   */
  typingMode: TypingMode;
  setTypingMode: (next: TypingMode) => void;
  /** The last finished batch, kept on screen while the next one is made. */
  outcome: Outcome | null;
  /** True while a batch is being generated. */
  busy: boolean;
  /** True when the batch on screen was made from different inputs than the applied ones. */
  stale: boolean;
  /** Apply any draft and ask for a fresh batch from the same sentence. Refused while the draft has problems. */
  regenerate: () => void;
  /** The made-up sentence every batch is built from, kept until newSentence; null before the first draw. */
  generated: GeneratedSentence | null;
  /** Apply any draft and draw a new made-up sentence, the only way it changes. Refused while the draft has problems. */
  newSentence: () => void;
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

  const [loaded] = useState(() => loadRequirementsReport(localStore));
  const [notice, setNotice] = useState(() => resetNotice(loaded.reset));
  const [applied, setApplied] = useState<Settings>(() => ({
    req: loaded.req,
    sentenceOptions: loadSentenceOptions(localStore),
    mappingSettings: loadMappingSettings(localStore),
    sentence: restored?.sentence ?? '',
    editedSentence: restored?.edited ?? null,
    typingMode: loadTypingMode(localStore),
  }));
  const [draft, setDraft] = useState<Settings>(applied);
  const [mode, setMode] = useState(() => loadMode(localStore));
  const [sort, setSort] = useState(() => loadSort(localStore));
  const [selected, setSelected] = useState(() => loadSelected(localStore));
  const [round, setRound] = useState(restored?.round ?? 0);
  const [generated, setGenerated] = useState<GeneratedSentence | null>(restored?.generated ?? null);
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
  const problems = useMemo(() => ruleProblems(draft.req), [draft.req]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  // The applied settings never hold a contradiction: a draft with one stays a draft, and the form says why.
  const apply = useCallback(() => {
    let next = draftRef.current;
    if (ruleProblems(next.req).length) return false;
    // A new typing mode reshapes the sentence (its made-up nouns, its number), so it draws a new one rather than refusing the kept one, and drops any edit to it.
    const redraw = next.typingMode !== appliedRef.current.typingMode;
    if (redraw) setGenerated(null);
    // A blank edit goes back to the sentence as drawn.
    if (next.editedSentence !== null && (redraw || !next.editedSentence.trim())) {
      next = { ...next, editedSentence: null };
      setDraft(next);
    }
    setApplied((current) => (sameSettings(current, next) ? current : next));
    setNotice(null);
    return true;
  }, []);
  const discard = useCallback(() => setDraft(applied), [applied]);
  const edit = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value })), []);
  const setReq = useCallback((next: Requirements) => edit('req', next), [edit]);
  const setSentenceOptions = useCallback((next: SentenceOptions) => edit('sentenceOptions', next), [edit]);
  const setMappingSettings = useCallback((next: MappingSettings) => edit('mappingSettings', next), [edit]);
  const setSentence = useCallback((next: string) => edit('sentence', next), [edit]);
  const generatedRef = useRef(generated);
  generatedRef.current = generated;
  const setEditedSentence = useCallback(
    (next: string) => edit('editedSentence', next === generatedRef.current?.words.join(' ') ? null : next),
    [edit],
  );
  // A mode brings its options with it: the strength, comfort and style that suit it, over whatever the draft held (visible in the form, undone by Discard).
  const setTypingMode = useCallback((next: TypingMode) => setDraft((d) => ({ ...d, typingMode: next, req: withProfile(d.req, next).req })), []);

  const mappings = useMemo(() => activeMappings(draft.mappingSettings), [draft.mappingSettings]);
  const inputs = useMemo<GenerateInputs>(() => inputsFor({ ...applied, mode }, generated), [mode, applied, generated]);
  const key = useMemo(() => inputsKey(inputs), [inputs]);

  // Applied settings and the list survive for good; they hold no secrets.
  useEffect(() => void saveRequirements(localStore, applied.req), [localStore, applied.req]);
  useEffect(() => void saveSentenceOptions(localStore, applied.sentenceOptions), [localStore, applied.sentenceOptions]);
  useEffect(() => saveMappingSettings(applied.mappingSettings, localStore), [localStore, applied.mappingSettings]);
  useEffect(() => void saveMode(localStore, mode), [localStore, mode]);
  useEffect(() => void saveSort(localStore, sort), [localStore, sort]);
  useEffect(() => void saveTypingMode(localStore, applied.typingMode), [localStore, applied.typingMode]);
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
      const request = inputsRef.current;
      void generator.run({ id, ...request }).then((outcome) => {
        if (id !== latest.current) return; // superseded
        // A new draw becomes the kept sentence, and the batch is filed under the inputs with it, so it is not made again.
        const drawn = request.mode === 'generated' && !request.generated && outcome.ok ? outcome.generated : undefined;
        if (drawn) setGenerated(drawn);
        setResult({ key: drawn ? inputsKey({ ...request, generated: drawn }) : key, round, outcome });
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
      ...(generated ? { generated } : {}),
      ...(generated && applied.editedSentence !== null ? { edited: applied.editedSentence } : {}),
    });
  }, [sessionStore, result, applied.sentence, applied.editedSentence, key, round, generated]);

  const regenerate = useCallback(() => {
    if (apply()) setRound((r) => r + 1);
  }, [apply]);
  const newSentence = useCallback(() => {
    if (!apply()) return;
    // A new draw replaces the sentence, edits and all.
    const unedited = (s: Settings) => (s.editedSentence === null ? s : { ...s, editedSentence: null });
    setDraft(unedited);
    setApplied(unedited);
    setGenerated(null);
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
      problems,
      notice,
      apply,
      discard,
      setReq,
      setSentenceOptions,
      setMappingSettings,
      setSentence,
      setEditedSentence,
      mappings,
      mode,
      setMode,
      sort,
      setSort,
      typingMode: draft.typingMode,
      setTypingMode,
      outcome: result?.outcome ?? null,
      busy,
      stale: !!result && result.key !== key,
      regenerate,
      generated,
      newSentence,
      selected,
      addSelected,
      removeSelected,
      clearSelected,
      isSelected,
    }),
    [draft, applied, dirty, problems, notice, apply, discard, setReq, setSentenceOptions, setMappingSettings, setSentence, setEditedSentence, setTypingMode, mappings, mode, sort, result, busy, key, regenerate, generated, newSentence, selected, addSelected, removeSelected, clearSelected, isSelected],
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
