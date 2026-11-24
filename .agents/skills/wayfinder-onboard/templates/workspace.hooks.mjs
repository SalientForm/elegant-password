/**
 * The hooks of __PRODUCT__ for the Workspace Wayfinder checks, named by the root package.json `wayfinder.hooks`: what the
 * checks cannot read for themselves from the product's code, and any checks of its own. Every export is optional; each
 * hook receives { settings, repoRoot, readRepo, exists }. Delete the hooks you do not need.
 */

/**
 * The product's routes (absolute paths, `:param` for parameters) and its navigation's paths, read from its router: the
 * assess-features skill builds the route mirror (settings.productRoutes) from them, and the check keeps the two equal.
 * `source` and `sidebarSource` name where they were read. A TanStack Router `createRoute` tree reads with the kit's
 * reader; another router needs a reader of the repository's own.
 */
// import { tanstackRoutes } from '@salientform/workspace-wayfinder/check/route-readers.mjs';
// export function productRoutes({ readRepo }) {
//   return { routes: tanstackRoutes(readRepo('src/router.tsx')), sidebar: [], source: 'src/router.tsx', sidebarSource: 'src/nav.tsx' };
// }

/** The product's navigation labels, which some Platform Docs page should mention. */
// export function navLabels({ readRepo }) {
//   return [];
// }

/** Every API path the product calls, when the default scan of areas.api.callers.roots does not find them. */
// export function fetchSites({ readRepo }) {
//   return [];
// }

/** More problems for a check, keyed by its name (about, audit, feature-audit, features, api, platform-docs). */
// export function extraChecks(ctx) {
//   return {};
// }
