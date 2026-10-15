# Elegant Passwords

Generates passwords that are hard to guess, easy to remember and fast to type.
Enter a site's rules and it suggests passwords that read as a sentence, with an
explanation for each:

    13 worthy storks openly pet twisty toys

- **Memorable**: every password follows a sentence pattern
  (number, adjective, noun, adverb, verb, adjective, noun, and longer forms),
  so you remember one picture, not a string.
- **Fast to type**: words are ranked on a QWERTY model that rewards nearby keys
  and runs along one row, and penalises long reaches, row jumps, same-finger
  pairs and Shift. Case never alternates inside a word: one capital starts a
  word, and several mean whole words in capitals.
  The default separator is `;`, on the home row under the right pinky; "auto"
  prefers a space (thumb) when the site allows one.
- **Strong**: entropy is computed exactly, as log2 of the number of passwords
  the chosen pattern can produce within the length limits, assuming the
  attacker knows this tool. Words come from `crypto.getRandomValues`, and
  generation runs entirely in the browser.
- **Scored cold**: what a card says about a password (bits and difficulty)
  is a pure function of the password and its hint (`src/lib/score.ts`).
  No setting, count or history goes in, so a password scores the same on a
  card, in your saved list, and a year later. The strength panel keeps the
  exact figure for the current plan.

## Features

- **Two modes.** *Make up a sentence* generates one; *Use my sentence* takes
  yours ("Sally eats sweets" -> `Salli3@tswts!`) and fits it to the rules:
  lowercase, drop inner vowels from long words, meet required digits with
  swaps half the time and otherwise a number in front or at the end, and
  required symbols with a few swaps, then closing marks. The
  sentence is kept in this tab only (sessionStorage) so a refresh does not
  lose it, and is never sent anywhere; it is only kept longer if you add a
  password to your list, as that password's hint.
- **Submit, then it sticks.** Edits to the rules, swaps or sentence are a
  draft: "Discard" and "Submit changes" float over the page (Ctrl+Enter
  also submits) and disappear once there is nothing to submit. Submitting
  saves the settings and regenerates; "Refresh" submits any draft too.
- **Padding.** A sentence that is under the site's minimum even with every
  word kept whole is padded, planned once with no retry: a word when more
  than 3 short, a swapped digit or symbol repeated (`$t33l` -> `$t33333l`),
  a run of digits, closing marks, and a length tag last. `%50` says the
  whole password is 50 characters (so 47 characters get `%50`, never 53);
  `@3` says 3 divides the length before it. Both switchable.
- **Survives a refresh.** The current passwords and the applied sentence
  live in sessionStorage (gone when the tab closes); the applied settings,
  mode, mappings and your list live in localStorage. On reload the same
  passwords come back; nothing is rolled again until something is applied.
  Unapplied drafts are not kept.
- **My list.** Add a suggestion one at a time; each entry stores only the
  password and its hint, scored cold on display. Copy, remove, or clear.
- **"At least N" rules** for uppercase, digits and symbols (all on by
  default). Several capitals means whole words in capitals, so the case
  never flips back and forth.
- **Defaults**: max 32 characters, 40-bit target, 2 minimum swaps, and
  uppercase, digit and symbol all required.
- **Rolls**: neighbouring keys on one row under one hand (`asdf`, `ert`,
  `fg`) are the cheapest move and have their own rubric criterion. Numbers
  favour close-together digits (`357` over `129`).
- **Made-up nouns**: one or two key rolls joined (`ertdfg`), all lowercase or
  ALL CAPS, about 14 bits each, counted exactly.
- **Swaps (twists)**: 64 built-in symbol swaps, number swaps and misspellings
  (`a>@`, `e>3`, `ph>f`, ...), each switchable, plus your own. Mapping
  choices are saved in localStorage. Twist strength is counted exactly from
  the number of distinct ways the twists could land.
- **Avoid pinky stretches** (on by default): the tool never picks a symbol
  more than one key from where a pinky rests (`! - _ = + ) |` ...). A
  separator you choose yourself, like `-`, is still used.
- **Shapes**: capital initials ("brings" -> `B`), two-letter words (first
  letter + last consonant, "jupiter" -> `jr`), and glue (`5ls`, `Fpc`).
  In generated mode a shaped slot's pool becomes its distinct initials or
  letter pairs, so entropy stays exact. In sentence mode, words compress
  toward a target length (drop vowels, trim consonants, drop small words,
  initials, then drop words): "jupiter brings 5 leds for piece" at 12 ->
  `jr;B;5ls;Fpc`. A symbol between words is optional. Fitting is exact:
  each compression step is finished into a real password and the
  least-compressed one that fits is kept. Property tests prove any sentence
  reduces to 12 characters that pass every rule (`src/lib/reduceTo12.test.ts`).
- **Layout.** Three columns: the rules and swaps on the left, suggestions in
  the middle (ordered by Difficulty, easiest to type first, by default, or by
  Memorability or Strength with the toggle above them; the choice is
  remembered), and on the right
  the password tester above your list. The outer columns are fixed and the
  middle one takes the rest. The page scrolls until the title row and tabs
  are gone; then each column sticks and scrolls on its own.
- **Narrow screens.** At 1100 px and below there is no room for three
  columns. Down to 801 px two stay open, Suggestions and one outer column
  (Options at first, whenever the page loads or the width enters the range),
  and the third shrinks to a button; at 800 px and below one column stays
  open and the other two shrink. A shrunken column is a button, "Options",
  "Suggestions" or "Testing", centred in a thin sticky strip that keeps the
  column's place; it opens its column and shrinks another. On a
  phone (600 px and below) the open column takes the whole width instead,
  under a bar stuck to the top: the page links fold into a menu behind a
  hamburger at its left and the three column tabs sit centred. This holds
  down to a flagship phone's width with nothing clipped or scrolling
  sideways: tables stack, the keyboard map scales, rows wrap. A phone-sized
  Playwright project (`pnpm test:e2e`, project `phone`) fails on any element
  past the right edge, past its column or with its text cut off, and on any
  horizontal scroll, at 1000, 800, 412 and 360 px.
- **Scoring page** (`#/scoring`): how strength in bits, the difficulty
  score and memorability are worked out, with the full rubric and
  time-to-guess tables.
- **Memorability** (0-100, on every card and list entry): how closely the
  password still looks like its hint. Words that keep their full length
  score in full, shortened words the fraction kept, dropped words nothing;
  shorter passwords score higher; each swapped word costs a little.
- **Test a password** (top of the right column): type any password and
  press Enter. Every keystroke is timed as you type, so the first run is
  scored too and becomes the password under test; corrections (Backspace,
  Delete), time, words per minute and accuracy are reported against the
  rubric's estimate, with a strength figure estimated from the text alone
  (`scoreAlone`). The password under test stays, through mistyped runs,
  until the Clear button, a paste or a new list entry replaces it; one that
  arrived without a hint can be given one. Nothing is stored.
- **Fun page** (`#/fun`): a full rebuild-the-app spec prompt, generated from
  the live constants and rendered as formatted text, with Copy and Download
  of the markdown. It embeds the algorithm flow document verbatim as a
  validation section.
- **Off the main thread.** A provider (`src/state/PasswordsProvider.tsx`)
  owns all state and runs generation in a Web Worker (inline where there is
  none), so typing never waits on the maths and the old batch stays on
  screen until the new one is ready. Sentence mode finds the right
  compression by binary search over the ladder.
- **Hardened.** The built page carries a Content-Security-Policy that
  allows only the app itself and no network at all (`build/csp.ts`), plus
  `referrer: no-referrer`. The clipboard failing (insecure context, page
  not focused) selects the text instead of silently doing nothing. A render
  error shows a message and a reload button, never a blank page.
- **Accessible.** The mode switch is a real tab list (arrow keys, Home,
  End), toggles report their pressed state, and status text is announced.
- **Difficulty score** (0-100) from a nine-criterion rubric: size, typing
  speed, reach, row jumps, same-finger pairs, Shift and case, off-letter
  keys, pinky stretches and memory load. The full rubric is in the app.

## How it works

[docs/algorithm-flow.md](docs/algorithm-flow.md) maps every criterion to the
step that enforces it, with flowcharts for generated mode, sentence mode and
cold scoring.

## Use

    pnpm install
    pnpm dev        # http://127.0.0.1:4270
    pnpm test       # unit tests (Vitest)
    pnpm test:e2e   # browser smoke tests (Playwright) against the build on 4272 and the dev server on 4273
    pnpm build && pnpm preview   # http://127.0.0.1:4271

Run `pnpm test:e2e` after each iteration: it builds, starts its own servers
on this project's spare ports, drives a real Chromium through loading,
drafting and applying changes, the saved list, sentence mode, copy, the
Fun page download, and fails on any console error. First time only:
`pnpm exec playwright install chromium-headless-shell`.

## Layout

- `src/lib/words.ts`: word pools per part of speech
- `src/lib/keyboard.ts`: QWERTY model and typing cost
- `src/lib/grammar.ts`: sentence templates and comfort-filtered pools
- `src/lib/lengthModel.ts`: exact counting and uniform sampling under length limits
- `src/lib/generate.ts`: requirements, plan selection, explanations
- `src/lib/twists.ts`: the 64 mappings and exact twist counting
- `src/lib/mappingStore.ts`: localStorage persistence for mappings
- `src/lib/fromSentence.ts`: "Use my sentence" mode
- `src/lib/difficulty.ts`: the difficulty rubric
- `src/lib/score.ts`: cold scoring of a password from its hint
- `src/lib/engine.ts`, `src/lib/generator.ts`, `src/worker.ts`: generation as one pure function, in a worker or inline
- `src/lib/storage.ts`, `settingsStore.ts`, `sessionStore.ts`, `selectedStore.ts`: persistence with untrusted-input parsing
- `src/lib/specPrompt.ts`: the Fun page prompt
- `src/state/PasswordsProvider.tsx`: the provider that owns state, persistence and generation
- `src/components/`: React UI
- `build/csp.ts`: the Content-Security-Policy added at build time
- `docs/algorithm-flow.md`: the algorithm flow
