# Plan: H3, limits and the slow-work notice

Implements `docs/specs/2026-10-21-h3-limits-and-slow-notice-design.md`,
after M2-M7 are merged (it touches `TypingTest.tsx` and `App.tsx`,
which M2 and M7 change). Each milestone ends green on `pnpm typecheck`,
`pnpm test`, and the last on `pnpm test:e2e`.

## H3.1 Limits

- `src/lib/text.ts`: `MAX_HINT_LENGTH = 512` replaces
  `MAX_SENTENCE_LENGTH` everywhere (engine, CLI, sentence fields, the
  typing test's hint field, prompts and their tests).
- `src/components/TypingTest.tsx`: the practice field and its paste use
  `MAX_LENGTH`.
- Docs: README (the 500-character limit), `docs/decisions.md` ("Limits
  and caches"), the spec prompt.

## H3.2 The notice

- `src/state/slow.ts`: `SLOW_MS`, `timed(what, fn, now?)`, a tiny
  store (`report`, `dismiss`, `subscribe`, `current`).
- Timed: the provider's engine call; `checkWithZxcvbn`'s library call;
  the typing test's scoring memos.
- `src/components/SlowNotice.tsx`, mounted in `App.tsx` beside the
  ApplyBar in one fixed stack; styles beside `.snackbar`.
- Tests as the spec's §4; `pnpm test:titles`.

## H3.3 Documentation

Decisions into `docs/decisions.md` and the README; the spec and plan
deleted; the checklist row built.
