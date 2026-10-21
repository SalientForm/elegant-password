# The page renders only the parts whose inputs changed

Status: **proposed**, 2026-10-21. Acts on item M7 of
`docs/audits/2026-10-21-audit-checklist.md`. Line numbers are at commit
`48e719c` on `feature/audit-medium`. `src/state/PasswordsProvider.tsx`,
`src/App.tsx` and every component named here are unchanged since
`b9b5e65`. The scratch measurements are in `.claude/scratch/m7/`:
`measure.test.tsx` counts renders in jsdom, `browser.mjs` times the
production build in Chromium, and `proto.vite.config.ts` builds the
decision below without touching `src/`.

## 1. The problem as it stands

### 1.1 The finding, checked

The provider's value (`PasswordsProvider.tsx:431-473`; the audit cites
line 437, inside it) is already memoised over its 37 inputs, and every
action in it is a `useCallback` (`:240-420`). So the value changes when,
and only when, one of the state values it carries changes. A change to
state it does not carry renders the provider alone: the round bump that
Refresh makes renders no consumer (0.14-0.27 ms in jsdom). The finding
holds in substance, though. Nearly every state change is in the value,
and every consumer renders for each one.

The consumers are `ElegantPasswords` (`src/App.tsx:190`), `TypingMode`
(`TypingMode.tsx:15`), `ApplyBar` (`ApplyBar.tsx:33`), `SessionControls`
(`SessionControls.tsx:18`), `SelectedList` (`SelectedList.tsx:60`), each
row of My list (`SelectedList.tsx:15`) and `TypingTest`
(`TypingTest.tsx:49`).

### 1.2 The cost is not in the context's shape

`ElegantPasswords` reads nearly every field of the value: the draft and
applied settings, the batch, busy, stale, the mode, the order, the
sentence, the problems, the notice, persistence and the list actions. It
renders all three columns as its own children (`App.tsx:273-453`), and
none of them is memoised. Whatever changes, the whole page renders, and
splitting the context would not change that: the page subscribes to
every part. The other consumers are all inside the page.

### 1.3 What renders, counted

- **One batch** (Refresh): three commits from the provider. The round
  bump renders the provider alone. Busy set to true renders the whole
  page, although only "Working…" and `aria-busy` change. The batch
  landing, with busy set back to false, renders the whole page and
  mounts the new cards. The cards then commit their own layout
  measurements and zxcvbn readings. That is two renders of the whole
  page per batch, and one of them is only for busy (the finding's
  "busy flips twice").
- **One keystroke in a draft field** (the made-up sentence, your own
  sentence, a text field in the options): the whole page, once.
- **One keystroke in the typing test**: `TypingTest` alone, because its
  text is local state. This item therefore does not touch the times the
  typing test reports. Those come from the test's own work per render,
  which is M2.

### 1.4 What it costs

Per component, one keystroke in the made-up sentence, jsdom with
development React (median of 41 keys on a quiet run; the machine was
shared, and other runs read two to six times higher in total):

| Rendered | My list empty | 20 in My list |
| --- | --- | --- |
| Five cards | 1.09 ms | 1.04 ms |
| Requirements form | 0.57 ms | 0.59 ms |
| Swaps panel | 0.49 ms | 0.51 ms |
| Strength panel | 0.22 ms | 0.23 ms |
| Site rules | 0.11 ms | 0.11 ms |
| My list (rows included) | 0.03 ms | 4.01 ms |
| Typing test, the other consumers | 0.14 ms | 0.47 ms |
| The whole commit | 3.25 ms | 7.57 ms |

The rows of My list are the largest cost once the list holds anything.
Each row reads the context and works out Strength and Raw on every
render (`SelectedList.tsx:32-33`), about 0.2 ms a row. My list has no
size limit.

In the production build in Chromium (headless shell, CPU slowed with
`Emulation.setCPUThrottlingRate`), the work from a keystroke's `input`
event to the end of the task it starts: React's render and commit, and
the sentence box measuring its height. Each figure is the median over
40 keys, and the table gives the median of three runs:

| Keystroke in the made-up sentence | 1× | 4× | 6× |
| --- | --- | --- | --- |
| My list empty, today | 3.9 ms | 14.2 ms | 21.9 ms |
| My list empty, with §2 | 2.5 ms | 9.8 ms | 14.8 ms |
| 19-20 in My list, today | 4.6 ms | 20.0 ms | 30.8 ms |
| 19-20 in My list, with §2 | 2.8 ms | 12.1 ms | 17.6 ms |
| For scale: a keystroke in the typing test, today | 1.4 ms | 5.6 ms | 9.2 ms |

At 6× with 20 in My list, the time from the keystroke to the next frame
goes from 40.6 ms to 26.1 ms. From the Refresh click to "Working…" in
the page goes from 14.4, 14.5 and 14.0 ms to 13.4, 10.5 and 7.9 ms at
1×, 4× and 6×. At 1× that wait is mostly the scheduler's next task, not
rendering. In jsdom the busy commit alone is 11-22 ms today and
2.3-2.6 ms with §2.

None of this is near a budget at 1×. At 4-6×, which is how H2's spec
estimated a slow phone, a keystroke in a draft field takes one to two
frames of work today, and the list makes it grow with every entry.

## 2. The decision

The provider and its one context stay as they are (2026-10-21). The page
draws memo boundaries around the parts whose inputs a keystroke or a
busy flip does not change, and gives them props that keep their identity
until those inputs change.

### 2.1 Five components are memoised

`SuggestionCard`, `StrengthPanel`, `RequirementsForm`, `TwistsPanel` and
`SiteRules` are each exported as `memo(function Name(...) {...})`. None
of them reads the context. Each holds only its own state, which a memo
boundary does not block.

### 2.2 The page passes them stable props

Three props in `ElegantPasswords` are made fresh on every render today
and would defeat the memo:

- The cards' `context` (`App.tsx:252-253`), memoised on the batch and
  `applied.req.minUppercase`.
- `practiseHere` (`:230-233`), made stable. It still reads the current
  column layout, through a ref written on each render, the way the
  provider reads the draft through `draftRef`. A card that did not render
  after the columns changed still opens Testing when it is needed.
- The swaps panel's `relevant` (`:263-264`), memoised on the mode and
  `draft.sentence`. In sentence mode a keystroke in the sentence still
  renders the swaps panel, because what it disables follows the
  sentence's letters.

Every other prop of the five is already a primitive, the draft's own
sub-object, a memoised batch value (`ordered`, `:261`) or an action from
the provider.

### 2.3 My list's rows take what they show as props

The row component in `SelectedList.tsx` stops reading the context.
`SelectedList` passes each row its entry, the typing mode, the
`practise` action, whether its zxcvbn reading failed (a boolean), and
`removeSelected` itself rather than a closure per row. The row is
memoised and exported as `ListEntry` for the render-count tests. A row
renders when its entry, the typing mode or its reading's failure
changes. `SelectedList` itself still reads the context and renders on
each change, which costs 0.1-0.4 ms.

### 2.4 Busy still flips twice per batch

The first flip is what paints "Working…", `aria-busy` and the dimmed
old batch before the engine takes the thread (`docs/decisions.md`,
"Where generation runs"). With §2.1-2.3 it renders the page component
and the small consumers, and no card, panel or row.

## 3. Alternatives rejected

- **Split the context by how often each part changes** (actions,
  settings, batch, busy, list). The page subscribes to every part, so it
  would still render on every change. Only the consumers outside the
  page's own body would gain. Apart from the list rows, which §2.3
  handles with props, they cost 0.1-0.5 ms together. The price would be
  four or five contexts, a hook for each, and every consumer and the
  test probes rewritten.
- **A store read with `useSyncExternalStore` and selectors.** The
  problem is the same, since the page selects nearly everything. It is a
  larger rewrite as well: the provider's effects, refs and persistence
  reporting would move into the store.
- **`useMemo` on the value and `useCallback` on the actions.** Already
  in place (§1.1).
- **A context for busy alone**, read by a small status component, so a
  flip skips the page too. It would save about 2 ms in jsdom, twice per
  batch, inside the 120 ms debounce. That is not worth a context and a
  component.
- **The React Compiler** (`babel-plugin-react-compiler`), which memoises
  automatically. It adds a Babel pass to a build that has none and
  memoises everything, so what renders is harder to see in the code. Five
  explicit wrappers and three stable props get the same measured gain.
- **Decline.** On a desktop the gain is 1-2 ms a keystroke, which nobody
  notices. Declining was rejected because at 4-6× a keystroke in a
  draft field is one to two frames of work, the list adds to it with
  every entry, and the fix is about 35 lines in seven files with tests
  that hold it (§10, question 1).

## 4. Behaviour visible to users

None. The same screens, the same updates, the same "Working…". A
keystroke in a draft field does a third to two fifths less work, and
the size of My list no longer adds to it.

## 5. Not changed

- `src/state/PasswordsProvider.tsx` and its tests.
- `TypingTest`, `TypingMode`, `ApplyBar` and `SessionControls` still read
  the context and render on every change. Each costs under 0.15 ms
  except the typing test while it holds a long password. That cost is
  its own scoring per render, which M2 removes.
- The fields a keystroke edits (`GeneratedSentenceField`,
  `SentenceInput`) and the tabs render on every keystroke, as they must.
- L4 (the pasted-rules box parses on every render) stays its own item.
  With §2.1 the box no longer renders for changes elsewhere on the page,
  but it still parses on each render that its own text causes.

## 6. The price

- Seven files touched: `src/App.tsx`, the five components of §2.1 (the
  first and last line of each, and an import) and `SelectedList.tsx`.
  The repo uses `memo` nowhere today.
- Memo boundaries can go stale silently. A later prop made fresh on each
  render (an inline object or closure) turns a boundary off, and nothing
  shows it but the render-count tests (§7). A component that starts
  reading something outside its props, other than a context, would show
  stale content. Nothing in the five does that today.
- `ListEntry` is exported for the tests only.

## 7. Tests

New, in `src/App.renders.test.tsx` (jsdom, the whole `App`). Each of the
five components and `ListEntry` is wrapped by `vi.mock` with a counter
inside its memo. The helper takes the module's export, throws "*name* is
not a memo component" if it is not one, and returns the memo with its
inner function counting renders. Prototyped in the scratch directory:
the technique fails on today's code and passes on §2's.

- "a keystroke in the made-up sentence renders no card, strength panel,
  requirements form, swaps panel or site rules".
- "starting a batch renders no card; the batch renders its own cards
  when it lands".
- "a card still renders when what it shows changes: Add marks it Added,
  a new typing mode rescores it". This guards against a boundary that
  hides a real change: after Add, one card renders and reads "Added".
- "in sentence mode the swaps follow the sentence as it is typed":
  `ph→f` is disabled for "sally eats sweets" and enabled once "photo" is
  typed. This guards `relevant`'s dependencies.
- "Practise on a card opens the Testing column when only one column fits,
  after the columns have changed". This guards the stable `practiseHere`.
- "a keystroke in the made-up sentence renders no row of My list; a new
  typing mode renders every row".

Every existing test passes unchanged.

## 8. Found while reading, not this item

The Fun page's app prompt still names `generator` among the
`src/state/` modules and calls `src/worker.ts` the worker entry
(`src/prompts/specPrompt.ts:158`). Both were deleted with H2. It is a
one-line fix that belongs to no M item, and it is not made here.

## 9. Order with the other items

M7 shares no file with M2 (`TypingTest.tsx` and its test), M5
(`PasswordsProvider.test.tsx`) or M3 (`App.test.tsx`, which this item
leaves alone; its tests go in a new file). It can be built before or
after any of them. After M2, the typing test's render on each change in
the provider costs almost nothing, so M2 and M7 together leave a draft
keystroke rendering only small consumers. Built before M2, the figures
in §1.4 for "Typing test" stay as they are until M2 lands.

## 10. Open questions

1. **Build it, or decline the item?** The gain is real on a slowed CPU
   and invisible on a desktop. Recommendation: build it. The change is
   small and contained, it removes the list's per-entry cost, and the
   tests keep it honest. The plan assumes this. If declined, the
   checklist row records §1.4's figures as the reason.
2. **Keep the render-count tests for good?** They pin an optimisation
   that a later refactor may want to drop. Recommendation: keep them.
   They are counts, not clocks (H1's rule), they fail with the
   component's name, and dropping a boundary on purpose then means
   deleting a test on purpose.
3. **Take a phone figure?** Recommendation: not needed. The throttled
   figures already decide the design, and no figure is near a limit that
   would change it. If wanted, the way is H2's: a scratch readout of
   `performance.now()` around a keystroke, shown on the page, from the
   dev server on Serve `:4270`. It is not kept in the code.
