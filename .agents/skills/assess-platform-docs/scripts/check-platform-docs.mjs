#!/usr/bin/env node
/**
 * Drift check for the Platform Docs pages (areas['platform-docs'] of the workspace config, found through the
 * root package.json wayfinder.config). The rules are the kit's (check/platform-docs.mjs).
 *
 * Fails when:
 *  - the configured directory does not exist or holds no *.md page
 *  - a page has no front-matter `title:`, numeric `order:` or `summary:`
 *  - two pages resolve to the same slug (numeric prefix + .md stripped)
 *  - areas['platform-docs'].reviewedAt fails the date rule
 *
 * Reports (does not fail) the product's navigation labels (the hooks file's navLabels) no page mentions.
 *
 * While areas['platform-docs'] is a placeholder, the check passes and prints it after its OK line. Placeholders never fail it; --strict fails on each.
 *
 * Usage (from the repository root): node .agents/skills/assess-platform-docs/scripts/check-platform-docs.mjs [--strict]
 */
import { runCheck } from '@salientform/workspace-wayfinder/check/run.mjs';

await runCheck('platform-docs');
