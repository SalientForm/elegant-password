# To do

## Asked for by Dossier (2026-10-22)

Dossier v1 will use the core as a package for its password dialog. Its
password generator is blocked until the first item ships; the other three
it picks up as they ship. Asked for by the user on 2026-10-22, first item
most urgent.

- **The core as an npm package, configured by mode, preset and
  overrides.** Publish `src/lib` as a library with a documented, stable
  API (a scoped name, as `tep` is taken). Today a caller has to build a
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
  allowed. To decide: one separator for the whole password or one per gap.
  The choice comes from `crypto.getRandomValues` and counts toward the
  bits exactly (log2 of the choices, once per draw). Space, None and a
  fixed symbol stay as they are.
- **No made-up nouns by default, in every mode.** `DEFAULT_REQUIREMENTS`
  already has `madeUp: 0`, but the mode profiles in `src/lib/modeProfiles.ts`
  set 1 (Two-finger, One-handed) and 3 (Minimal-quick). Set them to 0, so
  made-up nouns are never used unless chosen. Re-measure the profiles
  (`pnpm measure:modes`), as Minimal-quick will come out longer and the
  README's "13 characters at the defaults" may change. A config with
  `options: preset` follows the profile, so existing ones change too (see
  "`options: preset` follows the profile" below).
- **One sentence mode: one UI and one algorithm.** Merge "Make up a
  sentence" and "Use my sentence" into one sentence box. Generate fills it
  with a made-up sentence the user can edit, and passwords are always made
  from the sentence in the box. Today these are two paths: planning and
  sampling slots with exact bits (`generate.ts`), and fitting a given
  sentence (`fromSentence.ts`), with an edited made-up sentence already
  built as the user's own (`editedSentence`). To decide: how strength is
  counted once a made-up sentence is edited. Dossier's choice: an edited
  sentence is the user's, so it shows the scores (Strength, zxcvbn) rather
  than exact bits. `tep`'s `--sentence` and the config's `sentence`
  options follow.

## Deliberate swaps for typing ease: done, on by default

Built in `src/lib/ease.ts` (rule and table), wired through planning,
sampling, sentence mode, cold scoring, the card's "Why?" and the "Ease
awkward words with deliberate swaps" setting. 180 of the 2,242 list words
have a deliberate swap; 1,351 have an awkward move by the keyboard model.
About 30% of suggestions get at least one.

First measured with each deliberate swap charged like a random one (one
more item of memory load, 5 memorability points): the gain was mostly
eaten by the charge, so the setting started off. On 2026-10-15 the user
decided a deliberate swap is not memory load: it follows from its word by
one fixed rule. The scorer still recognises it from the hint (scores stay
a pure function of password and hint) but no longer charges it, and a
swapped word counts as kept whole ("cool" typed "cul").

Re-measured with the same scratch method, old and new scorer on the same
passwords: 600 suggestions per setting at the defaults (balanced comfort,
2 swaps), confirmed on 6,000 (± one standard error); 2,000 for the
before/after pairs (each password with its untwisted deliberate swaps
undone).

| Defaults, 6,000 suggestions | swaps off | on, old scoring | on, new scoring |
| --- | --- | --- | --- |
| Mean difficulty | 41.62 ± 0.08 | 41.57 | 41.34 ± 0.08 |
| Typing alone (memory load left out) | 39.65 | 39.36 | 39.36 |
| Memorability | 73.60 ± 0.05 | 72.53 | 73.57 ± 0.05 |
| Same-finger pairs per 10 keys | 0.668 | 0.613 | 0.613 |
| Easy / Moderate / Demanding | 2,790 / 3,205 / 5 | 2,814 / 3,180 / 6 | 2,895 / 3,099 / 6 |

- 600 suggestions, the task's sample: difficulty 41.66 off, 41.36 on
  before, 41.13 on now; memorability 73.67 off, 72.54 on before, 73.72 on
  now; same-finger 0.70 -> 0.63. With no random swaps (6,000): 34.15 off,
  34.08 on before, 33.74 on now.
- Pairs (passwords that have a deliberate swap): 1.7 points easier on
  typing alone; net of memory load 0.9 before, 1.7 now (0.4 before, 1.6
  now with no random swaps). Memorability fell 5.6 points before and
  rises 0.4 now (shorter). About half get easier on the rounded score,
  half stay level at a cut-point, 2-4% land a point harder (a roll or row
  jump crosses a cut-point).
- Strict and relaxed agree: on vs off is 0.43 easier at strict and 0.42
  at relaxed, memorability unchanged.
- Decision: on by default. Difficulty is lower at every comfort level
  (about 2.5 standard errors at the defaults), memorability and bits are
  unchanged, and same-finger pairs drop 8%. The gain is small, since only
  a third of passwords get a swap. Settings saved before the option
  existed take the new default; ones saved with it keep their value.
- Comfort filter: unchanged at balanced. The ranking is typing cost alone,
  which the scoring change does not touch: ranked as typed, only 35 of the
  662 words the balanced share drops come back (and 35 others make room).
  Relaxed costs 3.3 difficulty points over balanced with swaps on (44.66
  vs 41.34) and swaps win back 0.4 of them; strict is harder still at the
  defaults (42.15: longer sentences reach 40 bits).
- The 169 words of the 2026-10-15 review: 107 were already back, and
  "blazing", "bleak" and "seize" are restored. The other 59 stay out:
  re-checked, none falls inside the balanced share as typed. Only two
  have a swap at all ("naive" -> "nayve", "vials" -> "vyals"), and both
  stay in the hardest 30%.

Follow-ups:

- Reach more words. Most awkward moves left are cross-hand reaches the
  model charges heavily (`l-e`, `a-p`, `s-o`) and same-finger pairs no
  sound-alike spelling removes (`e-d`, `u-n`, `b-r`). A larger table that
  stays readable, or a model that rewards alternating hands, would be
  needed before relaxing the comfort filter.

## tep CLI: decisions to revisit

The CLI was designed on 2026-10-20 with these decisions taken on the
recommendation alone, with low confidence; `docs/decisions.md` ("The
command line") has the design as built. Examine each once `tep` is in use,
most uncertain first.

Settled by the user on 2026-10-20, kept here for the record:

- An unreachable strength target is a warning, not a contradiction.
- Blocked review items cannot be edited: change the line that blocks
  them first.
- Shaping a question may take up to 750 ms (first set at 333 ms, raised
  the same day). On 2026-10-21: the suite holds it as work, and `pnpm
  measure:wizard` names the questions over 750 ms and fails one over 2 s.
- The loosest-completion assumption stands; the property test proves it.

Still open:

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
- **No clipboard clearing** after `--copy`.
- **Not on npm; `pnpm link:cli` links a checkout's build**. Publishing
  would need a scoped name (`tep` is taken).
- **Commands left out of v1**: `tep score <password>`, `tep list`,
  `tep config show`, shell completions.

## Future considerations

Not planned yet; kept here so they are not lost. Roughly smallest first.

### What knowing the app is worth

Asked for by the user on 2026-10-20, when the badges were split by attacker
knowledge (Raw: nothing; Strength: English and the usual habits; bits: this
tool exactly, session only). A fourth figure would say how much of a
password's strength rests on the tool being unknown: Strength minus the
bits for the same password, or the two side by side with the difference
named. It needs the session (the bits do), so it would show beside the bits
figure, never be saved, and never feed a score.

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
letter layer and group digits and symbols together.

### Protect the saved list

My list keeps passwords in localStorage in plain text, and since
2026-10-20 only on the app's own origin (`src/state/origin.ts`; on the
shared GitHub Pages origin it lives in memory for the visit). The user
decided the app will move to a domain of its own; the deploy is ready for
it (`PAGES_DOMAIN`, see the README). Beyond that: offer to encrypt the list
with a passphrase (WebCrypto: PBKDF2 or Argon2 to AES-GCM), or a "hints
only" mode that keeps the sentence and drops the password. Scoring is
unaffected either way: it already needs only the password and hint.

### A worker again, once everything works without one

Asked for by the user on 2026-10-21, when the audit's bet was taken: the
engine is bounded first and the worker removed on that measurement
(`docs/decisions.md`, "Generation"; checklist H1 and H2). Once the
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

- A phone typing model. The typing test now reads a soft keyboard's
  typing from how the text changes, but difficulty is still scored for
  physical keyboards, so phone results are not yet claimed to be
  reliable. Test on real Android and iOS keyboards first.
- Fewer focusable score tips per card (five today), deferred in both
  audits.
- Keep splitting the large modules (`generate.ts`, `score.ts`,
  `fromSentence.ts`) a responsibility at a time; `checks.ts` was the first.
- To move to a newer zxcvbn (or another crack-time scenario), update
  `src/lib/zxcvbnReading.ts` and bump `ZXCVBN_ESTIMATOR`, so saved
  readings are worked out again once.

