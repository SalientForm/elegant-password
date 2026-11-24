# TODO

Reviewed: 2026-11-24
Next ID: 33

Ideas, tasks and small items that are not yet planned. Each entry keeps its id (`EP-<n>`) for life; ids are
never reused. Planning or finishing an entry deletes it from this file. Order is priority, highest first. Maintained by the
`todo` skill. The design as built, and the decisions behind it, are in [decisions.md](decisions.md).

## EP-1 Auto picks a random symbol separator

- **Area:** core
- **Source:** dossier
- **Added:** 2026-10-22

Asked for by Dossier (2026-10-22). Dossier v1 will use the core as a package for its password dialog. Its
password generator is blocked until the first item ships (the core as a package, now EP-M1.1 on the roadmap, [ROADMAP.md](ROADMAP.md)); the other two
it picks up as they ship (no made-up nouns in any mode was built on
2026-10-22, `docs/decisions.md`). Asked for by the user on 2026-10-22, first item
most urgent.

Today Auto is a fixed order:
`;` when the site allows it, else a space, else the first allowed and
comfortable of `. - , _`, else none. Make Auto choose at random among
the symbols the rules allow and the comfort rules permit (pinky stretch,
Shift reach), falling back to a space and then none when no symbol is
allowed. One separator for the whole password, drawn once (2026-11-03,
the user's decision): one per gap would add memory load the scorer
charges for. The choice comes from `crypto.getRandomValues` and counts
toward the bits exactly (log2 of the choices, once per password). Space, None and a
fixed symbol stay as they are.

## EP-2 One sentence mode: one UI and one algorithm

- **Area:** app
- **Source:** dossier
- **Added:** 2026-10-22

Asked for by Dossier: see EP-1.

Merge "Make up a
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

## EP-3 Two modes: Sentences and Keyboard patterns

- **Area:** app
- **Source:** user
- **Added:** 2026-11-18

Asked for by the user (2026-11-18).

Plan for two modes at
the top of the app: Sentences, which is everything the app makes today,
and Keyboard patterns, passwords made from patterns on the keyboard.
The typing modes (Ten-finger, One-handed, Two-finger, Quick) serve both:
each still says how the password will be typed, and Difficulty is still
scored for it. Call the two of them modes, never super modes. To settle
before building:
- what a keyboard-pattern password is and how it is remembered (a shape
  on the keys, a starting key, shifts and repeats), and how its bits are
  counted exactly, as a drawn sentence's are;
- how it reads on the badges: Strength charges a keyboard walk as one
  pick of 1,000 (`qwertyuiop` reads 11 bits) and zxcvbn finds spatial
  patterns, so a pattern password reads weak to both unless the pattern
  is drawn from enough choices; its hint describes the pattern;
- the names are settled (2026-11-18, the user's decision): Sentences
  and Keyboard patterns are the app mode (`app-mode` in the config),
  and what is called the mode today is the typing mode (`typing-mode`).
  The package's config format takes both names before it ships
  (`docs/specs/2026-11-03-core-package-design.md`, §4.1), so building
  Keyboard patterns adds a value to `app-mode`, not a key.

## EP-4 zxcvbn-ts merged into our code, and research into a scoring algorithm of our own

- **Area:** core
- **Source:** user
- **Added:** 2026-11-18

Asked for by the user (2026-11-18): see EP-3.

Bring zxcvbn-ts's code (the maintained TypeScript rewrite
of zxcvbn: `@zxcvbn-ts/core` with its common and English language
packages) into this repository, under `src/lib`, so it is part of the
core and of the package. It is not a dependency: neither the app nor the
package lists or installs it, and the `zxcvbn` 4.4.2 dependency goes.
Keep its MIT licence notice with the copied files and in the package.
The fourth badge runs on the merged code, reversing "zxcvbn stays at
4.4.2" (`docs/decisions.md`, Scoring; audit L11): a bump of
`ZXCVBN_ESTIMATOR`, so My list's saved readings are worked out again
once. It still runs offline and loads on first use; measure its chunk
against today's 400 KB. The library is the reference at first: a test
holds the merged code's readings equal to the library's on a fixed set
of passwords, and Strength is measured against it for parity. Then
survey the other estimators (zxcvbn's ports
and forks, nbvcxz, KeePassXC's, PCFG and Markov guessers, neural
estimators such as Melicher et al.'s) for what each models that
Strength does not, and bring the elements worth having into Elegant
Passwords' own Strength algorithm. Each addition keeps Strength's rules:
from the password alone, the same reading every time, no knowledge of
this app, a hint never raising it, and no dictionary of English words
(the common-password list is its only list), so an element that needs
a dictionary is the user's decision.

## EP-5 Register the `salientform` organisation on npm

- **Area:** repo
- **Source:** user
- **Added:** 2026-11-18

Asked for by the user (2026-11-18): see EP-3.

The user's step:
sign in on npmjs.com, Add Organization, `salientform`, the free plan.
It reserves the `@salientform` scope for `@salientform/elegant-passwords`
(free on 2026-11-03) and later packages. Publishing itself stays a
separate decision (`docs/specs/2026-11-03-core-package-design.md`, §10).

## EP-6 `options: preset` follows the profile

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit. The CLI was designed on 2026-10-20 with these decisions taken on the
recommendation alone, with low confidence; `docs/decisions.md` ("The
command line") has the design as built. Examine each once `tep` is in use,
most uncertain first.

A re-measured mode
profile changes what an existing config generates, without the file
changing. Freezing the values at save time is the alternative.

## EP-7 `--mode` replaces a config's own options

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

`--mode` replaces a config's own options, as in the web app.
The alternative: `--mode` only changes which mode difficulty is scored
for.

## EP-8 Count 5 at a terminal, 1 when piped

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

Output that changes with
where it goes can surprise; a fixed default is the alternative.

## EP-9 Hint printed under each password by default

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

It leaves the
sentence in the terminal's scrollback beside the password. Showing it
only with `--explain` is the alternative.

## EP-10 Sentence mode reads stdin or a hidden prompt only

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

Sentence mode reads stdin or a hidden prompt only, never inline
text. Check it is not too awkward to use.

## EP-11 `./tep.yml` only

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

`./tep.yml` only: no parent-directory search, no global
`~/.config/tep/config.yml`.

## EP-12 Unused options warn, not fail

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

Unused options warn, not fail: `--avoid-pinky` with two-finger.

## EP-13 No `key=value` arguments

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

The request's own example was
`mode=ten-finger`.

## EP-14 `quick` and `minimal-quick` both accepted

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

`quick` and `minimal-quick` both accepted, instead of one name
everywhere.

## EP-15 Arrow-key menus

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

Arrow-key menus for the questions and a typed line number on the
review screen. Two input styles in one wizard.

## EP-16 No clipboard clearing

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

No clipboard clearing after `--copy`: see EP-19.

## EP-17 `tep` is not on npm; `pnpm link:cli` links a checkout's build

- **Area:** cli
- **Source:** idea
- **Added:** 2026-11-03

A tep CLI decision to revisit: see EP-6.

The
core goes to npm first, as `@salientform/elegant-passwords` (EP-M1.1 on the roadmap); shipping `tep` as that package's bin is a separate
choice, for once the package is out.

## EP-18 Commands left out of v1

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A tep CLI decision to revisit: see EP-6.

Commands left out of v1: `tep score <password>`, `tep list`,
`tep config show`, shell completions.

## EP-19 Clear the clipboard after a copy

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-22

A future consideration. Not planned yet; kept here so they are not lost. Roughly smallest first.

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

## EP-20 What knowing the app is worth

- **Area:** app
- **Source:** user
- **Added:** 2026-10-20

A future consideration: see EP-19.

Asked for by the user on 2026-10-20, when the badges were split by attacker
knowledge (Raw: nothing; Strength: English and the usual habits; bits: this
tool exactly, session only). A fourth figure would say how much of a
password's strength rests on the tool being unknown: Strength minus the
bits for the same password, or the two side by side with the difference
named. It needs the session (the bits do), so it would show beside the bits
figure, never be saved, and never feed a score.

## EP-21 Strength below a card's bits

- **Area:** core
- **Source:** idea
- **Added:** 2026-10-22

A future consideration: see EP-19.

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

## EP-22 Deliberate swaps for more words

- **Area:** core
- **Source:** idea
- **Added:** 2026-11-03

A future consideration: see EP-19.

180 of the 2,242 list words have a deliberate swap (`src/lib/ease.ts`;
the measurement is in `docs/decisions.md`, Generation). Most awkward moves
left are cross-hand reaches the model charges heavily (`l-e`, `a-p`,
`s-o`) and same-finger pairs no sound-alike spelling removes (`e-d`,
`u-n`, `b-r`). A larger table that stays readable, or a model that
rewards alternating hands, would be needed before relaxing the comfort
filter.

## EP-23 A CLI with no dependencies

- **Area:** cli
- **Source:** idea
- **Added:** 2026-10-20

A future consideration: see EP-19.

`tep` v1 uses `yaml`, `zod` and `@clack/prompts`, all inlined into the
bundle, so the built file needs only Node. Next, let it run from the
source with no installed packages at all: `node:readline` prompts (arrow
keys through raw mode), a hand-written check for the config schema, and a
reader and writer for the small YAML subset the config uses (maps,
scalars, comments). The spec keeps those dependencies inside `src/cli/`
so they can be swapped out without touching `src/lib`.

## EP-24 Keyboard layouts, and phones

- **Area:** core
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

The typing model assumes QWERTY on a physical keyboard. Add Dvorak, Colemak,
AZERTY and QWERTZ. More distinctive is a phone keyboard model: there the cost
is not reach but switching layers (letters, numbers, symbols, Shift), so a
"typed mostly on a phone" setting would favour passwords that stay on the
letter layer and group digits and symbols together. The typing test already
reads a soft keyboard's typing from how the text changes, but difficulty is
still scored for physical keyboards, so phone results are not claimed to be
reliable; test on real Android and iOS keyboards before building a model
(left open by the 2026-10-20 audit).

## EP-25 Protect the saved list

- **Area:** app
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

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

## EP-26 A worker again, once everything works without one

- **Area:** app
- **Source:** user
- **Added:** 2026-10-21

A future consideration: see EP-19.

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

## EP-27 Recall practice

- **Area:** app
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

The typing test measures typing, not memory. A spaced-repetition drill would
show the hint, ask for the password, and schedule the next try further out
after each success (a day, three days, a week), all stored locally. It aims
at the real failure: forgetting the password, not mistyping it.

## EP-28 Offline and installable

- **Area:** app
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

Everything already runs in the browser. A service worker and manifest make it
installable and usable offline, which turns "never sent anywhere" from a
promise into something a user can check by switching the network off.

## EP-29 Browser extension

- **Area:** app
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

Read a site's rules from the `passwordrules` attribute or Apple's public
password-rules quirks list, suggest a password that fits, and fill it in.
Cold scoring already depends only on the password and hint, so the engine
needs no changes to run there.

## EP-30 Other languages

- **Area:** core
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

Word lists in other languages, paired with their keyboard layouts (Spanish
on Spanish QWERTY, German on QWERTZ). The grammar, comfort model and padding
all assume English today, so this is real work, but it would show the design
generalises.

## EP-31 Master password mode

- **Area:** app
- **Source:** idea
- **Added:** 2026-10-15

A future consideration: see EP-19.

A separate flow for the one password typed every day (a password manager's,
a laptop's): longer sentences, 70 bits or more, and recall practice built in,
since this is the password people actually forget.

## EP-32 Keep splitting the large modules

- **Area:** core
- **Source:** idea
- **Added:** 2026-10-20

From the 2026-10-20 follow-up audit, still open. The rest of the audit was done on 2026-10-20; its decisions are in
`docs/decisions.md`.

Keep splitting the large modules (`generate.ts`, `score.ts`,
`fromSentence.ts`, `ruleText.ts`) a responsibility at a time; `checks.ts`
was the first. One sentence mode (EP-2) merges the paths of
`generate.ts` and `fromSentence.ts`, so split those two as part of it.
