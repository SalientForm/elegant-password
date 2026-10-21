// One provider owns everything the app knows: the settings (the typing mode
// among them), the mode, the sentence, the current passwords, and the user's
// own list. Edits are a draft until the user applies them; applied settings
// are what generation uses and what is persisted, so a reload brings back
// exactly what was applied. Picking a typing mode is a draft too: it fills
// in the options that suit the mode, and Submit applies both. Generation
// runs on the page's own thread, a debounce after the last change and within
// the engine's budget, keeping the old passwords on screen until the new
// batch is ready.
//
// Every write to the browser's storage reports whether it worked, so the
// app never says something is kept when it is not (persistence). My list is
// changed one change at a time on the list as stored, and follows changes
// another tab makes, so two tabs never write over each other's entries.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { commonPasswordProblem, commonRank } from '../lib/common';
import type { TypingMode } from '../lib/difficulty';
import { inputsKey, runInputs, type GenerateInputs, type Mode, type Outcome } from '../lib/engine';
import type { SentenceOptions } from '../lib/fromSentence';
import type { GeneratedSentence, Requirements, Suggestion } from '../lib/generate';
import { checkWithZxcvbn, type ZxcvbnCheck } from './zxcvbnCheck';
import { isOwnOrigin } from './origin';
import { activeMappings, type MappingSettings } from '../lib/mappingSettings';
import { loadMappingSettings, saveMappingSettings } from './mappingStore';
import { withProfile } from '../lib/modeProfiles';
import { inputsFor } from '../lib/pipeline';
import { changeSelected, loadSelected, SELECTED_KEY, withEntry, withoutEntry, withReading, type SelectedEntry } from './selectedStore';
import { clearSession, loadSession, saveSession, SESSION_KEY } from './sessionStore';
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
import { browserStore, memoryStore, removeKey, watchKey, type KeyValueStore } from './storage';
import type { Mapping } from '../lib/twists';
import { ruleProblems, type RuleProblem } from '../lib/validation';

/**
 * Where something the app keeps actually is: 'saved' in the browser's
 * storage, 'visit-only' by design (in memory, on a shared origin), or
 * 'failed': storage was meant to hold it and the last write did not work
 * (full, or blocked), so it lasts only until the tab closes.
 */
export type SaveState = 'saved' | 'visit-only' | 'failed';

export interface Persistence {
  /** My list. */
  list: SaveState;
  /** The passwords on screen and the sentences, kept through a reload of this tab. */
  session: SaveState;
  /** The applied settings, which hold no secrets and are stored on every origin. */
  settings: 'saved' | 'failed';
}

/** A password chosen to practise in the typing test, from a card or My list. `id` tells two picks of the same password apart. */
export interface PracticeTarget {
  password: string;
  hint: string;
  id: number;
}

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
  /** Whether the list and the current batch are meant to go to the browser's storage: only on the app's own origin (src/state/origin.ts). Whether they did is `persistence`. */
  secretsPersisted: boolean;
  /** Whether each kind of thing the app keeps was actually saved. */
  persistence: Persistence;
  /** Try every failed write again; My list is merged with what storage holds, so nothing is lost either way. */
  retrySaving: () => void;
  /** Add a password to My list. Refused, with the reason, for a password on the common list (common.ts). */
  addSelected: (s: Pick<Suggestion, 'password' | 'hint'>) => { added: boolean; problem?: string };
  removeSelected: (password: string) => void;
  clearSelected: () => void;
  isSelected: (password: string) => boolean;
  /** Passwords whose zxcvbn reading could not be worked out (the estimator failed to load). */
  zxcvbnFailed: ReadonlySet<string>;
  /** The password picked to practise, if any. */
  practice: PracticeTarget | null;
  /** Make this password the one under test in the typing test. */
  practise: (s: Pick<Suggestion, 'password' | 'hint'>) => void;
  /**
   * Forget this session: the passwords on screen, the made-up sentence and
   * your own sentence, and the password under test, from memory and from
   * this tab's storage. A new batch is drawn. My list and the settings stay.
   */
  forgetSession: () => void;
  /** Goes up by one each time the session is forgotten, so components holding their own copies (the typing test) can drop them. */
  sessionEpoch: number;
}

const PasswordsContext = createContext<PasswordsContextValue | null>(null);

export interface PasswordsProviderProps {
  children: ReactNode;
  /** Makes a batch from the inputs, never throwing. Defaults to the engine; tests pass one that counts. */
  engine?: (inputs: GenerateInputs) => Outcome;
  /** Settings and the list. Defaults to localStorage. */
  local?: KeyValueStore;
  /** The current passwords and sentence. Defaults to sessionStorage. */
  session?: KeyValueStore;
  /** How long to wait after a change before generating. */
  debounceMs?: number;
  /** Whether secrets (the list, the current batch) may go to the browser's storage. Defaults to whether the page is on the app's own origin. */
  persistSecrets?: boolean;
  /** Works out the zxcvbn reading for a password added to My list. Defaults to zxcvbn in this browser. */
  zxcvbn?: ZxcvbnCheck;
}

interface Result {
  key: string;
  round: number;
  outcome: Outcome;
}

const sameSettings = (a: Settings, b: Settings) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function PasswordsProvider({ children, engine = runInputs, local, session, debounceMs = 120, persistSecrets, zxcvbn = checkWithZxcvbn }: PasswordsProviderProps) {
  const [secretsPersisted] = useState(() => persistSecrets ?? isOwnOrigin());
  const [localStore] = useState(() => local ?? browserStore('local'));
  // Secrets stay in memory on a shared origin, where other sites could read the browser's storage; a list or a
  // session an earlier version left there is removed.
  const [listStore] = useState(() => {
    if (secretsPersisted) return localStore;
    removeKey(localStore, SELECTED_KEY);
    return memoryStore();
  });
  const [sessionStore] = useState(() => {
    if (secretsPersisted) return session ?? browserStore('session');
    removeKey(session ?? browserStore('session'), SESSION_KEY);
    return memoryStore();
  });
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
  const [selected, setSelected] = useState(() => loadSelected(listStore));
  // Whether the last write of the list worked; a store the browser would not give us has never worked.
  const [listSaved, setListSaved] = useState(() => listStore !== undefined);
  const [failedWrites, setFailedWrites] = useState<ReadonlySet<string>>(() => new Set());
  const [retries, setRetries] = useState(0);
  const [practice, setPractice] = useState<PracticeTarget | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [zxcvbnFailed, setZxcvbnFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [round, setRound] = useState(restored?.round ?? 0);
  const [generated, setGenerated] = useState<GeneratedSentence | null>(restored?.generated ?? null);
  const [result, setResult] = useState<Result | null>(
    restored?.outcome ? { key: restored.key, round: restored.round, outcome: restored.outcome } : null,
  );
  const [busy, setBusy] = useState(false);
  const engineRef = useRef(engine);
  engineRef.current = engine;

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

  /** Note whether the write under `key` worked, keeping the same set when nothing changed. */
  const report = useCallback((key: string, ok: boolean) => {
    setFailedWrites((prev) => {
      if (prev.has(key) !== ok) return prev;
      const next = new Set(prev);
      if (ok) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Applied settings survive for good; they hold no secrets. The list holds passwords: it goes to the browser only on the app's own origin.
  useEffect(() => report('requirements', saveRequirements(localStore, applied.req)), [report, localStore, applied.req, retries]);
  useEffect(() => report('sentence options', saveSentenceOptions(localStore, applied.sentenceOptions)), [report, localStore, applied.sentenceOptions, retries]);
  useEffect(() => report('mappings', saveMappingSettings(applied.mappingSettings, localStore)), [report, localStore, applied.mappingSettings, retries]);
  useEffect(() => report('mode', saveMode(localStore, mode)), [report, localStore, mode, retries]);
  useEffect(() => report('sort', saveSort(localStore, sort)), [report, localStore, sort, retries]);
  useEffect(() => report('typing mode', saveTypingMode(localStore, applied.typingMode)), [report, localStore, applied.typingMode, retries]);

  // My list changes one change at a time, made to the list as stored just now, so another tab's additions survive.
  const selectedRef = useRef(selected);
  const listSavedRef = useRef(listSaved);
  const changeList = useCallback(
    (change: (list: readonly SelectedEntry[]) => SelectedEntry[]) => {
      const { list, saved } = changeSelected(listStore, selectedRef.current, listSavedRef.current, change);
      selectedRef.current = list; // a second change in the same tick builds on this one
      listSavedRef.current = saved;
      setSelected(list);
      setListSaved(saved);
    },
    [listStore],
  );
  // Another tab's change shows here at once, unless this tab holds entries storage does not (its last write failed).
  useEffect(
    () =>
      watchKey(listStore, SELECTED_KEY, () => {
        if (!listSavedRef.current) return;
        const list = loadSelected(listStore);
        selectedRef.current = list;
        setSelected(list);
      }),
    [listStore],
  );

  // Generate when the applied inputs or the round change, unless the batch on
  // screen was already made from exactly these (as after a reload). The engine
  // runs on this thread, in a timer: the debounce is what lets the browser
  // paint "Working…" and the dimmed old batch before the thread is taken, and
  // a change applied during it cancels the timer, so only the newest inputs
  // run. Nothing can arrive while a batch runs, so there is nothing to supersede.
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
    setBusy(true);
    const timer = setTimeout(() => {
      const request = inputsRef.current;
      const outcome = engineRef.current(request);
      // A new draw becomes the kept sentence, and the batch is filed under the inputs with it, so it is not made again.
      const drawn = request.mode === 'generated' && !request.generated && outcome.ok ? outcome.generated : undefined;
      if (drawn) setGenerated(drawn);
      setResult({ key: drawn ? inputsKey({ ...request, generated: drawn }) : key, round, outcome });
      setBusy(false);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, round, debounceMs]);

  // The current passwords and the applied sentence survive a reload, in this tab only.
  useEffect(() => {
    report('session', saveSession(sessionStore, {
      key: result?.key ?? key,
      round: result?.round ?? round,
      sentence: applied.sentence,
      outcome: result?.outcome ?? null,
      ...(generated ? { generated } : {}),
      ...(generated && applied.editedSentence !== null ? { edited: applied.editedSentence } : {}),
    }));
  }, [report, sessionStore, result, applied.sentence, applied.editedSentence, key, round, generated, retries]);

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
    (s: Pick<Suggestion, 'password' | 'hint'>) => {
      const rank = commonRank(s.password);
      if (rank !== undefined) return { added: false, problem: commonPasswordProblem(rank) };
      changeList((list) => withEntry(list, { password: s.password, hint: s.hint, addedAt: new Date().toISOString() }));
      return { added: true };
    },
    [changeList],
  );
  const removeSelected = useCallback((password: string) => changeList((list) => withoutEntry(list, password)), [changeList]);
  const clearSelected = useCallback(() => changeList(() => []), [changeList]);
  const isSelected = useCallback((password: string) => selected.some((e) => e.password === password), [selected]);

  // Each entry gets its zxcvbn reading once, when it is added (or, for an entry saved before readings existed, on the next visit), and keeps it.
  const checking = useRef(new Set<string>());
  useEffect(() => {
    for (const entry of selected) {
      if (entry.zxcvbn || checking.current.has(entry.password) || zxcvbnFailed.has(entry.password)) continue;
      const { password } = entry;
      checking.current.add(password);
      zxcvbn(password)
        .then((reading) => changeList((list) => withReading(list, password, reading)))
        .catch(() => setZxcvbnFailed((prev) => new Set(prev).add(password)))
        .finally(() => checking.current.delete(password));
    }
  }, [selected, zxcvbn, zxcvbnFailed, changeList]);

  const retrySaving = useCallback(() => {
    // Memory holds what the failed writes did not; storage may hold another tab's entries. Keep both.
    const stored = loadSelected(listStore);
    changeList((memory) => [...memory, ...stored.filter((e) => !memory.some((m) => m.password === e.password))]);
    setRetries((n) => n + 1);
  }, [changeList, listStore]);

  const practiceId = useRef(0);
  const practise = useCallback((s: Pick<Suggestion, 'password' | 'hint'>) => setPractice({ password: s.password, hint: s.hint, id: ++practiceId.current }), []);

  const forgetSession = useCallback(() => {
    clearSession(sessionStore);
    setResult(null); // a timer pending for the old sentence is cleared when the inputs change
    setGenerated(null);
    const blank = (s: Settings) => (s.sentence === '' && s.editedSentence === null ? s : { ...s, sentence: '', editedSentence: null });
    setApplied(blank);
    setDraft(blank);
    setRound(0);
    setPractice(null);
    setSessionEpoch((n) => n + 1);
  }, [sessionStore]);

  const persistence = useMemo<Persistence>(
    () => ({
      list: !secretsPersisted ? 'visit-only' : listSaved ? 'saved' : 'failed',
      session: !secretsPersisted ? 'visit-only' : failedWrites.has('session') ? 'failed' : 'saved',
      settings: [...failedWrites].some((k) => k !== 'session') ? 'failed' : 'saved',
    }),
    [secretsPersisted, listSaved, failedWrites],
  );

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
      secretsPersisted,
      persistence,
      retrySaving,
      addSelected,
      removeSelected,
      clearSelected,
      isSelected,
      zxcvbnFailed,
      practice,
      practise,
      forgetSession,
      sessionEpoch,
    }),
    [draft, applied, dirty, problems, notice, apply, discard, setReq, setSentenceOptions, setMappingSettings, setSentence, setEditedSentence, setTypingMode, mappings, mode, sort, result, busy, key, regenerate, generated, newSentence, selected, secretsPersisted, persistence, retrySaving, addSelected, removeSelected, clearSelected, isSelected, zxcvbnFailed, practice, practise, forgetSession, sessionEpoch],
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
