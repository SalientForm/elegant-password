# Roadmap

Reviewed: 2026-11-24

What gets built next, and in what order. A **milestone** (`EP-M<n>`) is one outcome; a **phase** (`EP-M<n>.<k>`) is an
independently shippable step towards it. The order under **Sequence** is a forecast, not a commitment. Shipped phases
collapse to a row under **Completed**. Small or unplanned items live in the TODO list ([TODO.md](TODO.md));
work that aligns with no milestone gets an `EP-X<n>` id under **Outside the roadmap**. The format is Workspace Wayfinder's (its `docs/formats.md`).

This repository deletes a spec and its plan once they are built, recording their decisions in
[decisions.md](decisions.md), the README or the [algorithm flow](algorithm-flow.md): a Completed row's Spec / plan is
`—` from then on.

## Sequence

1. EP-M1.1

## EP-M1. The core as a package

Dossier generates passwords in its own password dialog with Elegant Passwords' core, loaded on demand in the browser:
a caller states a typing mode, a site preset and only the values it overrides, and gets back checked suggestions and
their problems, never fixed quietly. The config format `tep` writes becomes the one configuration format of the web
app, the CLI and the package.

### EP-M1.1 The core as an npm package, configured by mode, preset and overrides

- **Status:** in progress
- **Kind:** feature
- **Goal:** Publish `src/lib` as `@salientform/elegant-passwords`, a library with a documented, stable API: the
  layering that turns a typing mode, a site preset and a few values into generation settings moves from `src/cli` into
  the core, and `tep`'s config (version 2, `app-mode` and `typing-mode`) is the one way Elegant Passwords manages its
  configuration, in the web app and the CLI alike.
- **Not in scope:** one sentence mode's screen and algorithm (EP-2; the spec settles only its format), Keyboard
  patterns (EP-3), merging zxcvbn-ts (EP-4), and whether and when to publish to npm (EP-5).
- **Depends on:** —
- **Spec:** docs/specs/2026-11-03-core-package-design.md
- **Plan:** docs/plans/2026-11-18-core-package-plan.md

Asked for by Dossier on 2026-10-22, its first and most urgent item: its password generator is blocked until this
ships. P1 to P3 of the plan are built (2026-11-23).

## Completed

| ID | Title | Shipped | Spec / plan |
| --- | --- | --- | --- |

## Outside the roadmap

Next X: 1

| ID | Title | Spec | Plan |
| --- | --- | --- | --- |
