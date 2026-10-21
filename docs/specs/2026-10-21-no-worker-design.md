# Generation on the page's own thread

Status: **proposed**, 2026-10-21. Acts on item H2 of
`docs/audits/2026-10-21-audit-checklist.md` and closes L2, L3 and L10
with it. It is the second of the two steps that take the audit's 90-day
bet: H1 (`2026-10-21-engine-budget-design.md`, commit `8699fd5`) made the
engine answer within a budget; this one removes the worker on H1's
measurement. The user took the recommendations of the discussion on
2026-10-21; §5 records the reasoning. `TODO.md` ("A worker again, once
everything works without one") keeps the way back.

## 1. The problem

`src/state/generator.ts` runs the engine in a Web Worker and carries what
that needs: a slot of one waiting request, superseding by id, replacement
of a worker still busy with superseded work after 300 ms, a ten-second
silence limit after which the generator runs inline for the rest of the
session, and re-creation after `dispose()` so a StrictMode mount cycle
cannot strand it. That is 185 lines, a 213-line test with a fake worker,
`src/worker.ts`, and three findings of the audit:

- L2: the scorer's and the twist table's caches key on the identity of
  the mapping list, and a worker request is a structured clone, so no
  cache hits across requests (0.1 ms with one list against 67 ms cloned,
  for 200 scores).
- L3: a replaced worker imports the engine again and ranks every pool
  again (80 ms cold against 19 ms warm on the desktop).
- L10: the engine, word lists and the common-password list are built
  twice, into the page's main chunk (for the inline path and the Scoring
  page) and into the worker chunk, which the first batch downloads.

| Chunk of the built app | Gzipped |
| --- | --- |
| Main page chunk, engine included | 176 KB |
| Worker chunk, the same engine again | 70 KB |

What the worker buys is a page that keeps painting while a batch is
made. A batch is made on Apply, Refresh, New sentence and page load, never
per keystroke: the draft is applied by a button. The typing test and the
Scoring page already run the scorer on the page's thread on every
keystroke. So the worker spares the user a stall during an explicit
action, and H1 measured that action: 224 ms on the desktop at the worst
permitted settings, 10 ms at the defaults.

## 2. Decisions

### 2.1 The engine is called, synchronously, inside the debounce

`PasswordsProvider` keeps its effect on the applied inputs and the round:
it sets `busy`, waits `debounceMs`, and then calls the engine and sets
the result and `busy` false in the same timer callback. The engine is
`runInputs` from `src/lib/engine.ts`, which never throws.

Superseding becomes the timer's cancellation, which already exists: a
change applied during the debounce clears the timer and the effect runs
again for the new inputs. A batch in progress cannot be overtaken,
because nothing runs on the thread while it runs, so the request id, the
`latest` counter and the "superseded" outcome have nothing to guard and
go. `GenerateRequest`, `GenerateResponse`, `SUPERSEDED`, `Generator`,
`WorkerLike`, `workerGenerator`, `syncGenerator`, `createGenerator`,
`dispose` and both timeouts go with them. `src/state/generator.ts` and
`src/worker.ts` are deleted. `engine.ts` keeps `GenerateInputs`,
`Outcome`, `runInputs` and `inputsKey`; a stored session is an `Outcome`
as before.

The call is synchronous rather than a Promise that always resolves at
once. A Promise would be a hedge for a worker that may never return; if
one does (the TODO's conditions), it comes with its own spec and makes
the seam asynchronous then.

### 2.2 The seam for tests stays, as a function

`PasswordsProviderProps.generator` becomes
`engine?: (inputs: GenerateInputs) => Outcome`, defaulting to
`runInputs`. Its contract is the engine's: never throws. The provider's
own tests pass a counting function where they passed a counting
generator. `ApplyBar.test.tsx`, `SelectedList.test.tsx` and
`TypingTest.test.tsx` passed `syncGenerator()` only to keep a worker out
of jsdom; they pass nothing.

### 2.3 "Working…" stays, and paints before the stall

`busy` is set in the effect and the engine runs in a timer, so the
browser paints the status, `aria-busy` and the dimmed old batch before
the thread is taken. The 120 ms debounce is that yield; it stays above a
frame. The batch on screen is kept until the new one replaces it, as
today. No second yield is added inside a batch (§2.7).

### 2.4 The caches hit across batches (L2)

With no clone, the mapping list the engine sees is the provider's own
object. The provider memoises the applied settings' list on
`applied.mappingSettings` alone and builds the inputs with it, so the
list is one object for every batch until a mapping is turned on or off
or a custom one changes. Today `inputsFor` builds a fresh list per call,
and the inputs are memoised on the whole applied settings, so a change to
the twist count would still hand the engine a new list. `inputsFor` takes
the list as an optional third argument; the CLI, which runs once, passes
nothing. The draft's own memoised list (for the form) is unchanged.

The scorer's cache (400 entries) and the twist spellings (5,000 per list)
then hold for the session: a word that recurs across batches of the same
sentence is scored once, and a Refresh re-scores nothing the last batch
scored.

### 2.5 What closes and what moves

- L3 closes: there is nothing to replace. The cold cost of the first
  batch (the pools ranked, about 80 ms on the desktop) is paid once per
  page load, as the worker paid it once per worker.
- L10 closes: one copy of the engine and the common list. The worker
  chunk leaves the build; the main chunk does not change, since it
  already carried the engine.
- The CSP loses `worker-src`: `default-src 'self'` covered it, and the
  policy should name only what the app does.
- M4 moves, not closes: the planning cache (up to 400 length models of
  about a megabyte) now lives on the UI thread. It shared the tab's
  memory before, but a collection pause now lands on painting. M4 keeps
  its place in the order, with this noted in the checklist.

### 2.6 The price

- No net under the engine. A regression that makes a batch take seconds
  freezes the page for those seconds, where the worker hid it. The guard
  is H1's tests, which assert the counts a batch may spend (one scoring
  per kept suggestion, three attempts per suggestion asked), and H1's §5
  measurement, to be repeated with the audit bench before any change to
  the engine's cost lands.
- No Stop button and no batch the user can watch grow. Neither exists
  today.
- The stall itself. Desktop figures are H1's; the phone column is an
  estimate at four to eight times the desktop, as the audit assumed:

| Case | Desktop, measured | Slow phone, estimated |
| --- | --- | --- |
| Defaults: a 60-character sentence, 5 asked | 10 ms | under 100 ms |
| Worst permitted: 250 characters, 20 asked, maximum 128 | 224 ms | 1 to 2 s |
| First batch after load, generated mode, cold | 80 ms | 0.3 to 0.6 s |

A phone figure is the one number this spec leaves open. The dev server
is on Tailscale Serve at port 4270; a scratch readout of
`performance.now()` around the engine call, shown in the status, gives it
in minutes on the user's phone. It is not part of the build and is
recorded in §5 if taken.

### 2.7 Not taken now

- A bench script in the repo (`pnpm bench`, printing H1's table) so the
  budget can be re-checked by hand before engine changes. The bench lives
  outside the repo today; this is the lead candidate if the "no net"
  price proves uncomfortable.
- Yielding between attempts inside a batch, so a long batch leaves the
  page responsive. It makes the engine asynchronous for a case the
  budget rules out.
- An idle yield before the first batch after load.
- Dropping `busy` and "Working…". They are cheap, they are what paints
  before the stall, and the smoke tests settle on them.

### 2.8 What does not change

The engine and the CLI (which never had a worker). The session format.
The debounce. The e2e suites' expectations: a batch lands and "Working…"
goes away. React StrictMode: the effect's cleanup clears the timer and
there is no worker to strand.

### 2.9 The documentation carries the decisions; the specs go

Decided by the user on 2026-10-21: a spec is a working document. Once it
is built, every decision in it that remains accurate is recorded in the
application's documentation, and the spec, its plan and the audit it
acted on are deleted. The documentation is the README for behaviour a
user meets, `docs/algorithm-flow.md` for the algorithm, and
`docs/decisions.md` (new) for engineering decisions, their reasons and
the measurements they rest on. A decision that stops holding is removed
from the documentation in the change that stops it, so the documentation
describes the app as it is, never its history; the history is in git.

This spec applies the rule to the specs its build must edit, since each
describes the worker: `2026-10-20-audit-fixes-design.md` and
`2026-10-20-follow-up-fixes-design.md` with their plan and audit; to
H1's `2026-10-21-engine-budget-design.md` and plan, whose decisions and
measurement are what this one rests on; and to itself and its plan once
built. The CLI spec of 2026-10-20 is not touched by this work and is its
own checklist item.

## 3. What changes

- Deleted: `src/state/generator.ts`, `src/state/generator.test.ts`,
  `src/worker.ts`.
- `src/lib/engine.ts`: `GenerateRequest` and `GenerateResponse` go; the
  header comment no longer offers a worker.
- `src/state/PasswordsProvider.tsx`: the `engine` prop (§2.2); the effect
  of §2.1; the applied mapping list memoised (§2.4); the dispose effect
  and the StrictMode comment go.
- `src/lib/pipeline.ts`: `inputsFor(settings, generated, mappings?)`.
- `build/csp.ts`: `worker-src` and the comment's "and the worker";
  `src/lib/csp.test.ts` with it.
- `vite.config.ts`: the `worker` option.
- `src/boundaries.test.ts`: `src/worker.ts` out of the web files and the
  bundle's roots.
- `playwright.config.ts`: the comment; the built target still checks the
  CSP and the built app.
- Prose: `README.md` line 225 ("Off the main thread" becomes the budget:
  generation runs on the page's thread, within H1's bound, and the old
  batch stays on screen until the new one is ready) and line 415; the
  Fun page's prompts, `cliPrompt.ts:42` and `specPrompt.ts:44`, `:341`,
  `:365`; the comment at `src/lib/generate.ts:263`.
- Tests as §4; `src/lib/testTitles.json` regenerated.
- Docs: this spec's status and §5; the checklist's H2, L2, L3, L10 and
  M4 rows; `docs/decisions.md` created and the specs of §2.9 folded into
  the documentation and deleted; the README's layout section lists the
  new file. The TODO entry is already written.

The older specs that describe the worker are not left as records: §2.9
says what happens to them.

## 4. Tests

- `PasswordsProvider.test.tsx`: the counting generator becomes a counting
  function. "Drops answers to superseded requests" becomes: a change
  applied during the debounce runs once, for the newer inputs (a nonzero
  debounce in that test). "A request still in flight for inputs no longer
  wanted" cannot arise with a synchronous engine; it becomes: to sentence
  mode and back within the debounce runs nothing, shows the batch those
  inputs already have, and is not busy.
- New: the status reads "Working…" when the engine is called (the
  counting function reads the probe), so the paint precedes the stall.
- New: the mapping list handed to the engine is the same object across a
  Refresh and across an applied change to the twist count, and a new
  object once a mapping is disabled.
- The component tests drop the generator prop; the engine's own tests
  stand; the bundle test's roots are `src/main.tsx` alone.
- The smoke suites are unchanged and are the check that a batch lands in
  the built app under the CSP without a worker.

## 5. For the record

Why remove rather than mend? The audit's bet: the worker's machinery
existed to hide a cost that H1 removed, and every finding in it (H1's
freeze, L2, L3, L10) was a cost of having it. Mending it (the withdrawn
timeout spec) would have kept the machinery and the findings for the
sake of a stall the budget makes a quarter of a second on a desktop.

Why not keep the Promise? Four test files and the provider would carry
an asynchronous shape for a worker that returns only on a measured reason
the TODO names. When it does, the spec that brings it back changes the
seam; until then the simpler shape is the honest one.

Why memoise in the provider and not inside `activeMappings`? A cache in
the library keyed on the settings object would be hidden state in a pure
function; the provider owns the identity of its objects and already
memoises the draft's list the same way.

Measured when built: the chunks of the build, the first batch after load
in the built app, the suite's size, and the phone figure if the user
takes it.
