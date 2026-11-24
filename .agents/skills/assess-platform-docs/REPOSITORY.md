# assess-platform-docs in Elegant Passwords

What `scripts/propose.mjs` printed on the Platform Docs area's first run (2026-11-24), before any page existed:

```text
platform-docs proposals — 0 pages in the format, 8 navigation labels, 8 pages to draft

judged: pages — each drafted page from the product's own text (labels, headings, empty states), opening with the draft placeholder
judged: areas['platform-docs'].directory — docs/platform, once the user asks for pages or the product has navigation to describe

draft: docs/platform/10-passwords.md — Passwords
draft: docs/platform/20-scoring.md — Scoring
draft: docs/platform/30-fun.md — Fun
draft: docs/platform/40-options.md — Options
draft: docs/platform/50-suggestions.md — Suggestions
draft: docs/platform/60-testing.md — Testing
draft: docs/platform/70-make-up-a-sentence.md — Make up a sentence
draft: docs/platform/80-use-my-sentence.md — Use my sentence
```

## What was judged, and why

- **Generated, not a placeholder:** the web app has navigation to describe (three pages in its header), so the area is
  generated: `directory: 'docs/platform'`, `reviewedAt` the first run's date.
- **Three pages, not eight:** only Passwords, Scoring and Fun are pages (the hash routes of `PAGES` in `src/App.tsx`).
  Options, Suggestions and Testing are the Passwords page's three sections (tabs on a phone), and Make up a sentence
  and Use my sentence its two sentence modes, so each is a section of `10-passwords.md`, not a file.
- Each page was drafted from the app's own text (its headings, labels, hints and the README's feature list) and opens
  with the draft placeholder until a person has read it against the app.

## This repository's rules

- The navigation labels come from the hooks file (`wayfinder/src/workspace.hooks.mjs`, `navLabels`), which reads the
  `PAGES`, `COLUMNS` and `MODE_TABS` tables of `src/App.tsx`.
- The readers are anyone choosing a password they will type by hand: no code, no file paths.
- The web app's "Mode" heading becomes "Typing mode" with the core package (EP-M1.1, plan P7): rename it on the
  Passwords page when that ships.
- Verify with `pnpm workspace:check`, then open `/platform-docs` on `pnpm workspace:dev` (4274).
