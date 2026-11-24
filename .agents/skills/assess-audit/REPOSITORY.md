# assess-audit in Elegant Passwords

What `scripts/propose.mjs` read off the repository on the Audit area's first run (2026-11-24):

| Setting | Proposed | From |
| --- | --- | --- |
| `areas.audit.specDirs` | `["docs/specs","docs/plans"]` | 2 documents with a spec or plan state |
| `areas.audit.phaseKinds` | `["feature","infrastructure","migration"]` | the defaults, the roadmap format's kinds |
| `areas.audit.todoAreas` | `["core","app","repo","cli"]` | the Area: values docs/TODO.md uses |
| `areas.audit.todoSources` | `["idea","dossier","user"]` | the Source: values of docs/TODO.md that are not paths |
| `areas.audit.ignore` | `[]` | no fixture or scratch directory holds markdown |

judged: areas.audit.linkExempt — no link is broken: leave it unset

## What was judged, and why

- Every proposed value went into `areas.audit` as printed. `ignore` is left unset (its default is none), and so is
  `linkExempt`: no link is broken.
- The TODO areas are the repository's own parts: `core` (`src/lib`, shared by both front ends), `app` (the web app),
  `cli` (`tep`) and `repo` (the repository, its publishing and its tooling). No `docs` area: no entry is about the
  documents alone.
- The TODO sources `dossier` and `user` come from the old root `TODO.md`'s group headings ("Asked for by Dossier",
  "Asked for by the user"); every other entry is `idea`.

## This repository's rules

- A spec and its plan are deleted once built, their decisions recorded in `docs/decisions.md`, the README or
  `docs/algorithm-flow.md` (`docs/decisions.md`, opening). So a Completed row's Spec / plan is `—`, and a shipped spec's
  review is deleted with it.
- Verify with `pnpm workspace:check`, then `pnpm typecheck` and `pnpm test`.
