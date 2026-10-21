# H3: a password field holds 128 characters, a hint 512, and anything over 2 s says so

Status: **accepted**, 2026-10-21 (the user's decisions, given with M2's
answers). Acts on H3 of `docs/audits/2026-10-21-audit-checklist.md`,
found while M2 was measured. Line numbers at `63c179f`.

## 1. The problem

The typing test hands whatever is under test to zxcvbn
(`src/components/useZxcvbn.ts`, `src/state/zxcvbnCheck.ts`), which runs
synchronously on the page's thread, with no length bound inside the
500-character cap (`MAX_SENTENCE_LENGTH`, `src/lib/text.ts:11`). M2's
measurements, Node, one call each:

| Input | zxcvbn |
| --- | --- |
| 128 characters of prose | 56 ms |
| 500 characters of prose | 1.3 s |
| 128 random printable characters | 1.1 s |
| 250 random printable characters | 21.8 s |
| 500 random printable characters | over 4 minutes |

Pasting a long API key freezes the page for seconds to minutes. Since H2
there is no worker and no time limit anywhere: a stall is silent.

## 2. The decisions (the user's, 2026-10-21)

### 2.1 Limits

- **A password text field holds at most 128 characters** (`MAX_LENGTH`,
  the longest password the tool makes). That is the typing test's field
  (typed or pasted; a longer paste is refused with the existing "Not set:
  the pasted text is longer than 128 characters").
- **A hint field holds at most 512 characters**: the typing test's hint
  and both sentence fields (the sentence is the hint in sentence mode).
  `MAX_SENTENCE_LENGTH` becomes `MAX_HINT_LENGTH = 512`, and the engine
  and `tep g --sentence` keep enforcing it with the one message both
  front ends use.
- zxcvbn reads at most 128 characters, so its worst case is about 1.1 s
  on a desktop; the scorer's inputs are at most 128 and 512.

### 2.2 Over 2 s is a failure, and says so

- **Any one piece of work the web app does synchronously that takes over
  2 s is a failure** (`SLOW_MS = 2000`). Timed: a batch (the provider's
  engine call), a zxcvbn reading (the library call itself, not its lazy
  load), and the typing test's scoring of the password under test and its
  hint.
- **A failure shows a floating error message that can be dismissed**: a
  snackbar in the error colour, 1.5 rem above the foot of the page like
  the unapplied-changes bar (above it when both show), `role="alert"`,
  naming what was slow and how long it took, with a Dismiss button
  (Escape dismisses it too when focus is on it). "Making passwords took
  3.4 s, over the 2 s this app allows. Looser settings, a shorter
  sentence, or a faster device make it quicker." A second failure while
  one shows replaces it.
- **Work on the page's thread cannot be stopped part-way**, so the message
  shows when the slow work has finished; the 2 s line is what makes a
  stall visible rather than silent, not a way to cut it short.
- **The timing lives in the web app** (`src/state/slow.ts`): `src/lib`
  stays free of clocks, and the CLI is not changed (its wizard's
  equivalent is M6's `pnpm measure:wizard`, failing at the same 2 s).
- Nothing is written to the console: the smoke suite fails on any console
  error, and the message is for the user.

## 3. Not changed

The rules text box (L4 has its own item), the number fields, the CLI's
output, stored data (entries are generated passwords of at most 128, and
their hints come from the same fields).

## 4. Tests

- The typing test field and the hint and sentence fields carry
  `maxLength` 128 and 512; a 129-character paste is refused.
- `fromSentence` refuses 513 characters and accepts 512.
- `timed` reports work over 2 s (an injected clock), not work under it.
- The notice: shown with what and how long, dismissed by its button,
  replaced by a newer failure; the provider reports a slow engine (an
  injected engine and clock).
