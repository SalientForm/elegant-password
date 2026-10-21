// Work the page does on its own thread cannot be stopped part-way, so a
// stall cannot be cut short; it can be made visible. Any one piece of work
// over SLOW_MS is a failure (the user's line, 2026-10-21): it is reported
// here, and SlowNotice shows it as a floating error until it is dismissed.
// The clock lives in the web app; the line itself is the core's
// (src/lib/budget.ts), shared with the CLI.

import { SLOW_MS } from '../lib/budget';

export { SLOW_MS };

export interface SlowWork {
  /** What was slow, as the notice names it: "Making passwords". */
  what: string;
  ms: number;
}

let current: SlowWork | undefined;
const listeners = new Set<() => void>();

// Listeners are told after the current task's rendering, never during it: a
// report can come from inside a render (a memo in the typing test), where
// setting another component's state is not allowed.
const notify = () => queueMicrotask(() => listeners.forEach((l) => l()));

/** Reports slow work; a newer report replaces the one showing. */
export function reportSlow(what: string, ms: number): void {
  current = { what, ms };
  notify();
}

export function dismissSlow(): void {
  if (!current) return;
  current = undefined;
  notify();
}

export const currentSlow = (): SlowWork | undefined => current;

export function subscribeSlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Runs `work` and reports it when it took longer than SLOW_MS. */
export function timed<T>(what: string, work: () => T, now: () => number = () => performance.now()): T {
  const started = now();
  try {
    return work();
  } finally {
    const ms = now() - started;
    if (ms > SLOW_MS) reportSlow(what, ms);
  }
}
