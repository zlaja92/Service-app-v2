import {
  InterventionReportContext,
  ReportType,
  ServicerReportContext,
  TemplateFn,
} from '../models/report.model';
import { interventionReceiptDefault } from './intervention-receipt.default';
import { servicerReportDefault } from './servicer-report.default';

// ── Per-type template maps ──────────────────────────────────────────────────
// Each report type has its own strongly-typed default + tenant-override maps.
// This avoids a single AnyTemplate union and keeps every call-site type-safe.

type InterventionTemplate = TemplateFn<InterventionReportContext>;
type ServicerReportTemplate = TemplateFn<ServicerReportContext>;

/** Default templates — one per report type. */
const DEFAULT_INTERVENTION: InterventionTemplate = interventionReceiptDefault;
const DEFAULT_SERVICER_REPORT: ServicerReportTemplate = servicerReportDefault;

/**
 * Per-tenant overrides for intervention-receipt.
 * To add a tenant-specific template:
 *   1. create e.g. intervention-receipt.tenantB.ts
 *   2. add one line: 'tenant-b': interventionReceiptTenantB
 */
const TENANT_INTERVENTION: Record<string, InterventionTemplate> = {
  // 'arst-srb': interventionReceiptArstSrb,
};

/**
 * Per-tenant overrides for servicer-report.
 * Same pattern as TENANT_INTERVENTION.
 */
const TENANT_SERVICER_REPORT: Record<string, ServicerReportTemplate> = {
  // 'arst-srb': servicerReportArstSrb,
};

// ── Typed resolve functions ─────────────────────────────────────────────────

/** Returns the tenant-specific intervention-receipt template, or the default. */
export function resolveInterventionTemplate(tenantId: string | null): InterventionTemplate {
  return TENANT_INTERVENTION[tenantId ?? ''] ?? DEFAULT_INTERVENTION;
}

/** Returns the tenant-specific servicer-report template, or the default. */
export function resolveServicerReportTemplate(tenantId: string | null): ServicerReportTemplate {
  return TENANT_SERVICER_REPORT[tenantId ?? ''] ?? DEFAULT_SERVICER_REPORT;
}

// ── Backward-compatible generic resolve ─────────────────────────────────────
// Kept so that existing callers (report.service.ts generate(), tests) compile
// without changes. New code should use the typed variants above.

type AnyTemplate = TemplateFn<InterventionReportContext>;

/** @deprecated Prefer resolveInterventionTemplate / resolveServicerReportTemplate for type safety. */
export function resolveTemplate(type: ReportType, tenantId: string | null): AnyTemplate {
  switch (type) {
    case 'intervention-receipt':
      return resolveInterventionTemplate(tenantId);
    case 'servicer-report':
      // Safe cast: this branch is only reached when the caller already holds a
      // ServicerReportContext, so the template will receive the correct type.
      return resolveServicerReportTemplate(tenantId) as unknown as AnyTemplate;
    default:
      // Unreachable for valid ReportType values. Returns undefined at runtime
      // for invalid casts (e.g. an unknown string as ReportType), preserving
      // the pre-existing behaviour relied upon by template-registry.spec.ts.
      return undefined as unknown as AnyTemplate;
  }
}
