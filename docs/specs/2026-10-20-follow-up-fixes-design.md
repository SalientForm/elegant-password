# Follow-up audit fixes, common passwords and a zxcvbn reading

Status: **built**, 2026-10-20, on `feature/audit-follow-up`. Acts on every
item of `docs/audits/2026-10-20-follow-up-audit.md`, with two additions
from the user the same day:

- Strength takes SecLists' list of the most common passwords into account,
  and a password that is exactly one of them is not allowed.
- Every password carries a second opinion from the zxcvbn library, as a
  fourth badge; in My list it is worked out when the password is added and
  saved with the password and hint, so it survives a reload and is never
  worked out again.

One audit suggestion was declined by the user: **Fun stays in the main
navigation**, beside Passwords and Scoring.

## 1. The additions

### 1.1 Common passwords

`src/lib/commonPasswords.ts` holds SecLists'
`Passwords/Common-Credentials/10k-most-common.txt` (10,001 passwords, most
common first, commit `913b327`, MIT licence) as one JSON string, written by
`scripts/commonPasswords.mjs` (`pnpm common:passwords [file]`).
`src/lib/common.ts` answers `commonRank(password)`.

Only an exact match counts, as asked: `dragon` is on the list, `Dragon` is
not. A password on the list:

- has Strength log2 of its place (the guesses an attacker trying the list
  in order needs): `password`, first, is 0 bits;
- fails a "Not a common password" check, so a suggestion (made-up or from
  the user's own sentence, in the app and in `tep`) that comes out as one is
  dropped like any card that misses a rule;
- is refused by My list, with the reason;
- is marked "Not allowed" in the typing test, which still scores it.

The list is static data, so Strength stays a pure function of the password.

### 1.2 The zxcvbn reading

zxcvbn (Dropbox's password strength estimator, 4.4.2, MIT) gives a second
opinion beside the app's own scores. Its crack time for an offline attack
on a slow hash (`crack_times_display.offline_slow_hashing_1e4_per_second`,
10^4 guesses a second) is read as one of four words: seconds or minutes
are very weak, hours to weeks are weak, months to years are good, and
centuries is strong. It runs in the browser; the app's CSP stays
`connect-src 'none'`, and nothing is sent anywhere.

- `src/lib/zxcvbnReading.ts` turns the crack time into the word, pure and
  tested on its own; eight reference passwords check the whole path.
- `src/state/zxcvbnCheck.ts` loads zxcvbn (about 800 kB) only when the
  first password needs a reading.
- `SelectedEntry.zxcvbn` keeps the word, the crack time, the place on the
  scale, zxcvbn's guesses and score, the estimator and the time of the
  reading. It is worked out once, when the entry is added; an entry saved
  before readings existed gets one on its next visit; a reading made by
  another estimator (a future zxcvbn) is worked out again.
- Every password shows it as the fourth badge, "zxcvbn strong", between
  Difficulty and Memorability: on cards and in the typing test it is worked
  out as the password appears (cached for the visit, never stored); My list
  uses the saved reading and adds a line under the hint, "zxcvbn: strong
  (centuries to crack)". A screen reader hears "Added. zxcvbn: …" when the
  reading of a new entry arrives. The Scoring page explains it. It is not
  one of the app's scores and sorts nothing.

## 2. Strength: habits attackers try first

The audit's concern stands, as a scoring decision: repeating `Password1!`
three times scored 66, and twelve `aA`s scored 73, a "master password".
Strength (`src/lib/strength.ts`) now also reads:

- **Repeated blocks.** A block typed again and again in a row counts once,
  plus log2 of the number of times. Blocks of three characters or more
  count from two copies; two-character blocks only from three copies, so
  `banana` and `cocoa` stay words.
- **Keyboard and alphabet walks.** Four or more letters stepping one key
  along a QWERTY row, or one letter along the alphabet, in one direction,
  are one pick from 1,000: `asdf`, `poiu`, `abcd`. Three-letter steps are
  common in English (`rst`), so they are left alone.
- **The common list**, as §1.1.

So `Password1!` typed three times scores about 27, twelve `aA`s 14, and
eight `asdf`s 13. The previous rule's test "a repeated pattern is still 12
letters" is replaced. Raw stays naive.

## 3. The audit's findings

| # | Fix |
| --- | --- |
| 1 | Every storage write reports whether it worked. `persistence` gives `saved`, `visit-only` (shared origin) or `failed` for My list and the session, and `saved` or `failed` for the settings. My list and the settings show an alert with Try again when a write fails, and the entries stay on screen to copy. Try again merges memory with what storage holds, so nothing is lost. Tests make writes fail after a good start. |
| 2 | A `minLowercase` rule, end to end: the requirements, validation, the form, presets, settings, the planner and checks, own-sentence mode, the parser, and `tep` (`--min-lowercase`, config). "always included" is gone. |
| 3 | The parser reports what it cannot keep (`unsupported`). A minimum length above 256 is not applied at all, not cut down. A maximum above 256 is kept as 256 and said so, since every password the tool makes stays under the site's limit. Clauses such as "no digits", "no letters" or "at most 2 symbols" are named. The web form shows them as "Not kept". `tep g --rules` with an unsupported clause exits 2 (usage) and names each one, and the wizard says what it drops. |
| 4 | The snackbar's actions wrap, so nothing is cut off at 320 px. |
| 5 | ApplyBar takes keys only while the Passwords page is showing. |
| 6 | Enter during IME composition never submits or runs: both sentence fields, the typing test and its hint field. |
| 7 | A pasted password is kept exactly, with any spaces at either end. One line break at the end is dropped. More than one line, spaces alone, or more than 500 characters are refused, with the reason. |
| 8 | YAML anchors and aliases are config errors (exit 4, file and line). A failure in `toJS` is caught. Values in messages are formatted without throwing (cyclic, huge). |
| 9 | The session validator checks every nested field a card reads (swaps and their mappings, criteria, measurements, word roles). A stored session that does not parse is removed. The error page's button forgets the session and reloads. |
| 10 | On a shared origin, a session an earlier version stored is removed, as well as the list. |
| 11 | Each change to My list is made to the list as stored, read again just before the write. A change another tab makes to localStorage shows at once (`storage` event). |

## 4. Design and engineering concerns

- **Bits figures**: a card's dim figure now reads "40.2 bits if the tool is
  known". Its tip says it counts this one password, not every length the
  rules allow as the plan does.
- **Worker**: at most one request runs in the worker, plus one waiting
  request that a newer one replaces. A worker still busy with a superseded
  request after 300 ms is terminated and replaced.
- **Input limits and caches**: sentences, hints and the password under
  test are capped at 500 characters (`MAX_SENTENCE_LENGTH`, the CLI's cap).
  The twists cache's inner map is capped like the scoring caches.
- **Deploys** need the same checks as CI, browser suite included
  (`pages.yml`'s `check` job).
- **Accessibility**: the licence link is at full muted contrast, no longer
  faded to 30% opacity. Fewer focusable tips per card is still deferred, as
  in the previous audit.
- **Large modules**: `checkRequirements` and the crack-time helpers left
  `generate.ts` for `checks.ts`, re-exported. The rest stays incremental.

## 5. Features

1. **Persistence status and "Forget this session"**: a "This session" card
   under My list says where the session is kept. A button (pressed twice to
   confirm) forgets the passwords on screen, both sentences and the password
   under test, in memory and in storage, and draws a new sentence. My list
   and the settings stay.
2. **Understood and not kept**: see finding 3.
3. **Practise**: a keyboard button on every card and every My list entry
   makes that password the one under test, with its hint, without saving
   or removing anything. On a narrow screen it opens the Testing column.
4. **Soft keyboards**: when a key down names no key (Android sends
   "Unidentified"), the typing is read from how the text changed, so runs
   are timed and corrections counted. A phone typing model is not built:
   phone results are not yet claimed to be reliable (TODO.md).
5. **A simpler default view**: the made-up sentence's long help sits behind
   "About this sentence". On a phone the tagline takes the full width, with
   the credit on one line under it.

## 6. Presentation

- Raw is a quieter badge (muted, thin border), so it does not compete with
  the three scores.
- My list is described as a shortlist to choose from, not a vault, with a
  pointer to a password manager.
- Deferred, as the audit recommended: CLI rewrites without dependencies,
  browser extensions, and a fourth strength metric.
