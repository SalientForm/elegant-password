#!/usr/bin/env node
/**
 * The Features area's first-run proposals (check/propose-features.mjs): areas.features' tests.include,
 * tests.playwright, coverage.summaries and sourceRoots, read off the test runners' configs; and the route mirror
 * (productRoutes), built from the hooks file's productRoutes hook, which --write writes.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-features/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('features');
