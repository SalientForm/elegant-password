#!/usr/bin/env node
/**
 * The API area's first-run proposals (check/propose-api.mjs): areas.api's document, registry, basePath and
 * callers.roots; and the consumer registry, which --write writes with each row's method, path, example, handler,
 * consumer and status derived, keeping the group, description, note and pages of the registry it finds.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/assess-api/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('api');
