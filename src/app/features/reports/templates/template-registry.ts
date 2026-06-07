import { InterventionReportContext, ReportType, TemplateFn } from '../models/report.model';
import { interventionReceiptDefault } from './intervention-receipt.default';

type AnyTemplate = TemplateFn<InterventionReportContext>;

/** Default templates used by every tenant unless overridden below. */
const DEFAULT_TEMPLATES: Record<ReportType, AnyTemplate> = {
  'intervention-receipt': interventionReceiptDefault,
};

/**
 * Per-tenant template overrides. Empty today.
 * To add a tenant-specific template tomorrow:
 *   1. create e.g. intervention-receipt.tenantB.ts
 *   2. add one line: 'tenant-b': { 'intervention-receipt': interventionReceiptTenantB }
 * Feature code that calls the report does NOT change.
 */
const TENANT_TEMPLATES: Record<string, Partial<Record<ReportType, AnyTemplate>>> = {
  // 'arst-srb': { 'intervention-receipt': interventionReceiptArstSrb },
};

/** Returns the tenant-specific template if registered, otherwise the default. */
export function resolveTemplate(type: ReportType, tenantId: string | null): AnyTemplate {
  return TENANT_TEMPLATES[tenantId ?? '']?.[type] ?? DEFAULT_TEMPLATES[type];
}
