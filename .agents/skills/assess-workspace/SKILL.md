---
name: assess-workspace
description: Use when a workspace area, page, registry, model, skill or check script is added, renamed or removed, or when the About area needs refreshing.
---

# Assess Workspace

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview
The About area (`/about`) documents the workspace itself. It is the first module of the kit (`src/about/` in the kit, `@salientform/workspace-wayfinder`); the repository configures it through `areas.about` in the workspace config (the file the root `package.json` `wayfinder.config` names) and `createAboutArea` in its workspace module (the file that imports the manifest: `grep -rln createAboutArea` under the workspace app). This skill owns three things; everything else on the pages is read from source at build time.

| What | Where | Holds |
| --- | --- | --- |
| Manifest | `areas.about.manifest` | `ABOUT_MANIFEST`, an `AboutManifest`: its `areas` (each area's registries, with live counts and owning dates), its `skills` (`ABOUT_SKILLS`, each workspace skill and its scripts, which the About check reads by that name) and its `reviewedAt` (`ABOUT_REVIEWED_AT`). **Built, never written:** `scripts/propose.mjs --write` builds it whole from the workspace config and the installed skills, and the About check fails while it differs from a fresh build. The models are the kit's (each area's, `SHELL_MODELS`, About's own), not the manifest's |
| Prose | `areas.about.prose` | purpose and how to read: `overview`, `shell`, `skills`, one file per area. The kit ships a default for `overview`, `shell`, `skills` and each kit area but About; a repository file of the same name replaces it. About needs none: its own pages are the overview, shell and skills prose, and the check asks no file for it. An area the kit has no default for needs the repository's file. Written by this skill, only where the default says something untrue |
| Date | `ABOUT_REVIEWED_AT` in the manifest | set by the build to today when the manifest changes, kept otherwise |

Three more settings: `areas.about.skillsDir` (default `.agents/skills`), the skills directory, where the skills live; `areas.about.skillLinks` (default `['.claude/skills']`), the agent directories that hold a link to each kit skill for the agents that do not read the skills directory; and `areas.about.checkScript` (default `workspace:check`), the root `package.json` script that runs every check.

All nine kit skills are installed into the skills directory as copies, whatever the areas, and each `skillLinks` directory gets a relative symlink per kit skill; the About check compares each copy with the kit's, fails on a kit skill that is not installed or not in `ABOUT_SKILLS`, fails on a link that is missing, is a copy or points elsewhere, and fails on a check script that runs a kit skill through a link. `node node_modules/@salientform/workspace-wayfinder/check/install-skills.mjs` re-installs and relinks them (on Linux, macOS or WSL; `--check` reports on any platform). It never touches a skill's `REPOSITORY.md`, which holds the repository's own rules for that skill, nor a skill or link that is not the kit's.

Every area is in the workspace (`readme`, `audit`, `features`, `api`, `platform-docs` and `about` in `settings.areas`; the About check fails on a missing one), and so in the manifest's `areas`. A placeholder area (its settings `{ placeholder: { reason, toFill } }`) has an empty entry, `{ registries: [], models: [] }`, until its skill fills it; its About page shows the placeholder above the prose. The Placeholders page lists every placeholder in the workspace, by area, then the document set's;

**What the build writes.** Each generated area's rows follow from its settings: Readme's collection; Audit's roadmap, TODO list, architecture document and reviews, and the feature audit when there is one; Features' catalogue, route mirror (routes and sidebar) and the three modules its Vite plugins generate; API's document and consumer registry; the Platform Docs directory. A placeholder area's entry is empty. `ABOUT_SKILLS` lists the nine kit skills (by the first area, in header order, each maintains), each with every script in its `scripts/` directory, then any other skill the check script runs from the skills directory. The manifest imports the Audit and Features areas from their own modules beside it (`audit.ts`, `features.ts`: the onboarding's layout) and the config for the dates it holds.

## First run
On a repository whose About area is new (the onboarding's first runs, `wayfinder-onboard` §4, last, once every other area's skill has run), in two parts.

**Settings.** Run `node .agents/skills/assess-workspace/scripts/propose.mjs`. It proposes the `content` collections that cover every file the areas read: the README collection the Readme area names (`README.md` and each section's `<prefix>**/README.md`); `markdown`, every other tracked markdown file the audit reviews (one `<dir>/*.md` per directory, `<dir>/**/*.md` for each spec directory, the About prose and Platform Docs directories always); `skills`, the kit skills' files under the skills directory; `reviews`, the reviews folder and each dot-directory in it by name (a glob enters a dot-directory only where its pattern names one); `features`, `api` and `audit`, the generated areas' own files; `sources`, the manifest. Write them into `content`. A collection the config has that the proposal does not is listed: keep it only if a page reads it.

**Registry.** `propose.mjs --write` builds the About manifest whole. Then read the prose (Workflow step 5), open `/about`, and click every page.

## Workflow
1. `node .agents/skills/assess-workspace/scripts/check-about.mjs` (`runCheck('about')` over the kit's `check/run.mjs`; the rules are the kit's `check/about.mjs`) — fix every fatal line.
2. Rebuild the manifest: `node .agents/skills/assess-workspace/scripts/propose.mjs --write`. It follows the config and the installed skills, so after an area changes form, a registry is added or a skill gains a script, the build carries it; it writes nothing when nothing changed.
3. Compare the `content` collections with the proposal the same run prints, and add what is missing: a file an area reads that no collection covers stops the workspace at load.
4. A repository skill that maintains a workspace registry and is not run by the check script is not listed: add its check to the check script, or leave it out of About.
5. Read each prose file (the repository's under `areas.about.prose`, the kit's default otherwise) against its area. Prose says what the area answers and how to read it. File paths, export names, field lists and check rules belong to the generated sections, not the prose.
6. Run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others); then open the area on the workspace dev server (`/about`) and click every menu item.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it.

## Common Mistakes
| Mistake | Fix |
|---|---|
| Editing the About manifest by hand | It is built: `propose.mjs --write` rebuilds it, and the About check fails on a hand edit |
| Describing fields or check rules in prose | Delete it; the Models and Skills sections generate that |
| Adding a workspace skill's check without rebuilding | The build lists every skill the check script runs: run `propose.mjs --write` after changing the check script |
| Forgetting the prose file for a new area | `<areas.about.prose>/<slug>.md` with `title` and `summary` front-matter, unless the kit ships a default for the area |
| Editing an installed kit skill | It is a copy the About check compares with the kit's: put the repository's rules in its `REPOSITORY.md`, or change the kit and re-install |
