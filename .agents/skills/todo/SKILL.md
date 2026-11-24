---
name: todo
description: 'Use when asked to add, list, reprioritise, execute, plan, or drop an entry in the repository''s TODO list (TODO.md) — "add a todo", "what''s on the todo list", "execute TODO 4, no spec, just go", "create a spec and plan for TODO 5", "drop TODO #7".'
---

# TODO list

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

The TODO list holds ideas, tasks and small items that are **not yet planned**. It is the source for the
Engineering Workspace Todo page (`/audit/implementation/todo`, the kit's Audit implementation module) and is
parsed by the kit's `check/audit-markdown.mjs` — a malformed file breaks the workspace build and the check script
(`areas.about.checkScript`, default `workspace:check`).

**The TODO list is required in the Audit area** (`areas.audit.todo`, with `todoAreas`), and the `document-repo` skill
writes it first. An empty list holds a placeholder that says why; adding the first entry removes the placeholder (the
audit check refuses one beside an entry).

Where it lives and what its fields may say come from the workspace config (the file the root `package.json`
`wayfinder.config` names), `areas.audit`:

| Setting | Means |
| --- | --- |
| `todo` | the file; this skill calls it `TODO.md` below |
| `idPrefix` | the prefix every id carries: an entry's id is `<P>-<n>` (`ACME-4` with `ACME`); this skill writes `<P>` for it |
| `todoAreas` | the values `Area:` may take; anything else fails the parser |
| `todoSources` | `Source:` values that are not repository paths (a trailing `:` is a prefix); any other value must be a path that exists |
| `roadmap` | where milestone-sized work goes instead, when configured; this skill calls it `ROADMAP.md` |

**An entry exists only while the work is unplanned.** Executing it or planning it deletes it. Milestone-sized work
belongs in `ROADMAP.md` (owned by `assess-audit`), not here.

## Format

The normative format is "The TODO list" in the kit's `docs/formats.md` (installed:
`node_modules/@salientform/workspace-wayfinder/docs/formats.md`).

    # TODO

    Reviewed: YYYY-MM-DD
    Next ID: 12

    <intro paragraph>

    ## <P>-11 Short imperative title

    - **Area:** one of areas.audit.todoAreas
    - **Source:** <repo-relative path> | one of areas.audit.todoSources (e.g. idea)
    - **Added:** YYYY-MM-DD

    Free markdown body: what, why, where. May be empty.

- An entry's id is the prefix and its number (`<P>-11`). Numbers come from `Next ID`; after using it, increment it.
  **Never reuse or renumber an ID** — people and commits refer to `<P>-4`. Gaps are normal.
- An entry is asked for by its id or its number: "ACME-4", "TODO 4" and "TODO #4" all name `<P>-4` of this
  repository (prefix `ACME`). An id with another repository's prefix names that repository's entry, not one here.
- File order is priority order, highest first. Moving an entry does not change its ID.
- Every edit sets `Reviewed:` to the day it is made.

## Operations

| Request | Do |
| --- | --- |
| **add** | Check it is not already an entry, a `ROADMAP.md` phase, or an open spec or plan (one with an active `state` in its front matter). Write the entry with the next ID, bump `Next ID`, place it by priority (end of file if unstated); remove the empty list's placeholder, if it has one. |
| **list** | Read the file; answer `<P>-<n> title (area)` in file order. Do not edit. |
| **execute `<P>-<n>`** ("no spec", "just go") | Read the entry and its Source. Implement directly with the normal workflow (tests first, verification before claiming done). Delete the entry. Commit with `<P>-<n>` in the message. If it turns out not to be a bounded change, stop and say so instead of growing it. |
| **spec / plan `<P>-<n>`** | Use the entry as the brief for brainstorming → a spec in the specs directory of `areas.audit.specDirs` (default `docs/specs` and `docs/plans`: specs in the first, plans in the second) → writing-plans → a plan. With a roadmap, before writing the spec, pick its id: the `ROADMAP.md` phase it serves, or — when none fits — allocate `<P>-X<n>` from `Next X` under "Outside the roadmap" (bump the counter, add the row); both documents start with `**Milestone:** <id>`. Without one, they carry no Milestone line. Delete the entry. Give each its front matter (`state`, `summary`, and `spec` on a plan) and, for each, a review file under `areas.audit.reviews` (see `assess-audit`). If the work is milestone-sized or changes the architecture and there is a roadmap, add a `ROADMAP.md` phase per `assess-audit` step "Update the roadmap". |
| **drop `<P>-<n>`** | Delete the entry; the commit message says who declined it and why. |
| **reprioritise** | Move entries; IDs unchanged. |

**"No spec, just go" is an instruction, not a shortcut you take.** When the user says to execute an entry without a
spec or plan, that explicit request overrides the brainstorming / spec / plan workflow for that entry: state in
one or two sentences what you are about to change, then do it. Without those words, an "execute" request for
anything that is not obviously bounded gets the normal design-first treatment.

## After any change

1. If the deleted entry's id (`<P>-<n>`) appears in a review's `tracked` list (a file under `areas.audit.reviews`), replace it
   with what the work became (a phase id or spec path) — or remove the review's `## Future content` if the document no
   longer carries future work.
2. If the entry's Source was a prefix value naming a feature-audit finding (`feature-audit:<slug>`), the finding with
   that slug in the feature audit (`areas.audit.featureAudit`) must be deleted or resolved in the same change
   (`assess-feature-audit`).
3. Run the check script (`areas.about.checkScript`, default `workspace:check`) and fix every line it prints.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Renumbering to close gaps | Never. IDs are permanent. |
| Writing an entry's id without the prefix (`## #4 …`, `#4` in `tracked`) | The parser and the check refuse it: `<P>-4`. |
| Forgetting to bump `Next ID` | The parser rejects `Next ID` ≤ the highest id. |
| Inventing an area | Use one of `areas.audit.todoAreas`; a new one is a config change, not an entry edit. |
| Marking an entry "done" in place | There is no done state — delete it; git is the record. |
| Putting a multi-week outcome here | That is a roadmap phase; use `assess-audit`. |
| Leaving a dangling `<P>-<n>` in `tracked` | The check script names the row; repoint it. |
| Adding, renaming or removing a registry or setting without telling About | Run `assess-workspace`, whose `propose.mjs --write` rebuilds the About manifest from the config |
