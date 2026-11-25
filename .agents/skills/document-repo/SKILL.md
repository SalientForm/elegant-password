---
name: document-repo
description: Use when asked to document a repository, to write or refresh its document set — ABOUT, SKILLS, ARCHITECTURE, ROADMAP, FEATURES, TODO, SETUP and ISSUES in docs/ — or when one of those documents is missing, out of date or still a placeholder, or a skill is added to or removed from the repository.
---

# Document the repository

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

This skill writes and refreshes a repository's **document set**: eight markdown documents in `docs/`, each in the kit's
format (`docs/formats.md`, "The document set"; installed at `node_modules/@salientform/workspace-wayfinder/docs/formats.md`,
and in the kit's own repository at `docs/formats.md`). Every document is written from what the repository already
says about itself — its files, its manifests, its configs, its README and docs, its git history — never from
invention. A document the repository has nothing for yet is still written: as a **placeholder file** that says why, and
what would fill it. A section with nothing to say is a placeholder too, beside sections that have content.

The skill works the same in every repository, the kit's own included, and needs no workspace config. Where the root
`package.json` names one (`wayfinder.config`), the Audit area's `roadmap`, `todo` and `architecture` settings (all
required there) say where those three live, `areas.audit.idPrefix` the prefix every roadmap and TODO id carries, and
`areas.about.skillsDir` where the kit's skills are installed. The onboarding (`wayfinder-onboard`, §3 step 7) runs this skill to write the whole set on its first run.

| Document | Holds | Owned after the first run by |
| --- | --- | --- |
| `ABOUT.md` | what the repository is, who it is for, its state, and where each other document is | this skill |
| `SKILLS.md` | the skills the repository keeps (below) | this skill |
| `ARCHITECTURE.md` | layout, stack summary, running it, deployment, planned migrations | `assess-audit` where the Audit area reads it, otherwise this skill |
| `ROADMAP.md` | planned work: milestones, phases, their order | `assess-audit` where the Audit area reads it, otherwise this skill |
| `FEATURES.md` | what the product does, one section per feature | this skill; with the Features area, a list of its catalogue |
| `TODO.md` | unplanned ideas and small items | the `todo` skill where the Audit area reads it, otherwise this skill |
| `SETUP.md` | requirements, install, configure, run, test, build, release | this skill |
| `ISSUES.md` | known problems and limits, each with its workaround and what would fix it | this skill |

The templates beside this file (`templates/`) give each document's shape, all eight but `PLACEHOLDER.md`'s (a
placeholder file's). `__TODAY__` is today (`YYYY-MM-DD`), `__PRODUCT__` the product's name as its users know
it, `__ID_PREFIX__` the id prefix (`areas.audit.idPrefix`; without a workspace config, the initials of the repository's
name in capitals, as the onboarding suggests them, `workspace-wayfinder` → `WW`), and every other `__NAME__` the text it
names; none may remain (`grep -n '__[A-Z_]*__' docs/*.md`). A template's
example row or section is replaced by the real ones, or by a placeholder.

## Placeholders

Plain CommonMark, two labelled lines in one blockquote, exactly:

```markdown
> **Not generated yet.** No deployment configuration was found in this repository.
> **To fill:** add the deployment (a CI workflow or a platform file), then run `document-repo`.
```

- **The reason** says what was looked for and not found, specifically enough that a reader can check it.
- **To fill** says what would fill it: a file to add, a decision to make, a skill to run.
- A **placeholder file** is the document's title, its `Reviewed:` line, one sentence on what the document will hold,
  and one placeholder, with no `## ` section (`templates/PLACEHOLDER.md`). Write one only when the repository has
  nothing for any of the document's sections.
- A **placeholder section** is the section's heading and a placeholder under it.
- A placeholder is never left beside real content for the same section: when the content exists, it replaces the
  placeholder.
- A placeholder inside a fenced code block is an example of the format, and is not read as one.

## Workflow

1. **Inventory.** `node <skillsDir>/document-repo/scripts/check-documents.mjs` (in the kit's own repository
   `node skills/document-repo/scripts/check-documents.mjs`) lists what is missing and malformed;
   `.../list-skills.mjs` lists the skills `SKILLS.md` must name. Read each existing document, wherever it is: a
   document of the same kind elsewhere (a root `TODO.md`, `ROADMAP.md`, `SETUP.md` or `CONTRIBUTING.md`, a README
   section "Roadmap", "Known issues", "Getting started") is the source for its document.
2. **Move, then rewrite.** An existing document of the set in another place moves into `docs/` with `git mv`, so its
   history follows (git keeps it while the file stays similar; the rewrite below may change it past that, which is expected), and every mention of it is updated: links and prose in markdown, and comments and strings in code (`git grep -n '<old path>'`). A document in
   another shape is rewritten into the format, keeping its wording and its numbers (a TODO entry's, a phase's), each id given the prefix: `#4` becomes
   `<P>-4`, `M2.1` becomes `<P>-M2.1`, and every mention of them in the repository's markdown follows. A list with no
   numbers is numbered in its own order; an entry's `Added` is the day it first appeared in git (`git log -S`), or today;
   its `Source` is where it came from as the list says, for an entry or its group (a group's heading, `Asked for by X`,
   gives `x`), else `idea`; a group's introduction is copied into the body of each of its entries, so each reads on its
   own. An entry's `Area` is the part of the repository it touches, named after its top-level folders (`app`, `cli`,
   `docs`); the audit check fails on any not in the config's `todoAreas` until `assess-audit`'s first run proposes the
   list from the entries (`wayfinder-onboard` §3 step 7). An item that already has a spec, a plan or both is not a TODO
   entry: it becomes a roadmap phase (its `Status` from them: a spec alone is `specified`, a plan `planned`, work
   begun `in progress`) and leaves the TODO list.
   A document already in the format is refreshed, not rewritten.
3. **Write each document** from its sources (below), in the order of the table: `ABOUT.md` last in practice, since it
   summarises the others.
4. **Check.** Run `check-documents.mjs` until it prints its OK line. Its placeholders print after it: read each one,
   and make sure it is true — that the repository really has nothing for it.
5. **Links.** Every link in the documents resolves: a relative link from `docs/` to a repository path that exists
   (`../README.md`, `specs/<file>.md`). Where the Audit area runs, its check resolves them too; run the check script
   (`areas.about.checkScript`, default `workspace:check`), and give each new document its review (`assess-audit`).
6. **Reviewed.** Every document written or changed gets today in its `Reviewed:` line; one left as it was keeps its
   date.

## Each document

**`ABOUT.md`** (`templates/ABOUT.md`): the opening paragraph says what the repository is and who uses it, from the
README's opening and `package.json`'s `description`. **State**: the version (`package.json`, the latest tag), whether
it is released or deployed and where, its licence. **The documents**: a row for each of the other seven, linked, with
what it holds, and "placeholder" where it is one. **Elsewhere**: the README and any other entry point a reader needs
(a contributing guide, a design site, a deployed app), linked. It never repeats what another document holds.

**`SKILLS.md`** (`templates/SKILLS.md`): the skills a repository keeps, from `list-skills.mjs`, which finds them in
the skills directory, the agent directories (`.agents/skills`, `.claude/skills`, `.opencode/skills`) and, in the kit's
own repository, `skills/`.
- **Repository skills**: the repository's own skills — custom to it and kept in it. Each row: the skill's name in
  backticks, one short sentence on what it does (written fresh: not the `description`, which says when to use it),
  and its path.
- **Wayfinder skills collection**: the kit's skills installed in the repository, in a section of their own, each with
  what it does and a link to its `REPOSITORY.md` where the repository has written one. In the kit's own repository the
  collection's source is its own `skills/`: they are the repository's own skills, and there is no collection section.
- Not listed: a vendor's skills (recorded in `skills-lock.json`), the user's or a plugin's (a link that resolves
  outside the repository), and agents' built-in commands. `list-skills.mjs` names what it leaves out.
- With no skill of its own, the Repository skills section is left out (the kit's collection is still listed); with no
  skill at all, `SKILLS.md` is a placeholder file. The check fails while the lists and the repository differ.

**`ARCHITECTURE.md`** (`templates/ARCHITECTURE.md`): the kit's format requires `Reviewed:` and these six sections, in
this order, each from its sources. The audit check fails on a missing or empty one; a placeholder is content:

| Section | Holds | Read from |
| --- | --- | --- |
| `## Overview` | what it is and who uses it, one paragraph | the README's opening, `package.json` `description` |
| `## Repository layout` | each top-level directory and package, one line each | the tree, workspace manifests, package READMEs |
| `## Stack summary` | one `### <Area>` per layer present, a row per item at its installed major version, `current` | `package.json` files, the lockfile, config files; each `Ref` a path that exists or a `§<n>` |
| `## Running it` | each command that starts, tests and builds it, with its port, one line each; the steps in full are `SETUP.md`'s | `package.json` scripts, the repository's port rules |
| `## Deployment` | where it is deployed or published, and what does it | CI workflows, container and platform files |
| `## Planned migrations` | a bullet per open roadmap phase that changes the architecture | the roadmap |

**`ROADMAP.md`** (`templates/ROADMAP.md`): open phases from specs and plans in an active
state (`draft`, `under-review`, `blocked`), from a README or docs section listing planned work, and from a roadmap in
another shape (a wish with no spec, plan or recorded decision to build it is a TODO entry, not a phase), moved into the format, each phase's `Goal` in the repository's own words and its `Status` by the
documents it has; Completed from specs and plans already `implemented`, with their dates. Nothing found: no milestone,
and the template's placeholder under Sequence, its reason saying where you looked; the audit check fails a roadmap
with no open milestone and no such placeholder, and a placeholder beside a Sequence that lists phases. Repository
files only: no issue tracker or other outside source. Where the Audit area reads it, `assess-audit` owns it from
then on.

**`FEATURES.md`** (`templates/FEATURES.md`): what the product does for the people who use it, one `## <Feature>`
section each with a paragraph, `Where` (the paths that implement it) and `Status` (`shipped`, `partial`, or a
roadmap id when it is planned). Read the routes, the entry points, the exports, the commands and the README's own
list. **With the Features area**, the catalogue is the source of truth: `FEATURES.md` is a table of its files (each
feature's title, its summary and a link to its catalogue file), never a second catalogue. A library's features are
what a consumer can do with it; a tool's, its commands.

**`TODO.md`** (`templates/TODO.md`): from an existing TODO file or a README section of that
kind, moved into the format with its wording and its numbers, each entry's id the prefix and its number (`<P>-4`),
by step 2's rules (an item with a spec or plan is a roadmap phase instead). `TODO` and `FIXME` comments in code are not copied in.
Nothing found: the template as it is, its header and its placeholder, the reason saying where you looked; with
entries, no placeholder (the audit check refuses one beside an entry). Where the Audit area reads it, the `todo` skill owns it from then on.

**`SETUP.md`** (`templates/SETUP.md`): **Requirements** (runtime and its version from `engines`, `.nvmrc` or
`.tool-versions`; the package manager from `packageManager`; services such as a database or Docker; the platform
where it matters), **Install**, **Configure** (environment files and their variables, by name, never a value;
ports), **Run**, **Test**, **Build**, **Release** (how a version is cut and published or deployed). Each command
exactly as the repository runs it. Where the README already gives a step in full, link it rather than copy it.

**`ISSUES.md`** (`templates/ISSUES.md`): known problems and limits in what exists today, from the README's caveats,
issue notes in docs, failing or skipped checks, and limits stated in code comments. Each is a `## <Title>` with
`Area`, `Found` (a date), `Workaround` (or `—`) and `Fix` (a TODO entry, a roadmap phase, or `—`), then what goes
wrong and when. An issue is deleted when it is fixed. Ideas are not issues: they belong in `TODO.md`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Inventing a feature, a phase or a known issue to fill a document | A placeholder that says what was looked for |
| A placeholder beside real content for the same section | Replace the placeholder with the content |
| Copying the README into `SETUP.md` or `ABOUT.md` | Summarise and link the README's section |
| Copying each skill's `description` into `SKILLS.md` | One short sentence on what it does, written fresh |
| Listing the kit's installed skills as the repository's own | Under "Wayfinder skills collection", apart — except in the kit's own repository |
| Listing a vendor's or the user's skills | Leave them out; `list-skills.mjs` names them |
| A second feature catalogue in `FEATURES.md` beside the Features area | A table of the catalogue's files |
| Moving a document with a plain copy | `git mv`, then update every link to it |
| Bumping `Reviewed:` on a document that did not change | Only a document written or changed gets today |
