#!/usr/bin/env node
/**
 * The About area's proposals (check/about-manifest.mjs): the content collections that cover every file the areas
 * read; and the About manifest, built whole from the workspace config and the installed skills, which --write writes
 * when it differs. The About check fails while the manifest differs from this build.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-workspace/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('workspace');
