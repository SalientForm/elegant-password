---
reviewedAt: __TODAY__
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
  - id: architecture # [[with: architecture]]
    title: Architecture # [[with: architecture]]
    path: docs/ARCHITECTURE.md # [[with: architecture]]
    description: The stack summary and the planned migrations. # [[with: architecture]]
  - id: roadmap # [[with: roadmap]]
    title: Roadmap # [[with: roadmap]]
    path: docs/ROADMAP.md # [[with: roadmap]]
    description: Milestones and phases in likely order, the source for the Roadmap page. # [[with: roadmap]]
---

# Reviews

One review per reviewed markdown file, kept here beside this index. Each review's name is its path: a review of
`README.md` is `README.review.md` under this folder, one of `docs/x.md` is `docs/x.review.md`, and a review of a whole
directory `docs/x/` is `docs/x/_directory.review.md`. This index holds the review date, the All markdowns sections and the Documentation
list. The format is defined in `@nexstratus/workspace-wayfinder`'s `docs/formats.md`.
