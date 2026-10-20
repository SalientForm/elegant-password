# Plan: the audit fixes

Implements `docs/specs/2026-10-20-audit-fixes-design.md` on
`feature/tep-cli`. Written 2026-10-20. Each milestone ends green on
`pnpm typecheck` and `pnpm test` and is committed on its own; the last one
also runs both builds and `pnpm test:e2e`. The numbers in brackets are the
audit's item numbers.

## M1. Three figures, no session in a score (spec §2) [10, 12, 18, 9, 39]

- `src/lib/strength.ts` (new): `rawBits(password)`, `strengthBits(password)`,
  the character classes, `collapseRuns`. Tests: the worked examples in the
  spec, repeats, a single digit, memorable runs, distinct symbols, capitals,
  another script, the empty string.
- `src/lib/score.ts`: `scoreCold(password, hint, mappings)` keeps the bits
  model and uses `mappings` only to count where swaps could have landed
  (and in the text reading it caps with); the alignment uses the built-in
  table and, failing that, an edit-distance match (`bestMatch`), so
  memorability never sees the session. `wordBitsFromText` collapses runs.
  `scoreAlone` and its types go. Tests: a custom swap read as one step,
  65 outcomes with one custom swap, memorability unchanged by the session
  list, the edit bound, repeats.
- `src/lib/readings.ts`: four readings; the band from the rounded figure;
  Raw with no band. `src/lib/sort.ts`: "strength" order by `strength`.
- `src/lib/generate.ts`, `src/lib/fromSentence.ts`, `src/lib/engine.ts`:
  `Suggestion.strength`, `Suggestion.raw`; `bits` counted over the active
  list. `sessionStore` accepts the new fields.
- UI: `ScoreBadges` (four badges, `role="img"`), the card's dim bits
  figure with a tip, `SelectedList`, `TypingTest` (no `scoreAlone`),
  `StrengthPanel` and `SentenceStrength` wording, `ScoringPage` (three
  attackers; criteria count from the rubric).
- CLI: `badges()`, the table's bits figure, JSON fields, the wizard's
  sample.
- Docs: README scoring bullets, `docs/algorithm-flow.md` §4, the Fun page
  prompts (`specPrompt.ts` §12 and §14, `cliPrompt.ts` badges), `TODO.md`
  (the future metric), the memory notes.

## M2. The password on screen, Esc, the shared origin (spec §3–5) [13, 15, 11, 21, 8, 20, 23, 24]

- `PasswordText` (new) replaces `ClickToCopy` and `PasswordTip`; the
  `.password.revealed` style; tests for the toggle, the keyboard, a password
  that fits.
- `CopyButton` rendered on coarse pointers only (`useMediaQuery`); the
  failure wording; the e2e copy test moves to the phone project and a
  reveal test joins the desktop one.
- `ApplyBar`: Esc in a field blurs it; `isComposing` ignored. Tests.
- `src/state/origin.ts` (new): `isOwnOrigin()`; the provider's list and
  session stores are memory stores elsewhere; the list key is removed from
  a shared origin; `SelectedList`'s note. The workflow's `PAGES_DOMAIN`
  branch. Tests for the stores' choice.
- Visible reasons for disabled controls; the mappings count; the badge role.

## M3. Core fixes (spec §6, §9) [1, 2 (reader), 4, 5, 14, 17, 19, 37, 40, 41, 45]

- `applyUppercase` order; drawn suggestions checked; the property test
  gains `shiftReach` and `shortest`.
- `ruleText.ts`: class-count phrases; min over max keeps the minimum.
- `PasswordsProvider`: the superseded request invalidated. `generator.ts`:
  only the newest pending request is kept. `generate.ts`: the model cache
  capped. Emoji-safe leftover. `uppercaseHow` for made-up nouns and
  `shiftReasons` from the words. Lazy pages. Autocorrect off. The
  other-script sentence message.

## M4. The CLI (spec §6–7) [3, 6, 7, 16, 26–32, 33–36, 38, 43, 44]

- `flags.ts` regex and `--no-<meta>`; case-insensitive choices;
  `--no-color` everywhere; `-v`; `help help`; `--explain` piped; JSON
  warnings.
- `configText.ts` quoting; `config.ts` message; `modelOf` omits unused
  options; the unused-option warning reworded.
- The wizard: dropped pasted rules named and listed; Esc back
  (`Cancelled.key`, the prompter's keypress listener, the scripted
  prompter's `escape` step); "too low" wording; the hidden prompt's mask.
- `messages.ts`: no-fit names the counts; fixes checked; the site's
  maximum not offered.
- `generateCommand`: the config line, in all three formats.
- `src/cli/args.ts` (new) and the command table in `main.ts`; exit-code
  line from `EXIT_MEANINGS`; `CONFIG_HELP` shows the format.
- `src/cli/tepLink.ts` shared by `scripts/linkCli.mjs` and `uninstall.ts`;
  `link:cli` refuses a foreign link.
- `bundle.test.ts` builds into a temporary directory (`TEP_OUT_DIR`);
  `scratchDir()` in `testing.ts` cleans up; `writeAtomic` follows symlinks
  and keeps the mode; `boundaries.test.ts` checks Node globals in the CLI
  modules the browser reaches; unused exports and dead code removed;
  constants imported.

## M5. Docs, CI, the last checks

- README (install, scoring, the password controls, Esc, My list, layout),
  the CLI spec's touched sections, `TODO.md`, `pnpm test:titles`.
- `.github/workflows/ci.yml`: typecheck, unit tests, both builds, the
  browser tests, on every push and pull request.
- `reduceTo12.test.ts` runs a short sweep by default, the full one with
  `FULL_SWEEP=1`.
- Both builds, `pnpm test:e2e`, and the wizard's Esc checked in a
  pseudo-terminal.

## Not addressed

Everything in the spec was done and checked (typecheck, 772 unit tests,
both builds, 57 browser tests, and Esc, Ctrl+C and the hidden prompt in a
pseudo-terminal). Left out, with why:

- **Esc as "previous question" during the wizard's first pass.** Esc means
  back at the review (to the review from a line; out of it without saving);
  during the first questions there is no earlier question to return to, so
  it stops like Ctrl+C. Going back one question would need the first pass
  restructured as a list of steps with a history; not worth it yet.
- **Android on-screen keyboards in the typing test** (audit 42). The fix
  (count keystrokes from `beforeinput`) could not be tried on a device,
  so it was not made.
- **Splitting `generate.ts` and `score.ts`** (audit 44). Large but
  coherent; a split for its own sake was not worth the churn in one pass.
  Dead code and copied constants were removed instead.
- **Blocking framing** (audit 45). GitHub Pages sends no headers and a
  meta CSP cannot set `frame-ancestors`; possible only once the app has a
  domain behind something that sets headers.
- **Badge tab stops** (audit 24). Each badge stays a tab stop: its tip is
  how a keyboard user reads it. The badges now carry `role="img"` with
  the whole reading as their name, which was the accessibility defect.
- **Sequences and keyboard runs in Raw** (audit 12). The user chose
  repeats only; `asdfasdfasdf` and `qwertyuiop` still read red, through
  the bands, not through pattern detection.
- **The domain itself** (audit 11). There is none yet. The deploy is
  ready for it (`PAGES_DOMAIN`), and until then My list and the current
  batch stay in memory on the shared origin.
- **The strength panel's colour** (audit 9). Green there still means
  "meets your target" while a badge's green means 50+ bits; the panel's
  text now says what its figure is and that the badges assume a different
  attacker, which was the confusion.
- **A dedicated origin for the Tailscale dev address.** Named in
  `.env.development`, so the dev server keeps storing the list there.
- **Warnings as structured JSON** (audit 27). Kept as strings, now with
  their lines joined by newlines rather than runs of spaces; a structured
  shape would change the documented interface.
- **Help listing modes with ten-finger first** (audit 20). The list
  follows the core's order; cosmetic.
