# Audit checklist, 2026-10-21

A working file: the findings of the 2026-10-21 principal-engineer audit,
one line each, with where each stands. Each item gets its own spec in
`docs/specs/` before it is built; the spec is the authority, this is the
index. Delete this file once every line is closed.

Status: **open** (no spec yet), **spec** (design written, link in the
Spec column), **built** (merged, with the commit), **declined** (with
why).

A spec is a working document (decided by the user on 2026-10-21, H2's
spec §2.9): once built, every decision in it that remains accurate is
recorded in the application's documentation (the README, `docs/algorithm-flow.md`,
`docs/decisions.md`) and the spec, its plan and the audit it acted on are
deleted. A built row's Spec column then names where its decisions are.

Audit baseline: `pnpm typecheck` clean, 829 unit tests passing (one
skipped), 97.6 % line coverage, `pnpm audit --prod` clean, at commit
`500a07e` on `feature/audit-follow-up`.

## High

| Id | Finding | Where | Status | Spec |
| --- | --- | --- | --- | --- |
| H1 | A worker timeout runs the engine on the UI thread and marks the generator broken for the rest of the session; sentence mode at permitted settings measured 3.9 s on a desktop, so a slow phone crosses the 10 s limit, freezes, and never uses the worker again. Profiled: 93 % of that time scores candidates the search discards. Fixed by bounding the engine (maximum length 128, score once per kept suggestion, 3 attempts per suggestion, `collapseBlocks` without slicing, the sentence cap in the engine) rather than by handling the timeout | `src/lib/fromSentence.ts:427`, `:627`, `:704`; `src/lib/strength.ts:122`; `src/lib/validation.ts:13` | built | `docs/decisions.md`, "The engine's budget" (the spec folded in and removed); commit `8699fd5`, 2026-10-21; worst permitted case 224 ms (was 3,631 ms) |
| H2 | Remove the worker once H1 is built and measured under its budget (the audit's 90-day bet, step 2): `generator.ts` loses its queue, timeout and restart, `worker.ts` and its test doubles go, and L2, L3 and L10 close with it. The price is written down in the spec: no safety net for future engine work, no Stop button, about a second's stall at the worst settings on a slow phone | `src/state/generator.ts`; `src/worker.ts`; `src/state/PasswordsProvider.tsx` | built | `docs/decisions.md`, "Where generation runs" (the spec and plan folded in and removed); built 2026-10-21, `0fc536f`, `f12e95f`, `e513506`; the first batch lands 110 ms sooner, one chunk carries the engine; `TODO.md` keeps the case for a worker again, once the app runs without one |
| H3 | The typing test hands whatever is under test, up to 500 characters, to zxcvbn on the page's thread with no length bound: 128 random characters 1.1 s, 250 21.8 s, 500 over 4 minutes (found with M2). Fixed by the user's limits (password fields 128, hint fields 512) and a dismissible floating error for any work over 2 s | `src/components/useZxcvbn.ts`; `src/state/zxcvbnCheck.ts`; `src/lib/text.ts:11` | spec | `docs/specs/2026-10-21-h3-limits-and-slow-notice-design.md`, `docs/plans/2026-10-21-h3-limits-and-slow-notice-plan.md`; built after M2-M7 are merged |

## Medium

| Id | Finding | Where | Status | Spec |
| --- | --- | --- | --- | --- |
| M1 | With Shift reach on, the opening capital can land after a swapped-in symbol (`beige @Corns befriend beds?`): twists run before the capital is placed and protect only the first word | `src/lib/generate.ts:745` (`applyUppercase`), `:949`, `:958` | built | `docs/decisions.md`, "The opening capital" (the spec and plan folded in and removed); commit `4c47495`, 2026-10-21; 0 of 6,000 passwords with Shift reach on put the capital mid-word (was 1.0-1.8 %) |
| M2 | The typing test recomputes Strength and Raw in every render, and `collapseBlocks` is cubic: 122 ms per keystroke at 500 characters, which also skews the typing times it reports | `src/components/TypingTest.tsx:268`; `src/lib/strength.ts:122` | built | `docs/decisions.md`, "Limits and caches" (the spec and plan folded in and removed); commit `d6e0eaf`, 2026-10-21; `collapseBlocks` with H1 (133 ms to 1.1 ms); a keystroke at 500 characters 2.1-2.6 ms to 0.5-1.1 ms in jsdom, no scoring |
| M3 | Strength reuses the bits presets' words, so every default password reads "master password" (Strength 73 against a plan of 52 at a 40-bit target) | `src/lib/readings.ts:18` | spec | `docs/specs/2026-10-21-m3-strength-word-design.md`, `docs/plans/2026-10-21-m3-strength-word-plan.md`; the word follows the colour band (high, fair, low; wording open); 21 % of default passwords read "master password", 71 % "very strong" |
| M4 | The planning cache can hold about 100 MB in the worker (400 length models, clear-all eviction; 108 combinations added 28 MB), and the unit suite needs a 4 GB heap | `src/lib/generate.ts:359`; `.github/workflows/ci.yml:29` | spec | `docs/specs/2026-10-21-m4-planning-cache-design.md`, `docs/plans/2026-10-21-m4-planning-cache-plan.md`; shared word groups (about 70 KB to 12 KB a model), least recently used eviction at 1,000; the 4 GB heap setting goes (the suite passes at 256 MB) |
| M5 | A kept sentence is never checked against the word lists, and empty words pass validation (`42;Paz$word;password;pasword`, `85;;Cadets;...`) | `src/state/sessionStore.ts:96`; `src/lib/generate.ts:816` | spec | `docs/specs/2026-10-21-m5-kept-sentence-check-design.md`, `docs/plans/2026-10-21-m5-kept-sentence-check-plan.md`; `couldBeDrawn`: a stored sentence that fails is dropped on load and a new one drawn; the engine refuses one with the way out; an empty initial crashes the engine today |
| M6 | A 750 ms wall-clock budget is asserted in the unit suite; it fails under coverage instrumentation | `src/cli/constraints.ts:25`; `src/cli/walk.test.ts` | spec | `docs/specs/2026-10-21-m6-question-work-design.md`, `docs/plans/2026-10-21-m6-question-work-plan.md`; the suite counts each question's work (at most 400 checks and 400 length models); the 750 ms timing moves to `pnpm measure:wizard`; the clock is CPU time, not wall-clock, and CI never runs coverage |
| M7 | The provider's one context value changes on any state change, so every consumer re-renders (busy flips twice per batch) | `src/state/PasswordsProvider.tsx:437` | spec | `docs/specs/2026-10-21-m7-render-boundaries-design.md`, `docs/plans/2026-10-21-m7-render-boundaries-plan.md`; the value is already memoised; the cost is the page rendering every column, so `React.memo` boundaries and props for My list's rows (a keystroke at 6x CPU 30.8 ms to 17.6 ms with 20 entries) |

## Low

| Id | Finding | Where | Status | Spec |
| --- | --- | --- | --- | --- |
| L1 | "At least 3 of the following 4" is read as all four required and reported as understood | `src/lib/ruleText.ts:265` | open | |
| L2 | Caches keyed on array identity never hit across worker requests (each request is a structured clone): 0.1 ms with one list vs 67 ms cloned, 200 scores | `src/worker.ts:7`; `src/lib/score.ts:457`; `src/lib/twists.ts:179` | built | with H2, `f12e95f` (L2) and `0fc536f` (L3, L10); `docs/decisions.md`, "Where generation runs" |
| L3 | A busy worker is replaced after 300 ms; the fresh one re-imports and re-ranks every pool (cold 80 ms vs warm 19 ms) | `src/state/generator.ts:43` | built | with H2, `f12e95f` (L2) and `0fc536f` (L3, L10); `docs/decisions.md`, "Where generation runs" |
| L4 | The pasted-rules box re-parses on every render and has no length cap | `src/components/SiteRules.tsx:58`, `:100` | open | |
| L5 | Stored sentence options have no upper bounds | `src/state/settingsStore.ts:121` | open | |
| L6 | The Fun page renders markdown to raw HTML with no sanitiser (constants only; CSP blocks scripts) | `src/components/FunPage.tsx:10`, `:88` | open | |
| L7 | The CSP is a meta tag, so it cannot carry `frame-ancestors`; the Pages site can be framed | `build/csp.ts` | open | |
| L8 | Coverage artefacts are committed and stale (600 KB from 2026-10-15); `.gitignore` lacks `coverage` | `coverage/` | built | no spec needed; `coverage/` untracked and ignored, 2026-10-21, with D1 |
| L9 | The check job is copy-pasted between `ci.yml` and `pages.yml` | `.github/workflows/` | open | |
| L10 | The common-password list ships in both the page and worker chunks and is split eagerly at import | `src/lib/common.ts:21` | built | with H2, `f12e95f` (L2) and `0fc536f` (L3, L10); `docs/decisions.md`, "Where generation runs" |
| L11 | zxcvbn 4.4.2 has had no release since 2017 (398 KB gzipped, loaded lazily) | `package.json` | open | |
| L12 | Duplicated helpers (`plural` ×3, `COMFORTS` ×2, capitalise/lower-first ×4) and a type-only import cycle through `generate.ts` for `Requirements` | `src/lib/validation.ts:109`, `src/lib/ruleText.ts:410`, `src/cli/messages.ts:29`, `src/lib/score.ts:160`, `src/lib/checks.ts:7`, `src/lib/validation.ts:10` | open | |
| L13 | The three largest modules are unchanged since the prior audit: `generate.ts` 1,022 lines, `score.ts` 727, `fromSentence.ts` 723 | `src/lib/` | open | |
| L14 | The web bundle carries fifteen CLI modules through the Fun page prompt (fenced by `boundaries.test.ts`) | `src/prompts/cliPrompt.ts` | open | |
| L15 | `SessionControls.tsx` is at 50 % line coverage, the only real gap | `src/components/SessionControls.test.tsx` (none) | open | |
| L16 | Neither Copy button nor the CLI clears the clipboard (an accepted decision in `TODO.md`) | `src/components/clipboard.ts`, `src/cli/clipboard.ts` | open | |
| L17 | In Minimal-quick mode Strength reads below the card's bits for 58 % of suggestions (median -0.5 bits, p5 -7.0; 1 % or less in the other modes): reading short made-up nouns and capitals at 2.3 bits a letter gives less than the tool's own pick. Strength assumes less knowledge than the bits, so it should not read lower (found with M3) | `src/lib/strength.ts` | open | |

## Housekeeping

| Id | Item | Where | Status | Spec |
| --- | --- | --- | --- | --- |
| D1 | The CLI spec and plan of 2026-10-20: every decision that remains accurate recorded in the README's command line section or `docs/decisions.md`, then the files deleted (the rule of H2's spec §2.9; done for the other four specs with H2) | `docs/specs/2026-10-20-tep-cli-design.md`; `docs/plans/2026-10-20-tep-cli-plan.md` | built | `docs/decisions.md`, "One core, two front ends" and "The command line" (the spec and plan folded in and removed), 2026-10-21; `TODO.md` keeps "tep CLI: decisions to revisit" |

## Order

H1, then M1 to M7 in order, then the Lows, one spec at a time. An item
whose spec turns out to be a one-line change may be grouped with its
neighbours; the grouping is recorded here when it happens.

Decided 2026-10-21: the audit's 90-day bet is taken, in two steps. H1
bounds the engine (its spec replaces the withdrawn worker-timeout spec of
the same day) and records the measured worst case when built; H2 removes
the worker on that measurement and is specced then, before M1. The
maximum password length becomes 128 (the user's decision, in H1's spec).
