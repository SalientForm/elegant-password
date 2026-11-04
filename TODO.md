# To do

## Asked for by Dossier (2026-10-22)

Dossier v1 will use the core as a package for its password dialog. Its
password generator is blocked until the first item ships; the other two
it picks up as they ship (no made-up nouns in any mode was built on
2026-10-22, `docs/decisions.md`). Asked for by the user on 2026-10-22, first item
most urgent.

- **The core as an npm package, configured by mode, preset and
  overrides.** Publish `src/lib` as a library with a documented, stable
  API, as `@salientform/elegant-passwords` (2026-11-03, the user's
  choice; `tep` is taken). Today a caller has to build a
  complete `GenerationSettings` (every field of `Requirements`, the
  sentence options and the mapping settings); the layering that turns a
  typing mode, a site preset and a few values into those settings lives in
  `src/cli/resolve.ts`. Move it into the package, so a caller passes the
  typing mode, the site preset and only the values it overrides, and every
  value it leaves out takes the package's default (a caller can leave made-up
  nouns alone, for example). The package resolves and checks the result
  (`problemsOf`, `warningsOf`) and returns the problems, never fixing them
  quietly.
  The config format `tep` writes becomes the one way Elegant Passwords
  manages its configuration, in the web app and the CLI alike, provided by
  the package: the model (`version`, `mode`, `site`, `rules`, `options`,
  `sentence`, `swaps`), its zod schema and version, the mode and preset
  names, and reading and writing it as YAML text. File access and the
  line-numbered error messages stay in `src/cli`, and the `output` section
  (count, format, copy, explain) stays CLI-only. The web app saves the last
  configuration in localStorage in this format, in place of its own shape,
  and My list saves each password with the whole configuration that made it
  (with no sentence, as a config never holds one), beside its hint.
- **Auto picks a random symbol separator.** Today Auto is a fixed order:
  `;` when the site allows it, else a space, else the first allowed and
  comfortable of `. - , _`, else none. Make Auto choose at random among
  the symbols the rules allow and the comfort rules permit (pinky stretch,
  Shift reach), falling back to a space and then none when no symbol is
  allowed. One separator for the whole password, drawn once (2026-11-03,
  the user's decision): one per gap would add memory load the scorer
  charges for. The choice comes from `crypto.getRandomValues` and counts
  toward the bits exactly (log2 of the choices, once per password). Space, None and a
  fixed symbol stay as they are.
- **One sentence mode: one UI and one algorithm.** Merge "Make up a
  sentence" and "Use my sentence" into one sentence box. Generate fills it
  with a made-up sentence the user can edit, and passwords are always made
  from the sentence in the box. Today these are two paths: planning and
  sampling slots with exact bits (`generate.ts`), and fitting a given
  sentence (`fromSentence.ts`), with an edited made-up sentence already
  built as the user's own (`editedSentence`). An edited sentence is the
  user's, so it shows the scores (Strength, zxcvbn) rather than exact bits
  (2026-11-03, the user's decision, as Dossier chose). `tep`'s
  `--sentence` and the config's `sentence` options follow; the config's
  shape for them is settled in the package's spec, so the format does not
  change again once the package ships.

## tep CLI: decisions to revisit

The CLI was designed on 2026-10-20 with these decisions taken on the
recommendation alone, with low confidence; `docs/decisions.md` ("The
command line") has the design as built. Examine each once `tep` is in use,
most uncertain first.

- **`options: preset` follows the profile**. A re-measured mode
  profile changes what an existing config generates, without the file
  changing. Freezing the values at save time is the alternative.
- **`--mode` replaces a config's own options**, as in the web app.
  The alternative: `--mode` only changes which mode difficulty is scored
  for.
- **Count 5 at a terminal, 1 when piped**. Output that changes with
  where it goes can surprise; a fixed default is the alternative.
- **Hint printed under each password by default**. It leaves the
  sentence in the terminal's scrollback beside the password. Showing it
  only with `--explain` is the alternative.
- **Sentence mode reads stdin or a hidden prompt only**, never inline
  text. Check it is not too awkward to use.
- **`./tep.yml` only**: no parent-directory search, no global
  `~/.config/tep/config.yml`.
- **Unused options warn, not fail**: `--avoid-pinky` with two-finger.
- **No `key=value` arguments**. The request's own example was
  `mode=ten-finger`.
- **`quick` and `minimal-quick` both accepted**, instead of one name
  everywhere.
- **Arrow-key menus** for the questions and a typed line number on the
  review screen. Two input styles in one wizard.
- **No clipboard clearing** after `--copy`: see "Clear the clipboard after
  a copy" below.
- **`tep` is not on npm; `pnpm link:cli` links a checkout's build**. The
  core goes to npm first, as `@salientform/elegant-passwords` (Dossier's
  first item above); shipping `tep` as that package's bin is a separate
  choice, for once the package is out.
- **Commands left out of v1**: `tep score <password>`, `tep list`,
  `tep config show`, shell completions.

## Future considerations

Not planned yet; kept here so they are not lost. Roughly smallest first.

### Clear the clipboard after a copy

Accepted for now on 2026-10-22 (audit L16), to revisit. Neither Copy
button nor `tep --copy` clears the clipboard, so the password stays there
until something replaces it: clipboard history (Windows' Win+V, KDE's
Klipper and other managers) keeps it, some sync it to other devices, any
program can read it, and it can be pasted by mistake later. Password
managers clear it 10-90 seconds after a copy.

- In the browser, a page can overwrite the clipboard only while it is open
  and usually focused, so a delayed clear after switching to the sign-up
  tab often fails silently; it cannot check the clipboard still holds the
  password without a permission prompt, so a blind clear could wipe
  something copied since; and it cannot mark the copy to skip clipboard
  history.
- `tep` can do it properly: after about 30 s, read the clipboard back and
  clear it only if it still holds the password (a short-lived background
  process outlives the command), and mark the copy to skip history where
  the platform's tool supports it.
- Neither can remove a copy that clipboard history or sync already holds.

The recommendation when this is revisited: clear in `tep` only, as above,
and leave the web app as it is, with the reason recorded.

### What knowing the app is worth

Asked for by the user on 2026-10-20, when the badges were split by attacker
knowledge (Raw: nothing; Strength: English and the usual habits; bits: this
tool exactly, session only). A fourth figure would say how much of a
password's strength rests on the tool being unknown: Strength minus the
bits for the same password, or the two side by side with the difference
named. It needs the session (the bits do), so it would show beside the bits
figure, never be saved, and never feed a score.

### Strength below a card's bits

Left open when audit L17 was built (2026-10-22; the figures are in
`docs/decisions.md`, Scoring). Two ways to narrow what remains, each for
the user to decide:

- **A card's bits in a shortest plan.** They ignore the length window, so
  with "shortest" on (Minimal-quick, or the Minimal target) a card can
  read well above the plan's exact figure, and Strength below the card
  (84 % of Minimal-quick cards with two made-up nouns) though never below
  the exact figure. Capping a card's bits at the plan's bits plus its swap
  bits would make the two agree; it changes the bits, not Strength, and
  the cards' bits would no longer be `scoreCold` alone.
- **Letter pairs English never uses.** Made-up nouns with a vowel
  (`cviu`, `OIFD`) still read as English letters: 16.5 % of ten-finger
  cards with two made-up nouns read below their bits. A table of the letter
  pairs English words do not contain, built from an English word list as
  `commonPasswords.ts` is from SecLists, flags 25 to 48 % of those nouns,
  but also 0.1 to 0.2 % of English words (`halfway`, `briefcase`,
  `pyjamas`), which would then read too high.

### Deliberate swaps for more words

180 of the 2,242 list words have a deliberate swap (`src/lib/ease.ts`;
the measurement is in `docs/decisions.md`, Generation). Most awkward moves
left are cross-hand reaches the model charges heavily (`l-e`, `a-p`,
`s-o`) and same-finger pairs no sound-alike spelling removes (`e-d`,
`u-n`, `b-r`). A larger table that stays readable, or a model that
rewards alternating hands, would be needed before relaxing the comfort
filter.

### A CLI with no dependencies

`tep` v1 uses `yaml`, `zod` and `@clack/prompts`, all inlined into the
bundle, so the built file needs only Node. Next, let it run from the
source with no installed packages at all: `node:readline` prompts (arrow
keys through raw mode), a hand-written check for the config schema, and a
reader and writer for the small YAML subset the config uses (maps,
scalars, comments). The spec keeps those dependencies inside `src/cli/`
so they can be swapped out without touching `src/lib`.

### Keyboard layouts, and phones

The typing model assumes QWERTY on a physical keyboard. Add Dvorak, Colemak,
AZERTY and QWERTZ. More distinctive is a phone keyboard model: there the cost
is not reach but switching layers (letters, numbers, symbols, Shift), so a
"typed mostly on a phone" setting would favour passwords that stay on the
letter layer and group digits and symbols together. The typing test already
reads a soft keyboard's typing from how the text changes, but difficulty is
still scored for physical keyboards, so phone results are not claimed to be
reliable; test on real Android and iOS keyboards before building a model
(left open by the 2026-10-20 audit).

### Protect the saved list

My list keeps passwords in localStorage in plain text, and since
2026-10-20 only on the app's own origin (`src/state/origin.ts`; on the
shared GitHub Pages origin it lives in memory for the visit). The user
decided the app will move to a domain of its own; the deploy is ready for
it (`PAGES_DOMAIN`, see the README). Beyond that: offer to encrypt the list
with a passphrase (WebCrypto: PBKDF2 or Argon2 to AES-GCM), or a "hints
only" mode that keeps the sentence and drops the password. Scoring is
unaffected either way: it already needs only the password and hint.

A custom domain on GitHub Pages still sends no headers. Once the app is on
a host that does, send `Content-Security-Policy: frame-ancestors 'none'`
(the rest of the policy may move into the header with it): framing is then
refused before any script runs, which the meta tag cannot do, and the
start-up check in `src/frameGuard.ts` can go (audit L7, 2026-10-22;
`docs/decisions.md`, "Build and deploy").

### A worker again, once everything works without one

Asked for by the user on 2026-10-21, when the audit's bet was taken: the
engine is bounded first and the worker removed on that measurement
(`docs/decisions.md`, "Generation"; audit H1 and H2). Once the
app runs without one and the real stall on a phone is known, consider
putting a worker back, and only if there is a reason the measurement
gives: the worst permitted batch stalls a slow phone for longer than a
user tolerates, or a feature needs work that cannot be bounded (a Stop
button, a batch the user can watch grow). If it comes back, it comes back
without the faults the audit found: the worker says when it is ready and
a slow or dead worker settles the request with an error and is replaced,
never run inline for the rest of the session (H1's withdrawn first spec
had that design); caches keyed by content, not array identity, so a
structured clone still hits (L2); no replacement of a busy worker that
re-ranks every pool (L3); one copy of the common-password list across the
chunks (L10).

### Recall practice

The typing test measures typing, not memory. A spaced-repetition drill would
show the hint, ask for the password, and schedule the next try further out
after each success (a day, three days, a week), all stored locally. It aims
at the real failure: forgetting the password, not mistyping it.

### Offline and installable

Everything already runs in the browser. A service worker and manifest make it
installable and usable offline, which turns "never sent anywhere" from a
promise into something a user can check by switching the network off.

### Browser extension

Read a site's rules from the `passwordrules` attribute or Apple's public
password-rules quirks list, suggest a password that fits, and fill it in.
Cold scoring already depends only on the password and hint, so the engine
needs no changes to run there.

### Other languages

Word lists in other languages, paired with their keyboard layouts (Spanish
on Spanish QWERTY, German on QWERTZ). The grammar, comfort model and padding
all assume English today, so this is real work, but it would show the design
generalises.

### Master password mode

A separate flow for the one password typed every day (a password manager's,
a laptop's): longer sentences, 70 bits or more, and recall practice built in,
since this is the password people actually forget.

## From the 2026-10-20 follow-up audit: still open

The rest of the audit was done on 2026-10-20; its decisions are in
`docs/decisions.md`.

- Keep splitting the large modules (`generate.ts`, `score.ts`,
  `fromSentence.ts`, `ruleText.ts`) a responsibility at a time; `checks.ts`
  was the first. One sentence mode (above) merges the paths of
  `generate.ts` and `fromSentence.ts`, so split those two as part of it.

