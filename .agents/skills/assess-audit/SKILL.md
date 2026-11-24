---
name: assess-audit
description: Use when asked to review, audit, or refresh the repository's documentation status — which markdown docs are stale, superseded, or current, which specs and plans are unimplemented, the architecture stack summary (ARCHITECTURE.md) and the roadmap (ROADMAP.md), and the Audit area of the Engineering Workspace — after a spec ships, a plan merges, or a doc is rewritten.
---

# Assess Audit

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview

Keep the Engineering Workspace's **Audit** area accurate. This skill owns the reviews folder and each spec's and plan's front matter, and edits two of the three markdown sources, each with its own owner date (the feature audit, `areas.audit.featureAudit`, a JSON file, is `assess-feature-audit`'s):

| Page | Source (`areas.audit` setting) | What it holds | Date |
| --- | --- | --- | --- |
| `/audit/ledger/*`, `/audit/document/*` | the reviews folder (`reviews`, default `docs/reviews`) and each spec's and plan's front matter (`specDirs`) | `<reviews>/index.md`'s `kinds` (the All markdowns sections), one review file per reviewed document, and the state of every spec and plan in its own front matter | the index's `reviewedAt` |
| `/audit/documentation/:doc` | `<reviews>/index.md`'s `documents` | the Documentation list | the index's `reviewedAt` |
| `/audit/implementation/architecture` | the architecture document (`architecture`) | "Stack summary" tables and the "Planned migrations" list | its `Reviewed:` line |
| `/audit/implementation/roadmap` | the roadmap (`roadmap`) | milestones, phases, Sequence, Completed | its `Reviewed:` line |
| `/audit/implementation/todo` | the TODO list (`todo`) | numbered unplanned items — **owned by the `todo` skill** | its `Reviewed:` line |

The roadmap, the TODO list and the architecture document are all required (`areas.audit` names each, with `phaseKinds`, `todoAreas` and `idPrefix`; the area throws at load without one), and the `document-repo` skill writes them first (see First run). A file with nothing to say yet holds a placeholder that says why (`docs/formats.md`, "The document set"): it is listed by the checks, never a failure.

The whole area is one Wayfinder module (`createAuditArea`, the kit's `src/audit/`). Every file it reads and the house conventions come from the workspace config (the file the root `package.json` `wayfinder.config` names), `areas.audit`:

| Setting | Means |
| --- | --- |
| `roadmap`, `todo`, `architecture` | the three markdown files, all required; a collection of the config's `content` must cover each |
| `reviews` | the folder of the review files, and its `index.md`; a `content` collection must cover every markdown file in it, dot-directories included (a glob enters a dot-directory only where its pattern names one, so a review under `.agents/` needs a pattern naming it) |
| `featureAudit` | the feature audit, JSON; a `content` collection must cover it. Its type and the reviews' are the kit's `check/audit-registries.d.mts` |
| `phaseKinds` | the values a phase's `Kind:` may take; the Roadmap page colours them in this order. Required |
| `todoAreas` | the values a TODO's `Area:` may take, in the Todo page's filter order. Required |
| `todoSources` | TODO `Source:` values that are not repository paths (a trailing `:` is a prefix); default `['idea']` |
| `idPrefix` | the prefix every roadmap and TODO id carries: upper-case letters and digits, starting with a letter. Required |
| `specDirs` | the directories of specs and plans (default `docs/specs`, `docs/plans`): the first holds specs, the others plans; each document's state is its own front matter |
| `ignore` | path prefixes of tracked markdown that needs no review (agent worktrees, say) |
| `linkExempt` | path prefixes whose markdown links are not checked (a fixture that links to a missing page on purpose) |

This skill uses the names `ROADMAP.md`, `TODO.md` and `ARCHITECTURE.md` for whatever files `roadmap`, `todo` and `architecture` name, and `<P>` for `idPrefix`.

**Every id carries the prefix**, so an id names its repository wherever it is quoted (`docs/formats.md`, "Ids"). With `idPrefix: 'ACME'`:

| Id | Is | Example |
| --- | --- | --- |
| `<P>-M<n>` | a milestone | `ACME-M4` |
| `<P>-M<n>.<k>` | a phase | `ACME-M4.2` |
| `<P>-X<n>` | a spec or plan outside the roadmap | `ACME-X7` |
| `<P>-<n>` | a TODO entry | `ACME-12` |

Write the full id everywhere one is named: roadmap headings, Sequence, Completed and Outside the roadmap rows, `Depends on`, Milestone lines, `tracked`, stack `Ref`s, Planned migrations bullets, and in prose, commit messages and branch names (`feat/acme-m4-2-…`). An id without the prefix, or with another repository's, fails the parser or the check. The prefix is chosen once, at onboarding; changing it means rewriting every id in the repository's markdown in one change. The markdown files are parsed by the kit's `check/audit-markdown.mjs`; the reviews folder and the specs' and plans' front matter are read by the kit's `check/audit-registries.mjs` (`readAuditMarkdown`), which the workspace app, its search index and the check scripts all share. **A malformed file, front matter or review, or a kind or area the config does not list, breaks the workspace build** (the readers name the file, e.g. `docs/specs/x.md state "shiped" is not one of …`), so keep to the formats below and run the drift check after every edit. Format reference: the kit's `docs/formats.md`, "The spec ledger and reviews" (installed: `node_modules/@salientform/workspace-wayfinder/docs/formats.md`). A new kind or area is a config change (`areas.audit`), made deliberately, not a typo the parser tolerates.

Architecture and Roadmap are **separate concerns**: Architecture says what runs and what will replace it; Roadmap says what gets built next and in what order. Not every roadmap phase changes the architecture, and `ARCHITECTURE.md` names planned migrations **without detail** — goal, scope and sequencing live only in `ROADMAP.md`.

Ideas, tasks and small items that are not yet planned live in `TODO.md`. Use the `todo` skill to add, execute, plan or drop them; this skill only points at them (see `tracked` below).

**The ledger is the files.** A review finding goes in its review file (`<reviews>/<reviewed path without .md>.review.md`, one per reviewed document) and a spec's or plan's state in its own front matter; there is no separate report and no JSON. `ROADMAP.md`, `TODO.md` and the ARCHITECTURE.md stack summary are the only markdown files this skill (or `todo`) edits as a whole-file registry. Recommendations stay recommendations — this skill does not edit, move, or delete the reviewed documents.

## First run

On a repository whose Audit area is new (the onboarding, `wayfinder-onboard` §3 steps 7 and 8, then its first runs,
§4), the files this skill owns are written afresh, from the repository, and its settings derived, in two parts.

**Settings.** Run `node .agents/skills/assess-audit/scripts/propose.mjs` once the documents are written (step 1 below).
It proposes, with where it read each:

| Setting | Proposed from |
| --- | --- |
| `specDirs` | the directories of markdown whose front matter has a spec or plan `state` (a directory with `spec` in its path first), else `docs/specs` and `docs/plans` |
| `phaseKinds` | the default three (`feature`, `infrastructure`, `migration`), then any other `Kind:` value the roadmap uses, so the next phase may be of any of them |
| `todoAreas` | the `Area:` values the TODO list uses, in the order it first uses them, else `app`, `docs`, `repo` |
| `todoSources` | `idea`, then each `Source:` value of the TODO list that is not a path (`other-repo:` for `other-repo:docs/x.md`), and `feature-audit:` with a feature audit |
| `ignore` | the fixture directories and agents' scratch copies that hold tracked markdown (`src/test-fixtures/`, `.claude/worktrees/`) |

Write them into `areas.audit`. A value the repository will use but does not yet (a TODO area for planned work) may be
added; record it, with why, in this skill's `REPOSITORY.md` under the table the script printed. `linkExempt` is
judged: the script lists each broken link; fix it, or exempt a path prefix whose links are broken on purpose.

**Registries,** in this order:

1. **The three documents** come from the `document-repo` skill, which writes the whole document set. It reads the
   repository's own records (an existing roadmap, TODO list or architecture document in any shape and place, a README
   section of planned work or caveats, the specs and plans) and rewrites each into the format, keeping its wording and
   its ids; an existing file is moved, never kept beside a second copy. Repository files only: no issue tracker or
   other outside source. The roadmap's open phases come from the active specs and plans and any list of planned work,
   its Completed rows from the `implemented` ones; with none, it holds the placeholder under Sequence. The
   architecture document has its six sections (`docs/formats.md`, "The architecture document"), each with what the
   repository says or a placeholder.
In the onboarding, steps 2 and 3 are its §3 step 8, done once there: the first run checks them and writes nothing
new. On a repository the onboarding did not just run on, the first run does them.

2. **Front matter and Milestone lines.** Every document directly in `specDirs` gets its front matter (step 6) and the
   `**Milestone:**` line of the phase or X row step 1 gave it; a phase names it as Spec or Plan.
3. **Reviews.** Stage everything written, then give every tracked markdown file a review (steps 2 to 6), the eight
   documents included, and fill the index's Documentation list (step 9).
4. **Check.** The drift check (step 1 below), then the check script, until both print their OK lines. Read each
   placeholder they list after it and make sure it is true.

An existing review, registry or other kit output is not kept or read as input: the first run proves what the kit can
build. The repository's own records are the exception, because they are sources: they are read as step 1 says.

## Workflow

### 1. Run the drift check first

```bash
node .agents/skills/assess-audit/scripts/check-audit-registries.mjs
```

The script runs the kit's rules: the markdown files' (the kit's `check/audit-implementation.mjs`) and the ledger's and documents' (the kit's `check/audit-ledger.mjs`), both configured by `areas.audit`, plus any `audit` problems the hooks file's (`wayfinder.hooks`) `extraChecks` hook adds. It exits non-zero when a front matter block, review or the index does not parse or a field is malformed, a review's `path` differs from its file name, a file in the reviews folder is neither `index.md` nor a `.review.md`, no `content` collection covers a review or a ledger document, a tracked `.md` file outside `ignore` and the reviews folder has no review (exact path or covering directory), a reviewed path no longer exists, a path in the index's `documents` is missing on disk, a `lastModified` date fails the date rule below, `ROADMAP.md` / `TODO.md` / the ARCHITECTURE.md sections do not parse or name an id or path that does not resolve, an ARCHITECTURE.md section (Overview, Repository layout, Running it, Deployment) is missing or empty, the roadmap has no open milestone and no placeholder under Sequence, or a placeholder sits beside a listed phase or a TODO entry, a phase's Spec / Plan is not an open spec or plan (an active `state` in its front matter), a review with a `## Future content` section has no resolvable `tracked` ids, a spec or plan lacks a `**Milestone:**` line or its id disagrees with its spec's or does not resolve, an open spec's or plan's phase does not name it, or an X row of the roadmap and the documents carrying its id differ, a relative link in tracked markdown points at a path that does not exist (the path only: its `#anchor` is not checked; code blocks and `linkExempt` excepted; the kit's `check/links.mjs`), or any of the five dates fails the date rule below. Fix every line it prints: a broken link gets its path fixed or the link removed, never left to fall through to the repository host.

### 2. Inventory

```bash
git ls-files '*.md' | grep -v node_modules
git log -1 --format=%ad --date=short -- <path>        # when the file last changed: read it, then date the review yourself
git status --short --ignored <dir>                     # untracked / ignored stragglers (agent and tool scratch directories)
```

Ignore the paths under `areas.audit.ignore` and generated test reports.

### 3. Verify each document against the code — do not trust prose

| Claim type | How to verify |
|---|---|
| "X exists / is missing" (apps, libs, components, routes) | `ls` the source roots; read the component library's barrel; grep the router for the route path |
| Issue lists (lint, a11y, tests, console.log) | grep the source; count `*.test.*`; read the components the document names |
| Package names, config files (package names, export conditions, theme preset) | `ls` the package; read `package.json` `name` and `exports` |
| Spec/plan implementation | `git log --oneline <integration branch> --grep=<keyword>`, `git branch --merged <integration branch>`, grep the feature's code for the spec's nouns |
| Decisions | Compare against `ARCHITECTURE.md` and the phase it names in `ROADMAP.md` — later decisions win; earlier specs become `conflicting` or `superseded` |
| Referenced docs | Every `.md` path a document cites must exist (`ls`) |

Record *how* you verified in the review's `## Stale content` ("verified: no auth routes in the API"), so the next pass can re-check quickly.

### 4. Classify

`verdict` in each review's front matter:

- `current` — accurate; note any minor nits under `## Stale content` anyway
- `partially-stale` — mostly right, named sections wrong
- `stale` — describes a repo state that no longer exists
- `superseded` — replaced by another doc; cite it in `ref`
- `done` — spec/plan whose work shipped (still a valid historical record)
- `conflicting` — contradicts a later decision; cite it in `ref`
- `wrong` — factually incorrect (e.g. wrong product name)

A review's `## Future content` captures roadmap items, TODOs, follow-ups, and "not yet implemented" tables — even for `current` docs. Every review with `## Future content` also carries `tracked: [...]` saying where that work now lives (step 5). `ROADMAP.md` and `TODO.md` themselves carry no `## Future content` — they *are* the future content. `recommendation` is one imperative sentence: keep / update X / archive / delete / rewrite.

Group entries (an archive directory, the skills directory `areas.about.skillsDir`) are fine when the verdict and action are identical for every file in the tree.

### 5. Track every `## Future content`

Each review with `## Future content` needs a non-empty `tracked` list in its front matter. A token is one of:

- a TODO id — `'<P>-12'` — an entry in `TODO.md` (small or unplanned work);
- a phase or milestone id — `'<P>-M2.4'`, `'<P>-M3'` — in `ROADMAP.md`, open or completed, or an X id — `'<P>-X4'`;
- a spec or plan path (one with front matter in `specDirs`), when a spec covers it and it is not on the roadmap.

A document whose future work has no such home gets no `## Future content` (and no `tracked`): the check refuses one without the other. A list the repository keeps in its own form (a free-form `TODO.md`, say) is like `ROADMAP.md` here: it *is* the future content, so its review has no `## Future content`, says nothing under `## Stale content` that is not stale, and says what the file is in `## Recommendation` ("Keep it as the repository's own list of deferred work; it is the future content itself").

For each such review, read the document and decide where its future work belongs:

- **Already a phase or a TODO entry** → name it.
- **Milestone-sized, decided, has a deciding document** → add a phase (step 8) and name it.
- **Small, undecided, or an idea** → add a `TODO.md` entry using the `todo` skill's format (next ID, bump `Next ID`, `Reviewed:` today) and name it.
- **Shipped or dropped** → remove the `## Future content` section and `tracked` together.

When the `todo` skill deletes an entry (executed, planned or dropped), the `<P>-<n>` tokens that named it must be repointed at what the work became, or removed with the `## Future content` section. The check script (`areas.about.checkScript`, default `workspace:check`) rejects an unresolved token.

### 6. Update the reviews and the specs' front matter

Reviews and specs/plans are markdown, in the formats of the kit's `docs/formats.md`. A new reviewed document gets a review file; a reviewed document changes its file; omit an optional key rather than writing it empty. A review's `kind` is an `id` from the index's `kinds`; a new section of the All markdowns page is a new `kinds` entry (`{ id: …, label: … }`), in page order. For each spec/plan set `state` in its front matter: `draft`, `under-review`, `blocked` (+ `blockedOn`), `conflicting`, `implemented` (+ `evidence`: PR/commit), `superseded`. Copy the document's own follow-up/out-of-scope list into `followUps` so shipped documents keep their open items visible. When a plan merges: flip the plan and its spec to `implemented`, add the evidence, and change the spec's review to verdict `done` with a "move to archive" recommendation. Set `spec` (the path of its spec, front matter of the plan) on every plan whose spec is also in the ledger; the unimplemented page shows a plan card in place of its spec and links the spec as "Source spec" from it.

Every document directly under one of `areas.audit.specDirs` (an `archive/` below them apart) has front matter with `state` and `summary`, and exactly one `**Milestone:** <id>` line: a phase (`<P>-M3.1`), an X id (`<P>-X4`, see step 8) or — historical rows only, state
`implemented` / `superseded` — a milestone (`<P>-M4`). A plan carries its spec's id, or, when its spec spans several phases of one milestone, the phase it implements (`<P>-M4.2` under a `<P>-M4.1` spec); the check script refuses any other difference. When a plan merges the id stays;
it is how the Implemented page links back to the roadmap. Rules: "The Milestone line" in the kit's `docs/formats.md`.

### 7. Update the architecture stack summary (`ARCHITECTURE.md`)

The "Stack summary" section has one `### <Area>` heading per area of the stack (the repository's own list), each followed by one table:

    | Item | Status | Note | Ref |
    | --- | --- | --- | --- |
    | Vite 7 | current | | §8 |
    | Kysely | planned | | ACME-M2.5 |

- `Status` is `current` or `planned`. `planned` only for a *decided* replacement or addition — never a wish — and its `Ref` must be an **open** phase (or its milestone) in `ROADMAP.md`.
- `Note` only for a caveat (deprecated, provisional, broken) or a pointer to the replacement ("Replaced by Kysely under ACME-M2.5"). Escape a literal pipe as `\|`.
- `Ref` is `§<n>` (a section of ARCHITECTURE.md), a roadmap id, a repo-relative path, or empty.
- When a migration lands: delete the old current row, flip the new row to `current`, point its Ref at the completed phase, and update any note that referenced it.
- Keep it concrete and short — versions, names, one line. Explanations live in the numbered sections above it.

The "Planned migrations" section is a bullet list of the **open phases that change the architecture**, names and links only:

    - **ACME-M2.4 Release versioning** — [ROADMAP.md](ROADMAP.md#acme-m24-release-versioning)

Never put goal, scope or sequencing text there. Feature phases that do not change the architecture are not listed. Every bullet must name an open phase; delete the bullet when the phase ships.

### 8. Update the roadmap (`ROADMAP.md`)

A **milestone** (`## <P>-M<n>. Title` followed by one outcome paragraph) is one outcome; a **phase** (`### <P>-M<n>.<k> Title`) is an independently shippable step towards it. Every open milestone has at least one phase — a single-step milestone has exactly one (`<P>-M4.1`). Phase fields are a bullet list, in this order (with `idPrefix: 'ACME'`):

    ### ACME-M2.4 Release versioning

    - **Status:** not started | specified | planned | in progress
    - **Kind:** one of areas.audit.phaseKinds
    - **Goal:** what this phase delivers, in a sentence or two.
    - **Not in scope:** optional.
    - **Depends on:** ACME-M2.1, a free-text external condition   (or —)
    - **Spec:** docs/specs/….md   (or —)
    - **Plan:** docs/plans/….md   (or —)

    Optional prose: sequencing notes, caveats.

- **Status follows the ledger.** `not started` = no Spec or Plan; `specified` = a Spec that is a spec whose front matter `state` is open (`draft` / `under-review` / `blocked`), no Plan; `planned` / `in progress` = an open Plan as well. The check rejects disagreement.
- **Sequence** (top of the file) is a numbered list of every open phase id, exactly once, in likely implementation order. Build it from `Depends on`, the audit's P0/P1 ordering, and the specs' front matter (every unimplemented spec is a candidate phase). It is a forecast, not a commitment.
- **When a phase ships:** delete its section; add a row to **Completed** (`| ACME-M2.4 | Title | YYYY-MM-DD | spec path |`); remove it from Sequence; delete its "Planned migrations" bullet and flip its stack rows to `current` (step 7); flip the spec and plan to `implemented` (step 6). When a milestone's last phase ships, delete the milestone heading and paragraph too.
- **New milestones take the next free number. Never renumber or reuse a milestone number** — specs, plans, branches and commits refer to `<P>-M<n>`. When milestones are merged, move the phases into the surviving milestone under new phase ids, repoint every `Depends on`, `tracked` and stack `Ref`, and list the retired number on the "Retired numbers" line in the ROADMAP.md intro.
- **Outside the roadmap** (after Completed) lists work that aligns with no milestone: `Next X: <n>` then a table
  `| ID | Title | Spec | Plan |`. Allocate `<P>-X<n>` from `Next X` and bump it. **Never reuse or renumber an X id.**
  When X work becomes a phase: change the documents' and rows' id to the phase id, delete the X row, and add the
  number to the "Retired numbers" line. When a phase ships, its spec and plan keep the phase id.
- A phase needs a deciding document or decision. Ideas and small items go to `TODO.md` through the `todo` skill; when one is planned and turns out to be milestone-sized, it becomes a phase and its TODO entry is deleted.
- Set `Reviewed:` to today on every markdown registry you edit.

### 9. Update the documents (the index's `documents`)

Add a document (`id`, `title`, `path`, `description`, optional `anchor`) to `<reviews>/index.md`'s `documents` for any new top-level doc or current spec that people need to read in-app; remove entries whose files were archived or deleted. The `id` is lowercase kebab, unique, and the `/audit/documentation/<id>` URL segment; the order is the nav order. The kit reads each `path` through the content manifest at load and throws for one no collection covers (the config's `content` — extend the markdown collection if the file lives outside the directories it covers). Keep `path` equal to the reviewed file's path (its review's `path`) so the badge cross-reference works. A relative link to a listed document from any rendered markdown lands on its Documentation page.

### 10. Finish

- Bump the index's `reviewedAt` when any review or front matter changed and the `Reviewed:` line of `ARCHITECTURE.md` / `ROADMAP.md` — each only when its own file changed.
- Re-run the drift check.
- Run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others) — a malformed registry or an uncovered document path throws when the workspace loads, so lint and typecheck alone are not enough.
- Then open the area on the workspace dev server and click through `/audit/ledger/doc-review` (menu label "All markdowns"), `/audit/ledger/implemented`, `/audit/ledger/unimplemented` (the area landing), `/audit/implementation/architecture`, `/audit/implementation/roadmap`, `/audit/implementation/todo`, and `/audit/documentation/:doc` for at least one doc. Confirm the verdict filter works, the todo area filter, that a stack row's roadmap Ref lands on its phase, and that the search palette finds a phase, a TODO and a stack row by title.

**Date rule:** every "last modified" date — the owning date of a registry (the index's `reviewedAt`, the feature audit's `reviewedAt`, or the `Reviewed: YYYY-MM-DD` line of a markdown registry) and each review's `lastModified` — is the date the file was actually last modified: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes a registry date; whoever edits a reviewed document sets its `lastModified`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a report about the reviews | Update each document's review file; the pages are the report |
| YAML the parser rejects | Quote a value with `: `, a leading `#`, or a `{a,b}` brace (`'…'`); the reader names the file and line |
| A review whose `kind` is not in `kinds` | Use an existing `kinds` id, or add the section to `kinds` deliberately |
| Moving a review to another name | The file name and `path` must agree: `<reviews>/<path without .md>.review.md` |
| Trusting a document's status line | Check git history / merged branches — shipped plans can still say "pending" |
| Marking a doc stale without evidence | `## Stale content` must say what is wrong *and* how you checked |
| Missing untracked stragglers | Run `git status --short --ignored` on the agent and tool scratch directories |
| Treating a later ARCHITECTURE decision as a conflict *in ARCHITECTURE* | The older spec is the `conflicting` one; ARCHITECTURE is the source of truth |
| Leaving a documents `path` pointing at a moved file | The kit throws at load; update the index's `documents` when archiving |
| Giving a stack row a status other than `current` / `planned` | The parser rejects it; caveats go in Note |
| Using a phase kind or TODO area the config does not list | The parser rejects it; add it to `areas.audit` in the workspace config only when the repository adopts it |
| Putting a wish on the roadmap | A phase needs a deciding document or decision; ideas go to `TODO.md` via the `todo` skill |
| Writing goal or scope text under "Planned migrations" in ARCHITECTURE.md | Names and links only; the detail belongs to the phase in `ROADMAP.md` |
| Renumbering milestones or phases to tidy up | Never; ids are permanent and gaps are fine |
| Writing an id without the prefix (`M2.4`, `X3`, `#12`) | `<P>-M2.4`, `<P>-X3`, `<P>-12`: the parser and the check refuse the bare form |
| Writing a spec or plan without a `**Milestone:**` line | The check script refuses it; name a phase or allocate an X id |
| Keeping the repository's own roadmap, TODO list or architecture notes beside the three files, in another shape | Move them into the three (`document-repo`), so there is one copy |
| Removing a placeholder with nothing to replace it, or leaving one beside real content | A placeholder goes only when its section has content; the check refuses an empty roadmap without one |
| Reusing or renumbering an X id | Never; retire it on the "Retired numbers" line |
| Leaving a shipped phase open | Move it to Completed, drop it from Sequence and Planned migrations, flip its stack rows and spec |
| Writing `## Future content` without `tracked` | Every future item lives somewhere: a TODO id `<P>-<n>`, a roadmap id, or a spec path |
| Editing `TODO.md` entries ad hoc | Use the `todo` skill's format and operations; ids are never reused |
| Leaving a link whose target was moved or never existed | The check script refuses it; point it at the file's current path or remove the link (keep the text) |
| Applying the recommendations while reviewing | Out of scope here; propose them and let the user decide |
| Adding, renaming or removing a registry or a registry key without telling About | Rebuild the About manifest, never edit it: `node <skillsDir>/assess-workspace/scripts/propose.mjs --write` (`assess-workspace`) |
