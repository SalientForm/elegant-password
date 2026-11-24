#!/usr/bin/env node
/**
 * Lists the skills SKILLS.md must name: the repository's own and, apart, the installed Wayfinder skills collection,
 * each with its SKILL.md description and where it lives, as tables to copy into SKILLS.md and shorten. A vendor's
 * skills (skills-lock.json) and links that resolve outside the repository are named but not listed. A helper the
 * document-repo skill runs by hand; the rules are the kit's (check/documents.mjs).
 *
 * Usage (from the repository root): node .agents/skills/document-repo/scripts/list-skills.mjs
 */
import { describeInventory, optionalSettings, skillInventory } from '@salientform/workspace-wayfinder/check/documents.mjs';
import { repoRoot } from '@salientform/workspace-wayfinder/check';

const settings = await optionalSettings(repoRoot);
console.log(describeInventory(skillInventory({ root: repoRoot, settings })));
