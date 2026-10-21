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
- **Strength's word names its colour band, never a preset** (2026-10-21,
  M3). The presets, Everyday to Master password, are targets on the bits'
  ladder, for an attacker who knows the tool; Strength assumes one who
  does not and reads above a card's bits, by 14 bits at the median at the
  defaults, so when the tip named the highest preset reached, 99.8 % of
  default suggestions were named a preset above the one chosen and 37 % of
  batches of five showed "master password". The tip says high (50 bits or
  more), fair (40 to 49) or low, read off the same rounded figure as the
  colour, so word and colour cannot disagree; the Scoring page states the
  bands by number and says the presets are targets for the bits. The
  user's answers (2026-10-21): the words are high, fair and low, the
  recommendation over no word or the band's numbers; the Scoring page
  sentence drops the preset names. A badge with no word would leave its
  band, read by a screen reader, to colour alone; the presets' own words
  or zxcvbn's would put one word on two badges with two meanings.
  `STRENGTH_WORDS` and `strengthWord` in `src/lib/readings.ts`.
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
  to 1.1 ms for 500 characters. `src/lib/strength.ts`.
- **The engine caps the sentence at 512 characters** (`MAX_HINT_LENGTH`,
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

### The opening capital (2026-10-21)

- **The capital is a word's first character, never after a swapped-in
  symbol** (`@Corns`). In generated mode the word that takes it is chosen
  from the words as typed, before the swaps (`capitalOrder` in
  `src/lib/generate.ts`: the first ordinary word, or with Shift reach on
  one whose first letter capitalises in reach), and the swaps keep that
  word's first character a letter (`capitalAt` in `src/lib/twists.ts`).
  Chosen after the swaps, as before, the capital followed Shift reach to a
  word the swaps had not been told to keep: 1.0-1.8 % of passwords with
  Shift reach on. Sentence mode capitalises before the swaps, which match
  lowercase letters only.
- **Only the capital's word is kept**: with the capital elsewhere (Shift
  reach, a two-letter form first) or not placed at all (a made-up noun in
  capitals meets the rule), the first word's start may be swapped. The
  cold scorer keeps the start of the twistable word that carries the
  capital, wherever it is, so the bits count what generation can make.
  At the defaults a seeded batch is the same passwords as before.

### Slow work (2026-10-21)

- **Any one piece of work on the page's thread over 2 s is a failure**
  (the user's line; `SLOW_MS` in `src/state/slow.ts`). Timed: a batch
  (the provider's engine call), a zxcvbn reading (the library call, not
  its lazy load) and the typing test's scoring of the password under test.
- **A failure shows a floating error until it is dismissed**: a snackbar
  in the error colour on every page, above the unapplied-changes bar when
  both show, naming what was slow and how long it took, with Dismiss
  (Escape inside it too). A newer failure replaces it. `SlowNotice`.
- **It shows when the work ends.** Work on the page's thread cannot be
  stopped part-way; the line makes a stall visible, it does not cut one
  short. A worker could stop it, at the price `TODO.md` ("A worker
  again") sets out.
- **The clock is the web app's.** `src/lib` stays free of one, and the CLI
  is unchanged: its wizard's 2 s line is `pnpm measure:wizard`. Nothing
  goes to the console, which the smoke suite fails on.

### Limits and caches

- **A password field holds at most 128 characters, a sentence or hint
  field 512** (2026-10-21, the user's limits; UTF-16 units). 128 is
  `MAX_LENGTH`, the longest password the tool makes, and holds the typing
  test's field, typed or pasted; 512 is `MAX_HINT_LENGTH`, for the typing
  test's hint, both sentence fields, the CLI and the engine. Scoring a text
  is quadratic in places, and zxcvbn is not bounded at all (250 random
  characters 21.8 s, 128 about 1.1 s on a desktop), so the lengths are
  capped rather than left open.
- The scorer keeps 400 cold scores, each mapping list 5,000 spellings; a
  full cache is emptied rather than evicted one entry at a time.
  `src/lib/score.ts`, `src/lib/twists.ts`.
- **Planning keeps 1,000 length models and drops the one used longest
  ago** (2026-10-21). A model holds only its counts, about 12 KB, because
  a pool's words grouped by length are built once per pool
  (`wordsByLength`, a `WeakMap` on the pool) and shared, read-only, by
  every model over it; each model used to copy them, 77 to 176 KB a
  model over a plan. 1,000 holds three plans at the widest lengths (288 shapes), so a
  Refresh, or a change and back, never rebuilds. Full, it is about 12 MB,
  where 400 unshared models measured 42 to 81 MB, and the clear-all cap
  of 400 it replaces never hit for two wide settings used in turn. The
  key is the comfort level, the digit count, the ease setting and the
  shape; the length window is not in it. Not taken: no cache (a plan at
  a maximum of 128 is 24 ms built against 3.6 ms cached on the
  development desktop, and a phone is several times slower); least
  recently used at 400 (under two wide plans) or 2,000 (no more hits than
  1,000); a cap in bytes (models differ by at most 15 times, and the count
  already bounds the cache near 12 MB). The groups being shared, `sample`
  must never write to them. `src/lib/lengthModel.ts`,
  `src/lib/generate.ts`.
- **The typing test scores the password under test once** (2026-10-21).
  Strength, Raw and the common-list check are memoised on the password,
  beside Difficulty and Memorability, so a keystroke costs a render and no
  scoring: at 500 characters 0.5-1.1 ms in jsdom, was 2.1-2.6 ms (122 ms
  before H1). Each key's time is read when its handler runs, so work per
  keystroke above the gap between keys would stretch the times the test
  reports; asserted as counts in `src/components/TypingTest.test.tsx`,
  never as a wall clock. `src/components/TypingTest.tsx`.

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
- **A kept sentence is one the tool could have drawn** (2026-10-21): a
  template's shape, bare or with its number placed; each word as written
  on its slot's full list, whatever the comfort, so a change of comfort
  never refuses it; a number from 2 to 9999 without a leading zero;
  made-up nouns only in the noun slots before the first real noun. An
  empty word is on no list. A stored one that is not is dropped on its own
  with its edit, keeping the rest of the session, and a new one drawn,
  with no notice (the user's decision); it is not repaired, since it is
  the app's draw, not the user's choice, and a repaired sentence is a
  different one. The engine refuses one too, with an ordinary
  requirements message naming the button that draws a new sentence (the
  user's decision), so an empty word no longer crashes it. The outcome's
  own copy is checked for shape only, as nothing reads it back after a
  load. The price: a release that removes a word from the lists, or moves
  one between them, replaces the kept sentence of a tab open across it.
  `couldBeDrawn` in `src/lib/generate.ts`; `src/state/sessionStore.ts`.
- **Enter during IME composition never submits or runs**: both sentence
  fields, the typing test and its hint field.
- **Secrets only on the app's own origin** (2026-10-20, the user's
  decision): the README's "Survives a refresh" and `src/state/origin.ts`.
  Until the app has a domain, My list and the current batch stay in memory
  on the shared Pages origin; the dev server's Tailscale address counts as
  the app's own (`.env.development`).

## Rendering

- **One context, and memo boundaries on the page** (2026-10-21). The
  provider keeps one memoised value, and every action in it is stable.
  The page component reads nearly all of it, so splitting it by how often
  each part changes would not stop the page rendering. Its heavy children
  instead render only when their own props change: the cards, the
  strength panel, the requirements form, the swaps panel and the site
  rules, none of which reads the context. The page keeps their props
  stable: the cards' context is memoised on the batch and the uppercase
  rule, Practise is one callback that reads the current column layout
  through a ref, and the swaps' sentence test is memoised on the mode and
  the sentence. My list's rows (`ListEntry`) take what they show as props
  instead of reading the context, and My list passes `removeSelected`
  itself, not a closure per row. A store with selectors, a context for
  busy alone and the React Compiler were rejected: the page selects
  nearly everything, and five explicit wrappers get the same gain.
  `src/App.tsx`, `src/components/SelectedList.tsx`,
  `src/components/ListEntry.tsx`.
- **The boundaries are held by counts, never a clock.**
  `src/App.renders.test.tsx` wraps each memo component's inner function
  with a counter; a component that is not a memo fails with its name, and
  a prop made fresh on each render (an inline object or closure) fails on
  the count. Dropping a boundary on purpose means deleting its test on
  purpose.
- **Busy still flips twice per batch.** The first flip paints "Working…"
  (see "Where generation runs") and renders the page component and the
  small consumers, no card, panel or row.
- **What still renders on every change:** `TypingTest`, `TypingMode`,
  `ApplyBar`, `SessionControls` and My list itself read the context, at
  under 0.15 ms each in jsdom (My list 0.1-0.4 ms), and the field a
  keystroke edits.
- **Measured when built:** in the production build in Chromium, a
  keystroke in the made-up sentence with 20 in My list went from 4.6,
  20.0 and 30.8 ms of work to 2.8, 12.1 and 17.6 ms at 1×, 4× and 6×
  CPU, and with My list empty from 3.9, 14.2 and 21.9 ms to 2.5, 9.8 and
  14.8 ms. Paired with the old build on a busier run when built, the 6×
  figure with 20 in My list went from 32.8-35.8 ms to 18.2-22.2 ms. The
  rows had cost about 0.2 ms each in jsdom on every change.

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

## One core, two front ends

- **The web app and `tep` make and score passwords through the same code**
  (2026-10-20, the user's decision), so a change to an algorithm reaches
  both or neither. `src/lib` holds every algorithm, rule, preset, label and
  reading in plain TypeScript; `src/state` and `src/components` are the web
  app, `src/cli` is `tep`, `src/prompts` the Fun page's prompts.
  `src/boundaries.test.ts` holds three rules: what each directory may
  import (`src/lib` names no browser or Node global, the CLI imports no
  React or web state, the web never imports the CLI); that the CLI reaches
  the engine only through `inputsFor`, `runInputs`, `presentSuggestions`
  and `scoreReadings`, the calls the web makes, and rebuilds no reading;
  and that for each site preset and typing mode the web provider and `tep`
  build the same inputs from the same settings.
- **The CLI modules the Fun page's prompt draws on stay free of Node
  APIs** (the field table, names, messages, constraints, the config writer,
  help), so the browser can run them; the boundaries test follows the
  browser's imports to hold that.
- **The Fun page has two rebuild prompts**, the app's and then the CLI's,
  which builds on the app's shared core by name instead of redefining it
  (2026-10-20, the user's decision). A test checks the CLI prompt's file
  list against `src/cli/`.

## The command line

What `tep` does is in the README's "Command line"; `TODO.md` lists the
decisions taken on the recommendation alone, to revisit once it is in use.

- **Two words for two kinds of mode.** `--mode` is the typing mode
  (`TypingMode`); `--sentence` is the engine's sentence mode. Preset slugs
  are derived from the labels in `src/lib`, never a second list, and a test
  fails if two collide. `quick` is the typing mode's id; `minimal-quick`,
  from its label, is accepted too.
- **`tep` never generates from, saves or carries forward settings that
  contradict each other, and never fixes them quietly** (2026-10-20). The
  web form's automatic fixes (`settleRules`: a maximum raised to fit, the
  separator set to Automatic) are not applied. `problemsOf` in
  `src/lib/consistency.ts` runs `ruleProblems`, then the early-exit
  `planProblem`, and returns every problem with the fields involved; in
  sentence mode `fromSentence` stands in for planning, as the sentence is
  known only at run time. A mode profile's "space if allowed" separator is
  the profile's own rule, not a fix, and is kept.
- **A strength target the rules cannot reach is a warning, not a
  contradiction** (2026-10-20, the user's decision): `tep g` makes the
  strongest passwords the rules allow and says on stderr how many bits they
  reach; the wizard marks the target and lets it be chosen. `warningsOf`
  returns it.
- **Settings are layered, each layer replacing only the fields it states**:
  the defaults, then the config file (its site preset, its `rules`, the
  mode's profile, its own `options`), then flags in the same order. The
  file is `-c <file>` or `./tep.yml`, with no parent-directory search and
  no global config. `--mode` over a file's own options replaces them with
  the mode's profile, as picking a mode does in the web app.
  `src/cli/resolve.ts` records where each value came from, and every
  message names it (`--max-length 10 (flag)` against `min-length 12
  (tep.yml:5)`).
- **Flags take `--x v` or `--x=v`, never a bare `x=v`**, which would be
  ambiguous beside a file name. Options a typing mode has no use for are
  accepted with a warning naming the reason, not refused.
- **A sentence is never an argument**: `--sentence -` reads one line from
  stdin, or prompts with echo off at a terminal, as an argument would land
  in shell history and `ps`.
- **At a terminal, the table prints each password's hint under it**, and a
  dim first line names the config file the settings came from.
- **Piped output is the passwords alone**, one per line and one by default
  (five at a terminal), so `tep g | pbcopy` works; the config note goes to
  stderr. `--explain` with no `--format` prints the table, as plain output
  cannot carry the why.
- **The JSON is a documented interface with stable names**: `strength` and
  `raw` are the scores, `bits` the session's figure (2026-10-20); warnings
  stay strings, their lines joined by newlines, since a structured shape
  would change the interface.
- **No clipboard tool is an error, never a silent no-op**, as in the web
  app. `--copy` tries `pbcopy`, `wl-copy`, `xclip` and `xsel` by platform
  and session, and does not clear the clipboard afterwards.
- **The exit codes are one list**, in `src/cli/errors.ts`, which the help
  line is built from: 0 done, 1 a bug or a failed tool, 2 usage, 3 a
  contradiction or a sentence that cannot fit, 4 a config file, 130
  interrupted.

### Config files

- **`options: preset` stores only the typing mode**, so a re-measured
  profile reaches an existing config; "Set each option" in the wizard
  writes every option, fixed. A file written by `tep config` leaves out the
  options its typing mode has no use for, so `tep g` never warns about its
  own file.
- **Checked with a zod schema after `yaml`'s parser**: unknown keys, wrong
  types and out-of-range numbers are errors with the file, line and key
  (exit 4), and "did you mean" for near misses. YAML anchors and aliases
  are errors too, as is anything that does not read as plain values.
  `version` is required, and a newer one than the CLI knows says to
  upgrade. A file that parses but contradicts itself is exit 3, naming its
  keys and lines.
- **A config holds no secret, no sentence and no password**, and is written
  0644, atomically (a temp file in the same directory, then a rename).
  Mappings and sentence options may be set by hand; the wizard does not ask
  about them and keeps them as they were.

### The wizard

- **Interactive only**: with stdin not a terminal, `tep config` exits 2 and
  points at the file format. Ctrl+C writes nothing.
- **No answer can contradict another.** A choice is allowed when the
  answers so far, the choice, and the loosest value of every question not
  yet answered pass `problemsOf`. The loosest values are fixed in
  `src/cli/constraints.ts` (the widest length window, every symbol, spaces,
  nothing required, the Minimal target, relaxed comfort, no initials,
  two-letter words or made-up nouns, Automatic separator); a property test
  walks the wizard at random and proves they always leave a way to finish
  (confirmed by the user, 2026-10-20). A choice not allowed is shown dimmed
  with the answer that rules it out; a question left with one choice is
  stated, not asked; a number's range is shown, found by binary search
  where a field is monotonic (a test proves which are) and by checking
  every value elsewhere.
- **A contradiction that gets through is a bug, and says so**: after each
  answer the wizard checks again, and a problem is shown at once in red,
  the answer dropped and the question asked again without it. The wizard
  never moves on, reviews or saves while one stands.
- **Shaping a question may take up to 750 ms on a typical laptop**
  (2026-10-20, the user's decision, first set at 333 ms). Each choice is
  checked with `planProblem`, shapes that cannot fit the length window are
  skipped before their length models are built, and results are
  remembered; the slowest question measured 151 ms of wall time on a
  desktop (Ryzen 9 3900X, WSL2, Node 24; seed 3, "Strength target", 148
  length models), 2026-10-21.
- **The budget is held as work in the suite, and timed by hand**
  (2026-10-21). The random walk in `src/cli/walk.test.ts` counts, from one
  answer to the next question, the plannings the CLI asks for
  (`problemsOf`) and the length models built, through two `vi.mock`
  factories in the test, and fails a question over 400 of either: about
  twice the worst measured (183 plannings, 181 models) and well inside the
  planning cache's 1,000, so one question never pushes out the models the
  next relies on. It also asserts the worst question did at least one of each,
  so the counters cannot stop counting unseen. No time is asserted in the
  suite or CI: the CPU time it used to assert measured the run, not the
  wizard, and a coverage run of the whole suite reached 81 to 94 % of the
  budget for a question that takes about 150 ms alone. `pnpm
  measure:wizard` runs the same walks on fresh caches and takes each
  question's wall time: 750 ms (`QUESTION_BUDGET_MS`) is the target,
  printed beside each time, and the questions over it are named; a
  question over 2 s (`QUESTION_FAIL_MS`) fails it (the user's decision,
  2026-10-21). It is run by hand on an idle machine before merging a
  change to `src/cli/constraints.ts`, `src/lib/consistency.ts` or the
  planning in `src/lib/generate.ts` and `src/lib/grammar.ts`, never in
  CI. The price: a change that makes each planning or each length model
  slower at the same counts passes the suite and is found only by `pnpm
  measure:wizard`; and the ceilings catch a change in kind (planning in
  full, which built 1,142 models in one question), not a creep of 20 %.
- **The review numbers every answer** (one line per option when set one by
  one); a typed number changes that line, `s` saves after one more check,
  `q` leaves. On the review a line is shaped by every other answer, and a
  choice another line rules out names it; a blocked choice cannot be taken
  (2026-10-20, the user's decision), so the user changes the line that
  blocks it first. Changing the mode while options follow the preset
  updates them; with options set one by one, the new mode's preset is
  offered only when it fits the rules.
- **Esc means back** (2026-10-20, the user's decision): from a line to the
  review unchanged, and out of the review without saving. The prompter
  listens for the key itself, as the prompt library reports Esc and Ctrl+C
  alike. During the first questions Esc stops like Ctrl+C: there is no
  earlier question to return to, and going back one would need the first
  pass restructured as a list of steps with a history.
- **A pasted rule the wizard cannot keep is never dropped in silence**
  (2026-10-20, the user's decision): it is named as it is dropped and
  listed on the review for as long as the answer differs from the text. A
  loaded file's value that cannot be kept is treated the same way, and a
  loaded file that contradicts itself opens with the conflict named and the
  later question asked again.
- **Help lists the modes in the core's order.**

### Build

- **One ESM file, bundled by tsdown**, with its dependencies (`yaml`,
  `zod`, `@clack/prompts`) inlined, so `dist-cli/tep.mjs` needs only Node
  24. The dependencies stay inside `src/cli/` so they can be replaced
  (`TODO.md`, "A CLI with no dependencies").
- **Not on npm**: the package stays private and the name `tep` is taken.
  `pnpm link:cli` builds and links `~/.local/bin/tep` instead of `pnpm
  link`, which from pnpm 10 on adds a directory to the project's
  dependencies.
- **Randomness is `crypto.getRandomValues`**, as in the browser. No
  `--seed` flag, no network, no telemetry, no update check.

## Build and deploy

- **A deploy runs the same checks as CI, the browser suite included**
  (`pages.yml`'s `check` job, before `build`).
- **The Content-Security-Policy is a meta tag** added to the built page
  only, since the dev server needs inline scripts. It cannot carry
  `frame-ancestors`, which needs a header the app's host does not send yet.
- **The smoke suites are the check that the built app works under the
  CSP**, on this project's own ports: 4272 the build, 4273 the dev server.
- **The unit suite runs in Node's default heap** (2026-10-21). It passes
  at 256 MB, and at 128 MB, a file at a time; the 4 GB flag of 2026-10-16
  was for a planning cache with no cap and came out when the cap, `mayFit`
  and the shared word groups had made it unneeded. No heap ceiling is set
  instead: it would also fail on growth in jsdom or Vitest, with an error
  that names no cause, and the planning cache's bound is asserted by
  count in its tests.
