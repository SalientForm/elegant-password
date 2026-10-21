# A kept sentence is one the tool could have drawn

Status: **proposed**, 2026-10-21. Acts on item M5 of
`docs/audits/2026-10-21-audit-checklist.md`: "A kept sentence is never
checked against the word lists, and empty words pass validation". Line
numbers are at commit `b9b5e65`; M1 is editing `src/lib/generate.ts` at
the same time, so functions are named as well.

## 1. The problem

A made-up sentence is kept from batch to batch (`GeneratedSentence`: its
slots and its words as written) and stored in sessionStorage with the
session. Two places read it, and neither asks whether the tool could
have drawn it:

- `src/state/sessionStore.ts:96`, `isGeneratedSentence`, checks the
  record's shape only: two string arrays of the same, non-zero length and
  known slot names. `parseSession` (`:124`) keeps whatever passes, and
  drops only a sentence that fails, on its own.
- `src/lib/generate.ts:816`, `keptSentence`, checks the sentence against
  the rules: its number, its made-up nouns, its template (`:824-825`),
  its length. It never looks at the words. They then become the hint of
  every card (`generateOnce`, `:913`), and the strength panel shows the
  plan for the template as if they were drawn from its lists.

Reproduced at the defaults through `parseSession` and `runInputs` (a
scratch test under `.claude/scratch/m5/`). Every record below is kept by
`parseSession` today.

| Stored slots and words | What the engine does |
| --- | --- |
| `num noun verb noun`: `42 password password pasword` | Builds it: `42;P@ssw0rd;password;pasword`, hint "42 password password pasword"; the strength panel reads 33.9 bits for a template none of these words is from |
| `num noun verb noun`: `85`, empty, `cadets otters` | Builds one card, `85;;Cadets;otters`: two separators run together, memorability 99 |
| `num adj noun adv verb adj noun` with an empty adverb, initials 1 | `Unexpected error: Cannot read properties of undefined (reading 'toUpperCase')`: the initial is `w[0]!` of an empty word (`:838`) |
| `num noun verb noun`: empty number, `otters paint boats` | Builds `Ott3rs;paint;8oats`, a sentence with no number in its number slot |
| `num noun verb noun`: `abc otters paint boats` | Builds `Abc;ottas;paint;b0@ts` |
| `num noun verb noun`: `42 Otters paint boats` | Builds `42;Otter$;paint;boat5` |
| `num noun verb noun`: `42`, `sea otters`, `paint boats` | Builds `42;Sea otters;paynt;bo47s` |
| `num noun verb noun`: `42 paint otters boats` (a verb as a noun) | Builds `42;Paint;otters;bo4tz` |
| `noun num verb noun`, or two numbers | "no sentence of its shape fits 12-32 characters": the wrong reason |

The record comes from the app's own draws, which are always on the
lists (§4), so today a bad one is a hand-edited or foreign record. The
word lists have not changed since sentences were kept (2026-10-16); when
they next do, a tab open across the deploy holds a sentence with a word
the lists no longer have, and the same paths apply.

What it costs: an off-list word gets the plan's bits it was never
counted in, an empty word gives a password with a doubled separator or
crashes the engine, and a misplaced number gets a message that sends the
user to the length limits.

## 2. Decisions

### 2.1 What "could have drawn" means

A sentence is one the tool could have drawn, under some settings, when:

- **its shape is one the tool makes**: the slots are a template's, either
  bare or with one number placed where `numberPlacements` puts it. That
  is 352 shapes, from 64 templates.
- **every word is on its slot's list, as written**: the full list, before
  any comfort share is taken, since a kept sentence stays whatever the
  rules and a change of comfort must not refuse it. Lowercase `a-z` as
  the lists hold them; `and` for the joiner. Not a capitalised word, not
  a deliberate swap's spelling (`seise`): the sentence holds the words
  as written and the swaps are worked out again from them
  (`generateOnce` returns `pictured`, the plain spellings, at `:1005`).
- **a number is one some setting draws**: 2 to 99, or every number of up
  to `MAX_DIGITS` (4) digits, without a leading zero.
- **a made-up noun stands only in a noun slot, and only before the first
  real noun**, as `madeUpPositions` places them. Either case, as
  `MADE_UP_NOUNS` holds both.

An empty word fails on every slot, so "empty words pass validation" needs
no rule of its own.

The check is one function, `couldBeDrawn(slots, words)`, in
`src/lib/generate.ts` beside `keptSentence`, with a helper
`isListWord(slot, word)` in `src/lib/grammar.ts` over the lists it
already holds (`RAW_POOLS`). It lives in `generate.ts` rather than
`grammar.ts` because it needs `MAX_DIGITS`, and `grammar.ts` importing
`validation.ts` would add a path to the type-only cycle L12 names. It
takes the two arrays, not a `GeneratedSentence`, for the same reason.

### 2.2 On load: dropped on its own, as a malformed one is

`parseSession` keeps `generated` only when it passes
`isGeneratedSentence` and `couldBeDrawn`. A sentence that fails is
dropped on its own and its edit with it (`:125`); the session's key,
round, the user's own sentence and the stored batch stay. The provider
then starts with no kept sentence, the stored batch's key no longer
matches the inputs, and the first run draws a new sentence. This is the
existing convention for a malformed sentence (the comment at `:123`, the
spec prompt's "a malformed one is dropped on its own and a new one
drawn"), so nothing new is visible beyond a new sentence where the
broken one was.

`isGeneratedSentence` stays the shape check, and is still what
`isOutcome` applies to the outcome's own copy (`:114`). That copy is
never read back after a load (the provider takes the kept sentence from
`StoredSession.generated`), so checking its words would only turn a
stale word into the loss of the whole session, the user's own sentence
included.

### 2.3 In the engine: refused, with the way out

`keptSentence` refuses a sentence that fails `couldBeDrawn`, after
`plan(req)` (impossible rules keep their general message) and before the
rules' checks, with a `RequirementsError`:

> The kept sentence is not one this tool makes: its shape, or a word in
> it, is not from the tool's lists. Draw a new sentence with the button
> beside it.

The template lookup at `:824` can then not miss, so the shape branch of
`:825` ("its shape is not one this tool makes") goes and the words-length
test goes into `couldBeDrawn`: one wording for each thing. After §2.2 the
app never reaches this message; it holds the engine's contract for any
other caller (tests now, the CLI if it ever keeps a sentence), and it is
what turns the crash into a message.

### 2.4 Not repaired

A kept sentence is the app's own draw, not a value the user chose, so
there is nothing to keep of a bad one. Lowercasing `Otters`, reading
`seise` as `seize`, dropping an empty word or swapping an off-list word
for a drawn one each makes a different sentence from the one on screen,
which the user may have started to learn; a new draw says so honestly.
Stored settings are repaired because the user chose them
(`settingsStore.ts`); this is not that case.

## 3. Alternatives not taken

- **The engine alone.** A stale record would greet the user after a
  reload with an error and a button, where the store's convention is a
  quiet new draw.
- **The store alone.** It leaves the engine building any sentence it is
  given, the empty initial crashing it, and the shape checked in the
  engine but the words not. The check costs under a microsecond.
- **Remove the whole session.** One bad field would take the user's own
  sentence and the round with it.
- **Check against the current comfort pool.** It would refuse a kept
  sentence when the comfort setting changes, against the decision that a
  kept sentence stays whatever the rules.
- **Repair.** §2.4.

## 4. What users see, and what does not change

Users see a new sentence after a reload where the stored one could not
have been drawn, and never an unexpected error from a kept sentence. A
sentence the app drew always passes: 703 draws across 1,500 random
requirement combinations (every comfort, deliberate swaps on and off,
initials, two-letter words and made-up nouns 0-3) all pass the check of
§2.1 (the scratch sweep), and the random-combination test of
`generate.test.ts` keeps that true.

Not changed:

- The edited made-up sentence and the "Use my sentence" text: the user's
  own words, any text up to 500 characters, built by `fromSentence`.
- The stored batch: its cards are shown as stored until the first run
  replaces them; a hand-edited figure on them is not worked out again.
  Scores stay functions of the password and its hint, and bits stay
  session-only and unsaved.
- A kept word outside the current comfort share is kept; the strength
  panel's plan counts the pools of the current rules, as now.
- The CLI never passes a kept sentence.

## 5. The price

- The store's reading of a session now depends on the word lists: a
  release that removes a word, or moves one between lists, replaces the
  kept sentence of every tab open across it, without a word said.
- A hand-edited sentence in sessionStorage is never honoured. The way to
  change the words is the sentence box, whose edits are built as the
  user's own sentence.
- Two sets built once (2,242 words; 352 shapes) and under a microsecond a
  check, on load and once a batch.

## 6. Tests

- `generate.test.ts`, new: "could have drawn only a known shape with
  every word on its slot's list": a drawn sentence passes; each row of
  §1 fails, and so do a word with a leading capital, `seise`, `07`, `1`,
  `12345`, a made-up noun after a real noun and a made-up noun in a verb
  slot.
- `generate.test.ts`, "a kept sentence", new: "is refused with the way
  out, not a crash, when the tool could not have drawn it": the empty
  adverb at an initial throws a `RequirementsError` matching
  `/not one this tool makes.*Draw a new sentence/`, and `runInputs` gives
  `ok: false` without `unexpected`.
- `generate.test.ts`, "meets every rule across random requirement
  combinations": every drawn sentence passes `couldBeDrawn`.
- `sessionStore.test.ts`, new: "drops a kept sentence the tool could not
  have drawn, and keeps the rest of the session": the off-list and
  empty-word records of §1 lose `generated` and `edited` and keep key,
  round, sentence and outcome; `loadSession` leaves the record in the
  store. The two existing tests that use `adj noun` (not a shape the tool
  makes) move to a drawn sentence.
- `PasswordsProvider.test.tsx`, new: "draws a new sentence on load when
  the stored one is not one the tool makes, keeping the user's own
  sentence".

## 7. Open questions

1. **Say so, or not, when a stored sentence is dropped?** A notice such
   as "The kept sentence could not be read, so a new one was drawn" would
   explain the change after a reload. Recommended: no notice, as for a
   malformed sentence or session today; the only realistic trigger is a
   word-list change, and a new sentence is what the user sees either way.
2. **The engine's refusal: a requirements message or an unexpected
   error?** A sentence that reaches the engine undrawn is, after §2.2, a
   bug in the caller, which argues for `unexpected`. Recommended: a
   `RequirementsError`, as the shape check is now, since it names the
   button that recovers and the app does not reach it.
