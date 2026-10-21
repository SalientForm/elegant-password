# M6: the wizard's budget asserted as work, timed by hand

Audit checklist M6. Written 2026-10-21 at commit `48e719c`.

## 1. The problem

`src/cli/walk.test.ts` walks `tep config` at random (40 seeds, 631
questions) and fails when any question takes longer than
`QUESTION_BUDGET_MS` (`src/cli/constraints.ts:25`, 750 ms), times 3 when
`CI` is set (`walk.test.ts:27`). The time is not wall-clock, as the
checklist says, but the test process's CPU time (`process.cpuUsage`,
`walk.test.ts:28-31`), chosen so that waiting for a core does not count.
It still counts more than the wizard: V8's garbage-collector threads, and
the instrumentation when coverage is on.

The slowest question is the same in every run: seed 3, "Strength target",
where `reachableBits` runs a full `plan` and builds 148 length models.
Measured on the desktop (Ryzen 9 3900X, 12 cores, WSL2, Node 24, Vitest
5.0.4), at `48e719c` and the two commits before it, where `src/cli` and
the planning are unchanged:

| Run | Slowest question, CPU | Slowest question, wall | The walk, wall |
| --- | --- | --- | --- |
| `walk.test.ts` alone | 179-269 ms | 122-145 ms | 7.3-8.0 s |
| alone, with coverage | 367-439 ms | 323-363 ms | 18.3-20.4 s |
| the whole suite | 303-352 ms | 297-307 ms | 10.8-11.2 s |
| the whole suite, with coverage | 610-708 ms | 615-996 ms | 19.2-26.4 s |

So the assertion measures the machine and the run, not the wizard: the
same question costs 2.3 to 4 times as much under a coverage run of the
whole suite, which reaches 81 to 94 % of the budget here and crosses it
on a slower or busier machine. CI does not run coverage
(`.github/workflows/ci.yml` runs `pnpm test`) and allows 2,250 ms, so
the failure is met locally, on the coverage run the audit's baseline came
from. The CI factor of 3 is itself a guess that was never measured.

The work the questions do does not vary. In every run above, with or
without coverage, the worst question asked for 183 plannings (`problemsOf`
calls from the CLI, past its cache) and the worst built 181 length
models.

## 2. The decision

The rule the engine's budget already follows (`docs/decisions.md`, "The
engine's budget": counts in tests, never a wall clock in CI) is applied to
the wizard.

- **The unit suite asserts work, not time.** The random walk counts, per
  question (from one answer to the next question being asked), the
  plannings the CLI asks for and the length models built, and fails when
  a question exceeds a ceiling: **400 plannings and 400 length models**.
  The counts come from two targeted `vi.mock` factories in the test: one
  wraps `problemsOf` from `src/lib/consistency.ts`, one subclasses
  `LengthModel` from `src/lib/lengthModel.ts` to count constructions.
  Nothing is added to `src/lib` or `src/cli` for the test. The counters
  are reset at every answer, so nothing accumulates.
- **The ceilings are the budget expressed as work.** 400 is about twice
  the worst measured (183 and 181), and the planning cache's own limit
  (`MODEL_CACHE_LIMIT`, `src/lib/generate.ts`): a question that built
  more would empty the cache it relies on. At the measured cost of a
  length model, 0.36 ms (median) to 1.9 ms (the largest pools), 400
  models cost 145 to 760 ms of CPU on the desktop, so the ceiling sits at
  the budget for the worst models, not far below it.
- **The counters prove they count.** The same test asserts that the
  worst question built at least one length model and asked for at least
  one planning, so a refactor that moves planning out of `problemsOf` or
  model building out of `LengthModel` fails the test rather than passing
  it unseen.
- **The time is taken by hand: `pnpm measure:wizard`.** A second test in
  `walk.test.ts`, skipped unless `MEASURE_WIZARD` is set (as
  `pnpm measure:modes` does for the mode profiles), runs the same 40
  walks on fresh caches, takes each question's wall time with
  `performance.now()`, prints the five slowest with their counts, and
  fails when one exceeds `QUESTION_BUDGET_MS`. Wall time, because the
  budget is a wait the user sees, and the run is one file on an otherwise
  idle machine. Measured at `48e719c`: the slowest question 133 ms wall
  on the desktop.
- **`BUDGET_MS`, `cpuMs` and the CI factor go.** `QUESTION_BUDGET_MS`
  stays in `constraints.ts`, read by the measurement and by the Fun
  page's CLI prompt (`src/prompts/cliPrompt.ts:271`), which loses "of CPU
  time".

The counters were checked against two regressions made in scratch
copies:

| Regression | Worst plannings | Worst models | Slowest, CPU, alone | Caught by |
| --- | --- | --- | --- | --- |
| None | 183 | 181 | 179-269 ms | |
| `problemsOf` plans in full (`plan`, not the early-exit `planProblem`) | 183 | 1,142 | 1,529 ms | the models ceiling, and the time |
| The `problemsFor` cache removed | 226 | 181 | 217 ms | neither: it costs no measurable time |

## 3. Alternatives not taken

- **Scale the budget under coverage.** Vitest gives a test no documented
  sign that coverage is on (the v8 provider starts it through the
  inspector in the worker), and the factor would be one machine's: 2
  alone, 3 to 4 in the whole suite. It stacks a second guess on CI's.
- **Skip the timing under coverage.** The same missing sign, and the
  whole suite without coverage already costs the slowest question 303 to
  352 ms of CPU against 179 to 269 alone, so the margin also shrinks on a
  busy machine without coverage; only CI's factor hides it there.
- **Raise the test's budget** (to 1,500 ms, say). The test would then
  hold nothing the user decided.
- **Move the time to `measure:wizard` with no counts.** The suite would
  guard nothing about the wizard's cost.
- **Count plannings alone.** The full-planning regression above keeps
  the plannings at 183 while the models rise sixfold and the time to 1.5
  s.
- **Counters exported from `src/lib`** (a stats object in `generate.ts`).
  Test instrumentation in the engine; the mocks keep it in the test.
- **`vi.mock(..., { spy: true })`**, as `src/lib/fromSentence.test.ts`
  does for the scorers. It spies every export and `LengthModel`'s
  methods, which `count` calls constantly: the walk took 10.1 to 10.6 s
  against 8.1 s. The targeted factories cost about 5 % (8.4 s).

## 4. Not changed

- **The budget itself**: shaping a question may take up to 750 ms on a
  typical laptop (the user's decision, 2026-10-20, first 333 ms), with
  `QUESTION_BUDGET_MS` its one value.
- The walk's 40 seeds and its correctness assertions (no contradiction,
  no dead end, the review within the box, a saved file `tep g` can use).
- The wizard and the planning: no code outside the test and the prompt's
  wording changes.
- CI: it runs `pnpm test` as before and still runs no coverage.
- The 4 GB heap the suite needs (M4).

## 5. The price

- Nothing in `pnpm test` or CI times the wizard. A change that makes each
  planning or each length model slower, at the same counts, passes the
  suite and is found only by `pnpm measure:wizard`, run by hand. This is
  the price H1 accepted for the engine.
- The ceilings are a proxy. A question at 400 models of the largest pools
  would already cost about the budget on the desktop, and more on a
  slower laptop; the ceilings catch a change in kind (planning in full,
  shapes that cannot fit no longer skipped), not a creep of 20 %.
- Two module mocks in the walk test, which a refactor of where planning
  happens must keep pointing at the right functions; the floor assertion
  says when they no longer do.
- `decisions.md` loses "the slowest question measured about 70 ms",
  which the walk no longer shows; the figure measured here replaces it.

## 6. Tests

- `walk.test.ts`, the walk, renamed "never meet a contradiction, never
  reach a dead end, fit the review to the box, save a file tep g can use,
  and keep each question within its work": each question at most 400
  plannings and 400 length models; the worst at least one of each.
- `walk.test.ts`, "times every question against the budget (pnpm
  measure:wizard)", skipped in `pnpm test`: run by `pnpm
  measure:wizard`, passes at `48e719c` with the slowest question 133 ms.
- The proof the guard works, done once in scratch and recorded in §2: a
  full plan in `problemsOf` fails the models ceiling.
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm vitest run --coverage`
  passes three times in a row, where the time assertion passed with
  6 to 19 % to spare.

## 7. Open questions

- **Should `pnpm measure:wizard` fail over the budget, or only print?**
  Recommended: fail. It is the only check of the user's decision in time,
  and it is run on purpose, on an idle machine. Designed that way.
- **When is it run?** Recommended: by hand before merging a change to
  `src/cli/constraints.ts`, `src/lib/consistency.ts`, or the planning in
  `src/lib/generate.ts` and `src/lib/grammar.ts`, written into
  `docs/decisions.md` beside the budget; never in CI, whose timing noise
  is what this item removes. Designed that way.
- **A laptop figure.** The budget names a typical laptop and every figure
  here is a desktop's. Recommended: run `pnpm measure:wizard` once on a
  laptop if one is to hand and record the slowest question in
  `decisions.md`; not needed to build this.
