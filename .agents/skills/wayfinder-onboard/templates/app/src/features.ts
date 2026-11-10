/**
 * The Features area, when the repository has routed UI and tests (onboarding §2). In its own module so the About
 * manifest can read it for counts without an import cycle (workspace.tsx imports the manifest). Add FEATURES_AREA to
 * workspace.tsx, router.tsx and the About manifest; register featureSources(), testInventory() and, with coverage,
 * featureCoverage() in vite.config.ts.
 */
import { createFeaturesArea } from '@nexstratus/workspace-wayfinder';
import sourceScan from 'virtual:workspace-feature-sources';
import testInventory from 'virtual:workspace-test-inventory';
import coverageReport from 'virtual:workspace-feature-coverage';
import settings from './workspace.config.mts';
import { AUDIT_AREA } from './audit';

export const FEATURES_AREA = createFeaturesArea({
  ...settings.areas.features,
  productRoutes: settings.productRoutes,
  sourceScan,
  testInventory,
  coverageReport,
  // A spec opens in Audit's full-document view, a roadmap id on its Roadmap row.
  documentLink: (path) => AUDIT_AREA.module.documentRoute(path),
  roadmapLink: (id) => AUDIT_AREA.module.implementation.roadmapAnchor(id),
});
