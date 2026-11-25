---
name: assess-features
description: Use when a feature, route, test file or E2E spec is added, renamed or removed, or when the Features area needs refreshing — the feature catalogue (one markdown file per feature), the product route mirror, the tests mapped to features and the Tests and Gaps pages of the workspace.
---

# Assess Features

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview
The feature catalogue lists every feature of the product, one markdown file each, with the routes it owns, the source files it claims and, through them, its tests. The Features area renders it (a Wayfinder module, `createFeaturesArea`, `src/features/` in the kit): an index, a page per feature with its unit and end-to-end tests by description, a Tests page and a Gaps page. What this skill needs to know about the repository comes from the workspace config (the file the root `package.json` `wayfinder.config` names); `REPOSITORY.md` gives this repository's values:

| Setting | Means |
| --- | --- |
| `areas.features.directory` | one `<id>.md` per feature, rendered at `/features/<id>`; the id is the file name, lowercase kebab, permanent (`gaps` and `tests` are reserved) |
| `areas.features.reviewedAt` | the catalogue's reviewed date, an ISO date shown in the nav; set only by this skill |
| `areas.features.sourceRoots` | directories (or globs of directories) of product code; Gaps lists the files under them that no feature claims; nothing fails on them |
| `areas.features.tests.include` | the test files inventoried, parsed at build time |
| `areas.features.tests.infrastructure` | test files no feature owns: the Tests page lists them under Infrastructure and the check does not count them unassigned |
| `areas.features.tests.playwright` | Playwright files that do not import `@playwright/test` themselves (they import a fixtures module) |
| `areas.features.coverage.summaries` | the `json-summary` coverage files, one per test project; the area sums them per feature over its `sources` files |
| `productRoutes` | the route mirror (`routes`, `sidebar`): the product's routes and sidebar paths; this skill owns it |

A feature is a capability of the product at route level; `REPOSITORY.md` says what else counts, or does not. The dead-code findings stay in Audit (`assess-feature-audit`).

The hooks file (the root `package.json` `wayfinder.hooks`) may export `productRoutes(ctx)`, which reads the product's router and sidebar and returns `{ routes, sidebar?, source, sidebarSource? }`. With it the check compares the mirror with the router; without it the mirror is trusted, and the check's summary says so.

## On a placeholder area
When `areas.features` is `{ placeholder: { reason, toFill } }` (the onboarding writes one where the repository has nothing the area reads; `docs/formats.md`, "The document set", Placeholders), test first whether it can now be generated: whether the product serves routes and has test files. If not, leave the placeholder, and make its reason true if what was looked for has changed. If so, replace the placeholder with the settings in the table above, write the route mirror (`productRoutes` and the hooks file's `productRoutes` hook; the content collection covering it and the catalogue comes from `assess-workspace`'s proposal, run after), build the catalogue as the Workflow below says, and set `reviewedAt`, then rebuild the About manifest (`assess-workspace`'s `propose.mjs --write`): the app's wiring is the same for both forms, so nothing else changes. The First run below says how. Two parts may be placeholders in a generated area: `tests: { placeholder }` where the test inventory cannot run (TypeScript 7 has no compiler API, and the kit loads the one package named `typescript`: the repository's `typescript` at 5.x fills it; its proposal writes this placeholder on 7), and the coverage, which the kit shows as a placeholder while `coverage` is unset (a `json-summary` coverage report fills it). The check passes on a placeholder area and prints it after its OK line.

## First run
On a repository whose Features area is new (the onboarding's first runs, `wayfinder-onboard` §4, or a placeholder this skill can now fill), the area is built from nothing, in two parts. An existing catalogue, mirror or feature page is not kept or read: the first run proves what the kit can build.

**Settings.** Run `node .agents/skills/assess-features/scripts/propose.mjs`. It reads the test runners' configs as text (Vitest's and Vite's `test.include`, Vitest's default where a config names none, Playwright's `testDir`, `node --test` globs in the scripts) and proposes, with where it read each:

| Setting | Proposed from |
| --- | --- |
| `tests.include` | the runners' globs that match a test file (one that matches none is listed, and left out) |
| `tests.playwright` | the Playwright tests that import a fixtures module rather than `@playwright/test` |
| `coverage.summaries` | each Vitest config whose coverage reporters name `json-summary`, at its `reportsDirectory`; none, and the coverage stays the kit's placeholder |
| `sourceRoots` | each package's `src` directory with code outside its tests |
| `productRoutes` | the mirror's path, beside the About manifest |

Write them into `areas.features` (replacing the placeholder) as proposed. Then judge, and record in this skill's `REPOSITORY.md` under the table the script printed: `sourceRoots` narrowed to the product's pages and the libraries they import where a package holds more (tooling, a design system); `tests.infrastructure`, the tests of tooling, the platform and shared code, one glob per reason.

**Registry.** The route mirror is built, never written: with the hooks file's `productRoutes` hook (for a TanStack Router `createRoute` tree, `tanstackRoutes(readRepo(<routes file>))` from the kit's `check/route-readers.mjs`; otherwise a reader of the repository's own: of another router's table, or, for a product without a router library, of its own list of pages, each written as a path, `/scoring` for a hash route `#/scoring`), `propose.mjs --write` writes it, and the check compares it with the router from then on. Without the hook there is no mirror: write the hook first. Then the catalogue, from the mirror: one file per feature, a feature being a route or a group of routes a reader would name as one thing, with the sidebar's label as its title where it has one, and one file per feature without a route (a background job, a parked library, planned work on the roadmap). Claim each feature's page and the files it imports in `sources`, map every test (Tests, below), and set `reviewedAt`. Run the check until it prints its OK line, then open `/features/gaps`: every unclaimed file is claimed or explained.


```markdown
---
title: Order detail
status: live
summary: One sentence, shown on the index.
routes: [/orders/:orderId]
sources: [src/pages/order-detail*, src/api/routes/orders.ts]
platformDoc: docs/platform/20-orders.md#the-order-page
specs: [docs/specs/2026-03-01-order-detail-design.md]
roadmap: [ACME-M3.2]
---

The first paragraph: how the feature is reached, in a sentence or two.

## What it does

## Edges
```

- **Keys** (type `Feature` in the kit's `check/features.d.mts`; any other key fails): `title`, `status`, `summary` and `sources` are required, except that a `planned` feature has no `sources`. `routes`, `tests`, `platformDoc`, `specs` and `roadmap` are optional.
- **Lists** are written inline, `[a, b]`: one line, comma-separated. The front matter is YAML, so an item with a brace, `: ` or `#` is quoted (`['src/{a,b}.ts', src/c.ts]`): an unquoted `{a,b}` glob fails to load (`docs/formats.md`, the front-matter rule).
- **`status`**: `live` is a route with a sidebar item or in-app link, or a feature without a route that its users reach another way (a command line, a background job); `partial` is a route or sidebar item without its counterpart; `parked` is a library nothing imports; `planned` is roadmap work with no route yet.
- **`routes`**: written exactly as in the mirror (`:param`). Every mirror route belongs to exactly one feature.
- **`sources`**: repository-relative globs (`**`, `*`, `?`, `{a,b}`; no `!`, no `[…]`). Name the route's page, the feature's library files and the API handlers it calls. Where one library serves several features, name the files that are this feature's by their names (`src/lib/scoring*`), not `src/**`; no import list is traced. A file several features use (a barrel, shared data) goes in each. Use `page.*` rather than `page*` when another page shares the prefix (`orders*` also matches `orders-export.tsx`).
- **API handlers**: when `areas.api.registry` is configured, for every registry row, the feature owning each of its `pages` names its `handler` in `sources`. The check fails otherwise, so a new endpoint from `assess-api` means a change here.
- **`platformDoc`**: a Platform Docs file (under `areas['platform-docs'].directory`), optionally with `#anchor`, where the anchor is a `##` or `###` heading's slug.
- **`roadmap`**: milestone, phase, Completed-row or Outside-the-roadmap ids from the roadmap (`areas.audit.roadmap`; the format is the kit's `docs/formats.md`).
- **`tests`**: extra test globs, for a test that sits beside no file the feature's `sources` claim (one test file covering two components under other names).
- **Body**: no `#` title (the page header shows it). Plain, factual, present tense; read the code, do not invent behaviour.

## Tests

The workspace reads every test file statically (the kit's `check/test-inventory.mjs`, the TypeScript parser, no test run): describe path, title, line, `skip`/`only`/`todo`/`fixme`, `each` and loops, and Playwright tags. Each test is mapped (`testOwnership` in the kit's `check/features.mjs`):

- **A unit test** (Vitest, or `node:test` in `.mjs` specs) belongs to the features whose `sources` or `tests` globs match its file or the file it tests: `routes/orders.test.ts` tests `routes/orders.ts`. A test beside claimed code needs nothing.
- **An end-to-end test** (Playwright) belongs to the features its tags name. Tag the describe, or the test: `test.describe('Placing an order', { tag: '@feature:checkout' }, () => …)`, a list for several. An untagged one falls back to path ownership, which an E2E spec rarely has.
- **Otherwise** it is unassigned and the check fails, unless its file matches `tests.infrastructure`. Only tooling, the platform and shared code belong there; a feature's test claims the feature's code instead.

**Coverage** is read, never written, by this skill: run the tests with coverage (the repository's coverage command (a `package.json` script, or the one `REPOSITORY.md` names)), and the area sums lines, statements, branches and functions per feature over the files its `sources` match, from the summaries `coverage.summaries` finds. A feature's E2E figure is the routes its tagged tests open with `page.goto` (directly, in a `beforeEach`, or in a same-file helper). Coverage fails nothing; a file "not in any coverage summary" sits in a library with no test project measuring it. Every test project keeps the same coverage block (writing a `json-summary` where `coverage.summaries` finds it); a new project gets it too.

Titles are the documentation: a top-level `describe` names the unit or the feature, a test title is a present-tense sentence about behaviour ("overdue tile filters the list"), never "should …", never empty, never repeated within its describe.

## Workflow
1. `node .agents/skills/assess-features/scripts/check-feature-catalogue.mjs`. It runs `runCheck('features')` over the kit's `check/run.mjs`; the catalogue and test rules are the kit's `check/feature-catalogue.mjs`, which shares its builder, glob matcher, test inventory and ownership with the workspace. Fix every line: an `unassigned:` line names a test file no feature owns.
2. Read the product surface: the router and the sidebar (the hooks file's `productRoutes` names them as `source` and `sidebarSource`; `REPOSITORY.md` otherwise), the page components and the libraries they import, and, with `areas.api.registry`, its rows (`pages` → `handler`).
3. **A route was added, renamed or removed** → update the mirror (`routes`, and `sidebar` if the sidebar changed), then the feature that owns it: a new screen gets a new file, a renamed one keeps its id.
4. **A feature's code moved** → update its `sources`. Open `/features/gaps` on the workspace dev server: every file under "Source files no feature claims" should be claimed, or be something no feature owns (the 404 page, a test helper, a handler nothing calls). Say which in the change.
5. **A test file was added or moved** → it should land on a feature: claim the file it tests in that feature's `sources`, add a `tests` glob, or tag an E2E test `@feature:<id>`. List it under `tests.infrastructure` only when it tests tooling or shared code. Open `/features/tests` and check the Unassigned section is empty; Gaps' "Features with no tests" is reported, not failed.
6. **Prose**: check each claim against the page, as `assess-platform-docs` does for Platform Docs, and keep the two consistent.
7. Bump `areas.features.reviewedAt` in the workspace config, re-run the script, then run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others). The workspace loads every feature at start-up and throws on a malformed file. Then open the area on the workspace dev server: `/features`, `/features/tests` and the pages you changed.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it. The mirror has no date of its own; it moves with `areas.features.reviewedAt`.

## Common Mistakes
| Mistake | Fix |
|---|---|
| A route in two features, or in none | One owner per route; split the feature or move the route |
| `routes: /orders` without brackets | Every list is `[…]`, even with one item |
| A lib-wide `src/**` for a shared lib | Name the library's files that are this feature's |
| Forgetting the API handler of a new endpoint | Add it to the `sources` of the feature owning each of the endpoint's pages |
| Updating the router without the mirror | The mirror (`productRoutes`) and the owning feature move together; with a `productRoutes` rule the check compares the mirror with the router |
| Writing an H1 or code-level prose | The header shows the title; write for an engineer new to the product |
| Treating Gaps as failures | Unclaimed files are reported, not failed; claim them or leave them with a reason |
| Listing a feature's test under `tests.infrastructure` to silence the check | Claim the code it tests in the feature's `sources`, or add a `tests` glob |
| A new test project without the coverage block | Copy the block from any other project's test config, or its code reads "Not measured" |
| An E2E spec without a `@feature:` tag | Tag its describe (`{ tag: '@feature:<id>' }`); a typo in the id fails the check |
| A "should …" or repeated title | Present-tense behaviour, unique within its describe |
| Adding, renaming or removing a registry or setting without telling About | Run `assess-workspace`, whose `propose.mjs --write` rebuilds the About manifest from the config |
