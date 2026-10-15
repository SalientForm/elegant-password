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
  pairs and Shift. Case never alternates: at most one capital, at the start.
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
  lowercase, drop inner vowels from long words, twist letters for required
  digits and symbols, then append only what twists cannot supply. The
  sentence is kept in this tab only (sessionStorage) so a refresh does not
  lose it, and is never sent anywhere; it is only kept longer if you add a
  password to your list, as that password's hint.
- **Survives a refresh.** The current passwords and the sentence live in
  sessionStorage (gone when the tab closes); the settings, mode, mappings
  and your list live in localStorage. On reload the same passwords come
  back; nothing is rolled again until an input changes.
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
- **Fun page** (`#/fun`): a full rebuild-the-app spec prompt, generated from
  the live constants, with Copy and Download.
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
    pnpm test
    pnpm build && pnpm preview   # http://127.0.0.1:4271

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
