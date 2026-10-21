// How long one piece of work may take, for every front end. A plain number:
// src/lib has no clock, so each front end times its own work against it.

/**
 * Longer than this, one piece of work is a failure (the user's line,
 * 2026-10-21): the web app shows its slow-work notice, and
 * `pnpm measure:wizard` fails a tep config question.
 */
export const SLOW_MS = 2000;
