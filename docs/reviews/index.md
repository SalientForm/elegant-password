---
reviewedAt: 2026-11-24
kinds:
  - id: documentation
    label: Documentation
  - id: spec
    label: Specs
  - id: plan
    label: Plans
  - id: config
    label: Agent & tooling config
documents:
  - id: readme
    title: README
    path: README.md
    description: What the repository is and how to set it up.
  - id: architecture
    title: Architecture
    path: docs/ARCHITECTURE.md
    description: The stack summary and the planned migrations.
  - id: roadmap
    title: Roadmap
    path: docs/ROADMAP.md
    description: Milestones and phases in likely order, the source for the Roadmap page.
  - id: decisions
    title: Design decisions
    path: docs/decisions.md
    description: The decisions behind the app, with why and when.
  - id: algorithm-flow
    title: Algorithm flow
    path: docs/algorithm-flow.md
    description: How site rules become a password, and how a password is scored.
  - id: setup
    title: Setup
    path: docs/SETUP.md
    description: Install, configure, run, test, build and release.
---

# Reviews

One review per reviewed markdown file, kept here beside this index. Each review's name is its path: a review of
`README.md` is `README.review.md` under this folder, one of `docs/x.md` is `docs/x.review.md`, and a review of a whole
directory `docs/x/` is `docs/x/_directory.review.md`. This index holds the review date, the All markdowns sections and the Documentation
list. The format is defined in `@salientform/workspace-wayfinder`'s `docs/formats.md`.
