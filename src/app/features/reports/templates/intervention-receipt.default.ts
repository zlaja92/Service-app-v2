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

  // Usable text width (page width minus the 10pt left/right page margins).
  const contentWidthPt = widthPt - 20;
  // pdfMake has no auto-shrink-to-fit, so approximate a font size that keeps
  // `text` on a single line within contentWidthPt. charWidthFactor is the average
  // glyph advance as a fraction of the font size (~0.62 for bold uppercase, ~0.5
  // for normal text). Clamped to [minFont, maxFont].
  const fitFontSize = (text: string, maxFont: number, minFont: number, charWidthFactor: number): number => {
    const len = text.length || 1;
    const fit = Math.floor(contentWidthPt / (len * charWidthFactor));
    return Math.max(minFont, Math.min(maxFont, fit));
  };

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

  // Label on its own line with the value stacked beneath it (full width), for
  // long free-text fields like the servicer note that don't fit beside the label.
  const stacked = (label: string, value?: string): Content[] => {
    const out: Content[] = [{ text: label, bold: true, margin: [0, 0, 0, 0] }];
    if (value && value.trim()) out.push({ text: value, margin: [0, 0, 0, 2] });
    return out;
  };

  // ── Header (company) ──
  // Small uppercase "service center" heading above the company name — smaller
  // than the name, but a touch larger than the address/contact lines (8pt).
  const serviceCenter = t('report_service_center').toUpperCase();
  content.push({ text: serviceCenter, alignment: 'center', noWrap: true, fontSize: fitFontSize(serviceCenter, 10, 6, 0.55), margin: [0, 0, 0, 1] });
  // Company name: uppercase, italic + bold, larger — but always on ONE line:
  // the font shrinks (down to 7pt) when the name is too long to fit the width.
  if (ctx.company.company) {
    const name = ctx.company.company.toUpperCase();
    content.push({ text: name, bold: true, italics: true, alignment: 'center', noWrap: true, fontSize: fitFontSize(name, 16, 7, 0.62), margin: [0, 0, 0, 2] });
  }
  // Address + city on one line: "address, city" — also kept to a single line.
  const addressLine = [ctx.company.address, ctx.company.city].filter(v => v && v.trim()).join(', ');
  if (addressLine) content.push({ text: addressLine, alignment: 'center', noWrap: true, fontSize: fitFontSize(addressLine, 8, 6, 0.5) });
  // Contact on one line: "tel: phone, email: mail" — also kept to a single line.
  const contactLine = [
    ctx.company.phone ? `${t('report_phone_short')}: ${ctx.company.phone}` : '',
    ctx.company.email ? `${t('report_email_short')}: ${ctx.company.email}` : '',
  ].filter(v => v).join(', ');
  if (contactLine) content.push({ text: contactLine, alignment: 'center', noWrap: true, fontSize: fitFontSize(contactLine, 8, 5, 0.5) });
  content.push(divider());

  // ── Customer ──
  content.push(row(t('report_customer_name'), ctx.user.fullName));
  content.push(row(t('report_address'), ctx.user.address));
  content.push(row(t('report_phone'), ctx.user.phone));
  content.push(row(t('report_city'), ctx.user.city));
  content.push(divider());

  // ── Device / intervention ──
  const iv = ctx.intervention;
  content.push(row(t('report_model'), ctx.device.name));
  // Non-mode2: intervention type. mode2 hides it (replaced by the fault row below).
  if (!iv.isMode2) content.push(row(t('report_intervention_type'), iv.typeLabel));
  content.push(row(t('report_date'), iv.date));
  content.push(row(t('report_serial'), ctx.device.sn));
  if (ctx.device.connectedSn) content.push(row(t('report_serial2'), ctx.device.connectedSn));

  if (iv.isMode2) {
    // mode2 rows: fault, fault location, field visits.
    content.push(row(t('report_fault_mode2'), iv.fault));
    content.push(row(t('report_location'), iv.interventionLocation));
    content.push(row(t('report_visits'), iv.visits));
  } else {
    content.push(row(t('report_fault'), iv.faultDescription));
  }

  content.push(row(t('report_purchase_date'), iv.purchaseDate));
  (iv.parts ?? []).forEach((part, i) => {
    if (part && part.trim()) content.push(row(`${t('report_spare_part')} ${i + 1}`, part));
  });

  if (iv.isMode2) {
    // mode2: fault description + technician work description (both free text).
    content.push(...stacked(t('report_fault_description'), iv.faultDescription));
    content.push(...stacked(t('report_work_description'), iv.workDescription));
  } else {
    content.push(...stacked(t('report_note'), iv.note));
  }

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
  // Image fitted to ~80% of the underscore-line width (20% smaller than before).
  const signWidth = Math.round(eqCount * 4.5 * 0.8);

  // Customer: the signature image (fitted to the line width) sits above the line.
  if (ctx.signatureDataUrl) {
    content.push({ image: ctx.signatureDataUrl, fit: [signWidth, 36], alignment: 'center', margin: [0, 16, 0, 0] });
    content.push({ text: signLine, alignment: 'center', margin: [0, -6, 0, 0] });
  } else {
    content.push({ text: signLine, alignment: 'center', margin: [0, 32, 0, 0] });
  }
  content.push({ text: t('report_sign_customer'), alignment: 'center', margin: [0, 1, 0, 0] });

  content.push({ text: signLine, alignment: 'center', margin: [0, 32, 0, 0] });
  content.push({ text: t('report_sign_servicer'), alignment: 'center', margin: [0, 1, 0, 0] });

  // FIKSNA visina strane (ne 'auto'). 'auto' pravi JEDNU dugu stranu tačno visine
  // sadržaja; dugi izveštaj (npr. gasni kotao sa svim parametrima) tako postane
  // vrlo visok, a ESC/POS print servis renderuje PDF stranu u bitmap i ne uspeva
  // da rasterizuje previsoku stranu na 80mm (bafer/veličina bitmapa) — print ne
  // izađe. Fiksna visina tera pdfMake da PRELOMI sadržaj na više kraćih strana,
  // pa je svaki bitmap mali i pouzdano se štampa (kao u staroj verziji app-a).
  const pageHeightPt = Math.round(140 * MM_TO_PT); // ~397pt, blizu visine koja radi
  return {
    pageSize: { width: widthPt, height: pageHeightPt },
    pageMargins: [10, 10, 10, 10],
    defaultStyle: { fontSize: 9 },
    content,
  };
}
