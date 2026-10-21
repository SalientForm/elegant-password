# Plan: Strength's word names its band

Implements `docs/specs/2026-10-21-m3-strength-word-design.md` on
`feature/audit-medium`. Written 2026-10-21. Each milestone ends green on
`pnpm typecheck` and `pnpm test` and stands on its own as a commit;
milestone 2 is documentation alone. Line numbers are at commit `b9b5e65`.
Nothing here touches `src/lib/generate.ts` (M1) or
`src/components/TypingTest.tsx` (M2).

## 1. The word follows the band (spec §2, §8)

- `src/lib/readings.ts`
  - Line 6: the `STRENGTH_PRESETS` import goes.
  - Line 14: the comment says green from 50 bits, yellow from 40, red
    below, naming no preset.
  - Lines 17-23: `export const STRENGTH_WORDS: Record<Band, string> = {
    high: 'high', mid: 'fair', low: 'low' }` and
    `export const strengthWord = (bits: number) =>
    STRENGTH_WORDS[strengthLevel(bits)]`, with a comment saying the word
    is the band's, never a preset's: the presets are targets for the bits,
    which assume an attacker who knows the tool.
  - Line 67 is unchanged; it already calls `strengthWord(shown)`.
- `src/lib/score.ts:422`: the comment on `STRENGTH_BANDS` gives the
  thresholds without the preset names.
- `src/components/ScoringPage.tsx:54-56`: the sentence of spec §2.2,
  printing `STRENGTH_BANDS.green`, `STRENGTH_BANDS.yellow` and the three
  words from `STRENGTH_WORDS` (imported from `../lib/readings`), in the
  order green, yellow, red.
- `src/prompts/specPrompt.ts`
  - Line 90: "the badge tip still reads "weak" below 40" becomes "the
    badge reads low (red) below 40".
  - Line 283: the example tip "Strength 63 bits, high: …" and the
    bracket "(the band's word: high from 50, fair from 40, low below;
    never a preset, which are targets for the bits)", the words and
    thresholds interpolated from `STRENGTH_WORDS` and `STRENGTH_BANDS`.
- `src/lib/readings.test.ts`
  - Line 3: import `STRENGTH_WORDS`; import `STRENGTH_PRESETS` from
    `./generate` for the new test.
  - Lines 17-29: the test becomes "is green from 50 bits, yellow from 40,
    red below, and says high, fair or low": `strengthWord` of 72 and 50
    is `high`, of 49 and 40 `fair`, of 39, 12 and 4 `low`.
  - New, in "strength badge": "names its band and never a preset, at
    every figure from 0 to 256": for each integer n,
    `strengthWord(n)` equals `STRENGTH_WORDS[strengthLevel(n)]` and is
    not any `STRENGTH_PRESETS` label in lower case.
  - Line 37: the expected text reads "Strength 49 bits, fair: …".
  - Line 46: `/^Strength 50 bits, high:/`.
- `src/components/SuggestionCard.test.tsx:79` and
  `src/components/SelectedList.test.tsx:44`: the alternation becomes
  `(high|fair|low)`.
- `src/App.test.tsx`, in "has a Scoring page with the rubric and the bits
  explanation, and keeps the typing test and list in the right column"
  (line 339): after line 351, the page has text matching
  `/its tip says high, fair or low/` and no text matching
  `/green from the Strong preset/`.
- `pnpm test:titles` (the renamed and new tests in
  `src/lib/testTitles.json`, around line 3139).
- Check: `pnpm typecheck`, `pnpm test`; `pnpm test:e2e` (no e2e test
  names the words; run it to be sure the tips still open).
- Commit: "The Strength badge's word names its colour band, never a
  preset (M3)".

## 2. The documentation carries the decision; the spec goes (spec §2, §5)

- `docs/decisions.md`, section "Scoring", after the bullet "The bits
  panel's green means …": a bullet "**Strength's word names its colour
  band, never a preset** (2026-10-21, M3)": the presets are targets on
  the bits' ladder, for an attacker who knows the tool; Strength assumes
  less and reads above the card's bits by 14 bits at the median at the
  defaults, where 99.8 % of suggestions were named a preset above the
  one chosen and 37 % of batches showed "master password". The tip says
  high (50 or more), fair (40 to 49) or low, read off the same rounded
  figure as the colour. `src/lib/readings.ts`. The user's answers to the
  spec's open questions are recorded in the same bullet.
- `docs/algorithm-flow.md` §4: under the table (after line 149), one
  sentence: the Strength badge is green from 50 bits, yellow from 40, red
  below, and its tip names the band (high, fair, low); the presets are
  targets for the bits and never describe Strength.
- `README.md`, the bullet "Three strength figures, by what the attacker
  knows" (lines 24-35): a sentence after "it is never saved": Strength's
  tip reads high, fair or low by its colour; the presets, Everyday to
  Master password, are targets for the bits.
- Delete `docs/specs/2026-10-21-m3-strength-word-design.md` and this
  plan.
- `docs/audits/2026-10-21-audit-checklist.md`, row M3: status
  **built**, the Spec column "`docs/decisions.md`, "Strength's word
  names its colour band" (the spec and plan folded in and removed);
  commit <hash>, 2026-10-21". If the user takes the spec's §6 as a row,
  it is added to the Low table then, with its measurement.
- Check: `pnpm typecheck`, `pnpm test` (the Fun page's spec prompt reads
  `docs/algorithm-flow.md` raw, so the test run covers the edit).
- Commit: "M3 built: the decision is in decisions.md, the spec and plan
  go".
