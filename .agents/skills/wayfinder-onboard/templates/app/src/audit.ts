/** The Audit area, in its own module so the Features area and the About manifest can read it without an import cycle. */
import { createAuditArea } from '@nexstratus/workspace-wayfinder';
import settings from './workspace.config.mts';

export const AUDIT_AREA = createAuditArea(settings.areas.audit);
