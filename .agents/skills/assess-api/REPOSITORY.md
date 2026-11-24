# assess-api in Elegant Passwords

What `scripts/propose.mjs` printed on the API area's first run (2026-11-24):

```text
api proposals — no OpenAPI 3 JSON document: keep the placeholder

judged: areas.api.placeholder — say where an OpenAPI document was looked for (tracked *.json with "openapi": "3…")
```

## What was judged, and why

The area stays a placeholder. Elegant Passwords has no API: the web app runs entirely in the browser (generation,
scoring and storage included) and `tep` runs on the machine. No tracked JSON file is an OpenAPI 3 document, and
nothing in `src/` calls `fetch` (`git grep -n "fetch(" -- src`). The placeholder's reason in
`wayfinder/src/workspace.config.mts` says so.

## This repository's rules

- Should the product ever serve or call an HTTP API, emit its OpenAPI 3 JSON document and run this skill's first run.
- Verify with `pnpm workspace:check`.
