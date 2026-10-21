# Plan: M6, the wizard's budget asserted as work, timed by hand

Implements `docs/specs/2026-10-21-m6-question-work-design.md`. Written
2026-10-21 at commit `48e719c`; line numbers are at that commit. Each
milestone ends green on `pnpm typecheck`, `pnpm test` and
`NODE_OPTIONS=--max-old-space-size=4096 pnpm vitest run --coverage`, and
stands on its own as a commit.

## M6.1 Work in the suite, time by hand (spec §2)

- `src/cli/walk.test.ts`:
  - Lines 1-5, the header: the walks keep every question within the work
    it may cost; `pnpm measure:wizard` times them against the budget.
  - Line 7: the empty `node:fs` import goes. Line 9 imports `vi`.
  - After the imports: `const work = vi.hoisted(() => ({ plannings: 0,
    models: 0 }))`; `vi.mock('../lib/consistency', ...)` returning the
    module with `problemsOf` wrapped to count `work.plannings`;
    `vi.mock('../lib/lengthModel', ...)` returning the module with
    `LengthModel` replaced by a subclass whose constructor counts
    `work.models`.
  - Lines 21-31: `BUDGET_MS` and `cpuMs` go. In their place
    `MAX_PLANNINGS_PER_QUESTION = 400` and `MAX_MODELS_PER_QUESTION =
    400`, with a comment giving the reason (about twice the worst
    measured, 183 and 181; the planning cache's limit; spec §2).
  - Line 45: a gap is `{ message, plannings, models, ms }`, `ms` in wall
    time. Line 50: `last` is `performance.now()`. Lines 64-70: `time`
    records the counters and the wall time since the last answer;
    `done` sets both counters to 0 and `last` to `performance.now()`.
  - Lines 119-140: the loop over seeds 1-40 becomes `walkAll()`,
    returning every gap, with the correctness assertions inside it as
    now. The test is renamed "never meet a contradiction, never reach a
    dead end, fit the review to the box, save a file tep g can use, and
    keep each question within its work" and asserts that no gap exceeds
    either ceiling and that the worst gap has at least one planning and
    one length model.
  - New: `it.skipIf(!process.env.MEASURE_WIZARD)("times every question
    against the budget (pnpm measure:wizard)", ...)` runs `walkAll()`,
    prints the five slowest gaps (message, wall ms, plannings, models)
    and expects none over `QUESTION_BUDGET_MS`.
- `src/cli/constraints.ts:24`: the comment says milliseconds on a typical
  laptop, asserted as work by `src/cli/walk.test.ts` and timed by `pnpm
  measure:wizard`.
- `package.json:27`: after `measure:modes`, `"measure:wizard":
  "MEASURE_WIZARD=1 vitest run src/cli/walk.test.ts -t 'times every
  question' --reporter=verbose --silent=false"`. The filter runs the
  timed walk alone, on fresh caches.
- `src/prompts/cliPrompt.ts:271`: "of CPU time" becomes "on a typical
  laptop". Line 283: "must shape every question within the budget (CPU
  time; 3x on CI)" becomes "must keep every question within 400
  plannings and 400 length models (`pnpm measure:wizard` times them
  against the budget)".
- `pnpm test:titles`.
- Checks beyond the milestone's three: the coverage run three times in a
  row; `pnpm measure:wizard` passes and its slowest question is recorded
  for M6.2; once, by hand and not committed, `problemsOf` in
  `src/lib/consistency.ts:25` calls `plan` (caught) instead of
  `planProblem`, and the walk fails the models ceiling (spec §2 measured
  1,142).

## M6.2 Documentation (spec §2, §4, §5)

- `docs/decisions.md:321-325` ("The wizard"): the bullet keeps the
  user's decision and adds how it is held, dated 2026-10-21: as work in
  the suite (at most 400 plannings and 400 length models per question,
  why 400), never as a time in the suite or CI (a coverage run reached
  81 to 94 % of the budget for a question that takes 133 ms alone);
  `pnpm measure:wizard` times every question, fails over the budget, and
  is run before merging a change to `src/cli/constraints.ts`,
  `src/lib/consistency.ts` or the planning in `src/lib/generate.ts` and
  `src/lib/grammar.ts`. "The slowest question measured about 70 ms"
  becomes M6.1's figure, with the machine. The price (spec §5, first
  two points) goes with it in one sentence each.
- `README.md:368`: after `pnpm test`, `pnpm measure:wizard  # times
  every tep config question against its 750 ms budget`.
- The spec and this plan are deleted.
- `docs/audits/2026-10-21-audit-checklist.md:38`: M6 built, with the
  commit; the Spec column names `docs/decisions.md`, "The wizard".
