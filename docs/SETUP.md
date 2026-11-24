# Setup

Reviewed: 2026-11-24

How to get Elegant Passwords running from a fresh clone, and how a version is released. The README's
[Use](../README.md#use) and [Command line](../README.md#command-line) sections have the commands with their notes.

## Requirements

- Node 24 or later (`engines` in `package.json`).
- pnpm 11, the version `packageManager` names (`corepack enable pnpm` provides it).
- Linux or macOS for `tep`, the command line; the web app runs in any modern browser.
- For the browser smoke tests, Playwright's Chromium, installed once (below).

## Install

```bash
git clone https://github.com/SalientForm/elegant-password.git && cd elegant-password
pnpm install
```

The Engineering Workspace's kit, `@salientform/workspace-wayfinder`, installs from the tarball committed in `vendor/`,
with no registry and no token.

## Configure

- **Ports:** this repository's block is 4270-4279: the web app's dev server 4270 and preview 4271, the smoke tests'
  servers 4272 (the build) and 4273 (the dev server), the workspace's dev server 4274 and preview 4275. All bind to
  127.0.0.1.
- **`.env.development`:** `VITE_OWN_HOSTS`, the hosts where a dev server is the app's own origin, so My list and the
  current batch may be stored (`src/state/origin.ts`).
- **Build variables:** `BASE_PATH` (the base the app is built under, default `/`) and `VITE_OWN_HOSTS`, both set by the
  deploy workflow; `WORKSPACE_BASE` for a workspace build under a sub-path.
- **`TEP_BIN_DIR`:** the directory `pnpm link:cli` links `tep` from, instead of `~/.local/bin`.

## Run

```bash
pnpm dev                 # the web app: http://127.0.0.1:4270
pnpm link:cli            # builds tep and links ~/.local/bin/tep; then tep g
pnpm workspace:dev       # the Engineering Workspace: http://127.0.0.1:4274
```

## Test

```bash
pnpm typecheck           # tsc -b
pnpm test                # unit tests (Vitest)
pnpm exec playwright install chromium-headless-shell   # first time only
pnpm test:e2e            # browser smoke tests against the build (4272) and the dev server (4273)
pnpm workspace:check     # the workspace's checks: documents, reviews and registries against the code
pnpm workspace:typecheck # the workspace app's types
```

## Build

```bash
pnpm build && pnpm preview                    # the web app, served on 4271
pnpm build:cli                                # tep, dist-cli/tep.mjs (one file, needs only Node 24)
pnpm workspace:build && pnpm workspace:preview  # the workspace, served on 4275
```

## Release

There are no versions to cut. Every push to `main` runs `.github/workflows/pages.yml`, which runs the checks and
publishes the web app to GitHub Pages (the README's [Deploy](../README.md#deploy) has the custom domain steps). `tep` is
not published: each checkout builds and links its own. Publishing the core as a package is planned (EP-M1.1 in
[ROADMAP.md](ROADMAP.md)).
