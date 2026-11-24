# assess-features in Elegant Passwords

What `scripts/propose.mjs` read off the repository on the Features area's first run (2026-11-24), before `--write`:

| Setting | Proposed | From |
| --- | --- | --- |
| `areas.features.tests` | `{"placeholder":{"reason":"The test files cannot be listed: the inventory parses them with the TypeScript 5 compiler API, and this repository resolves typescript 7.0.2, which has none.","toFill":"Move the repository to typescript 5.x (5.9 or later) and run assess-features again, which sets areas.features.tests and maps the tests to features. On TypeScript 7 it stays a placeholder: the kit loads the one package named typescript."}}` | the repository's typescript (typescript 7.0.2) |
| `areas.features.sourceRoots` | `["src"]` | each package's src directory |
| `areas.features.directory` | `"docs/features"` | the kit's default: one markdown file per feature |
| `productRoutes` | `"wayfinder/src/product-routes.json"` | the hooks file's productRoutes (src/App.tsx) |

judged: areas.features.tests.infrastructure — the tests of tooling, the platform and shared code, which no feature owns; never a feature's test
judged: the catalogue — one file per feature in the directory: one per route group of the mirror, and one per feature without a route
judged: areas.features.reviewedAt — today, once the catalogue is written
judged: areas.features.sourceRoots — narrow each root to the product's pages and libraries where the package holds more

with typescript 5 installed, areas.features.tests.include would be: e2e/**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs}, **/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs}
no test config writes a json-summary coverage report: leave coverage unset, and the kit shows it as a placeholder

## What was judged, and why

- **The route mirror** comes from the hooks file's `productRoutes` (`wayfinder/src/workspace.hooks.mjs`): the web app has
  no router library, so the hook reads `PAGES` in `src/App.tsx`, whose hash links (`#/`, `#/scoring`, `#/fun`) are
  written as paths (`/`, `/scoring`, `/fun`). They are the header's navigation too, so `sidebar` equals `routes`.
- **Tests stay a placeholder**, as proposed: the repository is on TypeScript 7 and cannot add 5 beside it. So there is
  no `tests.include`, no `tests.infrastructure` and no test mapping; the E2E specs carry no `@feature:` tags yet.
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
