# Wayfinder Onboard: Elegant Passwords

The choices of the onboarding run on 2026-11-10, for the next run to start from.

## Shape

- A single-package pnpm repository (no workspaces, no monorepo tool). The workspace app is `workspace/`, run by the
  root scripts `workspace:dev`, `workspace:build` and `workspace:preview` with `--config workspace/vite.config.ts`;
  its dependencies (the kit, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/router-core`) are root dev
  dependencies. `react`, `react-dom`, `vite` and `@vitejs/plugin-react` were already there and kept their versions.
- The workspace is a development tool: the product's production dependencies, its root `tsconfig.json` (which does
  not include `workspace/`) and its GitHub Pages build (`pnpm build`, the root `vite.config.ts`) do not change.
- No Tailwind: `workspace/src/styles.css` imports the kit's compiled `styles.css`.
- Repository: `https://github.com/SalientForm/elegant-password` (the remote's SSH alias `salientform-github` is
  `github.com`), branch `main`.

## Ports

4274 (dev) and 4275 (preview), inside the repository's block 4270-4279 (the machine-wide port table, outside the
repository). The repository registers its ports only in the README's "Use" commands, where the workspace's commands
were added with them. 4270-4273 are the product's (dev, preview, the two Playwright targets).

## Areas

- **Readme, Audit and About** only.
- **Audit** has no roadmap, no TODO list and no architecture document: `TODO.md` and `docs/decisions.md` are in the
  repository's own free form, and specs are deleted once built (`docs/decisions.md`), so `specDirs` keeps the defaults
  and is empty today. The `todo` skill is not installed.
- **Left out:** Features, API, Platform Docs and Monitor, by the user's decision. No rules file: no check needs a hook.
- **Header links:** none.

## Skills

Installed in `.agents/skills` (the default), with a relative symlink per skill in `.claude/skills` (the default
`skillLinks`), both committed; `.gitignore` ignores only `.claude/worktrees/` and `.claude/settings.local.json`.

## The kit

Since 2026-11-11 the kit is the release tarball `vendor/nexstratus-workspace-wayfinder-0.1.0.tgz`, committed, and the
root dev dependency `file:vendor/nexstratus-workspace-wayfinder-0.1.0.tgz`; there is no registry.
`pnpm-workspace.yaml` (settings only) excludes it from pnpm's release-age check, which a fresh install (CI) would
otherwise fail on. To upgrade: the new release's tarball into `vendor/`, `pnpm add -D file:vendor/<tarball>`, the old
one removed, `pnpm skills:install`, `pnpm workspace:check`.

The kit's optional peer `typescript` (5.x, for the Features area's test inventory) is not met by this repository's
TypeScript 7, so `pnpm peers check` lists it; Features is left out, so nothing uses it.

## CI

The frozen install works in CI now that the kit is committed. The check script is not run there yet: ask the user
whether `check.yml` should run `pnpm workspace:check`.
