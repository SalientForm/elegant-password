#!/usr/bin/env node
/**
 * Drift check for the API area (areas.api of the workspace config, found through the root package.json
 * wayfinder.config). The rules are the kit's (check/api.mjs).
 *
 * Fails when:
 *  - the OpenAPI document does not exist, is not JSON or has no paths
 *  - a file in areas.api.generated differs from a fresh run of its command (an emitted document, generated wire types)
 *  - an operation is in the document but not in the registry, or a row is not in the document and not marked
 *    outsideDocument (or is marked and is in it)
 *  - the registry has a bad row or group, or a handler that does not exist
 *  - a path the product fetches (the hooks file's fetchSites, else a scan of areas.api.callers.roots) is not in the
 *    registry, or its row is not `used`
 *  - a `used` GET under areas.api.basePath is fetched nowhere
 *  - areas.api.reviewedAt fails the date rule
 *
 * While areas.api is a placeholder, the check passes and prints it after its OK line. Placeholders never fail it; --strict fails on each.
 *
 * Usage (from the repository root): node .agents/skills/assess-api/scripts/check-api-registry.mjs [--strict]
 */
import { runCheck } from '@salientform/workspace-wayfinder/check/run.mjs';

await runCheck('api');
