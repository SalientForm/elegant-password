/**
 * The Engineering Workspace of Elegant Passwords: the browser half of its Workspace Wayfinder config. One area definition per
 * entry in workspace.config.mts `areas`, in the same order. The same lines serve an area and its placeholder: filling an
 * area changes the config and the About manifest, never this file.
 */
import {
  createAboutArea,
  createApiArea,
  createPlatformDocsArea,
  createReadmeArea,
  createWorkspace,
} from '@salientform/workspace-wayfinder';
import { ThemeToggle } from '@salientform/workspace-wayfinder/theme';
import settings from './workspace.config.mts';
import { ABOUT_MANIFEST } from './about-manifest';
import { AUDIT_AREA } from './audit';
import { FEATURES_AREA } from './features';

export { AUDIT_AREA, FEATURES_AREA };
export const README_AREA = createReadmeArea(settings.areas.readme);
export const API_AREA = createApiArea(settings.areas.api);
export const PLATFORM_DOCS_AREA = createPlatformDocsArea({ ...settings.areas['platform-docs'], product: settings.product });

/** The areas About documents, in header order. */
const DOCUMENTED = [README_AREA, AUDIT_AREA, FEATURES_AREA, API_AREA, PLATFORM_DOCS_AREA];
export const ABOUT_AREA = createAboutArea({ ...settings.areas.about, manifest: ABOUT_MANIFEST, documented: DOCUMENTED });

export const workspace = createWorkspace(settings, {
  areas: {
    readme: README_AREA,
    audit: AUDIT_AREA,
    features: FEATURES_AREA,
    api: API_AREA,
    'platform-docs': PLATFORM_DOCS_AREA,
    about: ABOUT_AREA,
  },
  // The kit's light and dark control, at the right of the header (main.tsx starts the theme it changes). A repository
  // with a theme system of its own passes its own control here instead.
  headerActions: <ThemeToggle />,
});
