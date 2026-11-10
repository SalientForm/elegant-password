---
name: assess-workspace
description: Use when a workspace area, page, registry, model, skill or check script is added, renamed or removed, or when the About area needs refreshing.
---

# Assess Workspace

Read `REPOSITORY.md` beside this file first, if it exists: it holds this repository's own rules for this skill, and they take precedence over the examples here.

## Overview
The About area (`/about`) documents the workspace itself. It is the first module of the kit (`src/about/` in the kit, `@nexstratus/workspace-wayfinder`); the repository configures it through `areas.about` in the workspace config (the file the root `package.json` `wayfinder.config` names) and `createAboutArea` in its workspace module (the file that imports the manifest: `grep -rln createAboutArea` under the workspace app). Three things are written by hand and owned by this skill; everything else on the pages is read from source at build time.

| What | Where | Holds |
| --- | --- | --- |
| Manifest | `areas.about.manifest` | `ABOUT_MANIFEST`, an `AboutManifest`: its `areas` (each area's registries and models, which a manifest may keep in an export of its own), its `skills` (`ABOUT_SKILLS`, each workspace skill and its scripts, which the About check reads by that name) and its `reviewedAt` (`ABOUT_REVIEWED_AT`). `SHELL_MODELS` and About's own models are the kit's (`src/about/models.ts` in the kit), not the manifest's. A kit model is named by its path in the kit (`src/settings.ts`, `check/features.d.mts`) with `kit: true` |
| Prose | `areas.about.prose` | purpose and how to read: `overview`, `shell`, `skills`, one file per area. The kit ships a default for `overview`, `shell`, `skills` and each kit area but About; a repository file of the same name replaces it. About needs none: its own pages are the overview, shell and skills prose, and the check asks no file for it. An area the kit has no default for needs the repository's file |
| Date | `ABOUT_REVIEWED_AT` in the manifest | set only by this skill |

Three more settings: `areas.about.skillsDir` (default `.agents/skills`), the skills directory, where the skills live; `areas.about.skillLinks` (default `['.claude/skills']`), the agent directories that hold a link to each kit skill for the agents that do not read the skills directory; and `areas.about.checkScript` (default `workspace:check`), the root `package.json` script that runs every check.

The kit's skills of the configured areas are installed into the skills directory as copies (`assess-workspace` and `wayfinder-onboard` always, then one per area or Audit file that has a skill), and each `skillLinks` directory gets a relative symlink per installed kit skill; the About check compares each copy with the kit's, fails on a kit skill whose area is not configured, fails on a link that is missing, is a copy or points elsewhere, and fails on a check script that runs a kit skill through a link. `node node_modules/@nexstratus/workspace-wayfinder/check/install-skills.mjs` re-installs and relinks them, and drops a kit skill whose area was taken out of the config (on Linux, macOS or WSL; `--check` reports on any platform). It never touches a skill's `REPOSITORY.md`, which holds the repository's own rules for that skill, nor a skill or link that is not the kit's.

A renamed or removed export or model fails the workspace build (the manifest is validated when the module loads). A **new** registry export or model is not detected: adding it to the manifest is the job of whoever adds it, and of this skill's sweep.

## Workflow
1. `node .agents/skills/assess-workspace/scripts/check-about.mjs` (`runCheck('about')` over the kit's `check/run.mjs`; the rules are the kit's `check/about.mjs`) — fix every fatal line.
2. Sweep for additions. For each area the workspace config lists, list the registries its module reads and their types (`grep -n "^export " <file>` on the repository's own area files) and compare with the area's entry in the manifest's `areas` (`ABOUT_MANIFEST.areas`); check the content manifest's collections (`content` in the workspace config) against About's `virtual:workspace-content` row. Add what is missing; remove what is gone. A registry row needs `name`, `file`, `source`, `holds` (one clause), and, where they exist, `count`, `owner`, `checkedBy`, `date`.
3. Sweep the skills: every skill under `areas.about.skillsDir` that maintains a workspace registry, and every skill the kit ships (`wayfinder-onboard` and `todo` maintain none of their own), is in `ABOUT_SKILLS` with its scripts in run order. Skills from elsewhere (vendor skills, the repository's own tooling) are not listed.
4. If the manifest names a new file, add it to the `sources` collection in the workspace config's `content` (About throws at load on a file the collection does not cover).
5. Read each prose file (the repository's under `areas.about.prose`, the kit's default otherwise) against its area. Prose says what the area answers and how to read it. File paths, export names, field lists and check rules belong to the generated sections, not the prose.
6. Bump `ABOUT_REVIEWED_AT`; re-run the script; run the check script (`areas.about.checkScript`, default `workspace:check`) and whichever of lint, typecheck and tests the repository has (its root `package.json` scripts; a `REPOSITORY.md` beside this skill may add others); then open the area on the workspace dev server (`/about`) and click every menu item.

**Date rule:** The owning `reviewedAt` is the date the registry was actually last updated: a valid ISO date, not after today. It is not tied to git: set it on the day you make the change, and leave it alone when the change is committed, rebased or merged on a later day. Only the owning skill writes it.

## Common Mistakes
| Mistake | Fix |
|---|---|
| Building a path in the manifest from a constant | Write every `file` and script path as a full string literal; the check script reads them with a regex |
| Adding a helper function to the manifest | It is a registry: data only. Lookups and validation are the kit's (`src/about/catalog.ts` in the kit) |
| Describing fields or check rules in prose | Delete it; the Models and Skills sections generate that |
| Adding a workspace skill without listing it | `ABOUT_SKILLS`, or the check script fails once its script is in the command |
| Forgetting the prose file for a new area | `<areas.about.prose>/<slug>.md` with `title` and `summary` front-matter, unless the kit ships a default for the area |
| Editing an installed kit skill | It is a copy the About check compares with the kit's: put the repository's rules in its `REPOSITORY.md`, or change the kit and re-install |
