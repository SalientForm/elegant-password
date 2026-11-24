#!/usr/bin/env node
/**
 * Drift check for the feature audit (areas.audit.featureAudit of the workspace config, found through the root
 * package.json wayfinder.config). The rules are the kit's (check/feature-audit.mjs).
 *
 * Fails when:
 *  - the feature audit is missing, is not JSON, or has a problem its reader reports
 *  - a finding's files do not exist
 *  - a todo finding and the feature-audit:<slug> TODO sources do not pair both ways
 *  - the TODO list is missing or malformed, so the pairing could not be checked
 *  - its reviewedAt fails the date rule
 *
 * Usage (from the repository root): node .agents/skills/assess-feature-audit/scripts/check-features-registry.mjs
 */
import { runCheck } from '@salientform/workspace-wayfinder/check/run.mjs';

await runCheck('feature-audit');
