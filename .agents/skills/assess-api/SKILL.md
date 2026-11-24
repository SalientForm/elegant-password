---
name: assess-api
description: Use when asked to list, audit, or update the frontend API surface — which API routes exist, which the product actually consumes, from which pages, and what shape each returns — or whenever a route is added, removed, or a fetch site changes, so the workspace's API area stays accurate.
---

# Assess API

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview

Keep the workspace's **API** area (`/api`) in sync with the real API surface: every operation in the API's OpenAPI document, whether the product consumes it through code called from a reachable page, and what it returns.

The area is a Wayfinder module (`createApiArea`) that renders any OpenAPI 3 JSON document, with an optional consumer registry over it. Everything this skill needs to know about the repository comes from `areas.api` in the workspace config (the file the root `package.json` `wayfinder.config` names):

| Setting | Means |
| --- | --- |
| `document` | the OpenAPI 3 document (JSON), usually emitted from the API's route definitions; every route and every request and success-response shape comes from it |
| `registry` | the consumer registry, JSON (`ApiRegistry` in the kit's `check/api-operations.d.mts`): the overlay the document cannot express |
| `reviewedAt` | the area's reviewed date, shown in its header; set only by this skill |
| `basePath` | the prefix of the routes the product calls (e.g. `/api`; default `/`); a `used` row under it links its path to the running API, and a `used` GET under it must be fetched somewhere |
| `generated` | `{ path, command, fix }[]`: files that must equal the stdout of their `command` (the emitted document, generated wire types); the check names `fix` when one is stale |
| `callers.roots` | where the product calls the API; the check scans them for fetch sites |
| `description`, `intro` | the area's one-sentence summary and the paragraph above its tables |

**The registry is data, not prose.** Never write the endpoint list to a markdown doc. It carries only what the document cannot say — *which product code consumes the route, whether that code is reachable* — so each row has `method`, `path`, `group`, `description`, `status`, and optionally `handler`, `consumer`, `pages`, `note`, `example` and `outsideDocument`. `groups` lists the sections in page order and `handlerRoot` shortens the handler labels (`server/routes` labels `server/routes/orders.ts` as `orders.ts`). If a route's request or response fields look wrong on the page, fix the schema the document is emitted from and re-emit; never transcribe them into the registry. Wire types the frontend generates from the same document belong in `generated`, so the check fails when they are stale.

## On a placeholder area
When `areas.api` is `{ placeholder: { reason, toFill } }` (the onboarding writes one where the repository has nothing the area reads; `docs/formats.md`, "The document set", Placeholders), test first whether it can now be generated: whether there is an OpenAPI 3 JSON document, or a command that emits one. If not, leave the placeholder, and make its reason true if what was looked for has changed. If so, replace the placeholder with `document` (and `generated` for the command that emits it, `basePath`, `callers`), and build the consumer registry as the Workflow below says, then rebuild the About manifest (`assess-workspace`'s `propose.mjs --write`): the app's wiring is the same for both forms, so nothing else changes. The First run below says how. The check passes on a placeholder area and prints it after its OK line.

## First run
On a repository whose API area is new (the onboarding's first runs, `wayfinder-onboard` §4, or a placeholder this skill can now fill), the registry is built from nothing, in two parts. An existing registry from an earlier install is not kept or read: delete it first, so the first run proves what the kit can build.

**Settings.** Run `node .agents/skills/assess-api/scripts/propose.mjs`. Without an OpenAPI 3 JSON document (a tracked `*.json` whose `openapi` is `3.x`) it proposes nothing: keep the placeholder, its reason naming where a document was looked for. With one it proposes, with where it read each:

| Setting | Proposed from |
| --- | --- |
| `document` | the OpenAPI document found (the first, when there are several: it lists them) |
| `registry` | `api-endpoints.json` beside the About manifest |
| `basePath` | the path segments every operation shares (`/api`), else `/` |
| `callers.roots` | the source roots (a package's `src`) of the files whose `fetch('…')` or `<client>.GET('…')` calls a path under `basePath` |

Write them into `areas.api`, replacing the placeholder. Then judge `generated`: the command that emits the document (a `package.json` script, a script the API's package runs) and any wire types generated from it, each with its `fix`. Record the commands in this skill's `REPOSITORY.md`, under the table the script printed.

**Registry.** `propose.mjs --write` writes the registry with every operation of the document, in document order, its derivable fields filled: `method` and `path`; `example`, the path with each parameter's example, enum or `1`; `handler`, the server file that registers the method on the path (`.get('/orders/:id'` or a route object's `method` and `path`, the longest match, so a router mounted under a prefix still matches); `consumer`, `<function>() — <file>` of each fetch site that calls it; `status`, `used` with a consumer, `unused` without. `group` starts from the document's tags and `description` from its summary. Then rewrite what is judged: the groups (a page section a reader understands, recorded in `REPOSITORY.md`), each `description` (what comes back, in one clause), `note`, `pages` (the pages reachable from navigation that use the consumer, step 2 below), `stub`, and a row with `outsideDocument: true` for each route the server serves that the document does not describe (read the server's entry file: a health check, an auth library's mounted routes). A later run of `propose.mjs --write` keeps every judged field of the registry it finds and recomputes the derivable ones, so run it again after any route or fetch change.


**This skill always regenerates the registry.** Do not stop at "no drift": walk every operation in the document and rewrite each row's status, consumer, pages, description, and note from the current code, even when the drift check passes — reachability can change (a nav item removed, a hook's caller deleted) without any route or fetch changing.

After any route or schema change: run every `generated` entry's `fix`, and commit the regenerated files together.

### 1. Run the drift check

```bash
node .agents/skills/assess-api/scripts/check-api-registry.mjs
```

A one-line `runCheck('api')` over the kit's `check/run.mjs`; the rules are the kit's `check/api.mjs`, which shares its operation builder with the workspace. It first fails on any `generated` file that differs from a fresh run of its `command` — run its `fix` and commit the result. Then it collects the product's fetch sites: the hooks file's `fetchSites(ctx)` (the file the root `package.json` `wayfinder.hooks` names) when it exports one, else a scan of `callers.roots` (tests excluded) for `fetch('<basePath>…')` and `<client>.GET|POST|PUT|PATCH|DELETE('<basePath>…')`; with neither, the fetched-path rules are skipped and the summary says so. It fails when an operation is in the document but missing from the registry, a row is not in the document and not marked `outsideDocument` (or is marked and is in it), a row or group is malformed, a `handler` file does not exist, a fetched path has no row or its row is not `used`, a `used` GET under `basePath` is fetched nowhere, or `reviewedAt` fails the date rule below. Its output is the list of rows that certainly changed; the rest still get re-verified in step 2. Known gap: only GET reachability is checked automatically; a `used` non-GET row fetched nowhere passes. The scan sees only a literal path as the first argument; calls through another wrapper need a `fetchSites` hook.

The workspace itself reads the same two files at start-up: a malformed registry row stops it loading (fix the row), while an operation the registry does not list appears under "Not in the registry" until you add it.

### 2. Establish the reachable surface

| Question | Where to read it |
|---|---|
| What routes exist? | The document (`paths` × methods); the server's route registration is the same list |
| What does each read? | The route's request schema in its handler module; the page renders it, so nothing to transcribe |
| What does each return? | The handler's header comment and its final response shape |
| Who fetches it? | Grep `callers.roots` for the scanned patterns, e.g. `grep -rn "\.\(GET\|POST\|PUT\|PATCH\|DELETE\)('/api\|fetch('/api" <roots>`, or read what the hooks file's `fetchSites` reads |
| Is the fetch reached? | The calling code (a data hook, say) called from a page reachable from navigation → `used`. Trace the hook's callers up to a route in the product's router **and** a navigation item or in-app link (`navigate(`, `<Link`). |
| Which pages render the data? | Grep the hook name (`useOrders()`, …) in the product's pages; keep only pages reachable from navigation. |

A fetch that exists only in a parked library (see the Features area) or an unlinked page does **not** make a route `used`; note it in `note` instead.

### 3. Write the rows

Follow `ApiEndpoint` in the kit's `check/api-operations.d.mts` exactly:

- One row per **method + path** (a module handling GET/POST/DELETE gets three rows), in page order
- `handler`: the repository path of the source, e.g. `server/routes/orders.ts`, or the server's entry file for inline handlers
- `group`: an id from `groups`
- `description`: one clause on what it returns
- `consumer` + `pages`: only when `status` is `used`; `pages` are product routes starting with `/`
- `status`: `used` / `unused` / `stub` (responds with placeholder data)
- `note`: redundancy with another route, planned owner (e.g. the milestone that wires it up), unread payload fields
- `outsideDocument: true`: the API serves it but the document does not describe it (a health check; an auth library's mounted routes, one row for the surface)

Remove rows for deleted routes; do not keep history here — git has it.

### 4. Shapes

Nothing to transcribe. Query, body and success-response shapes render from the document; if a shape looks wrong on the page, fix the schema the document is emitted from, then run every `generated` entry's `fix` and commit the files together. Keep `example` as a real URL path.

### 5. Verify

Bump `areas.api.reviewedAt` in the workspace config. Run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others); re-run the drift check (must exit 0); then open `/api` on the workspace dev server and confirm the counts in the status filter match the document and a row's expanded request and response read correctly.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it. Bump `areas.api.reviewedAt` whenever the registry changes.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Marking a route `used` because a hook exists | Trace the hook to a page reachable from navigation |
| One row per module | One row per method + path |
| Editing before running the drift check | Run it first; it tells you exactly what changed |
| Recording the endpoint list in markdown | The registry JSON is the single source of truth |
| Describing the request instead of the response | `description` says what comes back |
| Guessing shapes from the frontend consumer | Read the handler and its data schema; the frontend may only read a subset |
| Transcribing request fields into the registry | They render from the document; fix the schema and re-emit instead |
| A route outside the document without `outsideDocument: true` | The check reports it as stale; flag it |
| Editing a `generated` file | It is generated; fix the schema and run its `fix` |
| Adding, renaming or removing a registry or setting without telling About | Run `assess-workspace`, whose `propose.mjs --write` rebuilds the About manifest from the config |
