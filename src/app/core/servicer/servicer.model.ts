/**
 * A servicer (service company) account.
 * Stored at tenants/{tenantId}/servicers/{email}, docId = account email.
 * Holds the company identity used as the header on printed reports.
 */
export interface Servicer {
  company?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  pib?: string;
  /** Thermal paper width in mm for printed reports. Defaults to 80 when absent. */
  paperWidthMm?: number;
  [key: string]: unknown;
}
