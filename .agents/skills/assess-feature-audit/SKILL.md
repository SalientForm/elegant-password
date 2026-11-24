---
name: assess-feature-audit
description: Use when asked to audit, find, or update dead code, unused or unreachable features, orphaned libraries, stale TODOs, or recommendations — after removing or landing a feature, or when the workspace's Features page under Audit needs refreshing. Findings are grouped by the audit's own sections.
---

# Assess Feature Audit

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview

Find code and features that are **dead** (isolated: zero importers/callers) or **unreachable** (present but no route, link, or enablement leads to it), collect known TODOs and recommendations, and record them in the workspace's feature audit.

**The registry is data, not prose.** Findings go in the feature audit, the file `areas.audit.featureAudit` names in the workspace config (the file the root `package.json` `wayfinder.config` names; type `FeatureAudit` in the kit's `check/audit-registries.d.mts`), plus one entry in the TODO list (`areas.audit.todo`) per `kind: 'todo'` finding (`Source: feature-audit:<slug>`, so `areas.audit.todoSources` must list `feature-audit:`; format owned by the `todo` skill). The file holds `reviewedAt`, `groups` (the page's sections: `{ "id", "title", "blurb" }`, in page order) and `findings`. The Features page under Audit (`/audit/implementation/features`, the kit's Audit module, `createAuditArea`) renders the findings by group (badges, Copy-as-prompt via `formatFindingForPrompt()`). What the product ships, feature by feature, is the feature catalogue (`areas.features.directory`, the Features area), and the route mirror (`productRoutes`) belongs to it: both are the `assess-features` skill's. Never write findings to a markdown report, README, or new page.

**Without a feature audit** (`areas.audit.featureAudit` unset), Audit's Features page is a placeholder the kit states, and the audit check prints it after its OK line, until the first run (below) writes it.

**Scope:** the product's code under `areas.audit.unusedExports.roots` (default `['src']`). The workspace app itself is out of scope (it is the consumer of this registry), and so is the kit, whose exports are its public API; list both under `unusedExports.ignore`, so `find-unused-exports.mjs` does not report them while their files still count as users. Usage *from* the workspace still counts as usage for shared component library exports.

## First run
On a repository with no feature audit yet (the onboarding's first runs, `wayfinder-onboard` §4, after `assess-features`, whose route mirror the reachability reading uses), the audit is built from nothing, in two parts. An existing feature audit from an earlier install is not kept or read: delete it first.

**Settings.** Run `node .agents/skills/assess-feature-audit/scripts/propose.mjs`. It proposes the sweep's settings, read off the repository's build and test configs, with where it read each:

| Setting | Proposed from |
| --- | --- |
| `unusedExports.roots` | the top-level directories that hold the repository's packages (`apps`, `libs`), else `src` |
| `unusedExports.entries` | the kit's default entries, then each file under the roots that nothing imports but a tool runs: the test runners' setup files and global setup, the files an `index.html` loads, a package's `bin` and `main`, the files its scripts run (`tsx src/emit.ts`), and every tool config (`drizzle.config.ts`) |
| `unusedExports.ignore` | the workspace app, and the fixture directories under the roots |
| `featureAudit` | `feature-audit.json` beside the About manifest; `todoSources` gains `feature-audit:` |

Write them into `areas.audit`, and add this skill's check to the check script. Judge only what the proposal cannot know, and record it in this skill's `REPOSITORY.md` under the table the script printed: a library whose exports are a public API (add it to `ignore`; its files still count as users), and an entry a tool reads by a name no config states. The proposal reads entries from the build, test and bundler configs (`tsdown`, `tsup`, Rollup), `index.html` and the package scripts.

**Registry.** `propose.mjs --write` writes the feature audit when there is none: `reviewedAt` today, one group, `dead-code`, and one `dead-code` finding per file the sweep reports (its exports used nowhere, or that nothing imports it), with `files` filled. An export used only in its own file, or only by tests, is not dead code and makes no finding; `scripts/find-unused-exports.mjs` lists them apart, and the proposal counts them in a note. Confirm each finding (the sweep is a heuristic) and rewrite its title, summary and action; regroup into the groups this repository's page reads best in, recorded in `REPOSITORY.md`. Then add what only reading the product finds, by the Workflow below: `unreachable` findings (step 2, signals 4 to 7), `todo` and `recommendation` findings, and each `status` (`known` or `planned` with its `ref` where the repository already records it). A draft finding that is not dead after all (a file a tool loads by a name no config states, an export kept on purpose) is deleted, and its file added to `unusedExports.ignore` (a file path, or a directory ending in `/`) with the reason in `REPOSITORY.md`, so the next run does not report it again. With a feature audit, `propose.mjs` writes nothing: it lists the files the sweep reports that no finding names (`new:`) and the `dead-code` findings whose files it no longer reports (`gone:`).

## Workflow

### 1. Establish the reachable surface

| Surface | Where to read it |
|---|---|
| App routes | The product's router (the hooks file's `productRoutes` hook reads it, when there is one) |
| Nav / links | The navigation components, every `navigate(`, `<Link`, `<Navigate`, `href=` |
| Switching and roles | The users, roles or modes the product lets a reader switch between, and what each is shown |
| Providers mounted | The app root's provider stack |
| API consumers | Every call site under `areas.api.callers.roots` vs. the routes the server registers (`areas.api.document`) |
| Deploy surface | `Dockerfile`, infrastructure code, deploy scripts |

### 2. Sweep for the signals

1. **Zero-importer packages** — for each workspace package name, grep imports outside its own package (exclude `node_modules`, `dist`, `out-tsc`, the workspace app). Report workspace usage separately.
2. **Unused exports** — run `node .agents/skills/assess-feature-audit/scripts/find-unused-exports.mjs [pathPrefix]`, a wrapper over the kit's `check/unused-exports.mjs` that sweeps `areas.audit.unusedExports.roots`. It lists exports with no non-test, non-barrel reference. Pass already-dead roots as `--exclude=dir,dir` so their usage doesn't keep other code alive (transitive death). The workspace registries never count as users — they *describe* code by name; a mention in a `note` is not usage. They are all JSON (the files the `areas.*` settings name), which the script does not read.
3. **Orphan files** — files nothing imports by relative path (the script prints these too), excluding entries (`unusedExports.entries`, default the kit's list: `main.*`, `index.html`, tool configs, test setup files), tests and barrels (`index.*`).
4. **Unrouted / unlinked pages** — routes with no in-app link, nav items with no route, pages exported from a feature barrel but never routed.
5. **Unreachable data** — users, roles or modes that can never be selected, scenarios never mapped, assets in `public/` never referenced, referenced assets missing from disk.
6. **Inert state** — context members never called by any consumer (grep each `interface *ContextType` member).
7. **API and schema** — handlers with no client in the repository; database tables referenced by no route or seed.
8. **TODOs and stale tests** — `TODO|FIXME|placeholder|not yet` comments; scaffold tests that assert on removed text (run them to confirm).
9. **Config drift** — package.json deps, Vite aliases, and `tsconfig.json` references that only point at dead libs.

Explore agents work well for the grep sweeps; keep the reachability reasoning (1, 4, 5) in the main session.

### 3. Reconcile with the existing registry and docs

- Check the architecture document (`areas.audit.architecture`) and any earlier repository audits first. Anything already recorded there is `status: 'known'` with a `ref`; still list it so the page is complete.
- **Already listed, new evidence** → update that entry (files, size, summary); never duplicate a slug.
- **Fixed since logged** → delete the entry (and its TODO list entry, if `kind` was `todo`).
- **New** → add an `AuditFinding` to `findings`.

### 4. Write the entries

Follow the `AuditFinding` interface in the kit's `check/audit-registries.d.mts` exactly (the reader rejects an unknown key, a missing field or a value outside its list, naming the row):

- `kind`: `dead-code` (isolated/unused) / `unreachable` (exists, no path leads there) / `todo` (stub, failing test, stale doc) / `recommendation` (not dead, but blocks acting on a finding — e.g. a missing dev-server proxy to the API)
- `group`: an `id` from `groups`; `REPOSITORY.md` says which findings go in which group
- `summary`: one or two sentences — what is dead and *how you know* (no importer, no route, param mismatch, verified failing)
- `files`: repo-relative paths; a trailing `/` means the whole tree. Enough for someone to act without re-searching
- `action`: one imperative sentence naming the concrete change, with the alternative if there is a genuine choice ("delete X, or wire it into Y")
- `size`: lines/files when it changes the priority; omit otherwise
- `page`: product route where the finding is visible, if any (dead links count)
- `ref`: doc section for `known`/`planned`

Keep every entry terse. Group-level findings (e.g. "five parked libs") are fine when the action is identical; split when actions differ.

### 5. File TODO findings in the TODO list

For every finding with `kind: 'todo'`, keep one entry in the TODO list (`areas.audit.todo`) whose `Source` is `feature-audit:<slug>`. Follow the `todo` skill's format exactly (its `SKILL.md` in the skills directory, `areas.about.skillsDir`): heading `## <P>-<n> <title>` (`<P>` is `areas.audit.idPrefix`) with the number taken from `Next ID` (then bump `Next ID`; ids are never reused), `Area`, `Source`, `Added`, a short body naming the files and the action, and `Reviewed:` set to today. Add the entry when a new `todo` finding is added, update its body when the finding changes, and delete it when the finding is removed. If someone executes or plans that TODO through the `todo` skill, resolve or delete the finding in the same change. Never touch entries with any other `Source`. The check script verifies the pairing in both directions.

### 6. Hand route changes to `assess-features`

A route, sidebar item or page you find added, removed or unlinked changes the feature catalogue and the route mirror. Record the finding here; update the catalogue and the mirror with the `assess-features` skill, whose check compares the mirror with the product's router.

### 7. Verify

```bash
node .agents/skills/assess-feature-audit/scripts/find-unused-exports.mjs
node .agents/skills/assess-feature-audit/scripts/check-features-registry.mjs
```

`check-features-registry.mjs` is a one-line `runCheck('feature-audit')` over the kit's `check/run.mjs`: the kit's rules (`check/feature-audit.mjs`) confirm the file reads, every finding's `files` exist, todo findings and `feature-audit:<slug>` TODOs pair both ways, and `reviewedAt` passes the date rule below. Then run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others) — a malformed row throws at load, so lint and typecheck alone are not enough — then open `/audit/implementation/features` on the workspace dev server and confirm the new entries render and Copy works.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it. Bump the feature audit's `reviewedAt` whenever the file changes.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a markdown report | Update the feature audit — it is the single source of truth |
| Hand-editing JSON into an invalid file | Escape `"` and `\` inside strings, no trailing commas, no comments |
| Counting a dead lib's imports as usage | Exclude dead roots and re-run the export script (transitive death) |
| Calling a barrel re-export "usage" | Only non-`index.*`, non-test references count |
| Treating exported component prop types as dead | Public API types of live components are not findings |
| Mixing a dedicated group's findings into the general list | Use the group `REPOSITORY.md` assigns them |
| Omitting the reachability evidence | Summary must say how death was established |
| Re-reporting a documented item as new | Cite the doc in `ref` and mark `status: 'known'` |
| Adding a `todo` finding without a TODO list entry | Every `kind: 'todo'` finding needs an entry with `Source: feature-audit:<slug>` |
| Editing the feature catalogue or the route mirror from this skill | They are `assess-features`'; record the finding here and hand the change over |
| Adding, renaming or removing a registry or setting without telling About | Run `assess-workspace`, whose `propose.mjs --write` rebuilds the About manifest from the config |
