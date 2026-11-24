#!/usr/bin/env node
/**
 * The Platform Docs area's first-run proposals (check/propose-platform-docs.mjs): the area's directory, from the
 * pages already in the format, and a page to draft for each navigation label (the hooks file's navLabels) no page
 * mentions. Writes nothing: the skill drafts each page, opening with the draft placeholder.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-platform-docs/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('platform-docs');
