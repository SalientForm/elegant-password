# Plan: M1, the opening capital is a word's first character

Implements `docs/specs/2026-10-21-m1-capital-first-design.md`. Written
2026-10-21 at commit `b91a253`. Each milestone ends green on `pnpm
typecheck` and `pnpm test`.

## M1.1 The capital chosen before the swaps

- `src/lib/generate.ts`: split `applyUppercase` (line 745) so the
  word order it builds is `capitalOrder(words, fixedCase, rng,
  nearShift)`, exported; `applyUppercase` uses it. `generateOnce`
  works out `capitalAt` once per batch from `typed` (one capital
  needed, none in the words), passes it to `applyTwists` (line 949) in
  place of `protectFirstLetter`, and to `render` (line 958), which puts
  the capital on that word's first character.
- `src/lib/twists.ts`: `TwistOptions.protectFirstLetter` (line 92)
  becomes `capitalAt?: number`; `buildTable` (line 222) protects that
  position. `src/lib/fromSentence.ts:513` drops `protectFirstLetter:
  false`.
- `src/lib/score.ts:500`: the protected position is the first twistable
  word matching `/^[A-Z][a-z]/`.
- Tests: `generate.modes.test.ts` "the opening capital is a word's
  first character, with Shift reach on and off"; `twists.test.ts`
  "respects skip, the capital's word and the length limits" (renamed,
  with a second word whose start is swapped); `score.test.ts` "counts
  the start of the word with the capital as protected wherever it is";
  the `protectFirstLetter: true` options in `score.test.ts` become
  `capitalAt`.

## M1.2 Documentation

The decision goes into `docs/algorithm-flow.md` (generated mode's order
of steps) and `docs/decisions.md` ("Generation"); the spec and this plan
are deleted; the checklist row is marked built with the commit.
