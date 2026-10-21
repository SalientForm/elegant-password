# Plan: the planning cache

Implements `docs/specs/2026-10-21-m4-planning-cache-design.md` on
`feature/audit-medium`. Written 2026-10-21. Each step ends green on
`pnpm typecheck` and `pnpm test` and stands on its own as a commit; step
3 is checked by CI itself; step 4 is documentation alone. Line numbers
are at commit `48e719c`; `generate.ts` was being edited for M1 while this
was written, so each change is also anchored on its function or constant.

## 1. A model shares its pools' word groups (spec §2.1)

- `src/lib/lengthModel.ts`:
  - New, above the class: `const groupsCache = new WeakMap<readonly
    string[], ReadonlyMap<number, readonly string[]>>()` and `export
    function wordsByLength(pool: readonly string[]): ReadonlyMap<number,
    readonly string[]>`, which builds the grouping the constructor builds
    today (lines 18-26) once per pool and returns the cached `Map`
    after. A one-line comment says why: every model over a pool shares
    its groups, so a model holds only its counts.
  - The field `byLength` (line 13) becomes `private readonly ReadonlyMap<number,
    readonly string[]>[]`; the constructor's lines 18-26 become
    `this.byLength = pools.map(wordsByLength)`.
  - `count`, `meanLength` and `sample` are unchanged; `sample`'s spread
    (`[...this.byLength[i]!]`, line 78) type-checks on a `ReadonlyMap`.
- `src/lib/lengthModel.test.ts`, in `describe('LengthModel')` after
  "refuses an impossible range" (line 53); import `wordsByLength`:
  - "groups a pool's words by length once, so every model over the pool
    shares the groups": `wordsByLength(p)` is the same object twice, and
    `[...wordsByLength(['a', 'bb', 'cc', 'd'])]` equals `[[1, ['a', 'd']],
    [2, ['bb', 'cc']]]`.
  - "counts and samples the same over a shared pool as over a copy of
    it": `new LengthModel([P, P])` against `new LengthModel([[...P],
    [...P]])` for one pool `P`: `count` and `meanLength` over several
    ranges, and 200 samples from `seeded(7)` each, equal.
- `pnpm test:titles`.
- Measure (scratch, not committed): bytes per model by the method of the
  spec §1.1, expected about 12 KB; record if it differs.

## 2. Least recently used out, at 1,000 (spec §2.2)

- `src/lib/generate.ts`, the planning cache above `modelFor`:
  - Line 358's comment: "Length models hold only their counts (the word
    groups are shared per pool), about 12 KB; the one used longest ago is
    dropped when the cache is full. 1,000 holds three plans at the widest
    lengths."
  - Line 359: `export const MODEL_CACHE_LIMIT = 1000;`.
  - New, after it: `/** How many length models planning holds, for the
    tests. */ export function cachedModelCount(): number { return
    modelCache.size; }`.
  - `modelFor` (lines 366-375): on a hit, `modelCache.delete(key)` and
    `modelCache.set(key, model)` before returning; on a miss, `if
    (modelCache.size >= MODEL_CACHE_LIMIT)
    modelCache.delete(modelCache.keys().next().value!)` in place of
    `modelCache.clear()` (line 371). The key (line 367) is unchanged.
- `src/lib/generate.test.ts`: add `plan`, `MODEL_CACHE_LIMIT` and
  `cachedModelCount` to the import from `./generate` (line 2). A new
  `describe('the planning cache')` at the end of the file, after "made-up
  nouns and real words" (line 577):
  - "plans the same settings twice without building a length model
    again, even at the widest lengths": `plan(req({ maxLength: 128 }))`
    twice; every `variants[i].model` of the second is `toBe` the first's.
  - "keeps at most MODEL_CACHE_LIMIT length models and drops the one used
    longest ago": twelve settings at `maxLength: 128` (comfort strict,
    balanced, relaxed; `easeSwaps` on and off; `initials` 0 and 1). Plan
    the first and the second and keep their first variants' models; then
    plan the other ten, planning the first again after each. The first
    plan's model is the same object at the end, the second's is a new
    one, and `cachedModelCount()` is at most `MODEL_CACHE_LIMIT`. The
    test owns its order: nothing before it can evict what it touches,
    since it touches its own models last.
- `pnpm test:titles`.
- Measure (scratch, not committed): the three sessions of the spec §1.1
  against this commit, expected as the spec §2.4; record any difference
  in the spec.

## 3. The unit suite in the default heap (spec §2.3)

- `.github/workflows/ci.yml`: lines 31-32 (`env:` and the
  `NODE_OPTIONS` line with its comment) go; `- run: pnpm test` (line
  30) stays.
- `.github/workflows/pages.yml`: lines 35-36 go likewise.
- Check locally that the suite passes with room to spare under any runner's default:
  `NODE_OPTIONS=--max-old-space-size=256 pnpm test` three times, and
  once with no `NODE_OPTIONS`. Push; CI passes without the flag. If it
  does not, the step stops and the spec's §1.2 is reopened rather than
  the flag put back.

## 4. The documentation carries the decisions; the spec goes

- `docs/decisions.md`, "Limits and caches" (lines 160-163): the bullet
  keeps the scorer's caches as they are ("400 cold scores, each mapping
  list 5,000 spellings; a full cache is emptied rather than evicted one
  entry at a time") and planning gets its own bullet: **planning keeps
  1,000 length models and drops the one used longest ago** (2026-10-21).
  A model holds only its counts, about 12 KB, because the words grouped
  by length are built once per pool and shared; 1,000 holds three plans
  at the widest lengths (288 shapes), so a Refresh never rebuilds; full,
  about 12 MB, where 400 unshared models measured 27 to 63 MB and a
  clear-all cap of 400 never hit for two wide settings in turn. Not
  taken: no cache (a plan at a maximum of 128 is 20.8 ms built against
  3.3 ms cached). `src/lib/lengthModel.ts`, `src/lib/generate.ts`.
- `docs/decisions.md`, "Build and deploy" (line 361): **the unit suite
  runs in Node's default heap** (2026-10-21). It passes at 256 MB; the
  4 GB flag of 2026-10-16 was for a planning cache with no cap and came
  out when the cap and `mayFit` had made it unneeded. A heap ceiling was
  not set: the cache's bound is asserted by count.
- `README.md`: line 414's `lengthModel.ts` entry is unchanged (it says
  what the module does). Nothing user-facing changes.
- `docs/algorithm-flow.md`: unchanged, the algorithm is the same.
- `docs/audits/2026-10-21-audit-checklist.md`, row M4: Status **built**;
  Spec column: `docs/decisions.md`, "Limits and caches" and "Build and
  deploy" (the spec and plan folded in and removed); the commits of steps
  1 to 3, 2026-10-21; a model 70-162 KB to about 12 KB, a full cache 27-63
  MB to about 12 MB, the slowest plan 61-93 ms to 19-27 ms, the unit
  suite in the default heap.
- Delete `docs/specs/2026-10-21-m4-planning-cache-design.md` and this
  plan.
