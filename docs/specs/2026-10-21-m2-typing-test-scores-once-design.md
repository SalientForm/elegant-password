# The typing test scores the password under test once

Status: **proposed**, 2026-10-21. Acts on item M2 of
`docs/audits/2026-10-21-audit-checklist.md`. Line numbers are at commit
`48e719c` on `feature/audit-medium`; `src/components/TypingTest.tsx`,
its test and `src/lib/strength.ts` are unchanged since `b9b5e65`.
Scratch scripts are under `.claude/scratch/m2/`.

## 1. The problem as it stands

### 1.1 Most of the finding was `collapseBlocks`, and H1 fixed it

The audit measured 122 ms per keystroke at 500 characters. Nearly all of
it was the cubic `collapseBlocks`, rewritten with H1 (`8699fd5`) to
compare indexes through a Z-array (`src/lib/strength.ts:122-167`).
Measured now, the scoring each render does (`strengthBits`, `rawBits`
and `commonRank` twice), median of 21 calls in Node, beside the same
calls on the code before `8699fd5`:

| Password under test | Before H1 | Now |
| --- | --- | --- |
| 500 random printable characters | 135 ms | 1.9 ms |
| 500 characters of prose | 132 ms | 0.95 ms |
| 128 characters of prose | 2.8 ms | 0.11 ms |
| `beige @Corns befriend beds?` (27) | 0.07 ms | 0.02 ms |

### 1.2 What remains: the same figures worked out on every render

`TypingTest` renders once per keystroke: `onChange` sets the field's
value (`TypingTest.tsx:152`); `onKeyDown` writes into a ref and sets no
state (`:155-182`). Each render calls `strengthBits(target!)` and
`rawBits(target!)` (`:267`) and `commonRank(target!)` once, or twice for
a common password (`:261`, `:263`), although the password under test
does not change while a run is typed. Difficulty and Memorability are
already memoised on it (`:118`, `:122`, `:123`). The component also
renders on every change of the provider's context (M7), and each of
those renders scores again.

Per keystroke in the component (jsdom, one `keyDown` and one `change`,
median of 60 keys), today and with the three calls memoised (a scratch
copy of the component):

| Password under test | Today | Memoised |
| --- | --- | --- |
| None | 0.51 ms | 0.46 ms |
| 500 random printable characters | 2.22 ms | 0.98 ms |
| 500 characters of prose | 1.87 ms | 0.54 ms |
| 128 characters of prose | 0.68 ms | 0.45 ms |
| 27 characters | 0.49 ms | 0.44 ms |

Over nine keys and an Enter on a 27-character password, the component
calls `strengthBits` 10 times, `rawBits` 10 times and `commonRank` 20
times (once directly and once inside `strengthParts`), all for the same
password.

### 1.3 The skew in the reported times

Each key's time is read when its handler runs (`now()`, `:156`), and a
handler waits for the render of the key before it. When the work per key
exceeds the gap between keys, the run is measured as long as the work,
not the typing. At 122 ms per key, anyone typing faster than about eight
keys a second (about 100 wpm) was reported slower than they typed. At
2 ms the skew is gone in practice: no one types 500 keys a second. It
returns only if the work per keystroke grows again, which is what the
test in §8 guards.

## 2. The decision

The typing test works out the figures from the password alone once per
password under test (2026-10-21). One `useMemo` on `target`, beside
`base` and `difficulty`, holds Strength, Raw and the password's place on
the common list; the badges and the "Not allowed" line read it. They are
worked out again only when the password under test changes (a paste, the
first run's Enter, Practise, a new list entry, Clear, forgetting the
session), never on a keystroke, a keystroke in the hint field, the "Show
as typed" box or a change in the provider.

It is proved by counts, not by a wall clock (the rule H1 set): no call to
`strengthBits`, `rawBits` or `commonRank` while a run is typed.

The figures stay pure functions of the password (`docs/decisions.md`, "A
score is a pure function"). Memoising where they are used follows the
component's own pattern for Difficulty and Memorability and adds no
state to `src/lib`.

## 3. Alternatives rejected

- **Close M2 as done by H1, with no change.** The symptom the audit
  measured is gone. But nothing stops a later change to the scorer from
  putting a per-keystroke cost back, as `collapseBlocks` did, and the
  figures are worked out again on every provider change too. The fix is
  about five lines and one test.
- **A cache inside `strength.ts`**, a module-level map like `scoreCold`'s.
  Hidden state in a pure function (the reason given under "One mapping
  list per batch" in `docs/decisions.md`), one more place holding
  passwords in memory, and of no use to the engine, which already scores
  each suggestion once.
- **A memoised child for the result block** (`React.memo` over the badges
  and the password shown). It would also skip rendering them on a
  keystroke: 0.4-0.5 ms in jsdom at 500 characters (§1.2, "Memoised"
  against "None"). Not worth a new component and its props for that; it
  is the next step if a phone measurement ever asks for one.
- **Timing keys from the event's `timeStamp`** instead of `now()` when
  the handler runs. It would make the reported times immune to any stall
  on the page, not only this one, but it changes what every recorded time
  means and replaces the injected clock the tests rely on. Not needed
  once a keystroke costs a millisecond; it is an option for the finding
  in §5.1.

## 4. Behaviour visible to users

None. The same figures, badges and messages. A keystroke with a
500-character password under test costs 0.5-1.0 ms of rendering in
jsdom instead of 1.9-2.2 ms.

## 5. Found while measuring, not this item

Both are worked out once per password under test, not per keystroke, so
neither is M2. Both stall the page with no bound inside the 500-character
cap, and each needs its own spec (§8, question 2).

### 5.1 zxcvbn on long input

The typing test asks zxcvbn for a reading of whatever is under test
(`useZxcvbn`, `TypingTest.tsx:125`), up to 500 characters. The library
loads lazily, then runs synchronously on the page's thread. Node, one
call each:

| Input | zxcvbn |
| --- | --- |
| 64 characters of prose | 14 ms |
| 128 characters of prose | 56 ms |
| 250 characters of prose | 288 ms |
| 500 characters of prose | 1.3 s |
| 64 random printable characters | 85 ms |
| 128 random printable characters | 1.1 s |
| 250 random printable characters | 21.8 s |
| 500 random printable characters | over 4 minutes (stopped) |

Pasting 250 random characters, a long API key for instance, freezes the
page for about 22 seconds; 500 for minutes. The component benchmark
showed it: the test process stayed busy for minutes after its last
keystroke, on the 500-character paste's reading. Cards are at most 128
characters and read like prose, so they stay near 56 ms.

### 5.2 Difficulty without a hint on long repeated text

`difficultyAlone` (`src/lib/score.ts:725`) on the password under test,
once per password (`TypingTest.tsx:122`):

| Input | `difficultyAlone` |
| --- | --- |
| 500 random printable characters | 145 ms |
| 500 characters of prose | 33 ms |
| `P@ssw0rd!` typed 50 times (450) | 24 ms |
| `beige @Corns befriend beds?` typed 18 times (486) | 826 ms |
| The 94 printable marks in a fixed cycle, 128 characters | 124 ms |
| The same cycle, 250 characters | 1.1 s |
| The same cycle, 500 characters | 28.4 s |

A CPU profile at 250 characters puts about 90 % of the time in
`buildTable` and `twistOutcomes` (`src/lib/twists.ts:218`, `:256`),
counting the ways the twists found could have landed. The 28 s case is
contrived; a generated password pasted 18 times costs most of a second.

## 6. Not changed

- **The hint field** works out Memorability and Difficulty again on each
  keystroke in it (`:118`), because the hint is the input that changed:
  0.4-1.7 ms at the median, 98 ms at worst (a 128-character random
  password with a plain-words hint). Its worst case is §5.2's code.
- **My list** works out Strength and Raw for every entry on every render
  (`src/components/SelectedList.tsx:32-33`). Entries are at most 128
  characters, about 0.1 ms each; the renders come from the provider, M7's
  business.
- The lookup of a saved zxcvbn reading in My list on each render (`:125`)
  takes microseconds.
- `src/lib/strength.ts` is not touched.

## 7. The price

About five lines in the component and one test that spies on two core
modules (`vi.mock(..., { spy: true })`, as `src/lib/fromSentence.test.ts:14-16`
does). The spies apply to every test in `TypingTest.test.tsx` and keep
the real behaviour.

## 8. Tests

- New, in `src/components/TypingTest.test.tsx`: "scores Strength, Raw and
  the common-password check once per password under test, not on every
  keystroke". Paste a password; clear the spies; type nine keys and a
  mismatched Enter; `strengthBits`, `rawBits` and `commonRank` are not
  called. Paste `dragon`; `strengthBits` is called with it and the "Not
  allowed" alert shows. Prototyped in the scratch directory: it fails on
  today's component (10, 10 and 20 calls) and passes on the memoised one.
- Unchanged and still passing: "says a common password is not allowed"
  and "takes the password last added to the list, with its hint, and
  scores all three badges; a typed one has no hint", which checks the
  Strength figure against `strengthBits`.

## 9. Open questions

1. **Build M2 on its own, or group it with a neighbour?** The Order
   allows a one-line item to be grouped. M7 is the nearest in kind (it
   cuts the renders; this cuts the work per render) but is a larger
   change to the provider. Recommendation: build M2 on its own, as one
   commit now, and leave M7 its own spec. The plan assumes this.
2. **Add the two findings of §5 to the checklist?** Recommendation: yes,
   as H3 (zxcvbn on the page's thread with no length bound: a paste of
   250 random characters freezes the page for about 22 s) and M8
   (`difficultyAlone`'s twist counting: 28 s on a contrived 500-character
   cycle, 0.8 s on a generated password pasted 18 times), H3 specced
   next after M2. What the zxcvbn badge shows above a length bound is the
   user's call in H3's spec, not here. The plan adds the rows in its last
   milestone if the answer is yes.
