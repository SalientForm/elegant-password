# assess-features in Elegant Passwords

What `scripts/propose.mjs` read off the repository on the Features area's first run (2026-11-24), before `--write`,
with the tests as it proposed them on 2026-11-25, once the kit's test inventory stopped needing TypeScript 5:

| Setting | Proposed | From |
| --- | --- | --- |
| `areas.features.tests.include` | `["e2e/**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs}","**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs}"]` | playwright.config.ts, vite.config.ts |
| `areas.features.sourceRoots` | `["src"]` | each package's src directory |
| `areas.features.directory` | `"docs/features"` | the kit's default: one markdown file per feature |
| `productRoutes` | `"wayfinder/src/product-routes.json"` | the hooks file's productRoutes (src/App.tsx) |

judged: areas.features.tests.infrastructure — the tests of tooling, the platform and shared code, which no feature owns; never a feature's test
judged: the catalogue — one file per feature in the directory: one per route group of the mirror, and one per feature without a route
judged: areas.features.reviewedAt — today, once the catalogue is written
judged: areas.features.sourceRoots — narrow each root to the product's pages and libraries where the package holds more

no test config writes a json-summary coverage report: leave coverage unset, and the kit shows it as a placeholder

## What was judged, and why

- **The route mirror** comes from the hooks file's `productRoutes` (`wayfinder/src/workspace.hooks.mjs`): the web app has
  no router library, so the hook reads `PAGES` in `src/App.tsx`, whose hash links (`#/`, `#/scoring`, `#/fun`) are
  written as paths (`/`, `/scoring`, `/fun`). They are the header's navigation too, so `sidebar` equals `routes`.
- **Tests** (2026-11-25): the include globs as proposed, and the 13 files no feature's `sources` reached placed by
  hand. As a feature's `tests` glob: the smoke and phone E2E specs, `App.renders`, `generate.modes` and `reduceTo12`
  (Passwords: the page and its generation); `strengthFloor` (Scoring); `bundle`, `walk` and `scripts/linkCli`
  (tep); `testTitles` (Fun, whose prompt lists them). As `tests.infrastructure`: `boundaries` (the architecture's
  rules), `workflows` (CI) and `csp` (the build's security policy). The E2E specs carry no `@feature:` tags.
- **No coverage:** no test config writes a `json-summary` report, so `coverage` is unset and the kit shows its
  placeholder.
- **`sourceRoots`** stays `src`: everything under it is product code (the core, the web app, the CLI, the prompts).
- **The catalogue:** one feature per page of the web app (Passwords, Scoring, Fun), `tep` as a live feature with no
  route (reached from a terminal), and the core package as planned work (EP-M1.1, no sources). Each feature's
  `sources` are the files its entry imports, followed through relative imports (`src/main.tsx` without the lazily loaded
  Scoring and Fun pages; `src/components/ScoringPage.tsx`; `src/components/FunPage.tsx`; `src/cli/bin.ts`), so the
  core's files appear in each feature that uses them.
- **Left unclaimed on Gaps:** `src/cli/testing.ts` (the CLI tests' fake terminal) and `src/lib/testRandom.ts` (seeded
  randomness for the tests and `pnpm stats`): test helpers, which no feature owns.

## This repository's rules

- A page of the web app is a `PAGES` row in `src/App.tsx`; a new one changes the mirror (`propose.mjs --write`) and
  gets a feature file.
- Verify with `pnpm workspace:check`, then `pnpm typecheck` and `pnpm test`.
