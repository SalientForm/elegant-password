import { createWorkspaceRouter, createWorkspaceRoutes } from '@salientform/workspace-wayfinder';
import { ABOUT_AREA, API_AREA, AUDIT_AREA, FEATURES_AREA, PLATFORM_DOCS_AREA, README_AREA, workspace } from './workspace';

const { rootRoute, areaRoute } = createWorkspaceRoutes<object>(workspace);

// One line per area, in header order: mapping over workspace.areas would erase the route types.
const readmeRoute = areaRoute(README_AREA);
const auditRoute = areaRoute(AUDIT_AREA);
const featuresRoute = areaRoute(FEATURES_AREA);
const apiRoute = areaRoute(API_AREA);
const platformDocsRoute = areaRoute(PLATFORM_DOCS_AREA);
const aboutRoute = areaRoute(ABOUT_AREA);

export const routeTree = rootRoute.addChildren([
  readmeRoute.addChildren(README_AREA.routes(readmeRoute)),
  auditRoute.addChildren(AUDIT_AREA.routes(auditRoute)),
  featuresRoute.addChildren(FEATURES_AREA.routes(featuresRoute)),
  apiRoute.addChildren(API_AREA.routes(apiRoute)),
  platformDocsRoute.addChildren(PLATFORM_DOCS_AREA.routes(platformDocsRoute)),
  aboutRoute.addChildren(ABOUT_AREA.routes(aboutRoute)),
]);

/** The kit's router over this tree: base path, hash and scroll handling, the header-order check. */
export const router = createWorkspaceRouter(workspace, routeTree, { context: {} });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
