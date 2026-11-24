# About Elegant Passwords

Reviewed: 2026-11-24

Elegant Passwords generates passwords that are hard to guess, easy to remember and fast to type. Enter a site's rules
and it suggests passwords that read as a sentence, each explained and scored, in a web app that runs entirely in the
browser and in `tep`, a command line for Linux and macOS, both over one shared core. It is for anyone choosing a
password they will type by hand; Dossier is set to use its core as a package for its own password dialog.

## State

- **Version:** 0.1.0 (`package.json`; no release tags)
- **Released or deployed:** the web app on GitHub Pages, https://salientform.github.io/elegant-password/, from every
  push to `main`; `tep` is built from a checkout, not published
- **Licence:** MIT, copyright SalientForm ([LICENSE](../LICENSE))

## The documents

Each name links its document; a placeholder file says so in its row.

| Document | Holds |
| --- | --- |
| [SKILLS.md](SKILLS.md) | the agent skills this repository keeps |
| [ARCHITECTURE.md](ARCHITECTURE.md) | how it is built: layout, stack, running it, deployment, planned migrations |
| [ROADMAP.md](ROADMAP.md) | planned work: milestones, phases and their order |
| [FEATURES.md](FEATURES.md) | what it does: a table of the workspace's feature catalogue |
| [TODO.md](TODO.md) | ideas and small items not yet planned |
| [SETUP.md](SETUP.md) | how to install, configure, run, test, build and release it |
| [ISSUES.md](ISSUES.md) | known problems and limits, with workarounds and what would fix them |

## Elsewhere

- [README.md](../README.md): what the app and `tep` do, feature by feature, how to use and deploy them, and the
  source layout.
- [decisions.md](decisions.md): the design decisions behind the app, with why and when.
- [algorithm-flow.md](algorithm-flow.md): how site rules become a password, and how a password is scored.
- The Engineering Workspace (`wayfinder/`, `pnpm workspace:dev` on 4274): these documents, the specs, the features
  and the skills in one place.
