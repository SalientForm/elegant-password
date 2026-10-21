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
  The separator is Auto by default: `;` (home row under the right
  pinky, no Shift, and it counts as a symbol) whenever the site allows it,
  else a space (thumb), else `.` or `,`, else none. Space, None or any
  allowed symbol can be chosen instead.
- **Strong**: entropy is computed exactly, as log2 of the number of passwords
  the chosen pattern can produce within the length limits, assuming the
  attacker knows this tool. Words come from `crypto.getRandomValues`, and
  generation runs entirely in the browser.
- **Three strength figures, by what the attacker knows**: Raw (nothing:
  brute force over the characters used), Strength (English and the usual
  habits, not this tool), and bits (this tool exactly, and the swaps in
  force). Raw and Strength are scores: worked out from the password alone
  (`src/lib/strength.ts`), so a password reads the same on a card, in your
  saved list, and a year later. Bits is this session's figure, counted
  from the password and its hint (`src/lib/score.ts`) and shown beside
  the badges and in the bits panel; it is never saved. Strength's tip
  reads high, fair or low by its colour; the presets, Everyday to Master
  password, are targets for the bits. Difficulty and memorability come
  from the password and its hint, nothing else. A repeated character never
  raises a figure, and neither does a block typed again ("Password1!"
  three times) or a walk along the keyboard ("asdf").
- **Rules it cannot keep are named**: pasted site rules show what was
  understood and, separately, what was not kept and why (a minimum length
  above 128, "no digits", "at most 2 symbols"); nothing is quietly weakened.
  A minimum number of lowercase letters is a rule like the other counts.
- **No common passwords**: a password that is exactly one of the 10,001
  most common passwords (SecLists' `10k-most-common.txt`, in
  `src/lib/commonPasswords.ts`; `pnpm common:passwords` rewrites it) is
  never suggested, never added to My list, and the typing test says it is
  not allowed. Its Strength is the guesses it takes to reach it on that list.
- **A second opinion from zxcvbn, as a fourth badge**: every password
  carries what the zxcvbn library (4.4.2) says about it: its crack time for
  an offline attack on a slow hash, read as very weak, weak, good or strong.
  It runs in the browser, loaded only when first needed. Cards and the
  typing test work it out as the password appears; My list works it out
  once, when the password is added, and saves it with the password and
  hint. Nothing is sent anywhere.

## Features

- **Two modes.** *Make up a sentence* generates one; *Use my sentence* takes
  yours ("Sally eats sweets" -> `Salli3@tswts!`) and fits it to the rules:
  lowercase, drop inner vowels from long words, meet required digits with
  swaps half the time and otherwise a number in front or at the end, and
  required symbols with a few swaps, then closing marks. The
  sentence is kept in this tab only (sessionStorage) so a refresh does not
  lose it, and is never sent anywhere; it is only kept longer if you add a
  password to your list, as that password's hint. A sentence, like a hint,
  is at most 512 characters.
- **Submit, then it sticks.** Edits to the rules, swaps or sentence are a
  draft: a snackbar at the foot of the page holds "Discard" and "Submit
  changes" (Ctrl+Enter also submits; Escape discards, or in a text field
  first leaves the field) and goes once there is nothing to submit. Submitting saves the
  settings and regenerates; "Refresh" submits any draft too.
- **The sentence stays put.** A made-up sentence is kept until you press
  the refresh icon beside it. Refresh under Suggestions, the order and rule
  changes all rebuild the passwords from the same sentence.
- **Site presets.** One tap sets the site's rules, and only those (length,
  required classes, allowed symbols, spaces): *Typical site* (the
  defaults), *No spaces*, *No symbols* (letters and digits), *Short max
  (16)* (8-16, `!@#$%&*`, as many banks), *8-20, few symbols*
  (`!@#$%^&*`) and *NIST passphrase* (15-64, anything goes, nothing
  required). Strength, comfort, style and swaps stay yours. The preset the
  rules match exactly shows pressed; one that rules out a separator you
  chose sets it to Auto and says so beside the presets.
- **Paste the site's rules.** Paste the sign-up form's wording ("Must be
  8-20 characters and include at least one number and one of !@#$%") and
  the form fills in, saying what it understood: "8-20 characters, a digit,
  a symbol from !@#$%". The parser (`src/lib/ruleText.ts`) is plain
  patterns, no network and no model: lengths, "at least N" counts,
  symbol lists, spaces, "letters and numbers only". Whatever the text
  does not mention stays as it was; text with no rules says so and
  changes nothing. Anything the new rules would contradict is fixed in
  what the text did not say, and named ("maximum raised to 40 to fit",
  "separator set to Auto"). Presets and pasted rules are drafts like
  any edit.
- **Rules that cannot all hold are caught, never generated.** One pure
  function (`src/lib/validation.ts`) finds every contradiction: a minimum
  above the maximum, more required uppercase letters, digits and symbols
  than the maximum allows, a symbol required with none allowed (an empty
  symbols field), a chosen separator or Space the rules forbid, anything
  out of range. Each shows in red beside the fields at fault, and while
  there is any, Submit changes is disabled with the reason above it
  ("Show" goes to the field), Enter and Refresh do nothing, and the last
  passwords stay. What only planning can know (no made-up sentence is 4-8
  characters) is said in place of the suggestions. Saved settings that
  contradict themselves load repaired, as few fields reset as will do,
  with a note naming them. The full table is in the algorithm flow,
  section 1a.
- **Padding.** A sentence that is under the site's minimum even with every
  word kept whole is padded, planned once with no retry: a word when more
  than 3 short, a swapped digit or symbol repeated (`$t33l` -> `$t33333l`),
  a run of digits, closing marks, and a length tag last. `%50` says the
  whole password is 50 characters (so 47 characters get `%50`, never 53);
  `@3` says 3 divides the length before it. Both switchable; when the site
  allows none of the tag's symbols, padding goes untagged and the form says
  so.
- **Survives a refresh.** The current passwords and the applied sentence
  live in sessionStorage (gone when the tab closes); the applied settings,
  mode, mappings and your list live in localStorage. On reload the same
  passwords come back; nothing is rolled again until something is applied.
  Unapplied drafts are not kept. Secrets (the list, the current batch) go
  to the browser only on the app's own origin: a local server, or the
  hosts named at build time in `VITE_OWN_HOSTS`. On a shared origin such
  as `salientform.github.io`, where every site of the organisation can
  read the same storage, they stay in memory for the visit, anything an
  earlier version stored there is removed, and My list says so; settings
  are stored everywhere. Every write reports whether it worked: when one
  fails, My list or the settings show an alert with Try again, and nothing
  on screen is lost. A "This session" card under My list says where the
  session is kept; "Forget this session" (pressed twice) drops the
  passwords on screen, both sentences and the password under test, from
  memory and storage, and draws a new sentence; My list and the settings
  stay.
- **My list.** Add a suggestion one at a time; each entry stores only the
  password and its hint, scored cold on display. Remove, or clear. Each
  change is made to the list as stored, read again just before the write,
  and a change another tab makes shows at once, so two tabs never write
  over each other.
- **Showing and copying a password.** A password cut short by its column
  ends in an ellipsis; a click or tap shows the whole of it, wrapped, and
  the next folds it back. On a desktop a password is copied like any
  text, by selecting it; a touch screen gets a Copy button on each card
  and list entry.
- **"At least N" rules** for uppercase, digits and symbols (all on by
  default). Several capitals means whole words in capitals, so the case
  never flips back and forth.
- **Defaults**: max 32 characters, 40-bit target, 2 minimum swaps,
  deliberate swaps on, and uppercase, digit and symbol all required.
- **Rolls**: neighbouring keys on one row under one hand (`asdf`, `ert`,
  `fg`) are the cheapest move and have their own rubric criterion. Numbers
  favour close-together digits (`357` over `129`).
- **Made-up nouns**: one or two key rolls joined (`ertdfg`), all lowercase or
  ALL CAPS, about 14 bits each, counted exactly.
- **Swaps (twists)**: 64 built-in symbol swaps, number swaps and misspellings
  (`a>@`, `e>3`, `ph>f`, ...), each switchable, plus your own. Mapping
  choices are saved in localStorage. Twist strength is counted exactly from
  the number of distinct ways the twists could land.
- **Deliberate swaps for typing ease** (on by default): instead of being
  filtered out, a word with a same-finger jump (`e-d`) or a long reach (six
  key widths or more, `w-i`) is typed with one fixed sound-alike
  misspelling that removes it: `wise` -> `wyse`, `cool` -> `cul`, `bricks`
  -> `brix`. It is a function of the word alone, so it adds no bits and
  nothing to remember: the cold scorer works it out from the hint, never
  counts it as a random swap, and charges it no memory load and no
  memorability. Typing comfort then ranks words as typed. The rule and its
  table are in `src/lib/ease.ts`. Measured on 6,000 suggestions at the
  defaults, about 30% get a swap and those are 1.7 difficulty points
  easier; over all suggestions mean difficulty goes 41.6 -> 41.3 and
  same-finger pairs per 10 keys 0.67 -> 0.61, with memorability (73.6) and
  bits unchanged. A small gain at no cost, so it is on by default; the
  comfort filter is unchanged. "Ease awkward words with deliberate swaps"
  switches it off.
- **Avoid pinky stretches** (on by default): the tool never picks a symbol
  more than one key from where a pinky rests (`! - _ = + ) |` ...). A
  separator you choose yourself, like `-`, is still used.
- **Keep Shift within reach** (off by default; the One-handed mode turns it
  on): no shifted symbol more than 4 keys from both Shift keys (`$ % ^ & *`)
  is picked, and the opening capital goes on a word whose first letter one
  hand can capitalise while holding Shift (not T G B Y H N U J I).
- **Shortest that meets the target** (off by default; Minimal-quick turns it
  on): each sentence shape is cut to the fewest characters at which it still
  reaches the target, so the password is as short as the target allows. With
  the **Minimal** strength preset (4 bits) that is the shortest sentence the
  site's rules allow: 13 characters at the defaults.
- **Shapes**: capital initials ("brings" -> `B`), two-letter words (first
  letter + last consonant, "jupiter" -> `jr`), and glue (`5ls`, `Fpc`).
  In generated mode a shaped slot's pool becomes its distinct initials or
  letter pairs, so entropy stays exact. In sentence mode, words compress
  toward a target length (drop vowels, trim consonants, drop small words,
  initials, then drop words): "jupiter brings 5 leds for piece" at 12 ->
  `jr;B;5ls;Fpc`. A symbol between words is optional. Fitting is exact:
  each compression step is finished into a real password and the
  least-compressed one that fits and keeps every rule is kept; no step
  takes the letters the uppercase rule needs, so "ducks" with 5 capitals
  is `DUCKS`, not a refusal. Property tests prove any sentence reduces to
  12 characters that pass every rule (`src/lib/reduceTo12.test.ts`).
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
- **Scoring page** (`#/scoring`): how Raw, Strength and the bits, the
  difficulty score and memorability are worked out, with the full rubric,
  the options each typing mode fills in and what they measure, and
  time-to-guess tables.
- **Memorability** (0-100, on every card and list entry): how closely the
  password still looks like its hint. Words that keep their full length
  score in full, shortened words the fraction kept, dropped words nothing;
  shorter passwords score higher; each word with a random swap costs a
  little. A deliberate swap costs nothing: it comes with its word.
- **Test a password** (right column): type any password and
  press Enter. Every keystroke is timed as you type, so the first run is
  scored too and becomes the password under test; corrections (Backspace,
  Delete), time, words per minute and accuracy are reported against the
  rubric's estimate, with the Strength and Raw badges (from the password
  alone) and Difficulty, whose memory load without a hint is read off the
  password's own runs of letters and digits; Memorability needs a hint.
  The password under test stays, through mistyped runs, until the
  Clear button, a paste or a new list entry replaces it; one that arrived
  without a hint can be given one. Nothing is stored. A pasted password is
  kept exactly, spaces at either end included, with one trailing line
  break dropped; more than one line, spaces alone or more than 128
  characters are refused with the reason. On a soft keyboard that names no
  keys (Android), the typing is read from how the text changes. A keyboard
  button on every card and My list entry makes that password the one
  under test, with its hint, without saving or removing anything.
- **Fun page** (`#/fun`): a full rebuild-the-app spec prompt, generated from
  the live constants and rendered as formatted text, with Copy and Download
  of the markdown. It embeds the algorithm flow document verbatim as a
  validation section.
- **On the page's own thread.** A provider (`src/state/PasswordsProvider.tsx`)
  owns all state and runs generation where the page runs, 120 ms after a
  change is applied and within the engine's budget: the worst permitted
  batch takes about a quarter of a second on a desktop, the defaults a
  hundredth. The old batch stays on screen until the new one is ready.
  Sentence mode finds the right compression by binary search over the
  ladder.
- **Hardened.** The built page carries a Content-Security-Policy that
  allows only the app itself and no network at all (`build/csp.ts`), plus
  `referrer: no-referrer`. The clipboard failing (insecure context, page
  not focused) selects the text instead of silently doing nothing. A render
  error shows a message and a button that forgets the session and reloads,
  never a blank page; a stored session that does not parse is removed on
  load, and a kept sentence the tool could not have drawn is dropped and a
  new one drawn.
- **Accessible.** The mode switch is a real tab list (arrow keys, Home,
  End), toggles report their pressed state, and status text is announced.
- **Difficulty score** (0-100) from a rubric of eleven criteria across the modes, up to ten in one: size,
  typing speed, reach, row jumps, same-finger pairs, Shift and case,
  off-letter keys, pinky stretches and memory load. The full rubric is in
  the app.
- **Mode** (top of the Presets card, first in the left column): how the password will be typed, which
  every difficulty score is for. Ten-finger is the standard rubric;
  two-finger weighs length, travel and symbols and drops rolls and
  same-finger moves; one-handed charges every Shift, most
  of all a capital or symbol more than 4 keys from both Shift keys;
  minimal-quick weighs rolls and staying on one row ("dadsad",
  "you;poop"). Picking a mode previews its difficulty on the cards, My list
  and the typing test at once, and fills in the options that suit it
  (strength, comfort and style; never the site's rules) as a draft, like a
  site preset: Submit applies both and draws a new sentence, Discard
  reverts both.
  Ten-finger is the defaults; Two-finger takes a space separator, a
  made-up noun, one capital initial and one two-letter word, and has no use
  for the pinky rule or deliberate swaps (disabled, with the reason);
  One-handed takes strict comfort, Keep Shift within reach, a space, a
  made-up noun and a two-letter word; Minimal-quick takes the Minimal
  target with Shortest that meets the target, strict comfort, a space and
  made-up nouns throughout, so it makes the shortest password the site's
  rules allow. Each value was kept only if it measured easier in the mode's
  own rubric than the defaults; the table and the figures are on the Scoring
  page (`pnpm measure:modes` reruns the measurement).
- **Scroll bars** where the browser's take up room (Windows): no arrows and
  no track, a thin rounded handle shown only while the pointer is over the
  area or it scrolls, like macOS with scroll bars shown automatically.

## Command line

`tep` makes the same passwords in a terminal (Linux and macOS), through the
same shared core as the web app, so a password from `tep` is made and scored
exactly as the app would make and score it.

Set it up from nothing with one command (needs Node 24 and pnpm, which
`corepack enable pnpm` provides):

    git clone https://github.com/SalientForm/elegant-password.git && cd elegant-password && pnpm link:cli

`pnpm link:cli` is the one command in a checkout you already have, too:
pnpm installs the dependencies first if they are missing or out of date,
then it builds `dist-cli/tep.mjs` (one file, needs only Node 24) and links
`~/.local/bin/tep` to it. Then:

    tep g                        # ./tep.yml if there is one, else the defaults
    tep g --site short-max-16 --mode two-finger -n 3
    tep g --rules "8-20 characters, at least one number" --format json
    tep g --sentence - < sentence.txt
    tep config bank.yml          # a few questions, then tep g -c bank.yml
    tep uninstall                # takes tep off the PATH, after asking

`TEP_BIN_DIR=<dir> pnpm link:cli` links from another directory on your
PATH instead; it says if that directory is not on the PATH or another `tep`
comes first. The link follows the file, so `pnpm build:cli` after a change
needs no relinking. `tep uninstall` lists the links to a built `tep` it
finds (in `$TEP_BIN_DIR`, `~/.local/bin` and on the PATH) and removes them
once you say yes (`--yes` skips the question); the checkout stays, so
delete it to remove the rest. `pnpm unlink:cli` removes just the link
`pnpm link:cli` made, without asking. Without the link, run `pnpm tep g …` from the project. Not
`pnpm link`: from pnpm 10 on it takes a directory and adds it to this
project's dependencies, which puts `node_modules` out of step with the
lockfile, so every later `pnpm` script stops to reinstall. If that
happened, undo it with
`git checkout -- package.json pnpm-lock.yaml && rm -f pnpm-workspace.yaml && pnpm install`.

- **Settings** come from the defaults, then a config file (`./tep.yml`, or
  `-c`), then flags: a site preset, the site's rules (or their wording with
  `--rules`), a typing mode, which fills in the options that suit it, and
  any option by hand. `tep help g` lists every flag.
- **No contradictions.** Settings that contradict each other make no
  passwords (exit 3), and nothing is quietly fixed. Every message says what
  is wrong, where each value came from (a flag, a file and line, a preset),
  and how to fix it, with the value that would work where the engine can
  find it. A strength the rules cannot reach is a warning, as in the app.
- **Output**: a table with the Strength, Raw, Difficulty and Memorability
  badges and the session's bits at a terminal, the passwords alone when
  piped, or JSON; `--explain` adds the card's "Why?"; `--copy` uses the
  platform's clipboard tool.
- **Your own sentence** is read from stdin or typed at a hidden prompt
  (`--sentence -`), never taken as an argument, where shell history and
  `ps` would keep it.
- **`tep config`** asks the typing mode, the site's rules (a preset, pasted
  wording, or each rule), the options and the output, then shows every
  answer with a line number to change or save. Each question only offers
  what fits the answers before it; a choice ruled out is shown with the
  answer that rules it out.
- **Which config file** the settings came from is always said: the table's
  first line, a `config` object in the JSON, and a note on stderr when the
  output is piped (`--quiet` hides the note).
- **Esc means back** in `tep config`: from a line back to the review with
  the line unchanged, and out of the review without saving. Ctrl+C always
  stops, writing nothing. A pasted rule the wizard cannot keep is named as
  it is dropped and listed on the review.
- Exit codes: 0 done, 1 a bug, a failed clipboard tool or a link that could
  not be removed, 2 the command line, 3 a contradiction, 4 a config file,
  130 interrupted.

The decisions behind it are in [docs/decisions.md](docs/decisions.md), "The command line".

## How it works

[docs/algorithm-flow.md](docs/algorithm-flow.md) maps every criterion to the
step that enforces it, with flowcharts for generated mode, sentence mode and
cold scoring.

## Use

    pnpm install
    pnpm dev        # http://127.0.0.1:4270
    pnpm test       # unit tests (Vitest)
    pnpm measure:wizard  # times every tep config question against its 750 ms target; fails one over 2 s
    pnpm test:e2e   # browser smoke tests (Playwright) against the build on 4272 and the dev server on 4273
    pnpm build && pnpm preview   # http://127.0.0.1:4271
    pnpm build:cli  # the command line, dist-cli/tep.mjs; pnpm tep g runs it

Run `pnpm test:e2e` after each iteration: it builds, starts its own servers
on this project's spare ports, drives a real Chromium through loading,
drafting and applying changes, the saved list, sentence mode, copy, the
Fun page download, and fails on any console error. First time only:
`pnpm exec playwright install chromium-headless-shell`.

## Deploy

Every push to `main`, merges included, runs `.github/workflows/pages.yml`:
unit tests, then a build under `/elegant-password/` (`BASE_PATH`), published
to GitHub Pages at https://salientform.github.io/elegant-password/.

That address is an origin the organisation's other Pages sites share, so
the app keeps My list and the current batch in memory there (see "Survives
a refresh"). To give the app a domain of its own: add the DNS record
GitHub Pages asks for (a `CNAME` to `salientform.github.io` for a
subdomain), set the repository variable `PAGES_DOMAIN` to the host
(Settings → Secrets and variables → Actions → Variables), and push. The
workflow then builds at `/`, writes `dist/CNAME`, and names the host in
`VITE_OWN_HOSTS`, where the list is stored again. For a dev server reached
through another host, name it in `.env.development` (`VITE_OWN_HOSTS`).

## License

[MIT](LICENSE), copyright SalientForm.

## Layout

The web app and the command line share one core, `src/lib/`: every
algorithm, rule, preset, label and reading lives there once, in plain
TypeScript with no browser, Node or React, and both front ends reach the
engine through the same calls (`inputsFor`, `runInputs`,
`presentSuggestions`, `scoreReadings`). `src/boundaries.test.ts` fails if
either front end imports past that line or does a step its own way.

Shared core, `src/lib/`:

- `words.ts`: word pools per part of speech
- `keyboard.ts`: QWERTY model and typing cost
- `ease.ts`: deliberate swaps for typing ease
- `grammar.ts`: sentence templates and comfort-filtered pools
- `lengthModel.ts`: exact counting and uniform sampling under length limits
- `generate.ts`: requirements, plan selection, explanations
- `validation.ts`: every contradiction in a set of requirements, each with a code
- `consistency.ts`: contradictions including what only planning finds, and the unreachable-target warning
- `twists.ts`, `mappingSettings.ts`: the 64 mappings, exact twist counting, and which are on
- `fromSentence.ts`: "Use my sentence" mode
- `sitePresets.ts`, `ruleText.ts`: site rule presets and the pasted-rules parser
- `modeProfiles.ts`: the options each typing mode fills in
- `difficulty.ts`: the difficulty rubric
- `score.ts`: cold scoring of a password from its hint: memorability, difficulty, and the session's bits
- `strength.ts`: the Strength and Raw scores, from the password alone
- `engine.ts`: generation as one pure function of plain inputs
- `pipeline.ts`: settings to engine inputs, and suggestions as shown (rescored for the typing mode, ordered)
- `readings.ts`: how the four scores read (badge label, figure, band, sentence)
- `choices.ts`: the choice lists and their words (comfort, separators, sort orders)
- `explain.ts`: the card's "Why?" sentences, shared with `tep g --explain`
- `random.ts`, `text.ts`, `sort.ts`, `typingTest.ts`, `fluff.ts`: randomness, text helpers, the sort orders, the typing test's maths, padding
- `devStats.ts`, `testRandom.ts`: measurement and seeded randomness for the tests and `pnpm stats`

Web app:

- `src/state/PasswordsProvider.tsx`: the provider that owns state, persistence and generation
- `src/state/storage.ts`, `settingsStore.ts`, `sessionStore.ts`, `selectedStore.ts`, `mappingStore.ts`: persistence with untrusted-input parsing
- `src/state/origin.ts`: whether the page is on the app's own origin, where secrets may be stored
- `src/components/`: React UI
- `src/prompts/specPrompt.ts`, `cliPrompt.ts`: the Fun page's two prompts, the app's and then the command line's

Command line, `src/cli/` (imports only the shared core, Node, `yaml`, `zod`
and `@clack/prompts`):

- `fields.ts`, `flagList.ts`, `names.ts`: every setting once (flag, config key, label, values), the flags that are not settings, and the names and "did you mean"
- `resolve.ts`, `sources.ts`: settings layered from defaults, file and flags, each with where it came from
- `messages.ts`, `report.ts`, `errors.ts`: contradictions and warnings worded with sources and fixes; how errors print; the exit codes
- `config.ts`, `configText.ts`, `configModel.ts`, `configVersion.ts`: the config file, read with every problem and its line, written atomically
- `flags.ts`, `args.ts`, `generate.ts`, `output.ts`, `clipboard.ts`, `clipboardTools.ts`: `tep g` (its flags, the small commands' parser, the output formats, the clipboard)
- `constraints.ts`, `wizard.ts`, `wrap.ts`, `configCommand.ts`, `prompter.ts`: `tep config`
- `uninstall.ts`, `tepLink.ts`: `tep uninstall`, and what a link to a built tep is (shared with `scripts/linkCli.mjs`)
- `main.ts`, `bin.ts`, `help.ts`, `io.ts`: the command table, the executable, help, and the terminal behind an interface (`testing.ts` fakes it)

Build and docs:

- `build/csp.ts`: the Content-Security-Policy added at build time
- `scripts/linkCli.mjs`: `pnpm link:cli` and `unlink:cli`
- `docs/algorithm-flow.md`: the algorithm flow
- `docs/decisions.md`: the design decisions, with why, kept current
