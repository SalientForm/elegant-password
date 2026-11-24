#!/usr/bin/env node
/**
 * Drift check for the feature catalogue (areas.features) and the product route mirror (productRoutes), both
 * named in the workspace config (found through the root package.json wayfinder.config). The rules are the kit's
 * (check/feature-catalogue.mjs).
 *
 * Fails when:
 *  - a feature file is malformed, or a route belongs to no feature or to two
 *  - a sources, tests or tests.include glob matches no file, or a platformDoc, spec or roadmap id does not resolve
 *  - a test belongs to no feature and is not infrastructure, or an @feature: tag names no feature
 *  - the mirror's routes or sidebar differ from the product's (the hooks file's productRoutes)
 *  - an API registry row lists a page whose feature does not claim the row's handler in its sources
 *  - areas.features.reviewedAt fails the date rule
 *
 * It prints the area's placeholders after its OK line: the whole area's, or its test listing's and coverage's. Placeholders never fail it; --strict fails on each.
 *
 * Usage (from the repository root): node .agents/skills/assess-features/scripts/check-feature-catalogue.mjs [--strict]
 */
import { runCheck } from '@salientform/workspace-wayfinder/check/run.mjs';

await runCheck('features');
