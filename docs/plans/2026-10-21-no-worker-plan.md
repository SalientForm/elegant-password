# Plan: generation on the page's own thread

Implements `docs/specs/2026-10-21-no-worker-design.md` on
`feature/audit-follow-up`. Written 2026-10-21. Each milestone ends green
on `pnpm typecheck` and `pnpm test` and stands on its own as a commit;
M3 also runs `pnpm build` and `pnpm test:e2e` and records the
measurement; M4 is documentation alone. Line numbers are at commit
`8699fd5`.

## M1. The engine called in the debounce (spec §2.1, §2.2, §2.3)

- Delete `src/state/generator.ts`, `src/state/generator.test.ts` and
  `src/worker.ts`.
- `src/lib/engine.ts`: `GenerateRequest` and `GenerateResponse` go; the
  header comment says the function runs in a test or on the page.
- `src/state/PasswordsProvider.tsx`: the prop `engine?: (inputs:
  GenerateInputs) => Outcome`, defaulting to `runInputs`. The effect at
  line 331: when the batch on screen matches the key and round, `busy`
  false and nothing else; otherwise `busy` true, then in the timer the
  engine is called on `inputsRef.current` and the drawn sentence, the
  result and `busy` false are set. The `latest` counter, the dispose
  effect and the StrictMode comment go.
- `src/prompts/specPrompt.ts`: the import at line 44 goes; the sentence
  at line 341 says generation runs on the page's thread, 120 ms after the
  last change, with the old batch kept on screen dimmed and "Working…"
  shown. `src/prompts/cliPrompt.ts:42`: "the same call the web app
  makes".
- `src/state/PasswordsProvider.test.tsx`: `countingGenerator` becomes a
  counting function recording `GenerateInputs`. "Drops answers to
  superseded requests" becomes "a change applied during the debounce
  runs once, for the newer inputs", mounted with `debounceMs` of 50:
  Refresh, then apply a twist change within the 50 ms, then one more run
  only, carrying the change. "A request still in flight for inputs no
  longer wanted" becomes "to sentence mode and back within the debounce
  runs nothing and keeps the batch those inputs have": one run in all,
  the first password unchanged, `busy` false, no error, not stale. New:
  "the status reads Working… when the engine is called": the counting
  function reads the probe's `busy` output at call time.
- `ApplyBar.test.tsx`, `SelectedList.test.tsx`, `TypingTest.test.tsx`:
  the `generator` prop and its import go.
- `pnpm test:titles`.

## M2. Caches that hit, a build with one copy (spec §2.4, §2.5)

- `src/lib/pipeline.ts`: `inputsFor(settings, generated = null, mappings
  = activeMappings(settings.mappingSettings))`.
- `PasswordsProvider.tsx`: `appliedMappings`, memoised on
  `applied.mappingSettings`, passed to `inputsFor` at line 277.
- Test (`PasswordsProvider.test.tsx`): the `mappings` the engine receives
  is the same object across Refresh and across an applied change to the
  twist count, and a different object after a built-in mapping is turned
  off through `setMappingSettings`.
- `build/csp.ts`: `worker-src` out; the comment's "and the worker".
  `src/lib/csp.test.ts`: the `worker-src` assertion out.
- `vite.config.ts`: the `worker` option out.
- `src/boundaries.test.ts`: `src/worker.ts` out of `WEB` (line 66) and of
  the bundle's roots (line 181).
- `playwright.config.ts`: the comment at lines 3-7 names the CSP and the
  built app, not the worker.
- `README.md`: the bullet at line 225 becomes "On the page's own
  thread": generation runs where the page runs, within the engine's
  budget (the worst permitted batch under a quarter of a second on a
  desktop), 120 ms after the last change, with the old batch on screen
  until the new one is ready; line 415 loses `generator.ts` and
  `worker.ts`. `src/lib/generate.ts:263`: "stored", not "sent to a
  worker".

## M3. The measurement (spec §2.6, §5)

- `pnpm build`: `dist/assets` has no worker chunk; the main chunk's
  gzipped size beside today's 176 KB. `pnpm test:e2e`: all 61 pass.
- The time from navigation to the first batch on screen in the built
  app, with a scratch Playwright script run against this commit and
  against `8699fd5` (the worker chunk's download and start were on that
  path), median of five.
- The spec's status to built with the commit; its §5 table; the
  checklist's H2, L2, L3 and L10 rows to built and M4's note kept.
- The phone figure, if the user takes it: a scratch readout of
  `performance.now()` around the engine call shown in the status, run
  from the dev server on Serve `:4270`; written into §5 and not kept in
  the code.

## M4. The documentation carries the decisions; the specs go (spec §2.9)

- `docs/decisions.md` created: engineering decisions by area (scoring,
  generation, the engine's budget and where it runs, persistence, build
  and deploy), each with the decision, why, the date and where in the
  code, and the measurement it rests on where there is one. Its opening
  says the rule: a decision that stops holding is removed in the change
  that stops it. `README.md`'s layout section lists it.
- For each of `2026-10-20-audit-fixes-design.md` (with its plan),
  `2026-10-20-follow-up-fixes-design.md` (with
  `docs/audits/2026-10-20-follow-up-audit.md`),
  `2026-10-21-engine-budget-design.md` (with its plan) and
  `2026-10-21-no-worker-design.md` (with this plan): every decision is
  checked against the README, `docs/algorithm-flow.md` and the code. One
  already recorded needs nothing. One that holds and is unrecorded goes
  to the README (behaviour a user meets), `algorithm-flow.md` (the
  algorithm) or `decisions.md` (engineering, with its reason). One that
  no longer holds is dropped: the worker's slot, its 300 ms replacement
  and ten-second limit, the maximum of 256. Then the files are deleted.
- Known moves, from reading the four: H1's §2.1-2.6 and §5 table, and
  H2's §2.1-2.6 and §5, go to `decisions.md` whole, since nothing else
  records why the engine is bounded the way it is or what it measured.
  The follow-up spec's §2 (Strength's habits) and the audit spec's §2
  (three attackers) are already in `algorithm-flow.md` §4; its §1
  (common passwords, zxcvbn) is in the README's features. The audit
  spec's §1 table of the user's decisions goes to `decisions.md` as
  decisions, without the audit's numbering; its §8 wording table and §9
  fix list are history and go; its §10 is in `TODO.md`. The follow-up
  spec's §3 findings table holds behaviour (a pasted password kept
  exactly, YAML anchors refused, a session that does not parse removed)
  that is checked against the README bullet by bullet.
- The checklist's Spec column for a row whose spec is gone names the
  section of `decisions.md` instead.
- Not in this plan: `2026-10-20-tep-cli-design.md` and its plan, the
  checklist's D1.
