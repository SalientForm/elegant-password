# Architecture

Reviewed: 2026-11-24

## Overview

Elegant Passwords generates passwords that are hard to guess, easy to remember and fast to type: given a site's
rules, it suggests passwords that read as a sentence, each with an explanation and four strength readings. It has two
front ends over one shared core: a web app that runs entirely in the browser (published on GitHub Pages), and `tep`, a
command line for Linux and macOS. Both make and score a password exactly the same way, because every algorithm, rule,
preset and reading lives once in the core. The README's [Layout](../README.md#layout) lists every module.

## Repository layout

| Path | What it holds |
| --- | --- |
| `src/lib/` | the shared core: generation, the typing model, scoring and readings, in plain TypeScript with no browser, Node or React; `src/lib/config/` holds the configuration model, the one place the core may import `zod` and `yaml` |
| `src/state/`, `src/components/`, `src/App.tsx`, `src/main.tsx` | the web app: one provider owning state, persistence and generation, and the React UI |
| `src/cli/` | `tep`, the command line: flags, config files, the `tep config` wizard, output and the clipboard |
| `src/prompts/` | the Fun page's two prompts that rebuild the app and the command line |
| `src/boundaries.test.ts`, `src/workflows.test.ts` | the tests that hold the core's boundary and the workflows' shape |
| `build/` | `csp.ts`, the Content-Security-Policy added to the built app |
| `e2e/` | the browser smoke tests (Playwright) |
| `scripts/` | `linkCli.mjs` (`pnpm link:cli`), `devStats.mjs`, `testTitles.mjs`, `commonPasswords.mjs` |
| `docs/` | the document set, the design decisions, the algorithm flow, specs, plans, and the workspace's reviews and About prose |
| `wayfinder/` | the Engineering Workspace, a Vite app built with Workspace Wayfinder (`@salientform/workspace-wayfinder`) |
| `.agents/skills/`, `.claude/skills/` | the Workspace Wayfinder skills, installed by `pnpm skills:install`, and Claude Code's links to them |
| `vendor/` | the committed Workspace Wayfinder release tarball the workspace depends on |
| `.github/workflows/` | `check.yml`, the checks, called by `ci.yml` and `pages.yml`, the deploy |

## Stack summary

The concrete stack, one line per concern. `planned` marks a decided replacement or addition that is not built yet;
its Ref names the roadmap phase that delivers it.

### Runtime and tooling

| Item | Status | Note | Ref |
| --- | --- | --- | --- |
| Node 24 | current | `engines` in package.json | package.json |
| pnpm 11 | current | `packageManager` | pnpm-workspace.yaml |
| TypeScript 7 | current | `tsc -b` typechecks; no compiler API, so the workspace's test inventory is a placeholder | tsconfig.json |

### Web app

| Item | Status | Note | Ref |
| --- | --- | --- | --- |
| React 19 | current | | src/main.tsx |
| Vite 8 | current | dev server, build and preview; the CSP plugin | vite.config.ts |
| marked 18 | current | renders the Fun page's prompts | src/components/FunPage.tsx |
| zxcvbn 4 | current | the fourth badge, loaded on first use | src/lib/zxcvbnReading.ts |

### Core and command line

| Item | Status | Note | Ref |
| --- | --- | --- | --- |
| zod 4 | current | the config schema, in `src/lib/config/` | src/lib/config/model.ts |
| yaml 2 | current | config files as YAML text | src/lib/config/yaml.ts |
| @clack/prompts 1 | current | `tep config`'s questions | src/cli/prompter.ts |
| tsdown 0.23 | current | bundles `tep` into one file, `dist-cli/tep.mjs` | tsdown.config.ts |
| `@salientform/elegant-passwords` | planned | the core published as a package | EP-M1.1 |

### Tests

| Item | Status | Note | Ref |
| --- | --- | --- | --- |
| Vitest 5 | current | unit tests, jsdom for the UI | vite.config.ts |
| Testing Library (React 16) | current | | |
| Playwright 1 | current | smoke tests against the build and the dev server | playwright.config.ts |

### Engineering workspace

| Item | Status | Note | Ref |
| --- | --- | --- | --- |
| Workspace Wayfinder 0.3 | current | from the committed tarball in `vendor/` | wayfinder/vite.config.ts |
| TanStack Router 1 | current | the workspace's router | wayfinder/src/router.tsx |

## Running it

The commands that start, test and build Elegant Passwords, one line each; the steps in full are in [SETUP.md](SETUP.md).

| Command | What it does | Port |
| --- | --- | --- |
| `pnpm dev` | the web app's dev server | 4270 |
| `pnpm build && pnpm preview` | the built web app | 4271 |
| `pnpm test` | the unit tests (Vitest) | |
| `pnpm test:e2e` | the browser smoke tests, against the build and the dev server they start | 4272, 4273 |
| `pnpm typecheck` | types (`tsc -b`) | |
| `pnpm build:cli` | builds `tep`, `dist-cli/tep.mjs`; `pnpm tep g` runs it, `pnpm link:cli` links it | |
| `pnpm workspace:dev` | the Engineering Workspace's dev server | 4274 |
| `pnpm workspace:build && pnpm workspace:preview` | the built workspace | 4275 |
| `pnpm workspace:check` | the workspace's checks: documents, reviews and registries against the code | |

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`: the checks in `check.yml` first, then a build under
`/elegant-password/` (`BASE_PATH`) published to GitHub Pages at https://salientform.github.io/elegant-password/. With
the repository variable `PAGES_DOMAIN` set, it builds at `/` for a domain of its own. `tep` is not published: a checkout
builds it and `pnpm link:cli` links it. The workspace is not deployed. The README's [Deploy](../README.md#deploy) has
the detail.

## Planned migrations

Deliberate, decided changes to the architecture above, each an open roadmap phase. Goal, scope and sequencing for
each live in the roadmap.

- **EP-M1.1 The core as an npm package, configured by mode, preset and overrides** — [ROADMAP.md](ROADMAP.md#ep-m11-the-core-as-an-npm-package-configured-by-mode-preset-and-overrides)
