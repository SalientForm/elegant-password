---
reviewedAt: 2026-11-11
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
  - id: algorithm-flow
    title: Algorithm flow
    path: docs/algorithm-flow.md
    description: Every criterion mapped to the step that enforces it, and how a password is scored.
  - id: decisions
    title: Design decisions
    path: docs/decisions.md
    description: The decisions behind the app that the code does not make obvious, with why and when.
---

# Reviews

One review per reviewed markdown file, kept here beside this index. Each review's name is its path: a review of
`README.md` is `README.review.md` under this folder, one of `docs/x.md` is `docs/x.review.md`, and a review of a whole
directory `docs/x/` is `docs/x/_directory.review.md`. This index holds the review date, the All markdowns sections and the Documentation
list. The format is defined in `@nexstratus/workspace-wayfinder`'s `docs/formats.md`.
