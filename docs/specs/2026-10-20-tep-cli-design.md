# `tep`: the Elegant Passwords CLI

Status: **accepted**, 2026-10-20. Decisions made with low confidence
are listed in `TODO.md` under "tep CLI: decisions to revisit", to be
examined once the CLI is in use; four of them were settled by the user
the same day (§3, §7.2, §7.3).

## 1. Goal

A command-line front end to the same engine the web app runs, for Linux and
macOS (Windows is out of scope for now):

    tep g                          # generate with ./tep.yml, else the defaults
    tep g --site typical-site --mode two-finger
    tep g -c bank.yml -n 3
    tep config                     # answer questions, write ./tep.yml

The CLI adds no generation logic of its own, and neither does the web
UI: both go through one shared core in `src/lib` (user decision,
2026-10-20; the plan's §0 has the layout and the tests that hold it). It builds a `Requirements`
(plus `SentenceOptions` and mappings), calls `runInputs` from
`src/lib/engine.ts` and prints the outcome, so a password from `tep` is
generated and scored exactly as the web app would generate and score it,
and the scoring stays a pure function of password and hint.

## 2. Names

The engine already has two things called "mode". The CLI keeps them apart:

| CLI word | Engine name | Values |
| --- | --- | --- |
| `--mode` | `TypingMode` (`difficulty.ts`) | `ten-finger` (default), `two-finger`, `one-handed`, `quick` |
| `--sentence` | `Mode = 'sentence'` (`engine.ts`) | absent = make one up (`generated`) |
| `--site` | `SITE_PRESETS` (`sitePresets.ts`) | `typical-site`, `no-spaces`, `no-symbols`, `short-max-16`, `8-20-few-symbols`, `nist-passphrase` |
| `--strength` | `STRENGTH_PRESETS` (`generate.ts`) | `minimal`, `everyday`, `strong`, `very-strong`, `master`, or a number of bits |

Preset slugs are derived from the labels in code, not a second hand-kept
list, and a test fails if two slugs collide.

`quick` is the id in code; its label is Minimal-quick. The CLI accepts
`quick` and `minimal-quick`.

## 3. No contradictions

`tep` never generates from, saves, or carries forward a set of settings
that contradicts itself. Unlike the web app, it never fixes one quietly
either: `settleRules`' automatic fixes (maximum raised to fit, separator
set to Automatic, ...) are never applied.

A set of settings is **consistent** when both hold. One function,
`src/lib/consistency.ts` `problemsOf(req)` (shared, so the web app can use
it too), checks them in this order
and returns every problem it finds, each naming the fields involved:

1. `ruleProblems(req)` is empty (`validation.ts`: minimum above maximum,
   more required characters than the maximum allows, a symbol required
   with none allowed, a separator the rules forbid, anything out of
   range).
2. `plan(req)` does not throw (`generate.ts`: no sentence fits the
   length window, too few letters to capitalise, no closing mark for the
   required symbols).
A strength target the rules cannot reach (`plan(req).meetsTarget` false)
is **not** a contradiction (user decision, 2026-10-20). It is a
**warning**, as in the web app: `tep g` generates the strongest passwords
the rules allow and says on stderr how many bits they reach against the
target; the wizard lets the target be chosen and marks it (§7.2).
`warningsOf(settings)` returns it beside `problemsOf`.

In sentence mode (`--sentence`), 2 is replaced by `fromSentence` not
throwing, as the sentence is only known at run time.

A mode profile's "space if allowed" separator resolves by whether the
rules allow spaces (`profileValues`). That is the profile's own rule, not
a fix, and is kept.

## 4. Commands

| Command | Does |
| --- | --- |
| `tep g` (alias `tep generate`) | Generate passwords and print them |
| `tep config [file]` | Ask questions, write a config file (default `./tep.yml`) |
| `tep help [command]`, `-h`, `--help` | Usage |
| `tep --version`, `-V` | Version from `package.json` |

Not in v1, kept in `TODO.md`: `tep score <password>` (cold score, as
the Test field), `tep list` (presets and modes with their notes),
`tep config show` (the resolved settings and where each came from), shell
completions.

## 5. `tep g`

### 5.1 Where settings come from

Lowest to highest; each layer replaces only the fields it states:

1. `DEFAULT_REQUIREMENTS`, `DEFAULT_SENTENCE_OPTIONS`, built-in mappings.
2. The config file: `-c <file>` if given, else `./tep.yml` if present, else
   none. No parent-directory search and no global config. Within the file: site preset, then its own `rules`, then
   the mode's profile, then its own `options` (§6).
3. Flags, in the same order: `--site`, rule flags, `--mode` (fills the
   mode's profile), option flags.
4. `problemsOf` (§3). Any problem is an error that names the fields and
   where each value came from (`--max-length 10 (flag)` against
   `min-length 12 (tep.yml)`), exit 3. No password is generated and
   nothing is adjusted to fit. `warningsOf` (an unreachable target)
   goes to stderr and generation goes ahead.

`--mode` on the command line over a config that set its own options:
the flag's profile replaces the file's options, as picking a mode does in
the web app.

### 5.2 Flags

Both `--mode two-finger` and `--mode=two-finger`. A bare `mode=two-finger`
is not accepted: it would be ambiguous beside positional file names.

| Flag | Field | Notes |
| --- | --- | --- |
| `-c, --config <file>` | | `--no-config` ignores `./tep.yml` |
| `-m, --mode <mode>` | typing mode | Fills the mode's options; scores difficulty for it |
| `-s, --site <preset>` | rule fields | |
| `--rules <text>` | rule fields | The pasted-rules parser (`ruleText.ts`): sets the fields the text states, nothing else; what it understood goes to stderr |
| `--min-length`, `--max-length` | `minLength`, `maxLength` | |
| `--min-uppercase`, `--min-digits`, `--min-symbols` | | |
| `--symbols <chars>` | `allowedSymbols` | `''` for none |
| `--spaces`, `--no-spaces` | `allowSpaces` | |
| `--strength <preset or bits>` | `targetBits` | |
| `--shortest`, `--no-shortest` | `shortest` | |
| `--comfort <strict, balanced, relaxed>` | `comfort` | |
| `--avoid-pinky`, `--no-avoid-pinky` | `avoidPinkyStretch` | |
| `--shift-reach`, `--no-shift-reach` | `shiftReach` | |
| `--ease-swaps`, `--no-ease-swaps` | `easeSwaps` | |
| `--separator <auto, space, none, char>` | `separator` | |
| `--number`, `--no-number` | `includeNumber` | |
| `--swaps <0-3>` | `twists` | |
| `--initials <0-3>`, `--two-letter <0-3>`, `--made-up <0-3>` | `initials`, `shorthand`, `madeUp` | |
| `--glue`, `--no-glue` | `glue` | |
| `--sentence -` | sentence mode | Reads one line from stdin, or prompts for it with echo off when stdin is a TTY. Inline text is refused: it would land in shell history and `ps` |
| `--shrink`, `--shrink-from`, `--target-length`, `--no-drop`, `--no-small-initials`, `--no-padding`, `--length-tag` | `SentenceOptions` | Only with `--sentence` |
| `-n, --count <1-20>` | `count` | Default 5 at a terminal, 1 when piped |
| `--sort <difficulty, memorability, strength>` | | Default `difficulty`, as the web app |
| `-f, --format <plain, table, json>` | | §5.3 |
| `--copy` | | §5.4 |
| `--explain` | | The card's "Why?" per password, plus the plan's strength breakdown |
| `--no-color` | | Also `NO_COLOR` and a non-TTY stdout |
| `-q, --quiet` | | No warnings on stderr |

Options a mode has no use for (`unusedIn`) are accepted with a warning
naming the reason, not rejected.

### 5.3 Output

- **TTY, default `table`**: one row per password, the badges the web app
  shows (Strength in bits, Difficulty for the chosen mode, Memorability), and the
  hint under it:

      1  13 worthy storks openly pet twisty toys   Strength 42  Difficulty 38  Memorability 74
         hint: thirteen worthy storks openly pet twisty toys

- **Piped (`plain`)**: passwords only, one per line, nothing else on
  stdout, so `tep g | pbcopy` works (one password when piped).
- **`json`**: `{ mode, typingMode, separator, warnings, suggestions:
  [{ password, hint, bits, difficulty, memorability }] }`, stable field
  names, documented as an interface.
- Warnings (the engine's `warnings`, such as fewer swaps than asked)
  go to stderr.

### 5.4 Clipboard

`--copy` puts the first password (after sorting) on the clipboard with
`pbcopy` (macOS), `wl-copy` (Wayland) or `xclip`/`xsel` (X11), and says
which. None found is an error, never a silent no-op, as in the web app.
No clearing after a delay in v1.

### 5.5 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Passwords printed |
| 1 | Unexpected error (an engine bug: `unexpected: true`) |
| 2 | Usage: unknown flag, bad value, unknown preset |
| 3 | Settings that contradict each other (§3) |
| 4 | Config file unreadable or invalid |
| 130 | Interrupted (Ctrl+C) |

## 6. Config file

YAML, written by `tep config`, also fine to edit by hand. Keys are
kebab-case, the same words as the flags:

```yaml
# tep config, written by `tep config` on 2026-10-20.
# Run `tep g` in this directory, or `tep g -c <this file>`.
version: 1
mode: two-finger             # ten-finger | two-finger | one-handed | quick

site: typical-site           # a site preset; `rules` below replaces any of its fields
rules:
  min-length: 12
  max-length: 32
  min-uppercase: 1
  min-digits: 1
  min-symbols: 1
  symbols: "!@#$%^&*-_.,?;"
  spaces: true

options: preset              # follow the mode's profile, now and as it changes
# options:                   # or every option, fixed
#   strength: 40
#   shortest: false
#   comfort: balanced
#   ...

output:
  count: 5
  sort: difficulty
```

- `options: preset` stores only the mode, so a future re-measured profile
  reaches the config. Choosing "each option" in the wizard writes every
  option, fixed.
- Parsed with `yaml` and checked with a zod schema: unknown keys,
  wrong types and out-of-range numbers are errors with the file, line and
  key (`tep.yml:7 min-length: must be 1-256`), exit 4.
- `version` is required; a newer version than the CLI knows is an error
  telling the user to upgrade.
- Mappings (`swaps: { off: [a>@], custom: [{ from: ph, to: f }] }`) and
  sentence options can be set by hand; the wizard does not ask about them.
- A file that parses but contradicts itself (§3), written by hand, is
  an error for `tep g` (exit 3) naming the keys and their lines.
- Holds no secret, no sentence and no password, ever. Mode 0644.

## 7. `tep config`

Interactive only: with stdin not a TTY it exits 2 and points at the file
format. Ctrl+C at any point writes nothing. What it saves is always
consistent (§3): see §7.2.

### 7.1 Questions, in order

1. **Typing mode**: the four modes, each with its hint from
   `TYPING_MODES`. Default ten-finger.
2. **Site rules**: a site preset (the six, with their notes), paste the
   site's rules, or set each rule. Set one by one, the rules
   are asked in an order where each limits the next: minimum length,
   maximum length, allowed symbols, spaces, then the required uppercase
   letters, digits and symbols. Pasted text (one line, `parseRuleText`)
   shows what it understood; if the text's rules contradict themselves or
   an earlier answer, the wizard says so and asks each rule in turn, with
   the text's values as the defaults wherever they are allowed.
3. **Options**: "Use the <mode> preset" (shows the profile's values in a
   short table first) or "Set each option". Each option is asked in
   `PROFILE_KEYS` order with its label from `PROFILE_LABELS` and the
   mode's value as the default (the nearest allowed value when the mode's
   is not allowed); the mode's unused options are skipped and set to their
   neutral value.
4. **Output** (count, sort): asked, or left at the defaults with a single
   "Change output defaults?".

### 7.2 No answer can contradict another

Every question is shaped by the answers before it, so an answer that
contradicts them (§3) cannot be given.

- **How a choice is checked.** A choice is allowed when the answers so
  far, plus the choice, plus the loosest value of every question not yet
  answered, pass `problemsOf`. The loosest values are fixed in
  `src/cli/constraints.ts`: the widest length window, every symbol
  allowed, spaces allowed, nothing required, the Minimal target, relaxed
  comfort, no initials, two-letter words or made-up nouns, Automatic
  separator. So an allowed answer always leaves at least one way to
  finish, and a later question only narrows what earlier ones allowed.
- **Lists.** A choice that is not allowed is shown dimmed and cannot be
  selected, with the reason, naming the answer that rules it out:
  `Space: spaces are not allowed (line 2, site rules)`.
  A strength the rules cannot reach is not ruled out: it is shown with a
  warning, `Strong (50 bits): these rules reach at most 46 bits`, and can
  be chosen (§3).
  A site preset, a mode's preset, a separator, a comfort level and each
  0-3 count are lists like this. A question left with one allowed choice
  is not asked: the wizard states the value and why ("Symbols required:
  0, as no symbols are allowed").
- **Numbers.** The prompt shows the allowed range, worked out from the
  answers so far: `Maximum length (14-256)`. The bound is found by binary
  search with `problemsOf` where a field is monotonic (tests prove which
  are), else by checking every value. A value outside the range is refused
  before it is accepted, with the reason, and asked again.
- **Text.** Allowed symbols accept only printable ASCII symbols. Anything
  else is refused, naming the character.
- **Speed.** Working out a question's choices must take under 333 ms on a
  typical laptop (user decision, 2026-10-20); `plan()` is the cost,
  measured in the first milestone and pinned by a test.
- **Loosest completion** (user decision, 2026-10-20: confirmed). The
  property test in §9 is the proof that the loosest values always leave
  a way to finish.

**A contradiction that gets through is a bug.** After each answer is
accepted, the wizard runs `problemsOf` on the answers so far (with the
loosest values for the rest). If it finds a problem, the question let
through an answer it should not have. The wizard then:

1. says so at once, in red, before anything else is asked: what
   contradicts what, with both lines, and that this is a bug in `tep` to
   report;
2. discards the answer and asks the same question again, with that
   choice now shown as not allowed, until the user picks one that passes.

The wizard never moves on, shows the review, or saves while a
contradiction stands.

### 7.3 Review

When the last question is answered, every answer is shown with a line
number:

```
  1  Typing mode        Two-finger
  2  Site rules         Typical site (12-32, A + 1 + #)
  3  Options            Two-finger preset
       Strength target 40 bits (Everyday), Separator space, Minimum swaps 1,
       Capital initials 1, Two-letter words 1, Made-up nouns 1, Glue on
  4  Count              5
  5  Sort               Difficulty

  Sample: 7 Ertdfg jr wise elks B; ...      Strength 42  Difficulty 31  Memorability 70

Change a line (1-5), s to save, q to quit without saving:
```

- Choosing a line asks that question again, then returns here. The
  question is shaped as in §7.2, but by every other answer, not only the
  earlier ones (there are no unanswered questions left to be loose about).
  A choice another line rules out is shown dimmed with that line's number
  ("needs a maximum length of 20 or more: line 2"), so the user changes
  that line first. Blocked items cannot be edited (user decision,
  2026-10-20): there is no way round the block, not even with a warning.
  A line whose every other choice is ruled out says so when chosen,
  naming the lines that hold it, and the review is shown again.
- With options set one by one, each option is its own numbered line.
- Changing the mode while options follow the preset updates them; a mode
  whose preset contradicts the rules is not allowed. With options set one
  by one, it asks whether to take the new mode's preset, offered only
  when that preset fits the rules.
- `s` runs `problemsOf` on the complete answers once more before writing.
  A problem there is the bug path: said at once, nothing written, and the
  user is asked to change one of the lines it names.
- A sample password is generated from the answers.
- An existing file loaded at the start (§7.4) that contradicts itself
  (edited by hand) opens with the conflict named, and the later of the
  conflicting questions is asked again, shaped by the rest, before the
  review is shown.

### 7.4 Saving

- Only answers that pass `problemsOf` (§7.3).
- To `./tep.yml`, or the file named on the command line (`tep config
  bank.yml`): one file per site is the intended use, with
  `tep g -c bank.yml`.
- An existing file is loaded as the starting answers and the wizard opens
  on the review screen; saving over it asks first.
- Written atomically (temp file in the same directory, then rename), with
  the header comment and the field comments shown in §6.

## 8. Build and layout

- In this repo: `src/cli/` (`main.ts` argument parsing and dispatch,
  `config.ts` schema/load/save, `resolve.ts` the layering in §5.1,
  `constraints.ts` the allowed
  choices and ranges for each question (§7.2), `wizard.ts`, `output.ts`,
  `clipboard.ts`), importing `src/lib` as is. `src/lib` stays free of
  Node APIs.
- Bundled with tsdown to one ESM file with a `#!/usr/bin/env node`
  line, `bin: { tep }` in `package.json`, built by `pnpm build:cli`.
  Not published to npm (the package stays private); installed with
  `pnpm link --global`.
- Dependencies: `node:util` `parseArgs` for flags, `yaml`, `zod`, and
  `@clack/prompts` (arrow-key menus for the questions; the review screen
  takes a typed line number). The bundle inlines them, so the built
  `tep.mjs` needs only Node. The CLI's dependencies are kept to
  `src/cli/` so they can be replaced later: a dependency-free CLI (plain
  `node:readline` prompts, a hand-written schema check, a small YAML
  subset reader and writer) is a future feature in `TODO.md`.
- Node 24; `globalThis.crypto.getRandomValues` is the randomness, as in
  the browser. No `--seed` flag in the user-facing CLI.
- No network, no telemetry, no update check.

## 9. Tests

- Unit (Vitest): slugs, the layering in §5.1 (each layer, each conflict),
  config round trip (write, read, same `Requirements`), schema errors with
  line numbers, output formats, exit codes.
- The wizard driven through a fake terminal: every path, the review edits,
  Ctrl+C writes nothing.
- Contradictions, property-tested: a random walk through the wizard that
  picks any allowed choice or in-range number at every question, review
  edits included, never reaches `problemsOf` with a problem, and every
  question it reaches has at least one allowed choice. The bug path is
  tested by injecting a `constraints` that lets a bad choice through: the
  message appears at once, the same question is asked again without it,
  and nothing is written.
- Every field the binary search treats as monotonic is checked to be so.
- One end-to-end test that builds the bundle and runs `tep g --format
  json` and `tep g` piped, checking each password against its rules with
  the engine's own `checks`.
- Equivalence: for a fixed rng, `tep`'s resolved inputs give the same
  passwords as the web app's provider for the same settings.

## 10. Docs

README gets a "Command line" section. `docs/algorithm-flow.md` is
unchanged (no new algorithm). The Fun page has two rebuild prompts, the
app's first and then the CLI's, which builds on the app's shared core
instead of redefining it (user decision, 2026-10-20).
