# Plan: the page renders only the parts whose inputs changed

Implements `docs/specs/2026-10-21-m7-render-boundaries-design.md` on
`feature/audit-medium`. Written 2026-10-21. Each milestone ends green on
`pnpm typecheck` and `pnpm test` and can be committed on its own.
Milestone 3 is documentation only. Line numbers are at commit `48e719c`.
No file here is touched by the M2, M3 or M5 plans, so the order against
them is free (spec §9).

## Milestone 1. Memo boundaries on the page (spec §2.1, §2.2, §2.4, §7)

- `src/components/SuggestionCard.tsx`: `memo` added to the React import
  (line 1). Line 134 becomes
  `export const SuggestionCard = memo(function SuggestionCard({ ... }: Props) {`,
  and line 353 becomes `});`. One comment line above it says the card
  renders only when its own props change, and that the page keeps those
  props stable.
- The same two-line change, with `memo` imported from `react`, in:
  - `src/components/StrengthPanel.tsx`: lines 10 and 80, plus a new
    import line at the top.
  - `src/components/RequirementsForm.tsx`: lines 50 and 333, plus a new
    import line at the top.
  - `src/components/TwistsPanel.tsx`: lines 35 and 192; line 1 becomes
    `import { memo, useState } from 'react';`.
  - `src/components/SiteRules.tsx`: lines 36 and 132; line 1 becomes
    `import { memo, useRef, useState } from 'react';`.
- `src/App.tsx`:
  - Line 1: `useCallback` added to the React import.
  - Lines 229-233: the comment stays. The body moves into
    `practiseLatest.current = (s) => { ... }` on a
    `useRef<(s: { password: string; hint: string }) => void>`. Then
    `const practiseHere = useCallback((s: ...) => practiseLatest.current(s), []);`
    A comment says it is stable so the cards' memo holds, and that it reads
    the current layout through the ref.
  - Lines 252-253: `const context = useMemo<CardContext | undefined>(() => (outcome?.ok ? { ... } : undefined), [outcome, applied.req.minUppercase]);`
  - Lines 263-264: `relevant` in a `useMemo` on `[p.mode, draft.sentence]`.
    `sentenceWords` moves inside it, since nothing else reads it.
  - No other line changes. Lines 397-405 already pass the cards
    `p.addSelected`, a boolean `selected` and `ordered`'s suggestions,
    which are memoised at line 261.
- New `src/App.renders.test.tsx` (`// @vitest-environment jsdom`, the
  whole `App`, storage cleared before each test as in
  `src/App.test.tsx:9-13`, timeouts of 30 s):
  - A `vi.hoisted` helper, `counting(name, module)`. It throws
    "`name` is not a memo component" unless the export's `$$typeof` is
    `Symbol.for('react.memo')`. Otherwise it returns the module with that
    export replaced by `{ ...memo, type: (props) => { count(name); return memo.type(props); } }`.
    The inner function keeps its hooks, and the memo keeps its
    comparison. `vi.mock` is applied to each of the five modules with
    it.
  - "a keystroke in the made-up sentence renders no card, strength panel,
    requirements form, swaps panel or site rules": first batch settled,
    counts cleared, one `change` on "Generated sentence", all five counts
    0.
  - "starting a batch renders no card; the batch renders its own cards
    when it lands": counts cleared, Refresh clicked. "Working…" is shown
    and the card count is 0. Once the batch lands, the card count is at
    least the number of cards.
  - "a card still renders when what it shows changes: Add marks it Added,
    a new typing mode rescores it": Add on the first card renders one
    card, which reads "Added". "One-handed" renders every card, and
    every D badge's label ends "(one-handed)".
  - "in sentence mode the swaps follow the sentence as it is typed": the
    "Use my sentence" tab, then "sally eats sweets" typed in "Your
    sentence". The `ph→f` chip is disabled (as
    `TwistsPanel.test.tsx:99-110` reads it). After " photo" is added, it
    is enabled.
  - "Practise on a card opens the Testing column when only one column
    fits, after the columns have changed": the narrow `matchMedia`, as
    `App.test.tsx:424-428`. Options is opened, then Suggestions, then
    Practise is clicked on the first card. `main` has the class
    `columns narrow focus-list`, and the typing result reads "Testing:"
    and that card's password.
- `pnpm test:titles` (it rewrites `src/lib/testTitles.json`, which
  `src/lib/testTitles.test.ts` checks).
- Check: with any one `memo` reverted, its count test fails with the
  component's name. With `context` or `practiseHere` back inline, the
  first test fails on the card count. The scratch prototype showed both.
- `pnpm typecheck`, `pnpm test`. Commit.

## Milestone 2. My list's rows take what they show as props (spec §2.3, §7)

- `src/components/SelectedList.tsx`:
  - Line 1: `memo` added to the React import. Line 3:
    `import { difficultyIn, type TypingMode } from '../lib/difficulty';`.
  - Lines 14-15: the row becomes
    `export const ListEntry = memo(function ListEntry({ entry, onRemove, typingMode, practise, failed }: { entry: SelectedEntry; onRemove: (password: string) => void; typingMode: TypingMode; practise: (entry: SelectedEntry) => void; failed: boolean }) {`.
    The `usePasswords()` line goes. A comment says that the row reads no
    context, so a change elsewhere on the page does not render it.
  - Line 35: `zxcvbn={entry.zxcvbn ?? (failed ? 'failed' : 'pending')}`.
  - Line 42: `onClick={() => onRemove(entry.password)}`.
  - Line 48: `});`.
  - Line 60: `typingMode`, `practise` and `zxcvbnFailed` added to the
    destructuring.
  - Line 124: `<ListEntry key={entry.password} entry={entry} onRemove={removeSelected} typingMode={typingMode} practise={practise} failed={zxcvbnFailed.has(entry.password)} />`.
- `src/App.renders.test.tsx`: `vi.mock` of `./components/SelectedList`
  with `counting('ListEntry', ...)`. New test: "a keystroke in the
  made-up sentence renders no row of My list; a new typing mode renders
  every row". Two cards are added, counts are cleared, and one `change`
  on "Generated sentence" gives a row count of 0. "One-handed" gives a
  row count of at least 2, and both rows' D badges end "(one-handed)".
- `src/components/SelectedList.test.tsx` passes unchanged; it renders
  `SelectedList` inside the provider.
- `pnpm test:titles`.
- Measure, without committing anything: rebuild the scratch build with
  `pnpm exec vite build --outDir .claude/scratch/m7/dist --emptyOutDir`,
  then run `DIST=dist node .claude/scratch/m7/browser.mjs` three times.
  The medians are compared with the spec's §1.4 rows "with §2". They
  should be within about 1 ms at 1× and 2 ms at 4-6×. If they are not,
  stop and report before milestone 3. Also run `pnpm test:e2e` (61
  smoke tests) once.
- `pnpm typecheck`, `pnpm test`. Commit.

## Milestone 3. The documentation carries the decisions; the spec and plan go (spec §2-§6)

- `docs/decisions.md`: a new section, `## Rendering`, between "Input and
  persistence" (ends line 188) and "Wording and presentation" (line
  190), with three bullets:
  - **One context, and memo boundaries on the page** (2026-10-21). The
    provider keeps one memoised value. The page component reads nearly
    all of it, so splitting it would not stop the page rendering. Its
    heavy children instead render only when their own props change: the
    cards, the strength panel, the requirements form, the swaps panel
    and the site rules. The page keeps their props stable (the cards'
    context and Practise, the swaps' sentence test). My list's rows take
    what they show as props instead of reading the context.
    `src/App.tsx`, `src/components/SelectedList.tsx`; held by
    `src/App.renders.test.tsx`, which counts renders, never a clock.
  - **Busy still flips twice per batch**: the first flip paints
    "Working…" (see "Where generation runs") and now renders no card,
    panel or row.
  - **Measured when built**: milestone 2's figures. From the spec, a
    keystroke in a draft field in the production build in Chromium went
    from 3.9, 14.2 and 21.9 ms of work to 2.5, 9.8 and 14.8 ms at 1×,
    4× and 6× CPU. With 20 in My list it went from 4.6, 20.0 and 30.8 ms
    to 2.8, 12.1 and 17.6 ms. The rows had cost about 0.2 ms each in
    jsdom on every change. What remains on each change: `TypingTest`,
    `TypingMode`, `ApplyBar` and `SessionControls` still read the
    context, at under 0.15 ms each.
- `docs/decisions.md`, "Limits and caches": nothing.
- `README.md` and `docs/algorithm-flow.md`: nothing. No behaviour
  changes, and neither describes rendering. The README's layout bullet
  for `src/components/` stays.
- `docs/audits/2026-10-21-audit-checklist.md`, row M7: status
  **built**. Spec column: "`docs/decisions.md`, 'Rendering' (the spec
  and plan folded in and removed); commits `<milestone 1>`,
  `<milestone 2>`, 2026-10-21; the provider unchanged (its value was
  already memoised); a draft keystroke at 6× CPU with 20 in My list
  30.8 to 17.6 ms of work". Use milestone 2's measured figures if they
  differ.
- If the user declines the item (spec §10, question 1), only this
  milestone's checklist step happens. The row says **declined**, with
  §1.4's figures as the reason.
- Delete `docs/specs/2026-10-21-m7-render-boundaries-design.md` and this
  plan.
- `pnpm typecheck`, `pnpm test`. Commit.
