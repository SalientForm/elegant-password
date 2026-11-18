#!/usr/bin/env node
/**
 * Drift check for the Audit area's registries, every path named in areas.audit of the workspace config (found
 * through the root package.json wayfinder.config): the roadmap, TODO list and architecture document, the spec ledger
 * and the documents readable in full. The rules are the kit's: the markdown files' in check/audit-implementation.mjs,
 * the ledger's and documents' in check/audit-ledger.mjs (their headers list every failure). The paths it ignores and
 * the ones whose links it does not check are settings too (areas.audit.ignore and linkExempt).
 *
 * Usage (from the repository root): node .agents/skills/assess-audit/scripts/check-audit-registries.mjs
 */
import { runCheck } from '@salientform/workspace-wayfinder/check/run.mjs';

await runCheck('audit');
