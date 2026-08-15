import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Servicer } from '../../../core/servicer/servicer.model';

/** Report kinds. Add new ones here (e.g. 'servicer-stats' for feature 2). */
export type ReportType = 'intervention-receipt' | 'servicer-report';

/** Translates an i18n key in the currently active language. */
export type ReportTranslate = (key: string, params?: Record<string, unknown>) => string;

export interface ReportUser {
  fullName?: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface ReportDevice {
  name?: string;
  type?: string;
  subType?: string;
  sn?: string;
  /** Connected device serial (heat pumps). */
  connectedSn?: string;
}

export interface ReportIntervention {
  /** When true, the receipt renders the mode2 fields (fault, location, visits,
   *  faultDescription, workDescription) and hides typeLabel + note. */
  isMode2?: boolean;
  typeLabel?: string;
  /** Pre-formatted intervention date (dd.mm.yyyy). */
  date?: string;
  faultDescription?: string;
  /** Pre-formatted commissioning/purchase date (dd.mm.yyyy). */
  purchaseDate?: string;
  servicer?: string;
  note?: string;
  parts?: string[];
  // ── mode2-only fields ──
  /** Translated fault (from interventionFault). */
  fault?: string;
  /** Translated fault location (from interventionLocation). */
  interventionLocation?: string;
  /** Number of field visits. */
  visits?: string;
  /** Technician work description (free text). */
  workDescription?: string;
}

/** A pre-resolved, translated group of label/value rows (e.g. an env-info section). */
export interface ReportSection {
  title: string;
  rows: { label: string; value: string }[];
}

/** Device-type-specific footer: a disclaimer or a service-contact consent. */
export interface ReportConsent {
  type: 'boiler-disclaimer' | 'service-consent';
  /** For service-consent: customer's answer; null = not applicable. */
  accepted: boolean | null;
}

export interface InterventionReportContext {
  /** Servicer/company header (from core ServicerService). */
  company: Servicer;
  user: ReportUser;
  device: ReportDevice;
  intervention: ReportIntervention;
  /** Pre-resolved, translated device-parameter sections (env-info). */
  parameterSections?: ReportSection[];
  consent?: ReportConsent;
  /** Storage URL of the customer signature (added later). */
  signatureUrl?: string;
  /** base64 data URL of the signature, resolved by ReportService. */
  signatureDataUrl?: string;
}

/** A report template: from a typed context + a translate fn to a pdfMake document. */
export type TemplateFn<C> = (ctx: C, t: ReportTranslate) => TDocumentDefinitions;

/** A single row in the servicer-report PDF table.
 *  Intentionally omits deviceType and raw interventionType — the servicer
 *  summary PDF shows only human-readable, translated data. */
export interface ServicerReportPdfItem {
  /** Device serial number. */
  sn: string;
  /** Customer address (street + number). */
  address: string;
  /** Customer city. */
  city: string;
  /** Translated intervention type label — produced by passing
   *  ServicerReportItem.interventionTypeLabelKey through
   *  Transloco (transloco.translate(key)) at PDF-generation time. */
  interventionTypeLabel: string;
  /** Comma-separated spare part names. Empty string if none. */
  spareParts: string;
  /** Pre-formatted date string (dd.mm.yyyy). */
  date: string;
  /** Distance in km for this intervention. */
  distance: number;
  /** Translated warranty-status label (e.g. "U garanciji" / "Van garancije").
   *  Empty string when the source intervention has no warranty status. */
  warrantyLabel: string;
}

/** Context passed to the servicer-report PDF template. */
export interface ServicerReportContext {
  /** Servicer/company header data (from core ServicerService). */
  company: Servicer;
  /** Selected items to include in the report. */
  items: ServicerReportPdfItem[];
  /** Start of the date range, pre-formatted (dd.mm.yyyy). */
  dateFrom: string;
  /** End of the date range, pre-formatted (dd.mm.yyyy). */
  dateTo: string;
  /** Total number of interventions in the report. */
  totalInterventions: number;
  /** Sum of all distances (km) across included items. */
  totalDistance: number;
}
