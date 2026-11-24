#!/usr/bin/env node
/**
 * Check for the document set: the eight documents in docs/ (the Audit area's three where the workspace config names
 * them elsewhere), each with its title and Reviewed: line, every placeholder with its reason and what would fill it,
 * and SKILLS.md listing exactly the skills the repository keeps. The rules are the kit's (check/documents.mjs). It
 * needs no workspace config. Placeholders are printed after the OK line and do not fail it; --strict fails on them.
 *
 * Usage (from the repository root): node .agents/skills/document-repo/scripts/check-documents.mjs [--strict]
 */
import { checkDocuments, describePlaceholder, optionalSettings } from '@salientform/workspace-wayfinder/check/documents.mjs';
import { finish, repoRoot, today } from '@salientform/workspace-wayfinder/check';

const settings = await optionalSettings(repoRoot);
const { problems, placeholders, summary } = checkDocuments({ root: repoRoot, settings, today });
if (process.argv.includes('--strict'))
  problems.push(...placeholders.map((p) => `${describePlaceholder(p)} (--strict)`));
finish(problems, `documents OK — ${summary}`);
for (const placeholder of placeholders) console.log(describePlaceholder(placeholder));
