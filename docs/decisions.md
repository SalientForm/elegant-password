# Design decisions

What the app does is in the README and `docs/algorithm-flow.md`. This file
holds the decisions behind it that the code does not make obvious: what was
decided, why, when, and where it lives. It describes the app as it is. A
decision that stops holding is removed or replaced in the change that stops
it; the history is in git.

A spec in `docs/specs/` is a working document (decided 2026-10-21): once it
is built, every decision in it that remains accurate is recorded here, in
the README or in the algorithm flow, and the spec, its plan and the audit
it acted on are deleted. `TODO.md` keeps what is deferred and the decisions
to revisit.

## Scoring

- **A score is a pure function of the password, and of its hint where it
  needs one** (2026-10-20, the user's rule). Strength and Raw come from the
  password alone; Difficulty and Memorability from the password and its
  hint; nothing from the session, the settings or this app goes in, so a
  password reads the same on a card, in My list and a year later. The
  exact entropy of the app's own choices, which needs the session's swap
  list, is the bits figure: shown only in the session, never saved,
  feeding no score. `src/lib/strength.ts`, `src/lib/score.ts`; the three
  attackers are in the algorithm flow, section 4.
- **Raw reads repeated characters only, never sequences** (2026-10-20, the
  user's choice). `asdfasdfasdf` and `qwertyuiop` still read red, through
  Strength's bands, not through pattern detection in Raw, which stays the
  naive figure every strength meter gives.
- **Strength's habits, with their thresholds** (2026-10-20). A block typed
  again counts once plus log2 of the times: blocks of three characters or
  more from two copies, two-character blocks only from three, so `banana`
  and `cocoa` stay words. A walk of four or more letters along a keyboard
  row or the alphabet, in one direction, is one pick of 1,000; three-letter
  steps are common in English (`rst`) and are left alone. A password
  exactly on the 10,001 most common is log2 of its place on the list.
  `src/lib/strength.ts`.
- **The zxcvbn reading is the library's crack time read as one of four
  words** (2026-10-20). An offline attack on a slow hash at 10^4 guesses a
  second: seconds or minutes are very weak, hours to weeks weak, months to
  years good, centuries strong. It names the library, is not one of the
  app's scores and sorts nothing. A reading saved with a My list entry is
  worked out again only when the estimator changes (`ZXCVBN_ESTIMATOR` in
  `src/lib/zxcvbnReading.ts`).
- **The bits panel's green means "meets your target"; a badge's green means
  50 bits or more** (2026-10-20). The panel says its figure is for an
  attacker who knows the tool and that the badges assume one who does not.
- **A deliberate swap costs nothing** (2026-10-15, the user's decision). It
  follows from its word by one fixed rule, so it is not memory load; the
  measurement is in `TODO.md`.

## Generation

### The engine's budget (2026-10-21)

A batch of sentence-mode passwords at the worst permitted settings took
3.6 s on a desktop, 93 % of it scoring candidates the search then
discarded. Rather than guard that with a worker's time limit, the engine
was bounded:

- **The maximum password length is 128** (the user's decision), read from
  `MAX_LENGTH` in `src/lib/validation.ts` everywhere a length is named. A
  stored maximum above it is repaired on load. `MAX_TARGET_BITS` is also
  256 and stays: it is bits.
- **A suggestion is scored once, after the duplicate check.** The search in
  `fitLength` finishes drafts without scores; `scoreCold`, `strengthBits`,
  `rawBits` and `checkRequirements` run once per suggestion returned.
  `src/lib/fromSentence.ts`.
- **At most three attempts per suggestion asked for**
  (`MAX_ATTEMPTS_PER_SUGGESTION`), down from ten, which was never measured:
  every sentence with variety to spare found its suggestions in one attempt
  each, and the attempts past three were spent on sentences that had run
  out, which the variety warning already says.
- **`collapseBlocks` compares indexes, not slices.** The Z-array of each
  suffix gives every block length's repeat count in one pass: quadratic
  with no allocation, against cubic with a slice and join per step. 133 ms
  to 1.1 ms for 500 characters, which the typing test pays per keystroke.
  `src/lib/strength.ts`.
- **The engine caps the sentence at 500 characters** (`MAX_SENTENCE_LENGTH`,
  `src/lib/text.ts`), not only the fields and the CLI, with one message
  both front ends use.
- **The budget: the worst permitted batch answers in under 300 ms on a
  desktop.** Asserted in tests as counts (one scoring per kept suggestion,
  three attempts per suggestion), never as a wall clock in CI. Measured
  when built, median of five:

| Sentence | Maximum | Count | Before | After |
| --- | --- | --- | --- | --- |
| 500 characters | 128 | 20 | 769 ms | 152 ms |
| 250 characters | 128 | 20 | 885 ms | 224 ms |
| 60 characters | 32 | 5 (the defaults) | 26 ms | 10 ms |
| 500 characters | 256 | 20 | 3,631 ms | no longer permitted |

Not taken: building the twist variants once per candidate (`applyTwists`
builds a table up to three times per finished candidate, even for zero
twists). It is the lead if the budget is ever missed.

### Where generation runs (2026-10-21)

- **On the page's own thread, synchronously, inside the debounce.** The
  provider sets busy, waits 120 ms, then calls `runInputs` in the timer and
  sets the result. A change applied during the wait cancels the timer, so
  only the newest inputs run; nothing can arrive while a batch runs, so
  there is nothing to supersede. The Web Worker that ran generation before,
  with its queue, its 300 ms replacement, its ten-second limit and its
  inline fallback, was removed on the budget's measurement: a batch is
  made on Apply, Refresh, New sentence and page load, never per keystroke,
  and the typing test and the Scoring page already ran the scorer on the
  page's thread. `src/state/PasswordsProvider.tsx`.
- **The engine is a function, not a Promise.** A Promise that always
  resolved at once would be a hedge for a worker that returns only on a
  measured reason (`TODO.md`, "A worker again"); the spec that brings one
  back makes the seam asynchronous then. The provider's `engine` prop is
  the seam for tests.
- **"Working…" paints before the stall.** Busy is set in the effect and the
  engine runs in a timer, so the browser paints the status, `aria-busy`
  and the dimmed old batch first; the 120 ms debounce is that yield and
  stays above a frame.
- **One mapping list per batch.** The provider memoises the applied
  settings' list on the mapping settings alone and `inputsFor` takes it,
  so the scorer's cache and the twist spellings, keyed on the list's
  identity, hold until a mapping changes. A cache keyed on the settings
  object inside `activeMappings` would have been hidden state in a pure
  function.
- **The price, accepted.** No net under the engine: a regression that makes
  a batch take seconds freezes the page for them. No Stop button. The
  stall is 10 ms at the defaults and 224 ms at the worst permitted
  settings on a desktop; a slow phone is estimated at four to eight times
  that and has not been measured.
- **Measured when built:** the worker chunk (69.8 KB gzipped) left the
  build and the page's chunk, which already carried the engine, is 0.6 KB
  smaller; navigation to the first batch on screen in the built app went
  from 435 ms to 326 ms (median of seven, twice); the 61 smoke tests pass.

### Limits and caches

- A sentence, a hint and the password under test are at most 500
  characters (UTF-16 units) in the fields, the CLI and the engine: scoring
  a text is quadratic in places, so the length is capped rather than left
  open.
- The scorer keeps 400 cold scores, each mapping list 5,000 spellings, and
  planning 400 length models (about a megabyte each); a full cache is
  emptied rather than evicted one entry at a time. `src/lib/score.ts`,
  `src/lib/twists.ts`, `src/lib/generate.ts`.

## Input and persistence

- **Every write to the browser's storage reports whether it worked**
  (2026-10-20). Persistence is `saved`, `visit-only` (a shared origin) or
  `failed`; My list and the settings show an alert with Try again when a
  write fails, the entries stay on screen to copy, and Try again merges
  memory with what storage holds, so nothing is lost.
  `src/state/PasswordsProvider.tsx`.
- **My list is changed one change at a time on the list as stored**, read
  again just before the write, and a change another tab makes shows at
  once (the `storage` event), so two tabs adding at once both keep their
  entry. `src/state/selectedStore.ts`.
- **A stored session that does not parse is removed**, and the error
  page's button forgets the session and reloads; the validator checks
  every nested field a card reads. On a shared origin, a session or list
  an earlier version stored there is removed on load.
  `src/state/sessionStore.ts`.
- **Enter during IME composition never submits or runs**: both sentence
  fields, the typing test and its hint field.
- **Secrets only on the app's own origin** (2026-10-20, the user's
  decision): the README's "Survives a refresh" and `src/state/origin.ts`.
  Until the app has a domain, My list and the current batch stay in memory
  on the shared Pages origin; the dev server's Tailscale address counts as
  the app's own (`.env.development`).

## Wording and presentation

- **One wording for each thing, the best fit kept** (2026-10-20, the
  user's decision). Disabled controls say why in visible text, not only in
  a tooltip.
- **Fun stays in the main navigation**, beside Passwords and Scoring
  (2026-10-20, the user declined moving it).
- **My list is a shortlist to choose from, not a vault**, and says so, with
  a pointer to a password manager.
- **Raw is the quieter badge** (muted, thin border), so it does not compete
  with the three scores.

## The command line

The CLI's design is in `docs/specs/2026-10-20-tep-cli-design.md` until
that spec is folded in (the checklist's D1); `TODO.md` lists its decisions
to revisit. Settled since:

- **JSON warnings stay strings**, their lines joined by newlines; a
  structured shape would change the documented interface.
- **YAML anchors and aliases are config errors** (exit 4, with file and
  line), as is anything the YAML reader cannot turn into plain values.
- **A config file written by `tep config` leaves out the options the typing
  mode has no use for**, so `tep g` never warns about its own file.
- **Esc during the wizard's first questions stops like Ctrl+C.** There is
  no earlier question to return to; going back one would need the first
  pass restructured as a list of steps with a history.
- **Help lists the modes in the core's order.**

## Build and deploy

- **A deploy runs the same checks as CI, the browser suite included**
  (`pages.yml`'s `check` job, before `build`).
- **The Content-Security-Policy is a meta tag** added to the built page
  only, since the dev server needs inline scripts. It cannot carry
  `frame-ancestors`, which needs a header the app's host does not send yet.
- **The smoke suites are the check that the built app works under the
  CSP**, on this project's own ports: 4272 the build, 4273 the dev server.
