import { createWorkspaceRouter, createWorkspaceRoutes } from '@nexstratus/workspace-wayfinder';
import type { QueryClient } from '@tanstack/react-query';
import { queryClient } from './query-client';
import { ABOUT_AREA, AUDIT_AREA, README_AREA, workspace } from './workspace';

export interface RouterContext {
  queryClient: QueryClient;
}

const { rootRoute, areaRoute } = createWorkspaceRoutes<RouterContext>(workspace);

// One line per area, in header order: mapping over workspace.areas would erase the route types.
const readmeRoute = areaRoute(README_AREA);
const auditRoute = areaRoute(AUDIT_AREA);
const aboutRoute = areaRoute(ABOUT_AREA);

export const routeTree = rootRoute.addChildren([
  readmeRoute.addChildren(README_AREA.routes(readmeRoute)),
  auditRoute.addChildren(AUDIT_AREA.routes(auditRoute)),
  aboutRoute.addChildren(ABOUT_AREA.routes(aboutRoute)),
]);

/** The kit's router over this tree: base path, hash and scroll handling, the header-order check. */
export const router = createWorkspaceRouter(workspace, routeTree, { context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
