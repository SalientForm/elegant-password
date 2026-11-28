---
state: draft
summary: >
  Seven steps to one sentence box: one check for every configuration, one engine entry, drawn sentences fitted when
  they do not fit, the drawing options on the user's own sentence, the web app's one box, tep and the package, and the
  documentation.
spec: docs/specs/2026-11-26-one-sentence-design.md
---

# Plan: one sentence, one box, one set of options

Implements `docs/specs/2026-11-26-one-sentence-design.md`. Ordered with
the core package plan (`docs/plans/2026-11-18-core-package-plan.md`) by
the spec's decision 4: S1 goes on the core package's branch before its
P5; S2 to S6 come after P5 and before P6; S7 comes with P8. Each step ends
green on `pnpm typecheck` and `pnpm test`; S5 and S7 also on
`pnpm test:e2e`. Until S5 the web app keeps its two tabs, mapped onto the
one entry.

## S1 One check (spec §6)

On `feature/core-package`, so the package ships with it.

- `src/lib/consistency.ts`: the gate is `ruleProblems`. `planProblem`
  becomes a warning, `drawWarning(req)`, on the fields it names:
  "Generate cannot draw a sentence that fits these rules. Type your own
  sentence." (S3 rewords it once the nearest one is fitted.)
  `warningsOf` gives the target warning and the drawing warning.
  `problemsOf` goes once nothing calls it.
- The package: `resolveConfig` refuses on `ruleProblems` and warns on
  `warningsOf`, each with its keys. `generate` with no sentence returns
  the planner's problem as its own, as today.
- `tep g` (`src/cli/generate.ts`): the same check with or without
  `--sentence`; the target and drawing warnings print only when drawing.
  `src/cli/messages.ts` and `src/cli/constraints.ts`: the wizard refuses
  an answer only for a rule problem and says the drawing warning for the
  rest. The Fun page's CLI prompt (`src/prompts/cliPrompt.ts`) and the
  rebuild prompt (`src/prompts/specPrompt.ts`) name the new calls.
- Tests: `consistency.test.ts`; `api.test.ts` (rules that cannot be drawn
  resolve with a warning on `rules.min-length` and `rules.max-length`,
  and `generate` without a sentence fails while `generate` with one
  succeeds); `tep g`'s message tests, the wizard's constraint tests.

## S2 One engine entry (spec §5.1)

A change of shape, with no change in what is generated.

- `src/lib/engine.ts`: `GenerateInputs.sentence` is
  `GeneratedSentence | string | null`; `mode`, `generated` and `edited`
  go, and with them `Mode` and `MODES`. `Outcome.source` is
  `'drawn' | 'own'`. `inputsKey` keys on the sentence.
- `src/lib/pipeline.ts`: `GenerationSettings` loses `mode` and
  `editedSentence` and gains `sentence: GeneratedSentence | string | null`;
  `inputsFor` passes it through.
- Callers: the package's `generate`, `tep g` and the wizard, and the web
  app's `PasswordsProvider`, which builds the sentence from its open tab
  (the typed sentence, the edited text, or the drawn sentence) until S5.
  `SuggestionCard` and the strength panels read the new `source`.
- Tests: the engine and pipeline tests move to the new shape;
  `inputsKey`'s tests keep their cases (typing in a box that is not used
  does not change the key, now because the sentence is one value).

## S3 Drawn sentences take the fitting options (spec §4, §5.3, §5.4)

- `src/lib/generate.ts`, `keptSentence`: a kept sentence that cannot be
  built as drawn returns no candidate rather than throwing, and
  `runInputs` fits its words with `fromSentence`, adding "The rules
  changed since this sentence was drawn, so it was fitted like your own
  and its bits are estimated. Draw a new sentence for exact bits."
  Source `'own'`, no `plan`.
- `plan` with no fitting candidate returns the nearest: the smallest shape
  when the window is too short, the one with the most letters when
  letters run short, and `runInputs` draws it and fits it as above, with
  "No sentence the tool draws fits these rules, so the nearest was fitted
  and its bits are estimated." Only `fromSentence`'s own failure fails.
  `drawWarning` takes S1's place: "Generate cannot draw a sentence that
  fits these rules exactly, so it fits the nearest one and estimates its
  bits."
- Compress toward N for a drawn sentence: the planner cuts each shape's
  window to the lengths nearest N that the rules allow, and the bits are
  counted over that window. With N set, Shortest does not cut the window
  (decision 2).
- Tests: a kept sentence after `min-digits` rises and after
  `max-length` falls (fitted, warned, no bits); rules of 8 to 10
  characters draw and fit; too few letters and no closing symbol do the
  same; rules even fitting cannot meet still fail; Compress toward N moves
  a drawn sentence's length and its exact bits; Shortest is ignored with
  N set. The engine's budget tests (`docs/decisions.md`, "Where generation
  runs") still hold for the new paths.

## S4 The user's sentence takes the drawing options (spec §4, §5.2)

In `src/lib/fromSentence.ts`, each a step in the order its header comment
lists, each counted in the estimate as random initials are, and each
skipping the letters the uppercase and lowercase rules need:

- Leading number: a number drawn as the drawing engine draws its number
  slot goes first, unless the sentence has a number.
- Shorthand: `req.shorthand` random words of four or more letters are
  typed as their first and last consonant; the hint keeps the word.
- Made-up nouns: `req.madeUp` words found on `NOUNS` (`words.ts`) become
  made-up nouns of at most two key rolls, drawn as the drawing engine
  draws them; the hint shows the made-up noun. Fewer nouns than asked
  warns.
- Shortest: with no Compress toward N, the sentence is compressed toward
  the shortest length whose estimate reaches the target.
- Tests: each option on a typed sentence and on an edited drawn one;
  each estimate figure; none of them breaking an uppercase or lowercase
  rule; the warning for a sentence with no nouns; N winning over
  Shortest. At Ten-finger's profile (made-up nouns 0, shorthand 0) a
  typed sentence comes out as today. Two-finger and One-handed set
  shorthand to 1, so a typed sentence in those modes now gets one
  shorthand word: their tests change, and the change is said in S7's
  decisions entry.

## S5 The web app: one box (spec §3, §7)

- `src/App.tsx`: the Source text card holds the box with Copy and New
  sentence; `MODE_TABS`, the tabs and their panels go. Refresh draws
  first when the box is empty. "About this sentence" is rewritten for one
  box.
- `src/components/SentenceMode.tsx`: `GeneratedSentenceField` becomes the
  box; `SentenceInput`'s options become `FittingPanel` in the Options
  column after Style, under "These act whenever a sentence does not fit
  as it is: one you typed or edited, or a drawn one the rules have
  changed under." With Compress toward N set, Shortest shows as
  overridden (`RequirementsForm.tsx`).
- One strength panel: exact for a drawn sentence
  (`StrengthPanel.tsx`) and estimated for the user's (`SentenceStrength`
  folded in), its heading saying which. The swaps panel disables the
  swaps the sentence cannot use for any sentence in the box.
- `src/state/PasswordsProvider.tsx`: the draft holds `sentence` (the box's
  text) and `drawn`; the sentence passed to the engine is `drawn` while
  the text is its words, and the text otherwise. `setMode`,
  `setEditedSentence` and `setSentence` become one `setSentence`;
  `newSentence` draws into the box. `src/state/sessionStore.ts` reads a
  session saved before once: the open tab's sentence goes in the box, and
  the open-tab key goes.
- `src/prompts/specPrompt.ts` describes one box.
- Tests: `App.test.tsx`, `App.renders.test.tsx`,
  `PasswordsProvider.test.tsx`, `SentenceMode.test.tsx`, the session
  store's reading of an old session, and the e2e smoke (draw, edit, type,
  clear and submit).

## S6 `tep` and the package (spec §8)

- `src/lib/config/fields.ts`: the `sentence` fields' descriptions say
  they act whenever a sentence does not fit as it is, drawn included; the
  comment naming "Custom Sentence" goes. `tep config`'s comments and the
  package's `FIELDS` follow from it.
- The package: a `DrawnSentence` the rules no longer fit comes back fitted
  without `bits`, and the outcome carries no `sentence` for it; the
  `generate` docs say so. `packages/core/README.md` (from P5) follows.
- `tep g`: help and messages lose the two-mode wording ("your sentence
  cannot be made to fit" stays for a fitting failure, whichever sentence).
- Tests: `api.test.ts`, `src/cli/resolve.test.ts`, `tep`'s help and
  message tests, `src/lib/testTitles.json` regenerated.

## S7 Documentation (spec §9)

With the core package plan's P8.

- README: the sentence card and the Fitting card, and that every option
  works on every sentence.
- `docs/algorithm-flow.md`: one entry, the fitted drawn sentence, the
  drawing options on the user's sentence.
- `docs/decisions.md`: one sentence box and the four decisions of the
  spec's §11, with the date.
- `TODO.md`: "One sentence mode" goes.
- The spec, this plan and their reviews are deleted.
