/**
 * The Features area: generated from the config's settings, or the placeholder they hold (onboarding §2). In its own module so
 * the About manifest can read it for counts without an import cycle (workspace.tsx imports the manifest). The Vite
 * plugins featureSources(), testInventory() and featureCoverage() serve its three modules, empty for a placeholder.
 */
import { createFeaturesArea, type WorkspaceSettings } from '@salientform/workspace-wayfinder';
import sourceScan from 'virtual:workspace-feature-sources';
import testInventory from 'virtual:workspace-test-inventory';
import coverageReport from 'virtual:workspace-feature-coverage';
import settings from './workspace.config.mts';
import { AUDIT_AREA } from './audit';

export const FEATURES_AREA = createFeaturesArea({
  ...settings.areas.features,
  // Read through the settings type: the route mirror is set only once the area has one.
  productRoutes: (settings as WorkspaceSettings).productRoutes,
  sourceScan,
  testInventory,
  coverageReport,
  // A spec opens in Audit's full-document view, a roadmap id on its Roadmap row.
  documentLink: (path) => AUDIT_AREA.module.documentRoute(path),
  roadmapLink: (id) => AUDIT_AREA.module.implementation.roadmapAnchor(id),
});
