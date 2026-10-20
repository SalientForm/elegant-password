# Plan: `tep`, and one shared core for the app and the CLI

Implements `docs/specs/2026-10-20-tep-cli-design.md` on branch
`feature/tep-cli`. Written 2026-10-20.

## 0. The rule this plan is built around: no drift

The web app and `tep` must make and score passwords through the same code,
so a change to an algorithm reaches both or neither. An audit of `main`
(46337b5) found the engine already shared (`runInputs` in
`src/lib/engine.ts`), but four steps between the settings and what the user
sees lived in UI code, where a CLI cannot reach them and would have to
copy them:

| Step | Lived in | Moves to |
| --- | --- | --- |
| Settings to engine inputs (`activeMappings`, the generated sentence) | `src/state/PasswordsProvider.tsx` | `src/lib/pipeline.ts` `inputsFor` |
| Difficulty rescored for the typing mode, then sorted | `src/App.tsx` | `src/lib/pipeline.ts` `presentSuggestions` |
| Badge readings: "Strength 48", `strengthWord`, colour levels, tooltips | `src/components/SuggestionCard.tsx` | `src/lib/readings.ts` |
| Comfort choices and hints, separator choices and the separator note, "must contain" fields | `src/components/RequirementsForm.tsx` (comfort labels also copied in `modeProfiles.ts`) | `src/lib/choices.ts` |

`src/lib` also held modules only a browser can use (localStorage stores,
the Web Worker generator, the Fun page prompt that names storage keys).

The layout after this plan:

| Directory | Holds | May import |
| --- | --- | --- |
| `src/lib/` | The shared core: every algorithm, rule, preset, label and reading. Pure TypeScript, no DOM, no Node, no React | `src/lib` only |
| `src/state/`, `src/components/`, `src/App.tsx`, `src/worker.ts` | The web app: React, persistence (localStorage, sessionStorage), the worker | `src/lib`, each other |
| `src/cli/` | `tep`: flags, config files, the wizard, terminal output | `src/lib`, `node:*`, `yaml`, `zod`, `@clack/prompts` |
| `src/prompts/` | The Fun page's two rebuild prompts | anything but React |

Enforced by tests, not by convention:

1. **Boundaries** (`src/boundaries.test.ts`): `src/lib` imports only
   `src/lib` and names no browser or Node global (`window`, `document`,
   `localStorage`, `sessionStorage`, `Worker`, `process`, `node:`);
   `src/cli` imports nothing from `src/state`, `src/components` or React;
   the web never imports `src/cli`.
2. **No reimplementation**: `src/cli` may not import the engine's inner
   functions (`generate`, `fromSentence`, `scoreCold`, `scoreDifficulty`,
   `difficultyIn`, `sortSuggestions`) or rebuild a reading. It goes
   through `inputsFor`, `runInputs`, `presentSuggestions` and
   `scoreReadings`, the same calls the web makes. The same test pins
   that `PasswordsProvider.tsx` uses `inputsFor` and `App.tsx` uses
   `presentSuggestions`.
3. **Equivalence**: for each site preset and typing mode, the request the
   web provider sends to its generator equals the request `tep` builds
   from a config with the same settings.

## 1. Milestones

Each milestone ends green on `pnpm typecheck` and `pnpm test`, and is
committed on its own.

### M1. Shared core (web refactor, no behaviour change)

1. Move the web-only modules out of `src/lib`, tests with them:
   `storage`, `settingsStore`, `sessionStore`, `selectedStore`,
   `generator` to `src/state/`; `specPrompt` to `src/prompts/`. Split
   `mappingStore`: `MappingSettings`, `DEFAULT_MAPPING_SETTINGS`,
   `activeMappings` and a new `mappingSettingsProblems` (the checks a
   config file needs) go to `src/lib/mappingSettings.ts`; storage
   stays in `src/state/mappingStore.ts`.
2. `src/lib/pipeline.ts`: `inputsFor(settings, generated)` and
   `presentSuggestions(suggestions, typingMode, sort)`. The provider and
   `App.tsx` call them.
3. `src/lib/readings.ts`: `scoreReadings({ bits, difficulty,
   memorability })` returns each badge's label, value, level and full
   reading; `ScoreBadges` renders it, `tep` prints it.
4. `src/lib/choices.ts`: comfort choices, separator choices (each with
   why it is not allowed under given rules) and the separator note; the
   form, the profile table and the wizard read them.
5. `src/lib/consistency.ts`: `problemsOf(req)` (`ruleProblems`, then
   `planProblem`) and `warningsOf(req)` (unreachable target, with the
   bits the rules reach). `planProblem` (added to `generate.ts`, early
   exit, same messages as `plan`) returns a code with its message.
   `RuleProblem` gains a `code` so a front end can word a problem its
   own way without matching message text.
6. Boundary, no-reimplementation and equivalence tests (§0).
7. Regenerate `src/lib/testTitles.json`; README layout section.

### M2. CLI settings model

- `src/cli/names.ts`: slugs for modes (`quick` and `minimal-quick`),
  site presets, strength presets, derived from the labels in `src/lib`;
  "did you mean" for near misses.
- `src/cli/sources.ts`: where each value came from (default, site preset,
  mode preset, `file:line key`, flag, wizard line) and how each reads in
  a message.
- `src/cli/resolve.ts`: the layering of spec §5.1, recording a source
  per field; no automatic fixes.
- `src/cli/messages.ts`: every contradiction and warning worded for the
  CLI, from the problem's code and values: what is wrong, the values and
  where each came from, and how to fix it (the flag or key to change, in
  which direction, to what).

### M3. Config file

- zod schema for version 1 (spec §6), kebab-case keys, `options: preset`
  or a partial map, `sentence`, `swaps`, `output`.
- Parse with `yaml`'s `parseDocument` + `LineCounter`: every error names
  file, line, column, key path, the value found and what is expected,
  with the line quoted. Unknown keys get "did you mean".
- Writer with the header and field comments; round-trip tested; written
  atomically (temp file and rename); sections the wizard does not ask
  about (`sentence`, `swaps`) kept as they were.

### M4. `tep g`

- `node:util` `parseArgs` with tokens: unknown flags (with "did you
  mean"), a flag given twice, `--x` with `--no-x`, `-c` with
  `--no-config`, sentence options without `--sentence`, values out of
  range, all usage errors (exit 2) that say exactly which.
- `--sentence -`: stdin, or a hidden prompt on a TTY; inline text
  refused with the reason (shell history, `ps`).
- Output: table (TTY), plain (piped), json; `--explain`; colour off for
  `NO_COLOR`, `--no-color` or a non-TTY; warnings to stderr; `--quiet`.
- `--copy` with `pbcopy`, `wl-copy`, `xclip`, `xsel`, chosen by platform
  and session; a clear error when none is found.
- Exit codes 0, 1, 2, 3, 4, 130, each tested.

### M5. `tep config`

- A `Prompter` interface (select with disabled choices, text, number,
  confirm, notes); `@clack/prompts` behind it in production, a scripted
  fake in tests.
- `src/cli/constraints.ts`: each question's choices or range under the
  answers so far plus the loosest values for the rest (first pass), or
  under every other answer (review); the reason for each choice not
  allowed names what rules it out; strength choices the rules cannot
  reach carry a warning and stay selectable.
- The wizard: question order of spec §7.1, a one-choice question stated
  and skipped, the bug path (a contradiction that gets through: said at
  once, the choice dropped, the question asked again), review with line
  numbers, blocked lines that cannot be edited, sample password, save
  (confirm overwrite, atomic write, never a contradiction), loading an
  existing file (and one that contradicts itself), Ctrl+C writes
  nothing, non-TTY exits 2.
- Property test: random walks through the wizard never meet a
  contradiction or a question with no allowed choice.
- Timing test: every question shaped in under 750 ms of CPU time (3x on CI).

### M6. Build and run

- `tsdown` bundle to `dist-cli/tep.mjs` with a shebang; `bin`,
  `build:cli`; `.gitignore`.
- One end-to-end test that builds the bundle and runs it: `tep g`
  piped, `--format json` checked against the engine's own `checks`, a
  contradiction (exit 3), a bad config (exit 4), `--version`, `--help`.

### M7. The Fun page: two prompts

- `src/prompts/specPrompt.ts` (the app) gains the shared-core layout of
  §0, so an app rebuilt from it has the modules the CLI needs.
- `src/prompts/cliPrompt.ts`: the CLI prompt, generated from the CLI's
  own definitions (flags, config keys, exit codes, wizard questions,
  message rules), which says it builds on the app from the first prompt
  and reuses its `src/lib` modules by name instead of redefining them.
- The Fun page shows the app prompt first, then the CLI prompt, each with
  its word count, Copy and Download.

### M8. Docs

README "Command line" section and layout; spec updated where the plan
settled something (shared `problemsOf` in `src/lib`, the Fun page now
covers the CLI); TODO "decisions to revisit" kept current.

## 2. Considerations to verify (each gets a test)

- Every contradiction `ruleProblems` knows, and each `planProblem` code,
  through `tep g` (exit 3) with sources from flags, file and presets.
- Unreachable target: warning on stderr, passwords still printed; in the
  wizard a marked, selectable choice.
- Every flag: accepted values, each refusal and its message.
- Every config error: YAML syntax, wrong type, out of range, unknown key,
  missing or newer `version`, unknown preset or mode, bad mapping, a
  self-contradicting file.
- Every wizard constraint: each question's disabled choices and ranges,
  one-choice skips, the bug path, blocked review lines, overwrite
  confirmation, Ctrl+C, non-TTY.
- Count default 5 on a TTY, 1 piped; flag and file override it.
- Unused options in a mode: warning, value still used.
- `--mode` over a file's own options replaces them.
- Inputs equivalence with the web provider (§0).

## 3. Risks

- Another session is editing the web app on `main` (the provider, the
  form, the cards, `specPrompt.ts`, `sessionStore.ts`). Moving modules
  and extracting logic here will conflict with that work at merge time,
  mostly in import lines. Keep each web change minimal and mechanical,
  and say so when handing back.
- `plan()` costs up to 300 ms cold in some modes; the wizard uses the
  early-exit `planProblem` (about 20 ms cold, measured) for every choice
  and a full plan only for the strength warning.
