---
title: The core as a package
status: planned
summary: "The shared core published as @salientform/elegant-passwords: a typing mode, a site preset and a few overrides in, checked suggestions out."
specs: [docs/specs/2026-11-03-core-package-design.md, docs/plans/2026-11-18-core-package-plan.md]
roadmap: [EP-M1.1]
---

Planned work with no route: Dossier's password dialog will load the core from the package. The config model already
lives in `src/lib/config/` (the plan's P1 to P3); the package's API, its build and the web app's one configuration are
still to come.
