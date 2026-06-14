import { DeviceType } from '../../../shared/models/device.model';

export interface ServicerReportItem {
  /** Firestore document ID of the source intervention. */
  docId: string;
  /** Device serial number. */
  sn: string;
  /** Device type enum — used for filtering/grouping in the UI list.
   *  Intentionally excluded from ServicerReportPdfItem because the
   *  servicer summary PDF shows only translated intervention labels,
   *  not raw device types. */
  deviceType: DeviceType;
  /** Customer address (street + number). */
  address: string;
  /** Customer city. */
  city: string;
  /** Transloco i18n key for the intervention type label.
   *  Resolved at PDF-generation time via transloco.translate(key)
   *  to produce ServicerReportPdfItem.interventionTypeLabel. */
  interventionTypeLabelKey: string;
  /** Raw intervention type code from Firestore (e.g. 'repair', 'commissioning').
   *  Intentionally excluded from ServicerReportPdfItem — the PDF shows
   *  only the human-readable translated label, not the raw code. */
  interventionType: string;
  /** Comma-separated spare part names used during the intervention. Empty string if none. */
  spareParts: string;
  /** Pre-formatted date string (dd.mm.yyyy). */
  date: string;
  /** Epoch milliseconds — used for sorting by date. */
  dateTimestamp: number;
  /** Distance in km for this intervention (round-trip to customer). */
  distance: number;
  /** Raw warranty status from the intervention document
   *  ('in-warranty' | 'out-of-warranty' | '' when not set). */
  warrantyStatus: string;
  /** Whether the user has selected this item in the UI list (checkbox state). */
  selected: boolean;
}

/** Filter parameters for the servicer-report search. */
export interface ServicerReportFilter {
  /** Start of the date range (inclusive). The servicer-report service
   *  converts this JS Date to a Firestore-compatible query value. */
  dateFrom: Date;
  /** End of the date range (inclusive). The servicer-report service
   *  converts this JS Date to a Firestore-compatible query value. */
  dateTo: Date;
}
