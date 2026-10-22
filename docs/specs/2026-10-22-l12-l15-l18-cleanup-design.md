# L12, L15, L18: one home for the text helpers, the cycle broken, SessionControls tested, the named values shared

Audit rows L12, L15 and L18 of `docs/audits/2026-10-21-audit-checklist.md`.
Behaviour does not change: a seeded batch, the Fun page's two prompts, the
CLI's help and every message read the same, byte for byte, before and
after.

## 1. L12: duplicated helpers and the type-only cycle

### 1.1 The helpers

Every copy, found by grep on 2026-10-22:

| Helper | Copies |
| --- | --- |
| a count and its noun (`plural`) | `validation.ts`, `ruleText.ts`, `cli/messages.ts`; inline `n === 1 ? '' : 's'` in `generate.ts`, `fromSentence.ts`, `checks.ts`, `fluff.ts`, `components/TypingTest.tsx` |
| the comfort levels (`COMFORTS`) | `validation.ts` (from `COMFORT_SHARE`), `score.ts` (typed out) |
| first letter up (`capital`, `cap`) | `validation.ts`, `cli/constraints.ts`, `cli/wizard.ts`, `prompts/cliPrompt.ts`, `devStats.ts` (inline); `.replace(/^./, toUpperCase)` five times in `cli/messages.ts` |
| first letter down (`lowerFirst`, `lower`) | `cli/wizard.ts`, `cli/fields.ts`, `prompts/specPrompt.ts`; `.replace(/^./, toLowerCase)` in `cli/resolve.ts` |

Decisions:

- `plural`, `capitalise` and `lowerFirst` go in `src/lib/text.ts`, the
  core's import-free text module, so any module (the scorer, the
  validator, the CLI, the prompts, a component) can take them without
  pulling anything else in. `readings.ts` was the other candidate; it
  imports the difficulty and strength modules, so the validator and the
  checks taking a helper from it would draw those in.
- `plural(n, one, many = one + 's')` gives "1 digit", "3 digits"; the CLI's
  version, the most general of the three. `validation.ts`'s is the same
  with the default plural. `ruleText.ts` says "a digit" for one, a phrase
  with its article, so it keeps that one case at the call
  (`n === 1 ? one : plural(n, one, many)`); that line and the import are
  the only change to `ruleText.ts` (L1 is being built there at the same
  time).
- An inline `n === 1 ? '' : 's'` that is exactly `plural` is replaced; the
  ones that say something else ("a digit" / "At least 2 digits" in
  `checks.ts` and `generate.ts`, the rounded duration) stay.
- `COMFORTS` is exported from `grammar.ts`, which owns `Comfort` and
  `COMFORT_SHARE`: `Object.keys(COMFORT_SHARE)`, strictest first, as
  `validation.ts` built it. `score.ts`'s typed-out list was the same order.

### 1.2 The cycle

`generate.ts` imports `validation.ts` and `checks.ts`; both import the type
`Requirements` (and `checks.ts` `RequirementCheck`) back from
`generate.ts`. Type-only, so nothing loads twice, but the three modules
cannot be read or moved apart.

Decision: a new module, `src/lib/requirements.ts`, holds `Separator`,
`Requirements`, `DEFAULT_REQUIREMENTS` and `RequirementCheck`: the shape of
a set of rules, its defaults and the shape of one rule's check. It imports
only the type `Comfort` from `grammar.ts`. `validation.ts` and `checks.ts`
import from it; `generate.ts` imports from it and re-exports all four, as
it already re-exports `checks.ts` and `validation.ts`, so the sixty-odd
modules that import requirements from `generate.ts` keep their one import
and the public surface does not move.

### 1.3 The guard

`src/boundaries.test.ts` gains "src/lib has no import cycle, type-only
imports included": a depth-first walk over every non-test file in
`src/lib`, following each relative import (type-only ones too, since the
cycle that prompted this was one), failing with the chain of each cycle
it finds (`a.ts -> b.ts -> a.ts`). It uses the test's own `importsOf` and
`resolveImport`; no dependency is added. If the rest of `src` is free of
cycles too, the walk covers all of `src`, so a front end cannot grow one
either.

## 2. L15: SessionControls

`src/components/SessionControls.test.tsx`, jsdom and Testing Library like
the other component tests, inside the real `PasswordsProvider` with
in-memory stores (as `SelectedList.test.tsx` and `ApplyBar.test.tsx` do),
so the test reads what the user sees from the provider's real state:

- each of the three places the session is kept says so: saved (the app's
  origin), memory only (`persistSecrets={false}`), and failed (a session
  store whose writes throw), with Try saving again shown only for the last;
- Forget asks first: one click turns the button into "Really forget?",
  leaving the session alone; a second forgets it (the sentence cleared,
  the session epoch moved on) and the status says so; leaving the button
  (blur) cancels the question;
- Try saving again, once the store accepts writes again, saves the session
  and the button goes.

Coverage before: 50 % of lines (lines 33-38, the click handler and the
retry, never run).

## 3. L18: the values the front ends name

| Value | Constant | Owner, and its own use |
| --- | --- | --- |
| the number, 2-99 | `NUMBER_RANGE = { min: 2, max: 99 }` | `grammar.ts`: `numbers()` builds the pool from it |
| word lengths, 3-8 | `WORD_LENGTH_RANGE = { min: 3, max: 8 }` | `words.ts` (the lists are data; `words.test.ts` holds them to it, and `grammar.ts` cuts the made-up nouns to the same lengths with it) |
| draws per card, 10 | `DRAWS_PER_CARD = 10` | `generate.ts`: the batch loop's limit |
| redraws, 8 | `REDRAWS = 8` (exported) | `generate.ts`: `generate()` |
| custom swap length, 8 | `MAX_MAPPING_LENGTH = 8` | `twists.ts`: `validateMapping` (the audit named `mappingSettings.ts`; the check is in `twists.ts`) |

The ranges follow `SHRINK_FROM_RANGE` and `TARGET_LENGTH_RANGE` in
`fromSentence.ts` (`{ min, max } as const`).

Texts that state them, found by grep over `src/components`, `src/state`,
`src/prompts`, `src/cli`, the README and `docs/`: only the app's rebuild
prompt (`src/prompts/specPrompt.ts`: the word lengths twice, the number,
the draws, the redraws, the swap lengths); `validateMapping`'s two
messages in the core, which the swaps panel and `tep` show. Each now
interpolates the constant. The components, the CLI's help and messages,
the CLI prompt, the README and the docs do not state any of these values,
so nothing else changes; the README is left as it is.

## 4. Checks

- A scratch test (`.claude/scratch/l12/`) writes seeded batches at the
  defaults and four other settings, a sentence-mode batch, a set of
  messages, both prompts and the help to JSON before and after; the two
  files are identical.
- `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build:cli`, the e2e
  suite.

## 5. Afterwards

The decisions that the code does not make obvious go into
`docs/decisions.md` ("One core, two front ends"): where the shared text
helpers live and why, the requirements module and the cycle guard, and
that a value a front end states is a named constant in the module that
uses it. This spec and its plan are then deleted.
