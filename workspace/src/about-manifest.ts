/**
 * The About manifest of Elegant Passwords: each area's registries and models, the workspace skills and the review date. Every
 * `file` and script path is a full string literal, and every ABOUT_SKILLS entry is written `{ name: '…', scripts: […] }`:
 * the About check reads both with a regex.
 */
import type { AboutManifest, AboutSkill } from '@salientform/workspace-wayfinder';
// The Audit area, from its own module (no import cycle), for each registry's live count and owning date.
import { AUDIT_AREA } from './audit';

const { ledger } = AUDIT_AREA.module;

/** Bumped only by the assess-workspace skill. */
export const ABOUT_REVIEWED_AT = '2026-11-10';

/** Workspace skills, ordered by the first area (header order) they maintain. */
export const ABOUT_SKILLS: AboutSkill[] = [
  { name: 'assess-audit', scripts: ['.agents/skills/assess-audit/scripts/check-audit-registries.mjs'] },
  { name: 'assess-workspace', scripts: ['.agents/skills/assess-workspace/scripts/check-about.mjs'] },
  { name: 'wayfinder-onboard', scripts: [] },
];

export const ABOUT_MANIFEST: AboutManifest = {
  reviewedAt: ABOUT_REVIEWED_AT,
  skills: ABOUT_SKILLS,
  areas: {
    readme: { registries: [], models: [] },
    audit: {
      registries: [
        { name: 'reviews', file: 'docs/reviews/index.md', source: 'markdown', holds: 'a review per markdown file; the index holds the date, the All markdowns sections and the Documentation list', owner: 'assess-audit', count: ledger.docReviews.length, date: { name: 'reviewedAt', value: ledger.reviewedAt } },
      ],
      models: [],
    },
    about: { registries: [], models: [] },
  },
};
