// Tiny storage layer: JSON in and out of localStorage or sessionStorage,
// tolerant of blocked storage (private mode, quota) and bad data. Every
// store has a parse function that turns unknown JSON into a known shape or
// a default, so nothing read from the browser is trusted.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An in-memory store, for tests and for browsers that block storage. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** The browser's localStorage or sessionStorage, or undefined when it cannot be used. */
export function browserStore(kind: 'local' | 'session'): KeyValueStore | undefined {
  try {
    const store = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    if (!store) return undefined;
    // Accessing storage can throw (blocked); writing can throw (quota). Probe once.
    const probe = '__elegant-passwords-probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return undefined;
  }
}

/** Parsed JSON under `key`, or undefined when missing, malformed or blocked. */
export function readJson(store: KeyValueStore | undefined, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    if (raw === null || raw === undefined) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Write a value as JSON; false when storage is blocked or full. */
export function writeJson(store: KeyValueStore | undefined, key: string, value: unknown): boolean {
  try {
    store?.setItem(key, JSON.stringify(value));
    return !!store;
  } catch {
    return false;
  }
}

export function removeKey(store: KeyValueStore | undefined, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to do: it will not persist either way.
  }
}

export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
export const isString = (x: unknown): x is string => typeof x === 'string';
export const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';
