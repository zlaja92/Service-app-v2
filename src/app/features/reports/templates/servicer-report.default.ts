import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ServicerReportContext, ReportTranslate } from '../models/report.model';

/** Default A4 landscape template for the servicer monthly/period report. */
export function servicerReportDefault(
  ctx: ServicerReportContext,
  t: ReportTranslate,
): TDocumentDefinitions {
  const content: Content[] = [];

  // ── Header (company) ──
  if (ctx.company.company?.trim()) {
    content.push({
      text: ctx.company.company,
      bold: true,
      fontSize: 14,
      alignment: 'center',
      margin: [0, 0, 0, 2],
    });
  }

  const addressLine = [ctx.company.address, ctx.company.city]
    .filter((v) => v && v.trim())
    .join(', ');

  if (addressLine) {
    content.push({
      text: addressLine,
      alignment: 'center',
      margin: [0, 0, 0, 2],
    });
  }

  const contactParts: string[] = [];
  if (ctx.company.pib?.trim()) {
    contactParts.push(`${t('report_tax_id')}: ${ctx.company.pib.trim()}`);
  }
  if (ctx.company.phone?.trim()) {
    contactParts.push(`${t('report_phone_short')}: ${ctx.company.phone.trim()}`);
  }
  if (ctx.company.email?.trim()) {
    contactParts.push(`${t('report_email_short')}: ${ctx.company.email.trim()}`);
  }

  if (contactParts.length > 0) {
    content.push({
      text: contactParts.join(' | '),
      alignment: 'center',
      margin: [0, 0, 0, 10],
    });
  }

  // ── Title + period ──
  content.push({
    text: t('servicer_report_pdf_title'),
    bold: true,
    fontSize: 12,
    alignment: 'center',
    margin: [0, 0, 0, 4],
  });

  content.push({
    text: `${t('servicer_report_pdf_period')}: ${ctx.dateFrom} – ${ctx.dateTo}`,
    alignment: 'center',
    margin: [0, 0, 0, 10],
  });

  // ── Interventions table ──
  content.push({
    table: {
      headerRows: 1,
      widths: [20, 105, 55, '*', 60, 80, '*', 30],
      body: [
        [
          { text: '#', bold: true, alignment: 'center' },
          { text: t('servicer_report_pdf_col_sn'), bold: true },
          { text: t('servicer_report_pdf_col_date'), bold: true },
          { text: t('servicer_report_pdf_col_address'), bold: true },
          { text: t('servicer_report_pdf_col_city'), bold: true },
          { text: t('servicer_report_pdf_col_type'), bold: true },
          { text: t('servicer_report_pdf_col_parts'), bold: true },
          { text: t('servicer_report_pdf_col_distance'), bold: true, alignment: 'right' },
        ],
        ...ctx.items.map((item, index) => [
          { text: String(index + 1), alignment: 'center' as const },
          { text: item.sn || '' },
          { text: item.date || '' },
          { text: item.address || '' },
          { text: item.city || '' },
          { text: item.interventionTypeLabel || '' },
          { text: item.spareParts || '' },
          { text: item.distance != null ? String(item.distance) : '', alignment: 'right' as const },
        ]),
        [
          { text: t('servicer_report_pdf_total'), bold: true, colSpan: 6, alignment: 'right' as const },
          { text: '' },
          { text: '' },
          { text: '' },
          { text: '' },
          { text: '' },
          { text: String(ctx.totalInterventions), bold: true, alignment: 'center' as const },
          { text: String(ctx.totalDistance), bold: true, alignment: 'right' as const },
        ],
      ],
    },
    layout: {
      fillColor: (rowIndex: number): string | null => (rowIndex === 0 ? '#eeeeee' : null),
      hLineWidth: (): number => 0.5,
      vLineWidth: (): number => 0.5,
    },
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      fontSize: 8,
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      text: `${t('servicer_report_pdf_page')} ${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      margin: [0, 10, 0, 0],
    }),
    content,
  };
}
