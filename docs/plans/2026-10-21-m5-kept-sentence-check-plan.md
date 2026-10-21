# Plan: a kept sentence is one the tool could have drawn

Implements `docs/specs/2026-10-21-m5-kept-sentence-check-design.md` on
`feature/audit-medium`. Written 2026-10-21. Each milestone ends green on
`pnpm typecheck` and `pnpm test` and stands on its own as a commit;
milestone 3 is documentation alone. Line numbers are at commit `b9b5e65`.
M1 of the audit edits `src/lib/generate.ts` before this lands (it shifts
`keptSentence` by about 26 lines in the working tree), so each change
there names its function too.

## 1. The check, and the engine's refusal (spec §2.1, §2.3)

- `src/lib/grammar.ts`, after `RAW_POOLS` (`:190-198`):
  `export function isListWord(slot: Exclude<Slot, 'num'>, word: string): boolean`,
  over one `Set` per slot built from `RAW_POOLS` on first use. Its
  comment: the word as written, on its slot's full list, before any
  comfort share is taken.
- `src/lib/generate.ts`:
  - Imports: `isListWord` into the `./grammar` block (`:5-23`, which
    already has `isMadeUpNoun`, `numberPlacements`, `templates` and
    `Slot`); `MAX_DIGITS` into the `./validation` import (`:33`).
  - After `same` (`:808`), before `keptSentence`: `export function
    couldBeDrawn(slots: readonly Slot[], words: readonly string[]):
    boolean`, with a lazily built `Set` of every shape as
    `slots.join(' ')` (each template from `templates()`, bare and with
    each of `numberPlacements(t)`). False when the lengths differ or the
    shape is not in the set; then per slot: `num` matches `/^[1-9]\d*$/`,
    is at most `MAX_DIGITS` long and is at least 2; a `noun` that
    `isMadeUpNoun` passes only while no real noun has come before it;
    every other word `isListWord(slot, word)`. The comment says it is the
    set of sentences some settings draw, and why it is here rather than
    in `grammar.ts` (spec §2.1).
  - `keptSentence` (`:816-847`): after `doesNotFit` (`:819-820`), a
    `RequirementsError` with the message of spec §2.3, thrown when
    `!couldBeDrawn(sentence.slots, sentence.words)`; the comment above the
    function gains "and must be one this tool could have drawn". The
    `templates().find(...)` at `:824` takes a `!`, and `:825` goes (its
    shape branch cannot fire now; its length test is in `couldBeDrawn`).
- `src/lib/generate.test.ts`:
  - Imports (`:2`): `couldBeDrawn`; `runInputs` from `./engine`.
  - "meets every rule across random requirement combinations" (`:248`):
    after `generated++` (`:279`),
    `expect(couldBeDrawn(g.sentence.slots, g.sentence.words), JSON.stringify(g.sentence)).toBe(true)`.
  - "a kept sentence" (`:432-465`), new: "is refused with the way out,
    not a crash, when the tool could not have drawn it": `{ slots:
    ['num', 'adj', 'noun', 'adv', 'verb', 'adj', 'noun'], words: ['42',
    'sleepy', 'otters', '', 'paint', 'rusty', 'boats'] }` with
    `initials: 1` throws a `RequirementsError` matching `/not one this
    tool makes.*Draw a new sentence/`; the same through `runInputs` gives
    `ok: false` and no `unexpected`.
  - "made-up nouns and real words" (`:577`), new: "could have drawn only
    a known shape with every word on its slot's list": `kept` from
    "a kept sentence" and the `pods` sentence pass; fail: the slots and
    words of each row of the spec's §1 table, `Otters` in a noun slot,
    `seise` in a verb slot, `07`, `1` and `12345` as the number, a
    made-up noun (`dfg`) after a real noun, `dfg` in a verb slot, `and`
    anywhere but the joiner.
- `pnpm test:titles`.

## 2. The store drops one it could not have drawn (spec §2.2)

- `src/state/sessionStore.ts`:
  - `:10`: `couldBeDrawn` beside `ROLE_LABELS`.
  - `isGeneratedSentence` (`:96`): a comment that it checks the record's
    shape, which is all the outcome's own copy needs (`isOutcome`,
    `:114`: never read back after a load).
  - `parseSession` (`:123-124`): `generated` kept only when
    `isGeneratedSentence(raw.generated) && couldBeDrawn(raw.generated.slots,
    raw.generated.words)`; the comment names the cases: a sentence that
    does not parse, or that the tool could not have drawn (a word off its
    lists, an empty word), is dropped on its own and the app draws a new
    one.
- `src/state/sessionStore.test.ts`:
  - "keeps the made-up sentence, and drops only that when it is
    malformed" (`:32`) and "keeps an edit to the made-up sentence only
    alongside that sentence" (`:42`): the fixture `adj noun` becomes
    `{ slots: ['noun', 'verb', 'noun'], words: ['otters', 'paint',
    'boats'] }`.
  - New, after `:40`: "drops a kept sentence the tool could not have
    drawn, and keeps the rest of the session": for `42 password password
    pasword` and `85`, empty, `cadets otters` (`num noun verb noun`),
    with `edited` set, `parseSession` keeps `key`, `round`, `sentence`
    and `outcome` and has no `generated` or `edited`; `loadSession` on a
    store holding it returns the session and leaves the key in the store.
- `src/state/PasswordsProvider.test.tsx`, new, after "keeps the made-up
  sentence through Refresh, ..." (`:164`): "draws a new sentence on load
  when the stored one is not one the tool makes, keeping the user's own
  sentence". Mount and settle; unmount; write back the stored session
  with `sentence: 'my secret sentence'` and the empty-word sentence as
  `generated`; mount again with the same stores, wait for one run (the
  stored batch is on screen until it lands), then settle: that run has
  `generated` null; `text('sentence')` is neither empty nor the
  stored words; `text('error')` is empty; the stored session's
  `sentence` is `'my secret sentence'` and its `generated` is the sentence
  on screen.
- `src/prompts/specPrompt.ts:341`: "a malformed one is dropped on its own
  and a new one drawn" becomes "a malformed one, or one the tool could
  not have drawn (a word off its slot's list, an empty word, a shape it
  never makes), is dropped on its own and a new one drawn".
- `pnpm test:titles`.

## 3. The documentation carries the decisions; the spec goes

- `docs/decisions.md`, "Input and persistence", after the bullet at
  `:158` ("A stored session that does not parse is removed"): **A kept
  sentence is one the tool could have drawn** (2026-10-21): a template's
  shape, bare or with its number placed; each word as written on its
  slot's full list, whatever the comfort, so a change of comfort never
  refuses it; a number from 2 to 9999 without a leading zero; made-up
  nouns before the first real noun. A stored one that is not is dropped
  on its own and a new one drawn, not repaired: it is the app's draw, not
  the user's choice, and a repaired sentence is a different one. The
  engine refuses one too, naming the button that recovers, so an empty
  word no longer crashes it. The outcome's copy is checked for shape
  only, as nothing reads it back. The price: a release that changes the
  word lists replaces the kept sentence of a tab open across it.
  `couldBeDrawn` in `src/lib/generate.ts`; `src/state/sessionStore.ts`.
  The answers to the spec's open questions go in the same bullet if the
  user took another way.
- `docs/algorithm-flow.md` §2, the paragraph at `:90-97`: one sentence
  before its last, "A kept sentence must be one the tool could have drawn
  (a shape it makes, every word on its slot's list); one that is not is
  refused, and on load it is dropped and a new one drawn." §6, after the
  bullet at `:199`: "Every drawn sentence is one the tool could have
  drawn, and a stored one that is not is dropped, never built
  (`generate.test.ts`, `sessionStore.test.ts`)."
- `README.md:253-255` ("Hardened"): after "a stored session that does not
  parse is removed on load", ", and a kept sentence the tool could not
  have drawn is dropped and a new one drawn".
- `docs/audits/2026-10-21-audit-checklist.md:37`: M5 to **built**; the
  Spec column: `docs/decisions.md`, "Input and persistence" (the spec and
  plan folded in and removed), the commits of milestones 1 and 2,
  2026-10-21.
- Delete `docs/specs/2026-10-21-m5-kept-sentence-check-design.md` and this
  plan. The spec's reproductions and the sweep's figure (703 draws, all
  passing) are history and go with it; the random-combination test holds
  the sweep's claim.
