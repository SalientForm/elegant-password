# assess-feature-audit in Elegant Passwords

What `scripts/propose.mjs` read off the repository on the feature audit's first run (2026-11-24), before `--write`:

| Setting | Proposed | From |
| --- | --- | --- |
| `areas.audit.unusedExports.roots` | `["src"]` | the directories holding the packages |
| `areas.audit.unusedExports.entries` | `["**/main.{ts,tsx,js,jsx}","**/index.html","**/vite.config.{ts,mts,js,mjs}","**/vitest.setup.ts","**/test-setup.ts","**/playwright.config.ts","**/eslint.config.{js,mjs}","src/cli/bin.ts"]` | the whole list, which replaces the kit's: its defaults, and the files the configs, index.html files and package scripts name |
| `areas.audit.unusedExports.ignore` | `[]` | the workspace app when it sits under a root, and the fixtures under the roots; none when neither does |
| `areas.audit.featureAudit` | `"wayfinder/src/feature-audit.json"` | beside the About manifest |
| `areas.audit.todoSources` | `["feature-audit:"]` | added to the list: a todo finding's TODO entry names it |

judged: findings — each draft finding's title, summary, action and group, after confirming it; unreachable, todo and recommendation findings come from reading the product
judged: findings.status — open, or known and planned with the ref where the repository already records it

not drafted: 90 exports used only in their own file and 92 used only by tests, which are not dead code (scripts/find-unused-exports.mjs lists them)

## What was judged, and why

- The settings went into `areas.audit` as proposed. `ignore` is unset: the workspace app (`wayfinder/`) is outside
  `src`, and `src` holds no fixtures. `src/lib` is not ignored as a public API yet: the core package (EP-M1.1) will
  have one entry, `src/lib/index.ts`, and only its exports are public.
- **The one draft finding is confirmed:** `isCommonPassword` (`src/lib/common.ts`) has no reference but its own
  declaration; callers use `commonRank`. Its action leaves the choice between deleting it and exporting it from the
  package.
- **Nothing else found** by reading the product: the three pages are all in the header's navigation (no unreachable
  page), there is no `public/` directory, no `TODO` or `FIXME` comment in `src/`, and no API. So one group, `dead-code`,
  and no `todo` finding (and no `feature-audit:` TODO entry).

## This repository's rules

- Verify with `node .agents/skills/assess-feature-audit/scripts/find-unused-exports.mjs`, then `pnpm workspace:check`,
  `pnpm typecheck` and `pnpm test`.
