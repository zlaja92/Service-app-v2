import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { InterventionReportContext, ReportTranslate } from '../models/report.model';

const MM_TO_PT = 2.834645669;
const DEFAULT_WIDTH_MM = 80;

/** Default thermal-receipt template for an intervention report (configurable width). */
export function interventionReceiptDefault(
  ctx: InterventionReportContext,
  t: ReportTranslate,
): TDocumentDefinitions {
  const widthMm = ctx.company.paperWidthMm && ctx.company.paperWidthMm > 0
    ? ctx.company.paperWidthMm
    : DEFAULT_WIDTH_MM;
  const widthPt = Math.round(widthMm * MM_TO_PT);
  // Number of '=' for the separator / signature line, sized to the content width.
  const eqCount = Math.max(12, Math.floor((widthPt - 20) / 7));

  const content: Content[] = [];

  // Thermal-style separator: spaced '=' justified edge-to-edge (left margin to
  // right margin). Justify stretches the gaps so it always spans the full width,
  // regardless of the proportional font's glyph widths.
  const divider = (): Content => ({
    text: Array(eqCount).fill('=').join(' '),
    alignment: 'justify',
    margin: [0, 3, 0, 3],
  });

  // Thin full-width rule, drawn under each parameter sub-heading.
  const thinLine = (): Content => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: widthPt - 20, y2: 0, lineWidth: 0.5, lineColor: '#666666' }],
    margin: [0, 0, 0, 3],
  });

  const row = (label: string, value?: string): Content => ({
    columns: [
      { text: label, bold: true, width: '*' },
      { text: value && value.trim() ? value : '', width: 'auto', alignment: 'right' },
    ],
    margin: [0, 0, 0, 2],
  });

  // Parameter rows cap the label width slightly so a long field name doesn't
  // push the value onto a second line; the value gets the remaining space.
  const paramLabelWidth = Math.round((widthPt - 20) * 0.70);
  const paramRow = (label: string, value?: string): Content => ({
    columns: [
      { text: label, bold: true, width: paramLabelWidth },
      { text: value && value.trim() ? value : '', width: '*', alignment: 'right' },
    ],
    margin: [0, 0, 0, 3],
  });

  // ── Header (company) ──
  if (ctx.logoDataUrl) {
    content.push({ image: ctx.logoDataUrl, width: widthPt - 40, alignment: 'center', margin: [0, 0, 0, 4] });
  }
  content.push({ text: t('report_service_center'), bold: true, alignment: 'center', fontSize: 8 });
  if (ctx.company.companyName) {
    content.push({ text: ctx.company.companyName, bold: true, alignment: 'center', fontSize: 13 });
  }
  if (ctx.company.address) content.push({ text: ctx.company.address, alignment: 'center', fontSize: 8 });
  if (ctx.company.phone) content.push({ text: `${t('report_phone')}: ${ctx.company.phone}`, alignment: 'center', fontSize: 8 });
  if (ctx.company.taxId) content.push({ text: `${t('report_tax_id')}: ${ctx.company.taxId}`, alignment: 'center', fontSize: 8 });
  content.push(divider());

  // ── Customer ──
  content.push(row(t('report_customer_name'), ctx.user.fullName));
  content.push(row(t('report_address'), ctx.user.address));
  content.push(row(t('report_phone'), ctx.user.phone));
  content.push(row(t('report_city'), ctx.user.city));
  content.push(divider());

  // ── Device / intervention ──
  content.push(row(t('report_model'), ctx.device.name));
  content.push(row(t('report_intervention_type'), ctx.intervention.typeLabel));
  content.push(row(t('report_date'), ctx.intervention.date));
  content.push(row(t('report_serial'), ctx.device.sn));
  if (ctx.device.connectedSn) content.push(row(t('report_serial2'), ctx.device.connectedSn));
  content.push(row(t('report_fault'), ctx.intervention.faultDescription));
  content.push(row(t('report_purchase_date'), ctx.intervention.purchaseDate));
  (ctx.intervention.parts ?? []).forEach((part, i) => {
    if (part && part.trim()) content.push(row(`${t('report_spare_part')} ${i + 1}`, part));
  });
  content.push(row(t('report_note'), ctx.intervention.note));

  // ── Device parameters (env-info) — only when present ──
  const sections = ctx.parameterSections ?? [];
  if (sections.length > 0) {
    content.push(divider());
    content.push({ text: t('report_parameters').toUpperCase(), bold: true, italics: true, alignment: 'center', margin: [0, 0, 0, 2] });
    // Show per-section sub-titles only when there is more than one section
    // (a single-section device like a gas boiler doesn't need a sub-header).
    const showSectionTitles = sections.length > 1;
    sections.forEach(section => {
      if (showSectionTitles) {
        content.push({ text: section.title, italics: true, fontSize: 9, margin: [0, 8, 0, 2] });
        content.push(thinLine());
      }
      section.rows.forEach(r => content.push(paramRow(r.label, r.value)));
    });
  }

  // ── Consent / disclaimer ──
  if (ctx.consent) {
    content.push(divider());
    if (ctx.consent.type === 'boiler-disclaimer') {
      content.push({ text: t('report_boiler_disclaimer'), fontSize: 7, alignment: 'justify' });
    } else {
      content.push({ text: t('report_service_consent'), fontSize: 9, margin: [0, 0, 0, 3] });
      const yes = ctx.consent.accepted === true;
      const no = ctx.consent.accepted === false;
      // The customer's answer (DA/NE) is boxed depending on callAccepted.
      const choice = (label: string, selected: boolean): Content => ({
        width: 'auto',
        table: { body: [[{ text: label, bold: selected, fontSize: 9, margin: [6, 2, 6, 2] }]] },
        layout: {
          hLineWidth: () => (selected ? 1 : 0),
          vLineWidth: () => (selected ? 1 : 0),
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
        },
      } as Content);
      content.push({
        columns: [
          { text: '', width: '*' },
          choice(t('report_consent_yes'), yes),
          choice(t('report_consent_no'), no),
          { text: '', width: '*' },
        ],
        columnGap: 12,
      });
    }
  }

  // ── Signatures (no separator before them): line first, label below, spaced ──
  const signLine = '_'.repeat(eqCount);
  if (ctx.signatureDataUrl) {
    content.push({ image: ctx.signatureDataUrl, width: widthPt - 60, alignment: 'center', margin: [0, 16, 0, 0] });
  } else {
    content.push({ text: signLine, alignment: 'center', margin: [0, 32, 0, 0] });
  }
  content.push({ text: t('report_sign_customer'), alignment: 'center', margin: [0, 1, 0, 0] });
  content.push({ text: signLine, alignment: 'center', margin: [0, 32, 0, 0] });
  content.push({ text: t('report_sign_servicer'), alignment: 'center', margin: [0, 1, 0, 0] });

  return {
    pageSize: { width: widthPt, height: 'auto' },
    pageMargins: [10, 10, 10, 10],
    defaultStyle: { fontSize: 9 },
    content,
  };
}
