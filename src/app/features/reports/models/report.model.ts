import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Servicer } from '../../../core/servicer/servicer.model';

/** Report kinds. Add new ones here (e.g. 'servicer-stats' for feature 2). */
export type ReportType = 'intervention-receipt';

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
  typeLabel?: string;
  /** Pre-formatted intervention date (dd.mm.yyyy). */
  date?: string;
  faultDescription?: string;
  /** Pre-formatted commissioning/purchase date (dd.mm.yyyy). */
  purchaseDate?: string;
  servicer?: string;
  note?: string;
  parts?: string[];
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
