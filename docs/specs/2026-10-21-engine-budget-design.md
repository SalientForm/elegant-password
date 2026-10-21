# The engine answers within a budget

Status: **built**, 2026-10-21, commit `8699fd5` on
`feature/audit-follow-up` (plan: `docs/plans/2026-10-21-engine-budget-plan.md`). Acts on
item H1 of `docs/audits/2026-10-21-audit-checklist.md` and the engine half
of M2. It is the first of two steps that take the audit's 90-day bet: make
the engine fast enough to need no worker, then remove the worker (H2, its
own spec, written once this one is built and measured). It replaces the
withdrawn "worker's time limit" spec of the same day; §5 says why.

## 1. The problem

`src/state/generator.ts` gives the worker ten seconds per request. When
the limit passes, `giveUp()` marks the generator broken for the session,
terminates the worker and runs the same request on the UI thread, where
every later request runs too. The page freezes and never recovers until a
reload. The limit is reachable with settings the app allows: sentence mode
at a 500-character sentence, a maximum length of 256 and 20 suggestions
takes 3.6 s on a desktop and three to five times that on a phone.

Profiling shows the engine is not slow; the scorer is, and it is run on
work the engine throws away. For 20 kept suggestions at those settings:

- `fitLength` (`src/lib/fromSentence.ts:427`) searches the compression
  states by length, but each probe calls `finish()`, which scores the
  candidate in full (`scoreCold` at line 627, `strengthBits` at 639) and
  then discards it. Seven candidates are finished per attempt.
- The batch loop (line 704) allows ten attempts per suggestion asked. A
  sentence with little variety spends them all: 16 distinct passwords were
  found by attempt 85, and attempts 86 to 200 found nothing, each at the
  full cost. 1,400 candidates were finished for 16 suggestions.
- Half of all time is `collapseBlocks` in `src/lib/strength.ts:122`, a
  cubic scan that slices and joins strings: 17.8 ms for a 256-character
  password, 2.5 ms for 128. The typing test pays the same cost per
  keystroke (checklist M2).
- Building the twist table (`buildTable`, `src/lib/twists.ts:218`) for each
  finished candidate is the next 15 %.

Measured in Node on a desktop, median of three, with the sentence of 90
words from the audit bench. The last column has the per-candidate scoring
stubbed out, so it is the floor the search alone costs:

| Sentence | Maximum | Count | Today | Search alone |
| --- | --- | --- | --- | --- |
| 500 characters | 256 | 20 | 3,631 ms | 319 ms |
| 500 characters | 128 | 20 | 769 ms (16 found, 200 attempts) | 460 ms |
| 250 characters | 128 | 20 | 885 ms | 136 ms |
| 500 characters | 32 | 20 | 426 ms (16 found, 200 attempts) | 354 ms |
| 60 characters | 32 | 20 | 102 ms | 23 ms |
| 60 characters | 32 | 5 | 26 ms | 6 ms |

A second gap feeds the first. The 500-character cap on a sentence
(`MAX_SENTENCE_LENGTH`, `src/lib/text.ts`) is enforced by the web app's
fields and by `tep g`, never by the engine, so a sentence restored from
sessionStorage or passed by any other caller is not capped at all.

## 2. Decisions

### 2.1 The maximum length is 128

`MAX_LENGTH` in `src/lib/validation.ts` goes from 256 to 128, decided by
the user on 2026-10-21. `TARGET_LENGTH_RANGE` in `fromSentence.ts` follows
it instead of repeating the number. Everything that takes a length
already reads the constant: both length fields, the CLI's `--max-length`
and the wizard's "(14-256)" ranges, rule text ("exactly 200 characters:
this tool makes at most 128"), and the smallest-working-maximum search.

Stored settings with a length above 128 are repaired on load by the
existing `repair()` in `settingsStore.ts`, which resets the offending
field to its default and names it, as it does for any other rule that no
longer holds. No site preset or mode asks for more than 128. A kept
session's suggestions stay on screen as they are; nothing re-runs them.

`MAX_TARGET_BITS` is also 256 and stays: it is bits, not characters.

### 2.2 A suggestion is scored once, after it is kept

`finish()` builds the password, its length, its steps and the rule
problems that can refuse it (the lowercase check and the common-password
rank, both cheap) and returns a draft. The search in `fitLength` needs
nothing more. `fromSentence` scores a draft only after the duplicate check
has passed: `scoreCold`, `strengthBits`, `rawBits` and `checkRequirements`
run once per suggestion returned, never for a probe or a duplicate. The
`Suggestion` type and every field in it are unchanged; the draft is an
internal type.

### 2.3 At most three attempts per suggestion asked

The batch loop allows `3 × count` attempts instead of `10 × count`, as a
named constant. The variety warning ("Only 16 different versions fit; add
twists or initials for more variety") is unchanged and is what a user
sees when the attempts run out. On the measured worst case the change
costs one suggestion (15 found instead of 16) and removes 140 attempts
that found nothing. Three is a judgment: every measured sentence with
variety to spare found its 20 in 20 attempts.

### 2.4 `collapseBlocks` compares indexes, not slices

The function keeps its contract exactly (the block covering most of the
text wins, the shorter of two that cover as much) and loses its string
slicing. For each position it computes the Z-array of the suffix once;
the repeat count of a block of length `L` is then `1 + floor(z[L] / L)`,
so every block length is read off in one pass. Quadratic in the length
with no allocation per step, against cubic with a slice and join per
step today. The typing test's per-keystroke cost falls with it; the
component's recompute per render stays M2's own item.

### 2.5 The engine caps the sentence

`fromSentence` refuses a sentence longer than `MAX_SENTENCE_LENGTH` with a
`RequirementsError`, the same way it refuses a sentence with no words.
The check and its wording live once, in `src/lib/text.ts`:

> The sentence is 719 characters; 500 is the most this tool takes. Use a
> shorter sentence.

`tep g --sentence -` uses the same function, so the two front ends say the
same thing (today the CLI says "Keep it under 500 characters", one short
of its own rule). The web app's fields keep their `maxLength`, so a user
never meets the message there; a restored session that somehow carries a
longer sentence does, in place of the batch. Lengths count UTF-16 code
units, as the fields and the CLI already do.

### 2.6 The budget

The worst permitted settings (a 500-character sentence, maximum 128, 20
suggestions, and the same at 250 characters) answer in under 300 ms on
the audit desktop. From the floors above the estimate is about 250 ms for
each: 60 attempts of the search plus 15 to 20 scorings at 5 ms. The
figure is measured with the audit bench when this is built and recorded
in §5; it is the number the no-worker decision (H2) is made on. It is not
asserted by a wall clock in CI (checklist M6): the tests assert the
counts of §4 instead.

### 2.7 Not taken now

- Building the twist variants once per candidate: `applyTwists` builds a
  table up to three times per finished candidate (digits, symbols, random
  twists), and builds one even when zero twists are asked. It is the lead
  if the budget is missed; otherwise it waits for H2's measurement.
- The withdrawn spec's readiness handshake and "took more than 10
  seconds" message. With the engine bounded the limit is unreachable with
  permitted settings, and H2 removes the worker it would have guarded.
- A Stop button beside "Working…".

### 2.8 What does not change

`generator.ts` and `worker.ts` stay as they are until H2, with the
ten-second limit as a net that nothing permitted reaches. The debounce,
the single waiting slot, superseding and the 300 ms replacement of a busy
worker (L3) are untouched. The CLI has no worker and changes only through
the shared constants and the sentence check.

## 3. What changes

- `src/lib/validation.ts`: `MAX_LENGTH = 128`.
- `src/lib/fromSentence.ts`: `TARGET_LENGTH_RANGE.max` from `MAX_LENGTH`;
  `finish()` returns a draft without scores; the batch loop scores a draft
  after the duplicate check; `MAX_ATTEMPTS_PER_SUGGESTION = 3`; the
  sentence cap thrown before normalising; the header comment's step list
  updated.
- `src/lib/strength.ts`: `collapseBlocks` as §2.4.
- `src/lib/text.ts`: `sentenceLengthProblem(sentence): string | undefined`
  beside `MAX_SENTENCE_LENGTH`.
- `src/cli/generate.ts`: `sentenceProblem` uses it in place of its own
  check and wording.
- The one place a length did not read the constant: `LOOSEST` in
  `src/cli/constraints.ts`, the wizard's "rules out least" value.
- Prose that repeats 256: `README.md` line 37; `docs/algorithm-flow.md`;
  the comments at `src/lib/ruleText.ts:33`, `src/components/SiteRules.tsx:33`
  and `src/cli/resolve.ts:95`; the Fun page's prompts, `cliPrompt.ts` and
  `specPrompt.ts`, where the sentences that carried the literal now carry
  the constant.
- Tests that assert the literal 256 (`validation.test.ts`,
  `cli/fields.test.ts`, `cli/messages.test.ts`, `cli/config.test.ts`,
  `cli/generate.test.ts`, `cli/wizard.test.ts`, `cli/constraints.test.ts`,
  `RequirementsForm.test.tsx`) read 128; `src/lib/testTitles.json` is
  regenerated.
- Docs: this spec's status and §5 measurement; the checklist.

No change to `generator.ts`, `worker.ts`, `engine.ts`,
`PasswordsProvider.tsx` or `App.tsx`.

## 4. Tests

- `validation.test.ts`: a length of 128 is taken, 129 refused, and the
  message names 128. `ruleText.test.ts`: "exactly 200 characters" is not
  kept, naming 128. `settingsStore.test.ts`: a stored maximum of 200 is
  repaired to the default and reported.
- `fromSentence.test.ts`: `scoreCold` and `strengthBits` run exactly once
  per suggestion returned, with the score and strength modules spied as
  `FunPage.test.tsx` and `prompter.test.ts` already spy on modules. A
  one-word sentence with no twist, initial, digit or symbol rule, asked
  for 20, returns one suggestion with the variety warning after exactly
  60 attempts, counted through a spy on `applyTwists`, which such an
  attempt calls once. Every suggestion's fields are the same as before
  the split: the existing field-by-field tests stand.
- `strength.test.ts`: the new `collapseBlocks` gives the same text and
  repeats as the old on 2,000 random strings over a three-letter alphabet
  up to 40 characters and on the existing cases; the old implementation
  lives in the test as the oracle.
- `src/lib/text.test.ts` (new; `text.ts` has no test file today): 500
  characters are taken, 501 refused, and the message names both lengths.
  `fromSentence.test.ts`: the engine throws it as a `RequirementsError`.
  `src/cli/generate.test.ts`: the stdin-too-long case expects the shared
  wording.

## 5. For the record

Why not keep the worker's timeout as the fix? The withdrawn spec answered
a slow worker with a message and a fresh worker, which is honest but
leaves a four-second batch four seconds long. The profile shows the
batch should take a quarter of a second, and once it does the timeout
path has nothing to catch; building it would be work that H2 deletes.

Why three attempts per suggestion and not ten? Ten was never measured.
Every sentence with variety to spare found its suggestions in one attempt
each; the attempts past three per suggestion were spent on sentences
that had run out, and the warning already says so.

Why 128? The user's decision; it halves the longest password and takes
the Strength scan from 17.8 ms to 2.5 ms per call before §2.4 lands. No
site preset asks for more, and the longest rule the presets carry is
well under it.

Measured when built, 2026-10-21, same desktop and bench, median of five
(the worst single run of the first case was 296 ms, the rest within a
tenth of their median):

| Sentence | Maximum | Count | Before | After |
| --- | --- | --- | --- | --- |
| 500 characters | 128 | 20 | 769 ms | 152 ms (16 found) |
| 250 characters | 128 | 20 | 885 ms | 224 ms |
| 500 characters | 32 | 20 | 426 ms | 122 ms (16 found) |
| 60 characters | 32 | 20 | 102 ms | 40 ms |
| 60 characters | 32 | 5 | 26 ms | 10 ms |
| 500 characters | 128 | 5 | 40 ms | 46 ms |
| 500 characters | 256 | 20 | 3,631 ms | no longer permitted |

The budget of §2.6 is met: the worst permitted case is under 300 ms.
A batch of five, the default, is unchanged within noise: it never spent
attempts on repeats. `strengthBits` on random letters went from 2.5 ms
to 0.17 ms at 128 characters, 17.8 ms to 0.35 ms at 256, and 133 ms to
1.1 ms at 500 (the typing test's worst case). The preset generator is
untouched at about 40 ms warm. These are the figures H2 is decided on.
