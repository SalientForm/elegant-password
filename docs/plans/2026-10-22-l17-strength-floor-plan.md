# L17 plan: Strength reads non-English letters as non-English

Spec: `docs/specs/2026-10-22-l17-strength-floor-design.md`.

1. **Core** (`src/lib/strength.ts`): `VOWELS`, `CONSONANT_CHOICES`,
   `MIN_CONSONANT_WALK`, `VOWEL_STAND_INS`; `keyWalks` takes the shortest
   walk; `englishBits` (the reading as it was), `isNotEnglish` and
   `letterBits`; `strengthParts` works out which runs may be part of a
   swapped word (beside a digit, a vowel stand-in, or a symbol typed once
   with a letter on its far side) and reads letters through `letterBits`.
   The file's opening note says what Strength now knows.
2. **Unit tests** (`src/lib/strength.test.ts`): the three tests whose
   figures change (`fqrns`, `Sm@rt`, `CVB`) say the new rule; new tests
   for the consonant reading, walks of three, the one-letter-changed cap,
   the exemptions, y as a vowel, another script, never below the English
   reading, walks still low.
3. **Property tests** over seeded batches and the made-up noun list
   (`src/lib/strengthFloor.test.ts`): never below the exact figure in
   shortest plans; without made-up nouns, outside shortest, at most 2 %
   below the card's bits and never by more than 3 bits; the list's mean at
   least the pick. `pnpm test:titles`.
4. Commit: the code and its tests.
5. **Text**: the Scoring page (`src/components/ScoringPage.tsx`), the Fun
   page's app prompt (`src/prompts/specPrompt.ts`), interpolating the new
   constants; the README's scoring parts; the algorithm flow's table
   (section 4). Commit.
6. **Fold in**: the spec's decisions into `docs/decisions.md` (Scoring, a
   dated bullet with the figures), the algorithm flow and the README;
   `TODO.md` gets the open question (a card's bits in shortest plans); the
   L17 row set to built with where its decisions are and the commits;
   delete this plan and the spec. Commit.
7. **Checks**: `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm build:cli`, and the e2e suite through `flock /tmp/ep-e2e.lock
   pnpm test:e2e` (the Scoring page's text changes).
