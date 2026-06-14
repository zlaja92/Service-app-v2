import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ServicerReportContext, ReportTranslate } from '../models/report.model';

/** Default A4 landscape template for the servicer monthly/period report. */
export function servicerReportDefault(
  ctx: ServicerReportContext,
  t: ReportTranslate,
): TDocumentDefinitions {
  const content: Content[] = [];

  // ── Title ──
  content.push({
    text: t('servicer_report_pdf_title'),
    bold: true,
    fontSize: 14,
    alignment: 'center',
    margin: [0, 0, 0, 10],
  });

  // ── Company (left, left-aligned) + period (right) ──
  const companyStack: Content[] = [];

  if (ctx.company.company?.trim()) {
    companyStack.push({
      text: `${t('servicer_report_pdf_company')}: ${ctx.company.company.trim()}`,
      bold: true,
      margin: [0, 0, 0, 2],
    });
  }

  const addressLine = [ctx.company.address, ctx.company.city]
    .filter((v) => v && v.trim())
    .join(', ');

  if (addressLine) {
    companyStack.push({ text: addressLine, margin: [0, 0, 0, 2] });
  }
  if (ctx.company.pib?.trim()) {
    companyStack.push({ text: `${t('report_tax_id')}: ${ctx.company.pib.trim()}`, margin: [0, 0, 0, 2] });
  }
  if (ctx.company.phone?.trim()) {
    companyStack.push({ text: `${t('report_phone_short')}: ${ctx.company.phone.trim()}`, margin: [0, 0, 0, 2] });
  }
  if (ctx.company.email?.trim()) {
    companyStack.push({ text: `${t('report_email_short')}: ${ctx.company.email.trim()}` });
  }

  // pdfMake needs at least one item in the stack.
  if (companyStack.length === 0) {
    companyStack.push({ text: '' });
  }

  content.push({
    columns: [
      { width: '*', stack: companyStack, alignment: 'left' },
      {
        width: 'auto',
        text: `${t('servicer_report_pdf_period')}: ${ctx.dateFrom} – ${ctx.dateTo}`,
        alignment: 'right',
      },
    ],
    margin: [0, 0, 0, 10],
  });

  // ── Interventions table ──
  content.push({
    table: {
      headerRows: 1,
      // Keep each row intact: never split a single row across two pages.
      dontBreakRows: true,
      widths: [62, '*', 100, 80, 58, 32, '*'],
      body: [
        [
          { text: t('servicer_report_pdf_col_date'), bold: true },
          { text: t('servicer_report_pdf_col_address'), bold: true },
          { text: t('servicer_report_pdf_col_sn'), bold: true },
          { text: t('servicer_report_pdf_col_type'), bold: true },
          { text: t('servicer_report_pdf_col_warranty'), bold: true },
          { text: t('servicer_report_pdf_col_distance'), bold: true, alignment: 'right' },
          { text: t('servicer_report_pdf_col_parts'), bold: true },
        ],
        ...ctx.items.map((item) => [
          { text: item.date || '' },
          { text: [item.address, item.city].filter((p) => !!p && p.trim()).join(', ') },
          { text: item.sn || '' },
          { text: item.interventionTypeLabel || '' },
          { text: item.warrantyLabel || '' },
          { text: item.distance != null ? String(item.distance) : '', alignment: 'right' as const },
          { text: item.spareParts || '' },
        ]),
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
