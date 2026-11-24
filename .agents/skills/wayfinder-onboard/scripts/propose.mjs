#!/usr/bin/env node
/**
 * The onboarding's proposals (check/propose-onboard.mjs): the product and title, the repository's URL, the id
 * prefix, and the Readme area's sections and collection, read off the repository before the workspace config exists.
 * The branch, the ports and the header links are the skill's to judge (its §1). Writes nothing.
 *
 * Prints the settings as a table (Setting, Proposed, From) to write into the workspace config and open this skill's
 * REPOSITORY.md with, then what is left to judgement, each with its rule. --json prints it as JSON. The rules are the
 * kit's (check/propose.mjs). Two runs on the same repository print the same.
 *
 * Usage (from the repository root): node .agents/skills/wayfinder-onboard/scripts/propose.mjs [--write] [--json]
 */
import { runPropose } from '@salientform/workspace-wayfinder/check/propose.mjs';

await runPropose('onboard');
