# Plan: the engine answers within a budget

Implements `docs/specs/2026-10-21-engine-budget-design.md` on
`feature/audit-follow-up`. Written 2026-10-21. Each milestone ends green
on `pnpm typecheck` and `pnpm test` and stands on its own as a commit;
the last one also records the measurement the spec asks for.

## M1. The maximum at 128, the sentence capped by the engine (spec §2.1, §2.5)

- `src/lib/validation.ts`: `MAX_LENGTH = 128`. `src/lib/fromSentence.ts`:
  `TARGET_LENGTH_RANGE.max` reads it.
- `src/lib/text.ts`: `sentenceLengthProblem(sentence)` beside
  `MAX_SENTENCE_LENGTH`. `fromSentence` throws it as a `RequirementsError`
  after validating the requirements; `src/cli/generate.ts` uses it in
  place of its own check.
- Prose that repeated 256: README, `docs/algorithm-flow.md`, the comments
  in `ruleText.ts` and `SiteRules.tsx`, the Fun page's CLI prompt (the
  constant, not the number).
- Tests that asserted 256 read 128; `testTitles.json` regenerated. New:
  `src/lib/text.test.ts`; a long sentence refused by the engine and by
  `tep g --sentence -`; a stored maximum of 200 repaired and reported; a
  rule of exactly 200 characters not kept.

## M2. Score once, three attempts per suggestion (spec §2.2, §2.3)

- `fromSentence.ts`: `finish()` returns a `Draft` (the password, hint,
  length, tokens, steps, twists and the describing strings); the batch
  loop scores a draft after the duplicate check, building the
  `Suggestion`. `MAX_ATTEMPTS_PER_SUGGESTION = 3`.
- Tests: the scorers run once per suggestion returned (module spies on
  `./score` and `./strength`); a one-word, no-variety sentence stops at
  60 attempts (spy on `./twists`); every existing field test unchanged.

## M3. `collapseBlocks` without slicing, the measurement (spec §2.4, §2.6)

- `src/lib/strength.ts`: the Z-array version; the old one moves into
  `strength.test.ts` as the oracle for a random property test.
- The six cases of the spec's table re-measured with the audit bench and
  written into the spec's §5; the spec's status to built; the checklist's
  H1 row to built; `MAX_SENTENCE_LENGTH`'s comment in `text.ts` no longer
  says a 500-character sentence takes seconds.
