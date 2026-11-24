# wayfinder-onboard in Elegant Passwords

The choices of the onboarding run that installed Workspace Wayfinder 0.3.0 here (2026-11-24), so the next run starts
from them.

What `scripts/propose.mjs` read off the repository:

| Setting | Proposed | From |
| --- | --- | --- |
| `product` | `"Elegant Passwords"` | README.md's title |
| `title` | `"Elegant Passwords Workspace"` | the product |
| `repository.url` | `"https://github.com/SalientForm/elegant-password"` | the origin remote (git@salientform-github:SalientForm/elegant-password.git), its SSH host resolved by ssh -G |
| `areas.audit.idPrefix` | `"EP"` | the initials of elegant-password; ask the user to confirm |
| `areas.readme.sections` | `[]` | no README below the root |
| `content.readmes` | `["README.md"]` | the root README and the sections |
| `areas.readme.description` | `"The repository README, rendered from source."` | the sections |

## What was chosen, and why

| Question | Answer |
| --- | --- |
| Package manager, layout | pnpm 11, one package (no workspaces): the app's packages are the root's dev dependencies, and the root has the `workspace:*` scripts |
| Workspace app | `wayfinder/` (the user's choice), config `wayfinder/src/workspace.config.mts`, hooks `wayfinder/src/workspace.hooks.mjs` |
| Branch | `main`: specs and plans merge there, and it deploys |
| Id prefix | `EP`, as proposed |
| Ports | dev 4274, preview 4275, bound to 127.0.0.1: the machine's port table gives this repository 4270-4279, and lists these two for the workspace; the product's are 4270 and 4271, the smoke tests' 4272 and 4273. Registered in the README's Use commands, `docs/SETUP.md` and `docs/ARCHITECTURE.md` |
| Remote access | `server.allowedHosts` names the Tailscale Serve host in `wayfinder/vite.config.ts`, as the product's config does |
| Header links | Elegant Passwords on 4270, with no `path`: the product deploys to GitHub Pages on its own origin, never beside the workspace |
| Tailwind | none: the product has no Tailwind, so the app imports the kit's compiled `styles.css` and installs neither `tailwindcss` nor `@tailwindcss/vite` |
| Theme | the kit's (`startTheme()` and `ThemeToggle`): the product follows `prefers-color-scheme` in CSS alone, with no provider, control or class on `<html>` |
| Installed | the kit's tarball (`vendor/`, committed), `@tanstack/react-router` and `@tanstack/router-core`; React, Vite and `@vitejs/plugin-react` were already there. `minimumReleaseAgeExclude` names the kit in `pnpm-workspace.yaml` |
| TypeScript | 7 only, so the Features area's tests are a placeholder (the test inventory needs TypeScript 5's compiler API) |
| Agents | Claude Code and Codex: the skills directory is `.agents/skills` (Codex reads it) and `skillLinks` keeps its default `['.claude/skills']` (Claude Code). Git ignores only `.claude/worktrees/` and `.claude/settings.local.json`, so the links are tracked |
| CI | runs `pnpm workspace:check` in `.github/workflows/check.yml`, after the typecheck (the user's choice). No ignore file drops `vendor/` or `*.tgz`; there is no Dockerfile |
| Task runner | none that caches: no Nx or Turborepo |
| About prose | none of the repository's own: the kit's defaults are true here |

## The areas

| Area | Form | Why |
| --- | --- | --- |
| Readme | generated | the root README only: no README below it |
| Audit | generated | the document set, the reviews, the core package's spec and plan (EP-M1.1), and the feature audit |
| Features | generated, its tests and coverage placeholders | three hash routes read by the hooks file from `PAGES` in `src/App.tsx`; TypeScript 7 has no compiler API; no test run writes `json-summary` coverage |
| API | placeholder | no API: no tracked OpenAPI 3 JSON document, no `fetch` in `src/` |
| Platform Docs | generated | a page per page of the app, drafted from its own text, each still opening with the draft placeholder |
| About | generated | the manifest, built by `assess-workspace` |

## The document set

`document-repo` moved the root `TODO.md` to `docs/TODO.md` (`git mv`) and rewrote it into the format: 32 entries,
`EP-1` to `EP-32`, in the old file's order, each group's introduction in the body of its first entry. Its first item,
the core as a package, has a spec and a plan, so it became the roadmap's `EP-M1.1` instead of an entry. Every mention
of the old path (`docs/decisions.md`, the spec, the plan, two code comments) now names `docs/TODO.md` and the entry's
id. `docs/decisions.md` and `docs/algorithm-flow.md` stay as they are, reviewed.
