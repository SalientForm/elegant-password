---
path: README.md
kind: documentation
lastModified: 2026-11-24
verdict: partially-stale
tracked: [EP-M1.1]
---

## Stale content

The Layout section still lists `names.ts` and `configVersion.ts` under `src/cli/`, and no `src/lib/config/`: P1 of the core package plan moved them to `src/lib/config/names.ts` and `version.ts` (verified: `ls src/cli src/lib/config`). The rest matches the tree, the scripts and the ports (4270 to 4275).

## Future content

The core package (P8 of its plan) rewrites the README for the package and the one configuration format.

## Recommendation

Update the Layout section's command-line list for the config model's move to `src/lib/config/`, as the core package plan's P8 (documentation) does.
