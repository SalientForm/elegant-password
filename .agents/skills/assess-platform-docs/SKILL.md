---
name: assess-platform-docs
description: Use when asked to review or refresh the non-technical Platform Docs (the markdown pages under the configured Platform Docs directory) shown in the workspace — after a page, feature, or navigation item is added, removed, or renamed in the product, or when the Platform Docs area needs its date refreshed.
---

# Assess Platform Docs

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview
The Platform Docs pages describe the product for non-engineers: what it is, how to use it, what exists today. The area is a Wayfinder module (`createPlatformDocsArea`, `src/platform-docs/` in the kit); everything this skill needs to know about the repository comes from the workspace config (the file the root `package.json` `wayfinder.config` names); `REPOSITORY.md` gives this repository's values:

| Setting | Means |
| --- | --- |
| `product` | the product the pages describe (Acme) |
| `areas['platform-docs'].directory` | one markdown file per page, `<order>-<slug>.md`, rendered at `/platform-docs/<slug>`; the menu comes from front-matter (`title`, `order`, `summary`) |
| `areas['platform-docs'].reviewedAt` | the area's reviewed date, an ISO date shown in its header; set only by this skill |

The hooks file (the root `package.json` `wayfinder.hooks`) may export `navLabels(ctx)`, returning the product's navigation labels; the check reports the ones no page mentions. Without it nothing is reported.

## On a placeholder area
When `areas['platform-docs']` is `{ placeholder: { reason, toFill } }` (the onboarding writes one where the repository has nothing the area reads; `docs/formats.md`, "The document set", Placeholders), test first whether it can now be generated: whether there are plain-language pages about the product, or the user has asked for them. If not, leave the placeholder, and make its reason true if what was looked for has changed. If so, replace the placeholder with `directory` and `reviewedAt`, and write or check the pages as the Workflow below says, then rebuild the About manifest (`assess-workspace`'s `propose.mjs --write`): the app's wiring is the same for both forms, so nothing else changes. The First run below says how. The check passes on a placeholder area and prints it after its OK line.

## First run
On a repository whose Platform Docs area is new (the onboarding's first runs, `wayfinder-onboard` §4, or a placeholder this skill can now fill), the pages are written from nothing, in two parts. A page an earlier install wrote is not kept or read; a page of the repository's own, already in the format, is a source and stays.

**Settings.** Run `node .agents/skills/assess-platform-docs/scripts/propose.mjs`. It proposes `directory`: the directory holding the most pages already in the format (`<order>-<slug>.md`, with `title`, `order` and `summary` in their front matter). Without one, the area is generated when the product has navigation to describe (pages or screens a reader moves between): every area is present and filled where the repository can fill it, so the first run drafts a page per navigation item, each opening with the draft placeholder until a person has read it. Only a repository with no product UI keeps the placeholder, its reason true. Set `directory` (`docs/platform` unless the repository keeps its docs elsewhere) and `reviewedAt`, replacing the placeholder, and record why in this skill's `REPOSITORY.md`.

**Pages.** With the hooks file's `navLabels` hook (the product's navigation labels), `propose.mjs` lists a page to draft for each label no page mentions, with its file name (`draft: docs/platform/30-orders.md — Orders`): a candidate, not an order. A label for a tab or panel inside another page becomes a section of that page instead (Workflow step 1), and its file is not written. Write each from the product's own text (its labels, headings, empty states and help text), in the Workflow's voice, never from invention. Each drafted page opens, under its front matter, with the draft placeholder until a person has read it:

```markdown
> **Not generated yet.** This page was drafted by assess-platform-docs from the product's own text and has not been read by a person.
> **To fill:** Read it against the product, correct what is wrong, then delete these two lines.
```

The check prints each such placeholder after its OK line, and About's Placeholders page lists it under the area, linked to the page; `--strict` fails on it. Whoever reads the page against the product deletes the two lines.

## Workflow
1. `node .agents/skills/assess-platform-docs/scripts/check-platform-docs.mjs` (`runCheck('platform-docs')` over the kit's `check/run.mjs`; the rules are the kit's `check/platform-docs.mjs`, which shares its page builder with the workspace) — fix every fatal line. An `unmentioned:` line names a navigation label no page mentions; cover it or say why not. A label needs a mention, not a page of its own: a tab inside a page is covered by a section of that page.
2. Read the product surface: its routes, its navigation (sidebar, top bar), its entry and selection pages, and the public entry of each feature library: the router and navigation files the hooks file's `productRoutes` and `navLabels` hooks read, where it has them (`REPOSITORY.md` may name more).
3. For each page, check every claim against the surface: page names, sidebar labels, what opens automatically, which tabs have content, what is demonstration data. Fix wording; add a page when a new feature area appears; remove a page only when its feature is gone.
4. Update the what's-available page first, if there is one — it is the summary readers trust.
5. Voice: plain language, no code, no file paths, no component names. Write for the product's users (`REPOSITORY.md` may name who they are).
6. Bump `areas['platform-docs'].reviewedAt` in the workspace config; re-run the script; run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others) (the workspace loads every page at start-up and fails on a front-matter problem); then open the area on the workspace dev server (`/platform-docs`) and click every menu item.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it.

## Common Mistakes
| Mistake | Fix |
|---|---|
| Describing planned features as available | Say "planned" and point at the spec on the what's-available page |
| Technical vocabulary | Rewrite for the reader |
| Forgetting front-matter | `title`, numeric `order`, `summary` are required; the workspace will not load without them |
| An unquoted `summary` with `: ` or `#` in it | The front matter is YAML: quote the value (`summary: 'Modes: what each changes'`), or the page fails to load |
| Editing dates by hand elsewhere | Only `areas['platform-docs'].reviewedAt` moves, only from this skill |
| Putting a page in a subdirectory | Pages are the directory's direct `*.md` files; a file below it is not rendered |
| Adding, renaming or removing a registry or setting without telling About | Run `assess-workspace`, whose `propose.mjs --write` rebuilds the About manifest from the config |
