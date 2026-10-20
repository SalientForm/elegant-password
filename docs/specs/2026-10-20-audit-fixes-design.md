# Audit fixes: scores no attacker can game, reveal instead of click-to-copy, and the rest of the audit

Status: **accepted**, 2026-10-20. Decided with the user the same day, from
the audit of `b60e7b7` (four reviews: the CLI's and the web app's UX
consistency, and each one's code quality). The plan is
`docs/plans/2026-10-20-audit-fixes-plan.md`.

## 1. Goal

Act on the audit's findings, with the user's decisions where the audit
asked a question. Nine decisions change the product; the rest are fixes.
In the user's words, numbered as in the audit:

| # | Decision |
| --- | --- |
| 6 | The wizard never quietly drops a pasted rule it cannot keep: it says which rules it drops and why. |
| 10, 12 | Scores know nothing about the session or about this app. Bits (what an attacker who knows the tool must guess) is a session-only measure that feeds no score. A new Raw badge. Repeated characters never raise a score. A custom swap makes the swap count 65, not 64, in the bits. A future metric: what knowing the app is worth. |
| 11 | My list is kept only on the app's own domain. There is no domain yet, so until there is one the list lives in memory. |
| 13 | A tap or click shows the whole password. Copying is the Copy button's job, and the button is for touch screens only; click-to-copy goes. |
| 15 | Esc means back: in the app it leaves a field before it discards anything; in the wizard it returns to the review. |
| 16 | `tep g` always says which config file it used. |
| 17 | "At least 12, maximum 8" reads as 12 to 12, never swapped. |
| 22 | One wording for each thing, the best fit kept. |

Everything else in the audit that is compelling or cheap is done too (§9);
what is left is listed at the end of the plan.

## 2. Three attackers, three figures

The old Strength badge assumed an attacker who knows this tool: its word
lists, its sentence patterns and its 64 swaps. That is the right model for
an exact figure at generation time, and the wrong one for a score that
travels with a password: it depends on the session (which swaps were on),
and it reads a password made with a custom swap as random text, 15 bits
too high. The user's rule: a score must be a pure function of the
password (and, for memorability, its hint) and nothing else.

So each password now carries three strength figures, one per level of
attacker knowledge, and only the first two are scores:

| Figure | The attacker knows | Where | Saved with the password |
| --- | --- | --- | --- |
| **Raw** | nothing | badge | yes |
| **Strength** | English and people's habits, not this app | badge | yes |
| **Bits** | this app exactly, and this session's swap list | dim figure on a card, the strength panel, `tep g` | no |

Difficulty and Memorability stay as they are: a password and its hint,
nothing from the session. A hint word that reaches the password through a
custom swap now reads as one step away from the hint (§2.4), not as a
dropped word.

### 2.1 Raw

Brute force over the characters used. The classes present decide the
alphabet: lower case 26, upper case 26, digits 10, symbols 33 (every
printable ASCII punctuation mark and the space), any other character 50
(about an alphabet). A character that repeats the one before it adds
nothing, so `aaaaaaaaaaaa` is one `a`.

    raw = (characters, runs of one character counted once) × log2(alphabet)

`63;Rqmote;thiqves;chip;fqrns` uses all four classes (95) over 28
characters: 184 bits. It is the figure every naive strength meter gives,
and it is labelled as such; the badge has no colour band.

### 2.2 Strength

An attacker who knows English, the usual places for a capital, a digit or
a symbol, and the usual habits, but has never heard of this tool: no word
lists, no sentence patterns, no swap table, and no hint. Scored from the
password alone:

- A run of letters is English-like text at 2.3 bits a letter (the figure
  the old text reading used), never less than one letter's pick (4.7), with
  a repeated letter counted once. One more bit when the run has a capital.
  A capital after a lower-case letter starts a new run (`BlueTiger` is two).
- A run of digits is its digits at 3.3 bits each, repeats counted once; a
  memorable run (the same digit, 123, 4321, 2468) is one pick of 40 (5.3).
- Each distinct symbol (the space among them) is one pick of 32 (5 bits),
  however often it appears: a separator typed three times is one choice.
- Any other character is a symbol.

`63;Rqmote;thiqves;chip;fqrns`: 6.6 + 5 + 14.8 + 16.1 + 9.2 + 11.5 = 63
bits. `aaaaaaaaaaaa` 4.7, `asdfasdfasdf` 27.6, `Password1!` 27.7, all red.
A swap never changes a word's strength: `Rqmote` is six letters whether or
not `e>q` is anyone's mapping.

The colour bands stay where they are (green from 50, yellow from 40), and
the band is taken from the rounded figure, so a badge reading 50 is never
yellow. The strength word (everyday, strong, ...) follows the same figure.
"Strength" order sorts by this figure.

### 2.3 Bits: the session's measure

What the old Strength was, kept for what it is good at: the exact entropy
of this app's random choices, for an attacker who knows the app. Two
places make it:

- **The plan**, per batch: the strength panel's figure, unchanged.
- **Per password**: the cold count of the words drawn and of where the
  swaps landed, now over the swap list in force in this session (the
  built-in swaps the user has not switched off, plus their own: with one
  custom swap the count runs over 65, not 64). It needs the session, so it
  shows only there: a dim `42.7 bits` on a card beside the badges, with a
  tip saying what it is, and in `tep g`'s table and JSON (`bits`). My list,
  the typing test and anything saved never show it.

The strength panel is headed as the figure for an attacker who knows the
tool, and says that the badges assume one who does not.

### 2.4 Memorability's reading of the hint

Memorability finds each hint word in the password: whole, shortened,
as a capital initial, as a number, with its deliberate swap, or with a
random swap. Random swaps were recognised through the built-in table
only; a custom swap made the word unrecognisable, so it read as dropped.
Now a word that is not found by the table is looked for by its letters:
a spelling within a few edits (a letter changed, added or removed; up to
three for a word of ten letters or fewer, and never more than half its
letters) is the word, each edit one step away from the hint, charged as a
random swap is. Nothing from the session goes in: the fixed table and
the fixed shortening rules are the app's, the edits are anyone's.

### 2.5 Repeated characters

A run of the same character counts once wherever text is read: in Raw, in
Strength, and in the bits model's text reading of leftover letters.

### 2.6 Where the figures show

- **Badges**, in this order: Strength, Raw, Difficulty, Memorability. On a
  card, in My list, in the typing test (Memorability n/a without a hint),
  in `tep g`'s table, in the wizard's sample.
- **`tep g --format json`**: `strength`, `raw`, `bits`, and `readings` for
  all four badges.
- **The Scoring page** explains the three attackers and the four badges.
- **The typing test** no longer reads a hint off the password: Strength
  and Raw need none. `scoreAlone` goes.

### 2.7 Future metric

Added to `TODO.md` at the user's request: a figure for what knowing this
app is worth, Strength minus Bits for the same password, so a user can see
how much of a password's strength rests on the tool being secret.

## 3. Showing and copying a password

- Clicking or tapping a password shows the whole of it: it wraps onto as
  many lines as it needs, and the same click folds it back. The control is
  a button for the keyboard (Enter or Space), named "Show the whole
  password" while cut short and "Show less" while open; a password that
  fits is plain text. The hover tip for a cut-off password goes: the click
  does its job on every device.
- Click-to-copy goes, with its bubble.
- The Copy button on a card and in My list shows only where the pointer is
  coarse (touch screens: `(pointer: coarse)`), where selecting text is hard.
  On a desktop the password is selected and copied like any text. The
  "Copy sentence" button is not a password and stays everywhere.
- The copy failure message no longer presumes a keyboard: "Could not copy;
  the text is selected, so copy it from the selection."

## 4. Esc means back

- **The app.** With unapplied changes, Esc in a text field leaves the
  field and discards nothing; Esc with no field focused discards, as the
  Discard button's tip says. Esc during IME composition does nothing. Tips
  and the phone menu keep closing on Esc first.
- **`tep config`.** Esc while changing a review line returns to the
  review with the line unchanged. Esc at the review's own question leaves
  without saving, like `q`. During the first questions, Esc stops like
  Ctrl+C (there is no earlier question to go back to; noted in the plan's
  leftovers). Ctrl+C always stops, writing nothing. The prompter tells the
  two keys apart by listening for the key itself.

## 5. My list and the session on a shared origin

The app is served from `salientform.github.io`, an origin every
SalientForm Pages site shares, so anything in that origin's storage is
readable by all of them. My list holds passwords; the session store holds
the current batch and the user's own sentence. Both are now written to
the browser only on the app's own origin: `localhost`, `127.0.0.1` and
the hosts named in `VITE_OWN_HOSTS` at build time (none yet). Anywhere
else they live in memory for the visit; My list says so above its entries,
and the list key left in the shared origin's storage by earlier versions is
removed on load. Settings hold no secrets and stay in storage everywhere.

The deploy is ready for a domain: when the repository variable
`PAGES_DOMAIN` is set, the workflow builds at `/`, writes `dist/CNAME`
and puts the host in `VITE_OWN_HOSTS`; without it, the Pages path as now.
The user adds the DNS record and the variable when the domain exists.

## 6. Pasted rules

- **The wizard** (item 6). When pasted rules cannot all be kept, the
  wizard still asks each rule from what the text said, but every rule it
  cannot keep is named as it is dropped: "Dropped the pasted rule
  `required symbols 3`: ... tep's passwords will not meet it; check what
  the site accepts." The review lists them under "Not kept from the pasted
  rules" so they are in sight when saving. `tep g --rules` keeps refusing
  such text (exit 3): that is loud already.
- **Lengths** (item 17). A minimum above the maximum keeps the minimum and
  raises the maximum to it: "at least 12, maximum 8" is 12 to 12, said in
  what was understood.
- **Counts of classes** (audit item 5). "3 of the 4 character types",
  "2 character sets", "3 character classes" no longer read as a length.

## 7. `tep g` and the wizard

- **The config file** (item 16) is always named: the table's first line
  (`Config: tep.yml (/home/me/x/tep.yml)`, or `Config: none (no tep.yml
  in /home/me/x)`, or `Config: none (--no-config)`), a `config` object in
  the JSON, and a note on stderr when the output is piped plain.
- `--explain` with piped output prints the table (what `--explain` asks
  for) instead of silently printing passwords alone.
- JSON warnings keep their lines, joined with newlines, not runs of spaces.
- A config file written by `tep config` leaves out the options the typing
  mode has no use for, so `tep g` never warns about its own file; the
  warning for a hand-set unused option no longer contradicts itself.
- A custom swap to a digit is written quoted, and a file with `to: 0`
  says what is wrong and how to quote it.
- Flags: a flag with a short form that is missing its value names its
  long form; `--no-copy`, `--no-explain`, `--no-quiet` are refused like any
  other unknown flag; choice values are matched regardless of case;
  `--no-color` works for every command; `tep -v` suggests `-V`;
  `tep help help` prints the overview.
- Messages: the no-fit contradiction names the required characters when
  they are the cause; a fix is offered only when it works, and raising a
  maximum the site set is not offered; no doubled punctuation; a bad
  `separator` gets a `separator:` example; `tep config`'s no-terminal error
  points at the format, which `tep help config` now shows; `--mode`,
  `--site` and `--format` errors follow the house pattern (what is wrong,
  then a fix); Node's own wording never reaches the user; the wizard's
  "too low" reason names the line, not a number nobody typed; Ctrl+C at
  `tep g --sentence -` says no passwords were made; the hidden sentence
  prompt shows nothing as it is typed.
- Help: the exit-code line is built from the one list in `errors.ts`.

## 8. Wording

| Was | Now | Where |
| --- | --- | --- |
| Automatic / Auto | Auto | README, form hint, validation message |
| apply / Submit | submit | hints on the Passwords page |
| `(hint n/a)` / Hint: none | Hint: *none* | typing test, My list |
| Testing / Test a password / Test and practice | Testing (tab), Test a password (heading), Password to test (field) | column, typing test |
| Source Text | Source text | sentence card |
| "must be between 0 and N" / "whole number from 0 to N" | a whole number from 0 to N | validation |
| Strength target / target strength / Custom target (bits) | Strength target; Strength target in bits | form, CLI labels |
| Passwords / Order (review) | Count / Order | wizard review, matching the fields |
| `--shrink none` | also `keep`; `--target-length none` also `max`; help says what each means | CLI |
| separator hint `"." or ","` | the real fallback list | form |
| Mappings N on | counts only the mappings that can apply | swaps panel |
| nine criteria | the count from the rubric | Scoring page, README |

Disabled controls say why in visible text, not only in a tooltip:
"Include a number" (always on while digits are required), the Space
separator, and swaps that cannot apply to the user's sentence.

## 9. Fixes from the audit, in brief

Core: One-handed capitals that fell short of the uppercase rule (the
within-reach words are tried first, then the rest; a drawn suggestion that
fails a check is dropped like a kept one); the superseded worker answer
that stayed on screen; the planning cache with no cap; superseded worker
requests kept in the queue; the leftover count thrown off by emoji; the
uppercase "Why?" for capitals that come from a made-up noun; `SYMBOL_ALPHABET`
and other unused exports; the misleading message for a sentence in another
script.

Web: the Fun and Scoring pages load on demand; sentence and hint fields turn
autocorrect off; badges carry a role so a screen reader reads the whole
reading; README facts (Mode's column, the file list, the criteria).

CLI and build: `pnpm test` builds the bundle into a temporary directory
instead of over the `tep` on the PATH; tests delete their temporary
directories; one "is this a tep link" check shared by `pnpm link:cli` and
`tep uninstall`, and `link:cli` refuses to replace a link to anything else;
one argument-parsing helper and one command table; the atomic config write
follows a symlink and keeps the file's mode; the browser-safety test
checks Node globals in every module the browser reaches; constants
imported, not copied; a CI workflow that runs the unit and browser tests
on every push.

## 10. Not in this spec

Listed at the end of the plan, with why: a different Esc in the wizard's
first questions, Android on-screen keyboards in the typing test, splitting
`generate.ts` and `score.ts`, blocking framing on GitHub Pages, badge tab
stops, sequences and keyboard runs in Raw (the user chose repeats only).
