/**
 * The Engineering Workspace of __PRODUCT__: the browser half of its Workspace Wayfinder config. One area definition per
 * entry in workspace.config.mts `areas`, in the same order.
 */
import { createAboutArea, createReadmeArea, createWorkspace } from '@nexstratus/workspace-wayfinder';
import settings from './workspace.config.mts';
import { ABOUT_MANIFEST } from './about-manifest';
import { AUDIT_AREA } from './audit';

export { AUDIT_AREA };
export const README_AREA = createReadmeArea(settings.areas.readme);

/** The areas About documents, in header order. */
const DOCUMENTED = [README_AREA, AUDIT_AREA];
export const ABOUT_AREA = createAboutArea({ ...settings.areas.about, manifest: ABOUT_MANIFEST, documented: DOCUMENTED });

export const workspace = createWorkspace(settings, {
  areas: { readme: README_AREA, audit: AUDIT_AREA, about: ABOUT_AREA },
});
