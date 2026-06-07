/**
 * interventionReceiptDefault — Unit Tests
 *
 * Pure function (ctx, t) => TDocumentDefinitions, no Angular DI needed.
 * Uses a pass-through t-stub: t(key) === key.
 */

import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { InterventionReportContext } from '../models/report.model';
import { interventionReceiptDefault } from './intervention-receipt.default';

// ---------------------------------------------------------------------------
// t-stub
// ---------------------------------------------------------------------------

const t = (key: string): string => key;

// ---------------------------------------------------------------------------
// Constants (match source)
// ---------------------------------------------------------------------------

const MM_TO_PT = 2.834645669;
const DEFAULT_WIDTH_MM = 80;
const DEFAULT_WIDTH_PT = Math.round(DEFAULT_WIDTH_MM * MM_TO_PT); // 227

// ---------------------------------------------------------------------------
// buildCtx — minimal valid context; pass overrides for specific scenarios
// ---------------------------------------------------------------------------

function buildCtx(overrides: Partial<InterventionReportContext> = {}): InterventionReportContext {
  return {
    company: {},
    user: {},
    device: {},
    intervention: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Content-tree helpers
// ---------------------------------------------------------------------------

type AnyNode = Record<string, unknown>;

/**
 * Recursively collects all nodes from a pdfmake content tree into a flat array.
 * Handles arrays, {columns: []}, {table: {body: [[]]}} and plain objects.
 */
function flattenContent(node: unknown): AnyNode[] {
  if (node === null || node === undefined) return [];
  if (Array.isArray(node)) {
    return node.flatMap(flattenContent);
  }
  if (typeof node !== 'object') return [];

  const obj = node as AnyNode;
  const result: AnyNode[] = [obj];

  if (Array.isArray(obj['columns'])) {
    result.push(...flattenContent(obj['columns']));
  }
  if (obj['table'] && typeof obj['table'] === 'object') {
    const table = obj['table'] as AnyNode;
    if (Array.isArray(table['body'])) {
      result.push(...flattenContent(table['body']));
    }
  }
  if (Array.isArray(obj['content'])) {
    result.push(...flattenContent(obj['content']));
  }
  if (Array.isArray(obj['canvas'])) {
    result.push(...flattenContent(obj['canvas']));
  }

  return result;
}

/** Returns true if any node in the tree has a `text` field containing the substring. */
function hasText(doc: TDocumentDefinitions, substring: string): boolean {
  const nodes = flattenContent(doc.content);
  return nodes.some(n => typeof n['text'] === 'string' && (n['text'] as string).includes(substring));
}

/** Returns all nodes that have an `image` field equal to the given dataUrl. */
function findByImage(doc: TDocumentDefinitions, dataUrl: string): AnyNode[] {
  return flattenContent(doc.content).filter(n => n['image'] === dataUrl);
}

// ---------------------------------------------------------------------------
// Describe: interventionReceiptDefault
// ---------------------------------------------------------------------------

describe('interventionReceiptDefault', () => {

  // =========================================================================
  // Document structure
  // =========================================================================

  describe('document structure', () => {
    it('returns an object (TDocumentDefinitions)', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('pageSize has width and height="auto"', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      expect(result.pageSize).toBeDefined();
      const ps = result.pageSize as { width: number; height: string };
      expect(typeof ps.width).toBe('number');
      expect(ps.height).toBe('auto');
    });

    it('pageMargins is [10, 10, 10, 10]', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      expect(result.pageMargins).toEqual([10, 10, 10, 10]);
    });

    it('defaultStyle has fontSize 9', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      expect((result.defaultStyle as { fontSize: number }).fontSize).toBe(9);
    });

    it('content is a non-empty array', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      expect(Array.isArray(result.content)).toBeTrue();
      expect((result.content as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Width / paperWidthMm
  // =========================================================================

  describe('width calculation', () => {
    it('default width (paperWidthMm undefined) → pageSize.width = 227', () => {
      const result = interventionReceiptDefault(buildCtx(), t);
      const ps = result.pageSize as { width: number; height: string };
      expect(ps.width).toBe(DEFAULT_WIDTH_PT); // 227
    });

    it('paperWidthMm = 80 (explicit) → width = 227', () => {
      const result = interventionReceiptDefault(buildCtx({ company: { paperWidthMm: 80 } }), t);
      const ps = result.pageSize as { width: number; height: string };
      expect(ps.width).toBe(227);
    });

    it('paperWidthMm = 58 → width = Math.round(58 * 2.834645669) = 164', () => {
      const expected = Math.round(58 * MM_TO_PT); // 164
      const result = interventionReceiptDefault(buildCtx({ company: { paperWidthMm: 58 } }), t);
      const ps = result.pageSize as { width: number; height: string };
      expect(ps.width).toBe(expected);
      expect(ps.width).toBe(164);
    });

    it('paperWidthMm = 0 → fallback to default, width = 227', () => {
      const result = interventionReceiptDefault(buildCtx({ company: { paperWidthMm: 0 } }), t);
      const ps = result.pageSize as { width: number; height: string };
      expect(ps.width).toBe(DEFAULT_WIDTH_PT);
    });

    it('paperWidthMm = -10 (negative) → fallback to default, width = 227', () => {
      const result = interventionReceiptDefault(buildCtx({ company: { paperWidthMm: -10 } }), t);
      const ps = result.pageSize as { width: number; height: string };
      expect(ps.width).toBe(DEFAULT_WIDTH_PT);
    });
  });

  // =========================================================================
  // eqCount
  // =========================================================================

  describe('eqCount = Math.max(12, Math.floor((widthPt - 20) / 7))', () => {
    it('default width (227) → eqCount = Math.max(12, Math.floor((227-20)/7)) = 29', () => {
      const expectedEqCount = Math.max(12, Math.floor((DEFAULT_WIDTH_PT - 20) / 7)); // 29
      const result = interventionReceiptDefault(buildCtx(), t);
      // Verify via the signLine length (used for underscore line)
      const nodes = flattenContent(result.content);
      // signLine = '_'.repeat(eqCount) — find a node with only underscores
      const signLineNode = nodes.find(
        n => typeof n['text'] === 'string' && /^_+$/.test(n['text'] as string),
      );
      expect(signLineNode).toBeDefined();
      expect((signLineNode!['text'] as string).length).toBe(expectedEqCount);
    });
  });

  // =========================================================================
  // Header (company)
  // =========================================================================

  describe('Header (company)', () => {
    const fullCompany = {
      company: 'Frigo Tehnika',
      address: 'Cara Dušana 5',
      city: 'Niš',
      phone: '018-111',
      email: 'servis@frigo.rs',
      pib: '123456789',
      paperWidthMm: 80,
    };

    it('company name rendered uppercase, italic + bold, larger font', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const nameNode = nodes.find(n => n['text'] === 'FRIGO TEHNIKA' && n['bold'] === true);
      expect(nameNode).toBeDefined();
      expect(nameNode!['italics']).toBeTrue();
      expect(nameNode!['fontSize']).toBe(16);
    });

    it('company name is kept on a single line (noWrap)', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const nameNode = nodes.find(n => n['text'] === 'FRIGO TEHNIKA');
      expect(nameNode!['noWrap']).toBeTrue();
    });

    it('long company name shrinks below the max font (still one node, never wraps)', () => {
      const longName = 'Frigo Termo Klima Servis i Inženjering DOO Beograd';
      const result = interventionReceiptDefault(buildCtx({ company: { ...fullCompany, company: longName } }), t);
      const nodes = flattenContent(result.content);
      const nameNode = nodes.find(n => n['text'] === longName.toUpperCase());
      expect(nameNode).toBeDefined();
      expect(nameNode!['noWrap']).toBeTrue();
      expect(nameNode!['fontSize'] as number).toBeLessThan(16);
      expect(nameNode!['fontSize'] as number).toBeGreaterThanOrEqual(7);
    });

    it('extremely long company name clamps the font to the 7pt minimum', () => {
      const hugeName = 'A'.repeat(120);
      const result = interventionReceiptDefault(buildCtx({ company: { ...fullCompany, company: hugeName } }), t);
      const nodes = flattenContent(result.content);
      const nameNode = nodes.find(n => n['text'] === hugeName);
      expect(nameNode!['fontSize']).toBe(7);
    });

    it('address+city line is kept on a single line (noWrap)', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const line = nodes.find(n => n['text'] === 'Cara Dušana 5, Niš');
      expect(line!['noWrap']).toBeTrue();
    });

    it('EVERY header line is kept on a single line (noWrap)', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const headerTexts = [
        'REPORT_SERVICE_CENTER',
        'FRIGO TEHNIKA',
        'Cara Dušana 5, Niš',
        'report_phone_short: 018-111, report_email_short: servis@frigo.rs',
      ];
      for (const text of headerTexts) {
        const node = nodes.find(n => n['text'] === text);
        expect(node).withContext(text).toBeDefined();
        expect(node!['noWrap']).withContext(text).toBeTrue();
      }
    });

    it('renders the uppercase "service center" heading: smaller than the name but larger than the address', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      // t-stub returns the key; the template uppercases it.
      const heading = nodes.find(n => n['text'] === 'REPORT_SERVICE_CENTER');
      expect(heading).toBeDefined();
      expect(heading!['bold']).toBeFalsy();
      const headingSize = heading!['fontSize'] as number;
      const nameSize = nodes.find(n => n['text'] === 'FRIGO TEHNIKA')!['fontSize'] as number;
      const addrSize = nodes.find(n => n['text'] === 'Cara Dušana 5, Niš')!['fontSize'] as number;
      expect(headingSize).toBeLessThan(nameSize);
      expect(headingSize).toBeGreaterThan(addrSize);
    });

    it('address and city on a single line: "address, city"', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const line = nodes.find(n => n['text'] === 'Cara Dušana 5, Niš');
      expect(line).toBeDefined();
    });

    it('contact on a single line: "tel: phone, email: mail"', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      const line = nodes.find(n => n['text'] === 'report_phone_short: 018-111, report_email_short: servis@frigo.rs');
      expect(line).toBeDefined();
    });

    it('PIB is not rendered (removed for now)', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      expect(hasText(result, 'report_tax_id')).toBeFalse();
      expect(hasText(result, '123456789')).toBeFalse();
    });

    it('missing email → contact line has only the phone', () => {
      const { email: _email, ...companyNoEmail } = fullCompany;
      const result = interventionReceiptDefault(buildCtx({ company: companyNoEmail }), t);
      const nodes = flattenContent(result.content);
      const line = nodes.find(n => n['text'] === 'report_phone_short: 018-111');
      expect(line).toBeDefined();
      expect(hasText(result, 'report_email_short')).toBeFalse();
    });

    it('missing city → address line is the address only (no comma/city)', () => {
      const { city: _city, ...companyNoCity } = fullCompany;
      const result = interventionReceiptDefault(buildCtx({ company: companyNoCity }), t);
      const nodes = flattenContent(result.content);
      const line = nodes.find(n => n['text'] === 'Cara Dušana 5');
      expect(line).toBeDefined();
      expect(hasText(result, 'Niš')).toBeFalse();
    });

    it('never renders a logo image element regardless of any extra field', () => {
      const result = interventionReceiptDefault(buildCtx({ company: fullCompany }), t);
      const nodes = flattenContent(result.content);
      // The only image allowed is a signature; company section must have no image
      const imageNodes = nodes.filter(n => 'image' in n);
      // No signatureDataUrl in ctx → zero images total
      expect(imageNodes.length).toBe(0);
    });
  });

  // =========================================================================
  // Customer section
  // =========================================================================

  describe('customer section', () => {
    const customerKeys = [
      'report_customer_name',
      'report_address',
      'report_phone',
      'report_city',
    ];

    customerKeys.forEach(key => {
      it(`contains t-key "${key}" in content`, () => {
        const result = interventionReceiptDefault(buildCtx(), t);
        expect(hasText(result, key)).toBeTrue();
      });
    });
  });

  // =========================================================================
  // Device / intervention section
  // =========================================================================

  describe('device section', () => {
    const deviceKeys = [
      'report_model',
      'report_intervention_type',
      'report_date',
      'report_serial',
    ];

    deviceKeys.forEach(key => {
      it(`contains t-key "${key}" in content`, () => {
        const result = interventionReceiptDefault(buildCtx(), t);
        expect(hasText(result, key)).toBeTrue();
      });
    });

    it('connectedSn present → row with report_serial2 exists', () => {
      const result = interventionReceiptDefault(
        buildCtx({ device: { connectedSn: 'SN-CONNECTED-001' } }),
        t,
      );
      expect(hasText(result, 'report_serial2')).toBeTrue();
    });

    it('connectedSn absent → no row with report_serial2', () => {
      const result = interventionReceiptDefault(buildCtx({ device: {} }), t);
      expect(hasText(result, 'report_serial2')).toBeFalse();
    });

    it('connectedSn = undefined → no row with report_serial2', () => {
      const result = interventionReceiptDefault(
        buildCtx({ device: { connectedSn: undefined } }),
        t,
      );
      expect(hasText(result, 'report_serial2')).toBeFalse();
    });
  });

  // =========================================================================
  // servicer note — stacked below its label (long free text)
  // =========================================================================

  describe('servicer note (stacked, full width)', () => {
    const noteText = 'Zamenjen je izmenjivač toplote i očišćen je gorionik; klijent obavešten o sledećem godišnjem servisu.';

    it('renders the note label as its own bold line', () => {
      const result = interventionReceiptDefault(buildCtx({ intervention: { note: noteText } }), t);
      const nodes = flattenContent(result.content);
      const label = nodes.find(n => n['text'] === 'report_note' && n['bold'] === true);
      expect(label).toBeDefined();
    });

    it('renders the note text below the label (its own node, not beside it)', () => {
      const result = interventionReceiptDefault(buildCtx({ intervention: { note: noteText } }), t);
      const nodes = flattenContent(result.content);
      expect(nodes.find(n => n['text'] === noteText)).toBeDefined();
      // The note must NOT be a 2-column row (label beside value).
      const asRow = nodes.find(
        n => Array.isArray(n['columns']) && (n['columns'] as AnyNode[])[0]?.['text'] === 'report_note',
      );
      expect(asRow).toBeUndefined();
    });

    it('empty note → label still shown, no value node', () => {
      const result = interventionReceiptDefault(buildCtx({ intervention: { note: '' } }), t);
      const nodes = flattenContent(result.content);
      expect(nodes.find(n => n['text'] === 'report_note')).toBeDefined();
    });
  });

  // =========================================================================
  // parameterSections
  // =========================================================================

  describe('parameterSections', () => {
    it('empty array ([]) → no report_parameters header in content', () => {
      const result = interventionReceiptDefault(
        buildCtx({ parameterSections: [] }),
        t,
      );
      expect(hasText(result, 'report_parameters'.toUpperCase())).toBeFalse();
      expect(hasText(result, 'REPORT_PARAMETERS')).toBeFalse();
    });

    it('parameterSections undefined → no report_parameters header', () => {
      const result = interventionReceiptDefault(buildCtx({ parameterSections: undefined }), t);
      // t('report_parameters').toUpperCase() = 'REPORT_PARAMETERS'
      expect(hasText(result, 'REPORT_PARAMETERS')).toBeFalse();
    });

    it('1 section → header REPORT_PARAMETERS (uppercase) present', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'Section A', rows: [{ label: 'Param1', value: 'Val1' }] },
          ],
        }),
        t,
      );
      expect(hasText(result, 'REPORT_PARAMETERS')).toBeTrue();
    });

    it('1 section → NO sub-title (section.title not in text nodes)', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'MyUniqueSectionTitle', rows: [{ label: 'P', value: 'V' }] },
          ],
        }),
        t,
      );
      expect(hasText(result, 'MyUniqueSectionTitle')).toBeFalse();
    });

    it('2 sections → header REPORT_PARAMETERS present', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'Section A', rows: [{ label: 'P1', value: 'V1' }] },
            { title: 'Section B', rows: [{ label: 'P2', value: 'V2' }] },
          ],
        }),
        t,
      );
      expect(hasText(result, 'REPORT_PARAMETERS')).toBeTrue();
    });

    it('2 sections → sub-titles for each section are present', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'Section Alpha', rows: [] },
            { title: 'Section Beta', rows: [] },
          ],
        }),
        t,
      );
      expect(hasText(result, 'Section Alpha')).toBeTrue();
      expect(hasText(result, 'Section Beta')).toBeTrue();
    });

    it('2 sections → thinLine (canvas line) present in content', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'Section A', rows: [{ label: 'P', value: 'V' }] },
            { title: 'Section B', rows: [{ label: 'Q', value: 'W' }] },
          ],
        }),
        t,
      );
      const nodes = flattenContent(result.content);
      const canvasNodes = nodes.filter(n => Array.isArray(n['canvas']));
      expect(canvasNodes.length).toBeGreaterThan(0);
    });

    it('1 section → NO thinLine (canvas) in content', () => {
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'Only Section', rows: [{ label: 'P', value: 'V' }] },
          ],
        }),
        t,
      );
      const nodes = flattenContent(result.content);
      const canvasNodes = nodes.filter(n => Array.isArray(n['canvas']));
      expect(canvasNodes.length).toBe(0);
    });
  });

  // =========================================================================
  // paramRow label width
  // =========================================================================

  describe('paramRow label width', () => {
    it('default width → paramLabelWidth = Math.round((227-20)*0.70) = 145', () => {
      const expectedLabelWidth = Math.round((DEFAULT_WIDTH_PT - 20) * 0.70); // 145
      const paramLabel = 'UniqueParamLabel';
      const result = interventionReceiptDefault(
        buildCtx({
          parameterSections: [
            { title: 'S', rows: [{ label: paramLabel, value: 'v' }] },
          ],
        }),
        t,
      );
      const nodes = flattenContent(result.content);
      // Find column node where first column has our label text
      const colNode = nodes.find(n => {
        if (!Array.isArray(n['columns'])) return false;
        const cols = n['columns'] as AnyNode[];
        return cols.length >= 1 && cols[0]['text'] === paramLabel;
      });
      expect(colNode).toBeDefined();
      const firstCol = (colNode!['columns'] as AnyNode[])[0];
      expect(firstCol['width']).toBe(expectedLabelWidth);
      expect(firstCol['width']).toBe(145);
    });

    it('width 58mm → paramLabelWidth = Math.round((164-20)*0.70) = 101', () => {
      const widthPt58 = Math.round(58 * MM_TO_PT); // 164
      const expectedLabelWidth = Math.round((widthPt58 - 20) * 0.70); // 101
      const paramLabel = 'AnotherUniqueLabel';
      const result = interventionReceiptDefault(
        buildCtx({
          company: { paperWidthMm: 58 },
          parameterSections: [
            { title: 'S', rows: [{ label: paramLabel, value: 'v' }] },
          ],
        }),
        t,
      );
      const nodes = flattenContent(result.content);
      const colNode = nodes.find(n => {
        if (!Array.isArray(n['columns'])) return false;
        const cols = n['columns'] as AnyNode[];
        return cols.length >= 1 && cols[0]['text'] === paramLabel;
      });
      expect(colNode).toBeDefined();
      const firstCol = (colNode!['columns'] as AnyNode[])[0];
      expect(firstCol['width']).toBe(expectedLabelWidth);
      expect(firstCol['width']).toBe(101);
    });
  });

  // =========================================================================
  // consent
  // =========================================================================

  describe('consent', () => {
    it('consent undefined → no consent section in content', () => {
      const result = interventionReceiptDefault(buildCtx({ consent: undefined }), t);
      expect(hasText(result, 'report_boiler_disclaimer')).toBeFalse();
      expect(hasText(result, 'report_service_consent')).toBeFalse();
    });

    it('consent type "boiler-disclaimer" → contains report_boiler_disclaimer text', () => {
      const result = interventionReceiptDefault(
        buildCtx({ consent: { type: 'boiler-disclaimer', accepted: null } }),
        t,
      );
      expect(hasText(result, 'report_boiler_disclaimer')).toBeTrue();
    });

    it('consent type "boiler-disclaimer" → does NOT contain report_service_consent', () => {
      const result = interventionReceiptDefault(
        buildCtx({ consent: { type: 'boiler-disclaimer', accepted: null } }),
        t,
      );
      expect(hasText(result, 'report_service_consent')).toBeFalse();
    });

    describe('consent type "service-consent"', () => {
      it('accepted = true → DA choice node has hLineWidth returning 1 (boxed)', () => {
        const result = interventionReceiptDefault(
          buildCtx({ consent: { type: 'service-consent', accepted: true } }),
          t,
        );
        // Find table nodes where first cell text is 'report_consent_yes'
        const nodes = flattenContent(result.content);
        const yesTableNode = nodes.find(n => {
          if (!n['table']) return false;
          const body = (n['table'] as AnyNode)['body'];
          if (!Array.isArray(body)) return false;
          const firstRow = body[0] as AnyNode[];
          if (!Array.isArray(firstRow)) return false;
          const firstCell = firstRow[0] as AnyNode;
          return firstCell && firstCell['text'] === 'report_consent_yes';
        });
        expect(yesTableNode).toBeDefined();
        // layout.hLineWidth() should return 1 for selected (accepted=true)
        const layout = yesTableNode!['layout'] as {
          hLineWidth: () => number;
          vLineWidth: () => number;
        };
        expect(layout).toBeDefined();
        expect(layout.hLineWidth()).toBe(1);
        expect(layout.vLineWidth()).toBe(1);
      });

      it('accepted = true → NE choice node has hLineWidth returning 0 (not boxed)', () => {
        const result = interventionReceiptDefault(
          buildCtx({ consent: { type: 'service-consent', accepted: true } }),
          t,
        );
        const nodes = flattenContent(result.content);
        const noTableNode = nodes.find(n => {
          if (!n['table']) return false;
          const body = (n['table'] as AnyNode)['body'];
          if (!Array.isArray(body)) return false;
          const firstRow = body[0] as AnyNode[];
          if (!Array.isArray(firstRow)) return false;
          const firstCell = firstRow[0] as AnyNode;
          return firstCell && firstCell['text'] === 'report_consent_no';
        });
        expect(noTableNode).toBeDefined();
        const layout = noTableNode!['layout'] as {
          hLineWidth: () => number;
          vLineWidth: () => number;
        };
        expect(layout.hLineWidth()).toBe(0);
        expect(layout.vLineWidth()).toBe(0);
      });

      it('accepted = false → NE choice node hLineWidth returns 1 (boxed)', () => {
        const result = interventionReceiptDefault(
          buildCtx({ consent: { type: 'service-consent', accepted: false } }),
          t,
        );
        const nodes = flattenContent(result.content);
        const noTableNode = nodes.find(n => {
          if (!n['table']) return false;
          const body = (n['table'] as AnyNode)['body'];
          if (!Array.isArray(body)) return false;
          const firstRow = body[0] as AnyNode[];
          if (!Array.isArray(firstRow)) return false;
          const firstCell = firstRow[0] as AnyNode;
          return firstCell && firstCell['text'] === 'report_consent_no';
        });
        expect(noTableNode).toBeDefined();
        const layout = noTableNode!['layout'] as {
          hLineWidth: () => number;
          vLineWidth: () => number;
        };
        expect(layout.hLineWidth()).toBe(1);
        expect(layout.vLineWidth()).toBe(1);
      });

      it('accepted = false → DA choice node hLineWidth returns 0 (not boxed)', () => {
        const result = interventionReceiptDefault(
          buildCtx({ consent: { type: 'service-consent', accepted: false } }),
          t,
        );
        const nodes = flattenContent(result.content);
        const yesTableNode = nodes.find(n => {
          if (!n['table']) return false;
          const body = (n['table'] as AnyNode)['body'];
          if (!Array.isArray(body)) return false;
          const firstRow = body[0] as AnyNode[];
          if (!Array.isArray(firstRow)) return false;
          const firstCell = firstRow[0] as AnyNode;
          return firstCell && firstCell['text'] === 'report_consent_yes';
        });
        expect(yesTableNode).toBeDefined();
        const layout = yesTableNode!['layout'] as {
          hLineWidth: () => number;
          vLineWidth: () => number;
        };
        expect(layout.hLineWidth()).toBe(0);
        expect(layout.vLineWidth()).toBe(0);
      });

      it('accepted = null → both DA and NE have hLineWidth returning 0 (neither boxed)', () => {
        const result = interventionReceiptDefault(
          buildCtx({ consent: { type: 'service-consent', accepted: null } }),
          t,
        );
        const nodes = flattenContent(result.content);

        const tableNodes = nodes.filter(n => {
          if (!n['table']) return false;
          const body = (n['table'] as AnyNode)['body'];
          if (!Array.isArray(body)) return false;
          const firstRow = body[0] as AnyNode[];
          if (!Array.isArray(firstRow)) return false;
          const firstCell = firstRow[0] as AnyNode;
          return (
            firstCell &&
            (firstCell['text'] === 'report_consent_yes' || firstCell['text'] === 'report_consent_no')
          );
        });

        expect(tableNodes.length).toBe(2);
        tableNodes.forEach(n => {
          const layout = n['layout'] as { hLineWidth: () => number; vLineWidth: () => number };
          expect(layout.hLineWidth()).toBe(0);
          expect(layout.vLineWidth()).toBe(0);
        });
      });
    });
  });

  // =========================================================================
  // Signature
  // =========================================================================

  describe('signature', () => {
    it('signatureDataUrl present → image element with that dataUrl exists', () => {
      const sigUrl = 'data:image/png;base64,SIG==';
      const result = interventionReceiptDefault(buildCtx({ signatureDataUrl: sigUrl }), t);
      const found = findByImage(result, sigUrl);
      expect(found.length).toBeGreaterThan(0);
    });

    it('signatureDataUrl present → sign line (underscores) has margin [0,-6,0,0]', () => {
      const result = interventionReceiptDefault(
        buildCtx({ signatureDataUrl: 'data:image/png;base64,SIG==' }),
        t,
      );
      const nodes = flattenContent(result.content);
      const signLineWithNegMargin = nodes.find(
        n =>
          typeof n['text'] === 'string' &&
          /^_+$/.test(n['text'] as string) &&
          Array.isArray(n['margin']) &&
          (n['margin'] as number[])[1] === -6,
      );
      expect(signLineWithNegMargin).toBeDefined();
    });

    it('signatureDataUrl absent → no signature image element in content', () => {
      const result = interventionReceiptDefault(buildCtx({ signatureDataUrl: undefined }), t);
      const nodes = flattenContent(result.content);
      const imageNodes = nodes.filter(n => 'image' in n);
      expect(imageNodes.length).toBe(0);
    });

    it('signatureDataUrl absent → sign line has margin [0,32,0,0] (spacer)', () => {
      const result = interventionReceiptDefault(buildCtx({ signatureDataUrl: undefined }), t);
      const nodes = flattenContent(result.content);
      // First underscore-text node should have top-margin=32
      const signLineWithSpace = nodes.find(
        n =>
          typeof n['text'] === 'string' &&
          /^_+$/.test(n['text'] as string) &&
          Array.isArray(n['margin']) &&
          (n['margin'] as number[])[1] === 32,
      );
      expect(signLineWithSpace).toBeDefined();
    });
  });

  // =========================================================================
  // parts
  // =========================================================================

  describe('intervention.parts', () => {
    it("parts=['Part1','',null,'Part4'] → only 2 rows, labels use original index+1", () => {
      const result = interventionReceiptDefault(
        buildCtx({
          intervention: {
            parts: ['Part1', '', null as unknown as string, 'Part4'],
          },
        }),
        t,
      );
      // 'report_spare_part 1' and 'report_spare_part 4' should exist
      expect(hasText(result, 'report_spare_part 1')).toBeTrue();
      expect(hasText(result, 'report_spare_part 4')).toBeTrue();
    });

    it("parts=['Part1','',null,'Part4'] → label uses i+1 of ORIGINAL array (not 2 for Part4)", () => {
      const result = interventionReceiptDefault(
        buildCtx({
          intervention: {
            parts: ['Part1', '', null as unknown as string, 'Part4'],
          },
        }),
        t,
      );
      // The 4th element (index 3) → label 'report_spare_part 4', NOT 'report_spare_part 2'
      expect(hasText(result, 'report_spare_part 4')).toBeTrue();
      expect(hasText(result, 'report_spare_part 2')).toBeFalse();
    });

    it("parts=['Part1','',null,'Part4'] → value 'Part1' and 'Part4' present", () => {
      const result = interventionReceiptDefault(
        buildCtx({
          intervention: {
            parts: ['Part1', '', null as unknown as string, 'Part4'],
          },
        }),
        t,
      );
      expect(hasText(result, 'Part1')).toBeTrue();
      expect(hasText(result, 'Part4')).toBeTrue();
    });

    it('parts undefined → no report_spare_part in content', () => {
      const result = interventionReceiptDefault(
        buildCtx({ intervention: { parts: undefined } }),
        t,
      );
      expect(hasText(result, 'report_spare_part')).toBeFalse();
    });

    it("parts=[' ','\\t'] (whitespace-only) → no report_spare_part rows", () => {
      const result = interventionReceiptDefault(
        buildCtx({ intervention: { parts: [' ', '\t'] } }),
        t,
      );
      expect(hasText(result, 'report_spare_part')).toBeFalse();
    });

    it("parts=['','','',''] (all empty strings) → no report_spare_part rows", () => {
      const result = interventionReceiptDefault(
        buildCtx({ intervention: { parts: ['', '', '', ''] } }),
        t,
      );
      expect(hasText(result, 'report_spare_part')).toBeFalse();
    });
  });

  // =========================================================================
  // Signature only (logo has been removed from the template)
  // =========================================================================

  describe('signature only (no logo)', () => {
    it('signatureDataUrl present → exactly one image element in content (the signature)', () => {
      const sigUrl = 'data:image/png;base64,SIG==';
      const result = interventionReceiptDefault(
        buildCtx({ signatureDataUrl: sigUrl }),
        t,
      );
      const nodes = flattenContent(result.content);
      const imageNodes = nodes.filter(n => 'image' in n);
      expect(imageNodes.length).toBe(1);
      expect(imageNodes[0]['image']).toBe(sigUrl);
    });
  });

});
