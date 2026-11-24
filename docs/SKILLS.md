# Skills

Reviewed: 2026-11-24

The agent skills this repository keeps: a skill is a written procedure an agent (or a person) follows for one kind
of task. This repository has no skills of its own; the Workspace Wayfinder skills it installs are listed below. Skills
from a vendor, a plugin or the user's machine are not listed here.

## Wayfinder skills collection

Installed from `@salientform/workspace-wayfinder` by `pnpm skills:install` into `.agents/skills/` (which Codex reads),
with a link to each in `.claude/skills/` (for Claude Code); the installer keeps them equal to the kit's. This
repository's own rules for one sit beside it in its `REPOSITORY.md`.

| Skill | What it does | Repository rules |
| --- | --- | --- |
| `assess-api` | Keeps the workspace's API area true to the API the product serves and calls. | [REPOSITORY.md](../.agents/skills/assess-api/REPOSITORY.md) |
| `assess-audit` | Reviews the markdown documents, the spec ledger, the roadmap and the architecture document for the Audit area. | [REPOSITORY.md](../.agents/skills/assess-audit/REPOSITORY.md) |
| `assess-feature-audit` | Sweeps for dead code and unused features and keeps the feature audit current. | [REPOSITORY.md](../.agents/skills/assess-feature-audit/REPOSITORY.md) |
| `assess-features` | Keeps the feature catalogue, the route mirror and the tests mapped to features. | [REPOSITORY.md](../.agents/skills/assess-features/REPOSITORY.md) |
| `assess-platform-docs` | Keeps the plain-language Platform Docs pages true to the product. | [REPOSITORY.md](../.agents/skills/assess-platform-docs/REPOSITORY.md) |
| `assess-workspace` | Builds the About manifest and keeps the About area true to the workspace. | [REPOSITORY.md](../.agents/skills/assess-workspace/REPOSITORY.md) |
| `document-repo` | Writes and refreshes the document set in `docs/`. | — |
| `todo` | Adds, plans, executes and drops entries in the TODO list. | — |
| `wayfinder-onboard` | Installs the workspace in a repository and turns an area into a placeholder or back. | [REPOSITORY.md](../.agents/skills/wayfinder-onboard/REPOSITORY.md) |
