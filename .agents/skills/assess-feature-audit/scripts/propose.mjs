#!/usr/bin/env node
/**
 * The feature audit's first-run proposals (check/propose-feature-audit.mjs): areas.audit.unusedExports' roots,
 * entries and ignore, read off the build and test configs; and the feature audit, which --write writes as a draft with
 * one dead-code finding per file the sweep reports when there is none yet, and otherwise compares with the sweep.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-feature-audit/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('feature-audit');
