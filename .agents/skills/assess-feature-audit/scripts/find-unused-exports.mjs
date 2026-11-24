#!/usr/bin/env node
/**
 * Lists (a) exported names with no non-test, non-barrel reference anywhere under areas.audit.unusedExports.roots,
 * and (b) orphan files nothing imports by relative path. The rules are the kit's (check/unused-exports.mjs); the
 * roots, entry files and ignored paths are settings.
 *
 * Usage (from the repository root):
 *   node .agents/skills/assess-feature-audit/scripts/find-unused-exports.mjs [pathPrefix] [--exclude=dir,dir]
 *
 * pathPrefix  only report exports/orphans under this prefix (default: everything)
 * --exclude   comma-separated roots treated as already dead — their files do
 *             not count as users of anything (transitive death)
 *
 * Heuristic, regex-based; confirm each hit before acting on it.
 */
import { loadWorkspaceSettings } from '@salientform/workspace-wayfinder/check/index.mjs';
import { printUnusedExports } from '@salientform/workspace-wayfinder/check/unused-exports.mjs';

printUnusedExports(await loadWorkspaceSettings(), process.argv.slice(2));
