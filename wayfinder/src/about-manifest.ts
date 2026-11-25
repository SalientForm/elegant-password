/**
 * The About manifest of Elegant Passwords: each area's registries, the workspace skills and the review date. Built by
 * the assess-workspace skill from the workspace config and the installed skills (.agents/skills/assess-workspace/scripts/propose.mjs
 * --write), never edited by hand: the About check fails when it differs from a fresh build.
 */
import {
  listCollection,
  platformDocPaths,
  type AboutManifest,
  type AboutSkill,
} from '@salientform/workspace-wayfinder';
import settings from './workspace.config.mts';
// The areas the manifest reads for counts and dates, each from its own module (no import cycle: workspace.tsx imports
// the manifest).
import { AUDIT_AREA } from './audit';
import { FEATURES_AREA } from './features';

const { implementation, ledger, featureAudit } = AUDIT_AREA.module;
const FEATURES = FEATURES_AREA.module;

/** Set by the assess-workspace skill when the manifest changes. */
export const ABOUT_REVIEWED_AT = '2026-11-25';

/** Workspace skills, ordered by the first area (header order) they maintain. */
export const ABOUT_SKILLS: AboutSkill[] = [
  { name: 'assess-audit', scripts: ['.agents/skills/assess-audit/scripts/check-audit-registries.mjs', '.agents/skills/assess-audit/scripts/propose.mjs'] },
  { name: 'todo', scripts: [] },
  { name: 'assess-feature-audit', scripts: ['.agents/skills/assess-feature-audit/scripts/check-features-registry.mjs', '.agents/skills/assess-feature-audit/scripts/find-unused-exports.mjs', '.agents/skills/assess-feature-audit/scripts/propose.mjs'] },
  { name: 'assess-features', scripts: ['.agents/skills/assess-features/scripts/check-feature-catalogue.mjs', '.agents/skills/assess-features/scripts/propose.mjs'] },
  { name: 'assess-api', scripts: ['.agents/skills/assess-api/scripts/check-api-registry.mjs', '.agents/skills/assess-api/scripts/propose.mjs'] },
  { name: 'assess-platform-docs', scripts: ['.agents/skills/assess-platform-docs/scripts/check-platform-docs.mjs', '.agents/skills/assess-platform-docs/scripts/propose.mjs'] },
  { name: 'assess-workspace', scripts: ['.agents/skills/assess-workspace/scripts/check-about.mjs', '.agents/skills/assess-workspace/scripts/propose.mjs'] },
  { name: 'document-repo', scripts: ['.agents/skills/document-repo/scripts/check-documents.mjs', '.agents/skills/document-repo/scripts/list-skills.mjs'] },
  { name: 'wayfinder-onboard', scripts: ['.agents/skills/wayfinder-onboard/scripts/propose.mjs', '.agents/skills/wayfinder-onboard/scripts/walk-pages.mjs'] },
];

export const ABOUT_MANIFEST: AboutManifest = {
  reviewedAt: ABOUT_REVIEWED_AT,
  skills: ABOUT_SKILLS,
  areas: {
    readme: {
      registries: [
        { name: 'readmes', file: 'wayfinder/src/workspace.config.mts', source: 'config', holds: 'the content collection of READMEs the area renders (areas.readme.collection)', count: listCollection('readmes').length },
      ],
      models: [],
    },
    audit: {
      registries: [
        { name: 'ROADMAP.md', file: 'docs/ROADMAP.md', source: 'markdown', holds: 'milestones, phases and their sequence', owner: 'assess-audit', count: implementation.openPhases.length, date: { name: 'Reviewed:', value: implementation.roadmap.reviewedAt } },
        { name: 'TODO.md', file: 'docs/TODO.md', source: 'markdown', holds: 'small unplanned items', owner: 'todo', count: implementation.todos.todos.length, date: { name: 'Reviewed:', value: implementation.todos.reviewedAt } },
        { name: 'ARCHITECTURE.md', file: 'docs/ARCHITECTURE.md', source: 'markdown', holds: 'the stack summary and the planned migrations', owner: 'assess-audit', count: implementation.stack.items.length, date: { name: 'Reviewed:', value: implementation.stack.reviewedAt } },
        { name: 'reviews', file: 'docs/reviews/index.md', source: 'markdown', holds: 'a review per markdown file; the index holds the date, the All markdowns sections and the Documentation list', owner: 'assess-audit', count: ledger.docReviews.length, date: { name: 'reviewedAt', value: ledger.reviewedAt } },
        { name: 'feature-audit.json', file: 'wayfinder/src/feature-audit.json', source: 'json', holds: 'the feature audit: dead code, unreachable pages, stale TODOs and recommendations, by group', owner: 'assess-feature-audit', count: featureAudit?.findings.length ?? 0, date: { name: 'reviewedAt', value: featureAudit?.reviewedAt ?? '' } },
      ],
      models: [],
    },
    features: {
      registries: [
        { name: 'docs/features', file: 'wayfinder/src/workspace.config.mts', source: 'markdown', holds: 'the feature catalogue (areas.features.directory): one markdown file per feature, the routes it owns, the sources it claims and any extra test globs', owner: 'assess-features', count: FEATURES.features.length, date: { name: 'areas.features.reviewedAt', value: FEATURES.reviewedAt } },
        { name: 'product-routes.json routes', file: 'wayfinder/src/product-routes.json', source: 'json', holds: "a mirror of the product's routes (productRoutes), equal to its router; each belongs to one feature", owner: 'assess-features', count: FEATURES.productRoutes.routes.length, date: { name: 'areas.features.reviewedAt', value: FEATURES.reviewedAt } },
        { name: 'product-routes.json sidebar', file: 'wayfinder/src/product-routes.json', source: 'json', holds: "a mirror of the product's sidebar paths", owner: 'assess-features', count: FEATURES.productRoutes.sidebar?.length ?? 0, date: { name: 'areas.features.reviewedAt', value: FEATURES.reviewedAt } },
        { name: 'virtual:workspace-feature-sources', file: 'wayfinder/vite.config.ts', source: 'generated', holds: "the files the catalogue's globs can match, walked at build time from areas.features.sourceRoots and each feature's sources", count: FEATURES.sourceScan.files.length },
      ],
      models: [],
    },
    api: { registries: [], models: [] }, // A placeholder: no registry until it is filled.
    'platform-docs': {
      registries: [
        { name: 'docs/platform', file: 'wayfinder/src/workspace.config.mts', source: 'markdown', holds: "the Platform Docs pages (areas['platform-docs'].directory): one per markdown file, built from its front matter", owner: 'assess-platform-docs', count: platformDocPaths('docs/platform').length, date: { name: "areas['platform-docs'].reviewedAt", value: settings.areas['platform-docs'].reviewedAt } },
      ],
      models: [],
    },
    about: { registries: [], models: [] },
  },
};
