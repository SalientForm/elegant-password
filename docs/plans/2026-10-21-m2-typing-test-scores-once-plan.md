# Plan: the typing test scores the password under test once

Implements `docs/specs/2026-10-21-m2-typing-test-scores-once-design.md`
on `feature/audit-medium`. Written 2026-10-21. Each milestone ends green
on `pnpm typecheck` and `pnpm test` and stands on its own as a commit;
milestone 2 is documentation alone. Line numbers are at commit `48e719c`.

## Milestone 1. The figures from the password alone, memoised (spec §2, §8)

- `src/components/TypingTest.tsx`:
  - After line 123 (`difficulty`), one memo on `target`, with a one-line
    comment saying it is worked out once per password under test, not per
    keystroke:
    `const alone = useMemo(() => (target === undefined ? undefined : { strength: strengthBits(target), raw: rawBits(target), rank: commonRank(target) }), [target]);`
  - Line 261: `{alone?.rank !== undefined && (`; line 263:
    `{commonPasswordProblem(alone.rank)}.`
  - Line 267: `strength={alone!.strength} raw={alone!.raw}`. The block at
    line 222 renders only with `shownTarget` defined, so `alone` is
    defined there, as `target!` assumes today.
  - No other line changes; the imports at lines 2 and 5 stay.
- `src/components/TypingTest.test.tsx`:
  - Line 3: `vi` added to the vitest import. Line 5: `rawBits` beside
    `strengthBits`; a new import of `commonRank` from `../lib/common`.
  - After the imports: `vi.mock('../lib/strength', { spy: true });` and
    `vi.mock('../lib/common', { spy: true });`, as
    `src/lib/fromSentence.test.ts:14-16` does.
  - New test after "says a common password is not allowed" (lines
    154-159): "scores Strength, Raw and the common-password check once
    per password under test, not on every keystroke". Render with an
    injected clock; paste `beige @Corns befriend beds?`; `mockClear` the
    three spies; `typeInto` nine keys and `enter` (a mismatch, so the
    password under test stays); expect none of the three called. Paste
    `dragon`; expect `strengthBits` called with `'dragon'` and the alert
    to read "Not allowed".
- `pnpm test:titles` (rewrites `src/lib/testTitles.json`, which
  `src/lib/testTitles.test.ts` checks).
- Check: the new test fails with the component change reverted (10, 10
  and 20 calls in the prototype) and passes with it.
- `pnpm typecheck`, `pnpm test`. Commit.

## Milestone 2. The documentation carries the decision; the spec and plan go (spec §2, §9)

- `docs/decisions.md`, "The engine's budget", the `collapseBlocks` bullet
  (lines 74-78): ", which the typing test pays per keystroke" goes; the
  sentence ends at "for 500 characters", and the typing test's side is
  the new bullet below.
- `docs/decisions.md`, "Limits and caches" (line 154), a new bullet:
  **The typing test scores the password under test once** (2026-10-21).
  Strength, Raw and the common-list check are memoised on the password,
  beside Difficulty and Memorability, so a keystroke costs a render and
  no scoring: at 500 characters 0.5-1.0 ms in jsdom, was 1.9-2.2 ms
  (122 ms before H1). Each key's time is read when its handler runs, so
  work per keystroke above the gap between keys would stretch the times
  the test reports; asserted as counts in
  `src/components/TypingTest.test.tsx`, never as a wall clock.
  `src/components/TypingTest.tsx`.
- `README.md` and `docs/algorithm-flow.md`: nothing; no behaviour
  changes.
- `docs/audits/2026-10-21-audit-checklist.md`, row M2: status **built**;
  Spec column: "`docs/decisions.md`, 'Limits and caches' (the spec and
  plan folded in and removed); commit `<milestone 1>`, 2026-10-21;
  `collapseBlocks` with H1 (133 ms to 1.1 ms); a keystroke at 500
  characters 1.9-2.2 ms to 0.5-1.0 ms in jsdom, no scoring".
- If the user takes the spec's question 2: rows H3 and M8 added to the
  checklist from the spec's §5.1 and §5.2 (finding, where, open), and the
  Order section says H3 is specced next. Their measurements go into the
  rows, since the spec is deleted.
- Delete `docs/specs/2026-10-21-m2-typing-test-scores-once-design.md` and
  this plan.
- `pnpm typecheck`, `pnpm test`. Commit.
