#!/usr/bin/env node
/**
 * The Audit area's first-run proposals (check/propose-audit.mjs): areas.audit's specDirs, phaseKinds, todoAreas,
 * todoSources and ignore, read off the repository's specs, roadmap and TODO list; the files with broken links, for the
 * skill to fix or exempt (linkExempt). Writes nothing: the reviews and the documents are the skill's and document-repo's.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-audit/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('audit');
