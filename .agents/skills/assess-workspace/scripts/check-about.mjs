#!/usr/bin/env node
/**
 * Drift check for the workspace About area: the prose files and the About manifest, both named by areas.about
 * of the workspace config (found through the root package.json wayfinder.config), against the areas that config
 * lists. The rules are the kit's (check/about.mjs).
 *
 * Fails when:
 *  - a configured area (other than About) has no prose file
 *  - a prose file is neither an area nor overview, shell or skills, or one of those three is missing
 *  - a prose file has no front-matter `title:` or `summary:`
 *  - a script the check script (areas.about.checkScript) runs belongs to a skill that is not in ABOUT_SKILLS
 *  - an ABOUT_SKILLS skill has no SKILL.md under areas.about.skillsDir, or one of its scripts does not exist
 *  - a `file:` the manifest names does not exist
 *  - ABOUT_REVIEWED_AT fails the date rule
 *
 * Usage (from the repository root): node .agents/skills/assess-workspace/scripts/check-about.mjs
 */
import { runCheck } from '@nexstratus/workspace-wayfinder/check/run.mjs';

await runCheck('about');
