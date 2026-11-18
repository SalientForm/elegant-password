# Assess Audit: Elegant Passwords

- No roadmap, TODO list or architecture document is configured. `TODO.md` is the repository's own free-form list of
  deferred work: its review has no `## Future content`, and other reviews carry none either, since future work here has
  no roadmap id, `#<id>` or spec to be tracked by.
- Specs are working documents: once built, their decisions move to `docs/decisions.md`, the README or
  `docs/algorithm-flow.md`, and the spec and its plan are deleted (`docs/decisions.md`). While a spec or plan exists in
  `docs/specs/` or `docs/plans/`, it carries its front matter (`state`, `summary`, and `spec` on a plan) like any other.
- Verification after a sweep: `pnpm workspace:check`, `pnpm typecheck`, `pnpm test`, and
  `pnpm exec tsc -p workspace/tsconfig.json`.
