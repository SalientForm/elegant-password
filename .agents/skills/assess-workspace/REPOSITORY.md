# assess-workspace in Elegant Passwords

What `scripts/propose.mjs` read off the repository on the About area's first run (2026-11-24), the last of the first
runs, before `--write`:

| Setting | Proposed | From |
| --- | --- | --- |
| `content.readmes` | `["README.md"]` | the files the areas read |
| `content.markdown` | `["*.md","docs/*.md","docs/plans/**/*.md","docs/platform/*.md","docs/specs/**/*.md","docs/workspace/*.md"]` | the files the areas read |
| `content.skills` | `[".agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/SKILL.md",".agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/scripts/*.mjs",".agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/REPOSITORY.md","package.json"]` | the files the areas read |
| `content.reviews` | `["docs/reviews/**/*.md","docs/reviews/.agents/**/*.md"]` | the files the areas read |
| `content.features` | `["docs/features/*.md","wayfinder/src/product-routes.json"]` | the files the areas read |
| `content.audit` | `["wayfinder/src/feature-audit.json"]` | the files the areas read |
| `content.sources` | `["wayfinder/src/about-manifest.ts"]` | the files the areas read |

judged: areas.about.prose — a file of the repository's own only where the kit's default prose says something untrue for it

## What was judged, and why

- The seven collections went into `content` as proposed; the config had no other collection.
- **No About prose of the repository's own:** each of the kit's defaults (`overview`, `shell`, `skills` and the five
  areas') is true here as written. They speak of a placeholder where a part is one (Features' coverage, the API
  area). The check script runs locally, not in CI.
- `skillsDir` and `skillLinks` keep their defaults: `.agents/skills` (read by Codex) and `['.claude/skills']` (for
  Claude Code), the two agents this repository's people use.

## This repository's rules

- Rebuild the manifest with `node .agents/skills/assess-workspace/scripts/propose.mjs --write` after any change to the
  config, the check script or the installed skills; never edit it.
- Verify with `pnpm workspace:check`, `pnpm workspace:typecheck` and `pnpm workspace:build`, then open `/about` on
  `pnpm workspace:dev` (4274).
