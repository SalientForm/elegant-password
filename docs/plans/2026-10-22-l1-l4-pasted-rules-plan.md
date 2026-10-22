# Plan: L1 and L4, the pasted rules

Implements `docs/specs/2026-10-22-l1-l4-pasted-rules-design.md`, on
`feature/audit-low` at `c28f0f2`. Each step ends green on
`pnpm typecheck` and `pnpm test`; the last also on `pnpm build`,
`pnpm build:cli` and the e2e suite (`flock /tmp/ep-e2e.lock pnpm test:e2e`).

## L1.1 The core reads a choice

- `src/lib/ruleText.ts`: "A-Z", "a-z", "0-9" named in `normalise`
  before lowercasing; a choice trigger (count of kinds) per clause, its
  members from the clause or the lines under it; "or" chains; choices
  kept in `Found.choices`, resolved in `finish` (letters, already met,
  then lowercase, uppercase, digit, symbol; ruled-out kinds skipped), one
  understood line each, the failures in `unsupported`.
- `src/lib/ruleText.test.ts`: the wordings as cases; the two old cases
  corrected; a property over the choice cases.
- `pnpm test:titles`.

## L4.1 The cap in the core

- `MAX_RULES_TEXT_LENGTH`, `rulesTextLengthProblem`, and the guard in
  `parseRuleText`; tests.
- Re-measure at the cap with the choice reading in
  (`.claude/scratch/l1/measure.test.ts`).

## L4.2 The web box

- `src/components/SiteRules.tsx`: the memoised, timed reading; the
  one-entry memo shared with fill; `maxLength`; the refused paste and the
  full-box hint.
- `src/components/SiteRules.test.tsx` (new), the "3 of 4" fill in
  `RequirementsForm.test.tsx`; `pnpm test:titles`.

## L4.3 tep

- `src/cli/resolve.ts`: `--rules` past the cap is a usage error.
- `src/cli/wizard.ts`: the paste prompt's validation refuses it.
- `src/cli/flagList.ts`: the cap in `--rules`'s description.
- Tests in `generate.test.ts`, `resolve.test.ts`, `wizard.test.ts`.

## L1-L4.4 Smoke and words

- `e2e/smoke.spec.ts`: a pasted "3 of 4" fills in three kinds; the
  textarea's `maxLength`.
- The prompts (`src/prompts/specPrompt.ts`, `cliPrompt.ts`) say what the
  code does, the cap interpolated.

## L1-L4.5 Documentation

Decisions into the README, `docs/algorithm-flow.md` and
`docs/decisions.md`; the spec and plan deleted; rows L1 and L4 built
with where the decisions are and the commits.
