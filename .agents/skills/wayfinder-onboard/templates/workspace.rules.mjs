/**
 * The rules __PRODUCT__ adds to the Workspace Wayfinder checks, named by the root package.json `wayfinder.rules`. Every
 * export is optional; each hook receives { settings, repoRoot, readRepo, exists }. Delete the hooks you do not need.
 */

/**
 * The product's routes (absolute paths, `:param` for parameters) and its navigation's paths, read from its router,
 * which the route mirror (settings.productRoutes) must equal. `source` and `sidebarSource` name where they were read.
 */
// export function productRoutes({ readRepo }) {
//   return { routes: [], sidebar: [], source: 'src/router.tsx', sidebarSource: 'src/nav.tsx' };
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
