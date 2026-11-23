// The app modes: what kind of password the app makes. Sentences is the only
// one until Keyboard patterns is built (TODO.md); building it adds a value
// here and to a configuration's app-mode, not a key. The typing modes
// (difficulty.ts) serve every app mode.

export type AppMode = 'sentences';

export const APP_MODES: readonly { id: AppMode; label: string; hint: string }[] = [
  { id: 'sentences', label: 'Sentences', hint: 'A password made from a sentence: one drawn for you, or your own.' },
];

export const DEFAULT_APP_MODE: AppMode = 'sentences';
