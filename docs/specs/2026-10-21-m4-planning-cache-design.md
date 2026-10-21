# The planning cache: shared word groups, least recently used out

Status: **proposed**, 2026-10-21. Acts on item M4 of
`docs/audits/2026-10-21-audit-checklist.md`. Line numbers are at commit
`48e719c` on `feature/audit-medium` (M1 built); the lines this item names
are the same as at `b9b5e65`, where the measurements were taken.

## 1. The problem

Planning counts, for every sentence shape, the word sequences that fit the
length window. `modelFor` (`src/lib/generate.ts:366-375`) builds one
`LengthModel` per shape and keeps it in `modelCache`
(`src/lib/generate.ts:357`), keyed on the comfort level, the digit count,
the ease setting and the shape's slots and forms; the length window is not
in the key. At `MODEL_CACHE_LIMIT` (400, `:359`) the whole cache is
emptied. `docs/decisions.md` ("Limits and caches") calls a model "about a
megabyte"; that was never measured, and is wrong in both directions below.

Since H2 the cache lives on the page's thread, so the garbage a clear
leaves is collected there, between paints.

### 1.1 Measured

Node 24.18 on the development desktop, `node --expose-gc`, heap after two
collections; a scratch bench outside the repo, against a copy of `src/lib`
at `b9b5e65`.

What a model holds. The constructor (`src/lib/lengthModel.ts:18-26`)
copies each slot's pool into new arrays grouped by word length, so every
model carries its own copy of every pool it uses; only the counts
(`suffix`) are its own work.

| Settings | Shape | Model | Counts alone |
| --- | --- | --- | --- |
| strict, 1 digit | 4 slots | 13.7 KB | 1.7 KB |
| strict, 1 digit | 22 slots | 80.5 KB | 21.5 KB |
| balanced, 1 digit, ease on (the defaults) | 4 slots | 20.7 KB | 1.8 KB |
| balanced, 1 digit, ease on | 22 slots | 110.2 KB | 22.5 KB |
| relaxed, 4 digits (9,000 numbers) | 4 slots | 105.2 KB | 1.5 KB |
| relaxed, 4 digits | 22 slots | 216.3 KB | 22.2 KB |

The copies are 80 to 99 % of a model. Over a whole plan the average is
70 KB at the default comfort and 162 KB at relaxed with four digits.

How many models a plan builds. There are 64 templates and 288 shapes once
the number is placed. `mayFit` skips shapes that cannot fit, so the
defaults (12 to 32 characters) build 8 models, and a maximum of 128 builds
280. The cap of 400 therefore holds one plan at the widest lengths: a
second such setting empties the cache part way through, and two settings
used in turn never hit.

A full cache. 400 models measured 27.3 MB at the default comfort and
63.2 MB at relaxed with four digits, with a maximum of 128; 400 of the
largest shape would be 87 MB, the audit's "about 100 MB".

Sessions, `plan()` alone, a fresh cache with the pools already ranked:

| Session | Models built | Hits | Planning, total | Slowest plan | Held at the end | Collection, total (longest pause) |
| --- | --- | --- | --- | --- | --- | --- |
| Typical: 31 batches, Refresh, comfort, ease, digits, forms, lengths 32/40/64/128 | 1,952 | 25 % | 493 ms | 83 ms | 30.8 MB | 76 ms (6.6 ms) |
| Two settings at maximum 128, in turn, 20 batches | 5,760 | 0 % | 889 ms | 61 ms | 9.4 MB | 130 ms (6.7 ms) |
| 24 wide settings, twice (48 batches) | 8,239 | 17 % | 1,793 ms | 93 ms | 43.8 MB | 267 ms (5.8 ms) |

A whole batch (`generate()`) with its models cached takes 15 ms at the
defaults and 17 ms at a maximum of 128, so a plan that builds its models
cold is most of a batch.

### 1.2 The 4 GB heap is not this cache any more

`ci.yml:31-32` and `pages.yml:35-36` run `pnpm test` with
`NODE_OPTIONS=--max-old-space-size=4096`, "generate.test.ts runs out of
the default heap on the runner" (the audit's `ci.yml:29` is now line 32).
The flag came in `c29d38c` on 2026-10-16, when the cache had no cap and
every shape built a model:

| Tree | `generate.test.ts` |
| --- | --- |
| `c29d38c` (2026-10-16), no cap | fails at 2,048 MB, passes at 4,096 MB |
| `08f881c^`, no cap | fails at 1,024 MB |
| `08f881c` (2026-10-20), `mayFit` skips shapes that cannot fit | passes at 1,024 MB |
| `c1ce838^` | passes at 512 MB, fails at 256 MB |
| `c1ce838` (2026-10-20), the cap of 400 | passes at 256 MB |
| `b9b5e65` and `48e719c`, the whole suite (75 files) | passes at 256 MB in four runs out of four; at 192 MB `walk.test.ts`, whose walks are random, fails two runs in four; at 128 MB `generate.test.ts` fails too |

Vitest runs each file in a forked process that inherits `NODE_OPTIONS`,
so these are per-file limits. Node's default limit is sized from the
machine's memory and is gigabytes on any GitHub runner. The flag now does
nothing but hide the next regression.

## 2. The decision

### 2.1 A model shares its pools' word groups

`lengthModel.ts` gains `wordsByLength(pool)`: the pool's words grouped by
length, built once per pool and kept in a `WeakMap` on the pool's
identity, like `boundsOf` and `shortestIn` in `generate.ts`. The
constructor takes each slot's groups from it instead of building its own,
and holds them as `ReadonlyMap<number, readonly string[]>`. A model then
holds only its counts. `sample` already reads the groups without changing
them.

Every pool `modelFor` passes is already one object for the session:
`pools()` caches by comfort, digits and ease (`src/lib/grammar.ts:203`),
`typedPool` and the initials and two-letter forms are `WeakMap`s on the
pool, and `MADE_UP_NOUNS` is a constant. A caller that passes a fresh
array still gets a correct model, only an unshared one.

Measured on the prototype: 12 KB a model on average, at every comfort and
digit count. The groups themselves are one copy per pool, 138 KB for the
largest set (relaxed, four digits, as written and as typed), and live as
long as `pools()` keeps the pools.

### 2.2 The cache keeps 1,000 models and drops the least recently used

`modelFor` moves a model to the end of the `Map` on a hit (delete and set)
and, when full, deletes the first key, the one used longest ago, before
adding. `MODEL_CACHE_LIMIT` becomes 1,000 and is exported, with
`cachedModelCount()`, for the tests, as `twists.ts` exports
`VARIANT_CACHE_LIMIT` and `cachedSpellingCount`. The key does not change.

1,000 holds three plans at the widest lengths (288 shapes each), so a
Refresh, and a change and back, never rebuild. Full, it is 11.7 MB at
relaxed with four digits and 11.6 MB at the default comfort, against 63.2
and 27.3 MB for 400 today.

### 2.3 The unit suite runs in the default heap

The `NODE_OPTIONS` lines go from both workflows, comment included. The
suite's bound is asserted by count in its tests (§8), not by a heap size
in CI.

### 2.4 Measured on the prototype

The same sessions as §1.1, both changes applied:

| Session | Models built | Hits | Planning, total | Slowest plan | Held at the end | Collection, total (longest pause) |
| --- | --- | --- | --- | --- | --- | --- |
| Typical, 31 batches | 1,350 | 48 % | 165 ms | 23 ms | 11.1 MB | 5 ms (2.0 ms) |
| Two settings at 128, in turn | 576 | 90 % | 108 ms | 27 ms | 6.6 MB | 3 ms (1.6 ms) |
| 24 wide settings, twice | 6,912 | 31 % | 582 ms | 19 ms | 11.9 MB | 40 ms (2.8 ms) |

Every unit test of `src/lib` passes on the prototype, and 40 passwords
drawn from seeded randomness at four settings (the defaults, maximum 128,
relaxed with four digits, initials, two-letter words and a made-up noun)
are identical with and without the change.

## 3. Alternatives rejected

Measured on the same sessions where a number is given.

- **No cache, shared groups.** Nothing held, and the simplest code: the
  slowest plan is 26 to 37 ms and the totals 241, 404 and 668 ms. But a
  Refresh at a maximum of 128 rebuilds 280 models every time: the plan
  takes 20.8 ms on the desktop against 3.3 ms with its models cached
  (median of seven), and a phone is four to eight times slower. The
  commonest action should not pay it. At the defaults the cache buys
  nothing (2.4 ms either way). This is the fallback if the user wants no
  cache (§9).
- **Least recently used at 400, shared groups.** 5.0 MB, but the same 0 %
  hits for two wide settings in turn as today (428 ms): 400 is under two
  plans at 288 shapes.
- **Least recently used at 2,000.** No better than 1,000 on any session
  (48, 90 and 31 % hits) for twice the memory (13.6 to 23.1 MB).
- **Least recently used without sharing the groups.** The memory is the
  problem: 23.6 to 64.1 MB held, and the slowest plan still 52 to 78 ms.
- **Clear-all kept, shared groups.** 2.3 to 4.5 MB, but two wide settings
  in turn still never hit, and a clear still drops a whole cache at once.
- **Cache whole plans by the requirements.** The key would need the
  lengths, symbols and counts, so it misses more, and it holds the same
  models.
- **A cap in bytes.** Models now differ by at most 15 times (1.5 to
  22.5 KB) and the count bound is already within 12 MB; a byte budget
  needs a size estimate per model for no gain.
- **Smaller counts.** A `Float64Array` row would hold the same 8 bytes a
  count as the number arrays do in Node. Cutting each row at `MAX_LENGTH`
  letters, or
  sharing the rows of shapes that end the same way, would trim the 12 KB
  further for more code than the 12 MB warrants.

## 4. What users see change

Nothing but speed: the same plans, bits and passwords for the same random
draws. The slowest plan in the sessions falls from 61 to 93 ms to 19 to
27 ms on the desktop, the page holds about 12 MB at most for planning
instead of up to 87 MB, and collection on the page's thread falls from 76
to 267 ms a session to 3 to 40 ms.

## 5. Deliberately not changed

- The model's key, including that a digit count of 0 and of 1 build the
  same pools under two keys (`pools()` does the same); a small duplicate.
- The scorer's caches (400 cold scores, 5,000 expansions and recoveries)
  and the spellings per mapping list (5,000): clear-all, not named by the
  audit, not measured here.
- `pools()`'s cache: a `Map` with at most 30 entries (3 comfort levels, 5
  digit counts, ease on or off).
- `LengthModel`'s interface and its counting; `sample` still spreads a
  slot's groups per call.
- `docs/algorithm-flow.md`: the algorithm is the same.

## 6. Found on the way, not this item

- `walk.test.ts` (M6) plans for every choice the wizard offers; cheaper
  models may shorten it. Not claimed, not measured.
- `pages.yml`'s copy of the check job (L9) carries the same flag; both
  copies lose it here, so L9 has one line less to reconcile.

## 7. The price

- The cache is still state on the page's thread: up to about 12 MB for
  the session, and a session that moves through more than three wide
  settings rebuilds, at 19 to 27 ms a plan on the desktop.
- The groups are shared, so a change that wrote to them in `sample` would
  corrupt every model over that pool. The readonly types and the test that
  a shared pool counts and samples as a copied one guard it.
- Without the flag, a regression that grows the suite's memory fails CI
  with an out-of-memory error rather than passing on a 4 GB heap. That is
  the intent.

## 8. Tests that prove it

`src/lib/lengthModel.test.ts`, in `LengthModel`:

- "groups a pool's words by length once, so every model over the pool
  shares the groups": the same `Map` for the same pool, words grouped in
  order.
- "counts and samples the same over a shared pool as over a copy of it":
  one pool used for two slots against two copies; counts, means and seeded
  samples equal.

`src/lib/generate.test.ts`, a new group "the planning cache":

- "plans the same settings twice without building a length model again,
  even at the widest lengths": every variant of the second
  `plan({ maxLength: 128 })` holds the first one's model object.
- "keeps at most MODEL_CACHE_LIMIT length models and drops the one used
  longest ago": twelve settings at a maximum of 128 (comfort, ease,
  initials 0 or 1), the first planned again after each; the first keeps
  its model object, the second gets a new one, and `cachedModelCount()`
  is at most the limit.

The existing generation tests, unchanged, are the check that plans and
passwords are the same. `src/lib/testTitles.json` is regenerated. CI
running the suite without the flag is the check of §2.3.

## 9. Open questions

1. **Keep a cache at all?** Recommended: yes, 1,000 models, least
   recently used out (§2.2): about 12 MB buys a plan at the widest
   lengths in 3.3 ms instead of 20.8 ms on a Refresh on the desktop. The other answer
   is no cache with the shared groups: nothing held and less code, at that
   cost per Refresh. This spec is written for the cache.
2. **A heap ceiling in CI instead of none?** Recommended: no ceiling,
   the default heap. A ceiling (say 512 MB, twice the 256 MB the suite
   passes in today)
   would catch a regression the tests do not count, but would also fail
   on growth in jsdom or Vitest, with an error that names no cause. The
   cache's bound is asserted by count in §8.
