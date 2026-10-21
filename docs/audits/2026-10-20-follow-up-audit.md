# Follow-up code quality and UX audit — 2026-10-20

Status: acted on, 2026-10-20: see `docs/specs/2026-10-20-follow-up-fixes-design.md`. The user declined one suggestion: Fun stays in the main navigation.

The shared core, strict TypeScript configuration, explicit draft model, and substantial regression suite are strong foundations. The main remaining weaknesses are at boundaries: interpreting rules, persisting secrets, accepting restored data, keyboard events, and narrow-screen error states. Feature expansion should follow those fixes.

This is an audit, not an implementation change. It revisits the accepted previous audit without treating intentional choices—desktop selection instead of Copy, distinct strength figures, or keeping the generated sentence—as regressions.

Scope: shared generation/scoring/rule parsing, React state and components, storage, worker lifecycle, CLI parsing/configuration/output, build/CI, and desktop/mobile browser behavior. Review began at `b0172b0`; the workspace advanced independently to `416d8ad` during the audit. That commit changes snackbar appearance, spacing, and accompanying descriptions; its changes do not address the findings below. No application code was changed by this audit.

Verification:

- Unit suite: **73 files passed; 772 tests passed, one skipped**.
- Full browser suite, including production build and type checking: **56 passed, one failed**. The failed mobile test failed again in a focused rerun.
- CLI bundled successfully into a temporary directory, leaving the linked CLI build alone.
- Production dependency advisory audit: **zero reported vulnerabilities** across 12 dependencies. This is an advisory check, not a security certification.
- Additional browser and CLI probes reproduced the first nine findings below. Browser probes used a separate incognito profile; audit storage was removed and the tab closed afterward.
- No real Android/iOS keyboard or assistive-technology session was tested. Automated mobile tests use Chromium device emulation.

## Findings to fix

### 1. P1 — Failed storage writes are presented as successful saving

Locations: `src/state/PasswordsProvider.tsx:135`, `:223`; `src/state/storage.ts:47`; `src/components/SelectedList.tsx:83`.

`secretsPersisted` records whether the origin is allowed to persist, not whether storage is available or the write succeeded. Save effects discard the boolean result. My list still promises that entries are kept in browser storage after a quota or access failure.

Reproduced by making the selected-list write throw `QuotaExceededError`, then adding a suggestion. The UI showed the entry and its usual persistence promise, no alert appeared, and the persisted list remained `[]`. Reload would lose the entry. A failed removal has the opposite consequence: a password can reappear after reload.

Track actual persistence state separately from permission to persist. Show a persistent, actionable failure notice and keep the in-memory entry available to copy. Apply the same reporting to settings and session writes. Test failure after a successful initial storage probe, not just unavailable storage at startup.

### 2. P2 — Lowercase requirements are acknowledged but not enforced

Location: `src/lib/ruleText.ts:418`; the requirements model has no lowercase-count field.

`at least 5 lowercase letters` produces no rule changes and the explanation `a lowercase letter (always included)`. That explanation loses the count and is false: the engine can produce a fully uppercase word. A direct sentence-mode probe with `ducks`, length 5, five required capitals, no digits/symbols/swaps, and padding off returned `DUCKS`, with every implemented check passing.

Either model and validate the lowercase minimum end to end, or explicitly report it as unsupported. Do not mark it as an invariant. The parser should also disclose unsupported clauses in otherwise partly understood text, such as `8-20 characters, no digits`.

### 3. P2 — Pasted lengths above the supported limit are silently weakened

Location: `src/lib/ruleText.ts:394`.

`exactly 300 characters` is explained as exactly 300 but becomes a 256–256 requirement. This affects both front ends. Reproduced with the freshly bundled CLI:

```sh
printf 'ducks\n' | tep g --no-config --rules 'exactly 300 characters' --sentence - --format json
```

The process exited 0, said it understood exactly 300, and returned a 256-character password. Reject unsupported lengths or surface a blocking unsupported-rule result. The rule summary and enforced values must agree. This is distinct from the previously accepted repair for a maximum below a minimum.

### 4. P2 — Blocked-submit actions overflow a 320 px screen

Location: `src/styles.css:524`; regression: `e2e/mobile.spec.ts:432`.

At 320 px, clear allowed Symbols while symbols are required and set Minimum to 40. The snackbar's `Show`, `Discard`, and `Submit changes` group extends past the right edge. The outer snackbar wraps, but the action group is a nonshrinking, nonwrapping flex row.

This failed the existing full browser suite and its focused rerun, identifying `div.snackbar-actions` and `button.primary` as overflowing. Permit the actions to wrap or use a narrow-screen grid; preserve readable labels. Retest both blocked and ordinary drafts at 320, 360, and 412 px.

### 5. P2 — Hidden pages still accept draft submission/discard shortcuts

Locations: `src/App.tsx:96`; `src/components/ApplyBar.tsx:31`.

The main page stays mounted when Scoring or Fun is active, and ApplyBar's window listener stays active with it. Reproduced by editing the generated sentence, navigating to Scoring, and dispatching Ctrl+Enter. The hidden draft was applied and written to sessionStorage while Scoring remained visible. Escape outside a text field can similarly discard it.

Keep mounted state, but explicitly enable shortcuts only while the Passwords page is active. Test navigation with a dirty draft and both shortcuts.

### 6. P2 — Sentence inputs submit during IME composition

Locations: `src/components/SentenceMode.tsx:39`, `:196`; also review `src/components/TypingTest.tsx:108`.

ApplyBar checks `isComposing`, but local Enter handlers intercept the event first without checking it. Reproduced on the generated sentence field: an Enter event with `isComposing: true` applied the draft and cleared the unapplied state. A user accepting a composition candidate can submit prematurely.

Guard local submit/run handlers against composition and cover both sentence fields and the typing test. This is separate from the already deferred issue of measuring Android soft-keyboard input.

### 7. P2 — Pasting into the tester changes the password

Location: `src/components/TypingTest.tsx:96`.

The paste handler trims whitespace and takes only the first line. Pasting `  Audit Secret  ` reproducibly set the test target to `Audit Secret`. Scores and subsequent matching now concern a different password.

Preserve leading/trailing spaces exactly. If multiline passwords are unsupported, explain and reject the paste or provide an explicit choice rather than silently selecting a prefix. Test spaces-only, leading/trailing-space, and newline input separately.

### 8. P2 — Invalid YAML aliases bypass config diagnostics

Locations: `src/cli/config.ts:81`; `src/cli/fields.ts` value-error formatting.

Two small files reproduced exit 1 with an internal stack trace rather than the documented config error, exit 4:

```yaml
version: 1
rules: *missing
```

```yaml
version: 1
options: &loop
  separator: *loop
```

The first throws from `doc.toJS()`; the second reaches error formatting and throws while stringifying a circular object. Catch conversion failures, constrain alias use as appropriate for this config format, and make diagnostic formatting safe for cyclic values. Report the file and location as a config error.

### 9. P2 — Session validation admits data that crashes “Why?”

Locations: `src/state/sessionStore.ts:37`; `src/components/SuggestionCard.tsx` twist rendering; `src/components/ErrorBoundary.tsx:28`.

`isSuggestion` checks that `twists` is an array but does not validate its elements. A valid saved batch with `twists: [null]` passes `parseSession`. Reloading it and opening “Why?” reproduced the whole-app error boundary: `Cannot read properties of null (reading 'mapping')`.

Validate all nested fields read by the UI, including twist mappings and difficulty data, or reconstruct derived data from a smaller validated record. Clear/rebuild an invalid session batch. Reload alone preserves this particular corrupt record, so it is not a complete recovery action.

### 10. P2 — The shared-origin migration leaves old session secrets behind

Location: `src/state/PasswordsProvider.tsx:138`.

Static finding: when persistence is disallowed, the provider removes the old selected-list key from localStorage but only switches the session to an in-memory store. It does not remove a preexisting `elegant-passwords:session:v1` from real sessionStorage. A tab upgrading from the earlier behavior can retain the old passwords and sentence on the shared origin.

Remove legacy session secrets as well as list secrets when entering nonpersistent operation. Test with both stores prepopulated. This is a migration gap, not a claim that the current implementation writes new session secrets on the shared origin.

### 11. P2 — Independent tabs can overwrite each other's saved list

Locations: `src/state/PasswordsProvider.tsx:159`, `:223`, `:281`.

Static finding: each tab loads the list once, mutates its own React array, and writes the complete array. There is no storage-event reconciliation or version/concurrency check. If two tabs start with the same list, add A in one and B in the other, the second write replaces A with its stale snapshot plus B. Removing entries can similarly be undone by another tab's next write.

Define and implement cross-tab behavior. A storage listener improves synchronization; use an explicit merge/conflict policy or transactional storage if simultaneous edits must be preserved. Add a two-context regression test. This matters on origins where persistence is enabled.

## Design and engineering concerns

- **Strength can substantially reward obvious repeated patterns.** Reproduced: three repetitions of `Password1!` score 66.3; twelve repetitions of `aA` score 73.1; eight repetitions of `asdf` score 73.6. The latter values receive the “master password” reading. This follows the accepted additive implementation, so changing it requires a deliberate scoring-policy decision. The concern is the user-facing claim about an attacker who knows ordinary habits. Consider repeated-block/keyboard-pattern penalties or more modest heuristic wording. Raw's intentionally naive behavior is a separate decision.
- **Different “bits” figures need clearer distinction.** The settings target, plan count, per-card estimate, and own-sentence estimate represent different assumptions. The plan explanation already acknowledges that card bits ignore length limits; make that distinction visible beside the figure rather than expecting users to find the long explanation. Do not present the proposed Strength-minus-Bits metric as a precise measured information leak when its inputs are different models.
- **Worker supersession is not computation cancellation.** `src/state/generator.ts:103` settles older promises but still posts every new request to the same worker, whose `src/worker.ts` handler runs synchronously. Already queued old requests continue consuming CPU. Timeout fallback reruns the current work on the UI thread. Consider one running job plus one replaceable pending request, or terminating/replacing obsolete workers. I did not reproduce a timeout-induced UI freeze.
- **Input limits and cache budgets are inconsistent.** CLI sentences have a 500-character cap; browser sentence/hint/practice inputs have no equivalent bound. The typing test scores synchronously. `src/lib/twists.ts:176` uses a WeakMap, but the inner variant map for the module-global built-in mapping array has no eviction. Other scoring caches are capped. Bound user-input work and all long-lived caches; benchmark before choosing limits. An isolated 500-character repeated-letter sentence took about 2.5 seconds in a browser worker in this audit; that is a sample, not a representative benchmark.
- **Main-branch deployment is not gated by browser tests.** `.github/workflows/ci.yml:7` excludes main pushes; `pages.yml` deploys after unit tests/build but no browser suite. Thus a direct main push can deploy the mobile failure found here. PR checks may protect ordinary merges, but repository branch-protection settings were not inspected. Share one verified build/test job with deployment or require its successful completion.
- **Accessibility coverage remains incomplete.** Tabs and labels have useful tests, but the suite is Chromium-only and does not exercise real soft keyboards or a screen reader. The license link is rendered with 0.3 opacity, deserving a contrast check. Five focusable score/bits tips per suggestion create substantial keyboard travel; this was already deferred by the prior audit, not newly discovered.
- **Large algorithm modules remain expensive to change safely.** `generate.ts` is about 1,100 lines, `score.ts` about 730, and `fromSentence.ts` about 710. Extract planning/counting, transformation, and presentation responsibilities incrementally while preserving property tests. Avoid a broad rewrite. The existing core/frontend boundary tests and shared labels are valuable and should remain.

## Features worth adding

1. **Visible persistence status and “Forget this session.”** Distinguish saved, visit-only, and failed-to-save states. A deliberate reset should cover the current batch, entered sentence, tester, and stored secrets, with scope clearly stated.
2. **“Understood / unsupported” rule review.** Show exactly what will be enforced and which pasted clauses cannot be represented. Lowercase minima should be the first additional rule considered; more general character-count/range support can follow actual demand.
3. **A direct “Practice” action on a suggestion or saved entry.** Currently adding to My list doubles as selecting the typing-test target; old saved entries have no direct practice selector. Let users practise without saving or removing/re-adding a password.
4. **A phone typing model and reliable input-event measurement.** This aligns with the product's typing-comfort purpose. Complete actual mobile-keyboard support before marketing phone test results as reliable.
5. **A simpler default view with optional advanced controls.** Keep site constraints, sentence, and useful output prominent; disclose detailed swaps, shape controls, and scoring explanations on demand.

## Features or presentation to remove, reduce, or defer

- **Reduce the default Raw/bits emphasis.** Retain the accepted information, but consider moving Raw and technical counting details into expanded explanations. Four badges plus a fifth bits figure compete with the password itself.
- **Shorten the initial mobile reading burden.** At 390 × 844, the title/credits, mode selector, sentence, and long help paragraph pushed the first password to about y=822 in the inspected state. Move extended help into a disclosure and give the tagline the full available width rather than reserving a large column for credits.
- **Move “Fun” into secondary navigation.** It is useful project documentation, but not a core password-generation task. Keep its functionality accessible without giving it the same navigation weight as Passwords.
- **Treat My list as a shortlist, not a growing password vault.** Clarify the intended lifetime. Defer accounts, sync, encryption workflows, or password-manager features until retention and recovery behavior are explicit.
- **Defer dependency-free CLI rewrites, browser extensions, and a fourth strength metric.** These increase maintenance or conceptual load while boundary bugs remain. Retain the shared core, existing dependencies, and current score-policy decisions until there is a concrete need to change them.

Recommended order: fix persistence truthfulness, parser correctness, and the failing mobile regression; then keyboard/paste behavior and config/session validation; then storage migration and cross-tab consistency. Simplify presentation before adding substantial new features.
