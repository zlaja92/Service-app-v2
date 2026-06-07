/**
 * ReportService Unit Tests
 *
 * MOCK STRATEGY — CapacitorHttp
 * =============================
 * CapacitorHttp from @capacitor/core is a Capacitor Proxy object.
 * The Proxy's get trap always intercepts property access and lazily loads
 * the web implementation, meaning:
 *
 *   spyOn(CapacitorHttp, 'get') does NOT work — the get trap overrides own props.
 *
 * The same root cause is documented in storage.service.spec.ts (BUG-03 / CAPACITORHTTP
 * section) and applies identically here.
 *
 * Resolution used in this spec:
 *   - For generate() tests: spy on the private method `(service as any).toDataUrl`
 *     so the HTTP call inside toDataUrl is never reached.
 *   - For toDataUrl() tests: the early-return branches (undefined / '' / data: URL)
 *     are testable directly. The HTTP-dependent branches (success / error / empty
 *     base64) cannot be tested without mocking CapacitorHttp. They are documented
 *     as BLOCKED with the same rationale as BUG-03.
 */

import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import { ReportService } from './report.service';
import { PdfOutputService } from './pdf-output.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import {
  createMockTenantService,
  createMockTranslocoService,
  createMockLoggerService,
} from '../../../testing/mock-factories';
import { InterventionReportContext, ReportType } from '../models/report.model';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// ---------------------------------------------------------------------------
// Helper factory
// ---------------------------------------------------------------------------

function createMockContext(overrides: Partial<InterventionReportContext> = {}): InterventionReportContext {
  return {
    company: {
      companyName: 'Test Company d.o.o.',
      address: 'Testna 1, Beograd',
      phone: '+381601234567',
      logoUrl: undefined,
    },
    user: {
      fullName: 'Petar Petrovic',
      address: 'Testna 2',
      city: 'Beograd',
      phone: '+381691234567',
    },
    device: {
      name: 'Ariston Clas ONE',
      type: 'gas-boiler',
      sn: 'SN123456789',
    },
    intervention: {
      typeLabel: 'Redovni servis',
      date: '01.06.2026',
      servicer: 'Jovan Jovanovic',
    },
    signatureUrl: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('ReportService', () => {
  let service: ReportService;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockPdfOutput: jasmine.SpyObj<PdfOutputService>;

  beforeEach(() => {
    mockTenant   = createMockTenantService();
    mockTransloco = createMockTranslocoService();
    mockLogger   = createMockLoggerService();
    mockPdfOutput = jasmine.createSpyObj<PdfOutputService>('PdfOutputService', ['openPdf']);
    mockPdfOutput.openPdf.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        ReportService,
        { provide: TenantService,    useValue: mockTenant   },
        { provide: TranslocoService, useValue: mockTransloco },
        { provide: LoggerService,    useValue: mockLogger   },
        { provide: PdfOutputService, useValue: mockPdfOutput },
      ],
    });

    // Override the providedIn: 'root' singleton so TestBed uses our mock
    TestBed.overrideProvider(PdfOutputService, { useValue: mockPdfOutput });

    service = TestBed.inject(ReportService);
  });

  // =========================================================================
  // generate()
  // =========================================================================

  describe('generate()', () => {
    const type: ReportType = 'intervention-receipt';

    it('TC-RS01: resolves and calls openPdf with correct fileName', async () => {
      // Stub toDataUrl to avoid CapacitorHttp — see mock strategy note above
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      const ctx = createMockContext();
      await service.generate(type, ctx);

      expect(mockPdfOutput.openPdf).toHaveBeenCalledTimes(1);
      const [, fileName] = mockPdfOutput.openPdf.calls.first().args as [TDocumentDefinitions, string];
      expect(fileName).toBe('Intervention-report.pdf');
    });

    it('TC-RS02: calls tenantService.getCurrentTenantId to resolve template', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('SR');
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      await service.generate(type, createMockContext());

      expect(mockTenant.getCurrentTenantId).toHaveBeenCalledTimes(1);
    });

    it('TC-RS03: openPdf receives a defined document object (template produced output)', async () => {
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      await service.generate(type, createMockContext());

      const [doc] = mockPdfOutput.openPdf.calls.first().args as [TDocumentDefinitions, string];
      expect(doc).toBeDefined();
      // pdfMake doc must have a content array — this ensures the template ran
      expect((doc as { content?: unknown }).content).toBeDefined();
    });

    it('TC-RS04: transloco.translate is called via the t function passed to the template', async () => {
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      await service.generate(type, createMockContext());

      // The template calls t(key, ...) → transloco.translate must have been called
      expect(mockTransloco.translate).toHaveBeenCalled();
    });

    it('TC-RS05: logger.info is called after successful generation', async () => {
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      await service.generate(type, createMockContext());

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Report generated',
        jasmine.objectContaining({ type }),
      );
    });

    it('TC-RS06: logger.info receives the current tenantId', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('SR');
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);

      await service.generate(type, createMockContext());

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Report generated',
        jasmine.objectContaining({ tenantId: 'SR' }),
      );
    });

    it('TC-RS07: toDataUrl is called for logoUrl and signatureUrl', async () => {
      const toDataUrlSpy = spyOn(service as any, 'toDataUrl').and.resolveTo('data:image/png;base64,FAKE');

      const ctx = createMockContext({
        company: { logoUrl: 'https://example.com/logo.png' },
        signatureUrl: 'https://example.com/sig.png',
      });

      await service.generate(type, ctx);

      // Called once for logoUrl and once for signatureUrl
      expect(toDataUrlSpy).toHaveBeenCalledTimes(2);
      expect(toDataUrlSpy).toHaveBeenCalledWith('https://example.com/logo.png');
      expect(toDataUrlSpy).toHaveBeenCalledWith('https://example.com/sig.png');
    });

    it('TC-RS08: generate() rejects when openPdf rejects', async () => {
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);
      mockPdfOutput.openPdf.and.rejectWith(new Error('PDF open failed'));

      await expectAsync(service.generate(type, createMockContext()))
        .toBeRejectedWithError('PDF open failed');
    });

    it('TC-RS09: logger.info is NOT called when openPdf rejects', async () => {
      spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);
      mockPdfOutput.openPdf.and.rejectWith(new Error('fail'));

      try {
        await service.generate(type, createMockContext());
      } catch {
        // expected
      }

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // toDataUrl() — private, accessed via (service as any).toDataUrl
  //
  // CapacitorHttp Proxy note:
  //   The HTTP-dependent branches of toDataUrl (success response, error response,
  //   empty base64 response) rely on CapacitorHttp.get which is a Capacitor Proxy.
  //   The Proxy's get trap prevents direct spying (same issue as BUG-03 documented
  //   in storage.service.spec.ts). These three branches are therefore:
  //     a) Indirectly covered by generate() happy-path tests that exercise the
  //        full toDataUrl code path on a real URL — NOT in this unit test suite.
  //     b) Marked below as BLOCKED with detailed reasoning.
  //
  //   The three directly testable early-return branches are covered below.
  // =========================================================================

  describe('toDataUrl() — private', () => {
    it('TC-RS10: returns undefined when url is undefined', async () => {
      const result = await (service as any).toDataUrl(undefined);
      expect(result).toBeUndefined();
    });

    it('TC-RS11: returns undefined when url is empty string', async () => {
      const result = await (service as any).toDataUrl('');
      expect(result).toBeUndefined();
    });

    it('TC-RS12: returns the same data URL string when url already starts with "data:"', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      const result = await (service as any).toDataUrl(dataUrl);
      expect(result).toBe(dataUrl);
    });

    it('TC-RS13: returns the full data URL unchanged for data:image/jpeg prefix', async () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/FAKE==';
      const result = await (service as any).toDataUrl(dataUrl);
      expect(result).toBe(dataUrl);
    });

    // -----------------------------------------------------------------------
    // BLOCKED: HTTP-dependent branches
    // -----------------------------------------------------------------------

    xit('TC-RS14 [BLOCKED]: returns data URL on successful CapacitorHttp response — CapacitorHttp Proxy cannot be spied upon', async () => {
      // CapacitorHttp from @capacitor/core is a Capacitor Proxy object.
      // Its get trap overrides property assignment, so:
      //   spyOn(CapacitorHttp, 'get') does NOT work.
      //   Object.defineProperty(CapacitorHttp, 'get', ...) also fails silently.
      //
      // The web implementation (CapacitorHttpWeb) is lazily loaded via the Proxy —
      // unlike FirebaseStorageWeb which exposes its prototype before the lazy load,
      // CapacitorHttpWeb is not a directly importable class in @capacitor/core's
      // public API surface.
      //
      // Blocked: same root cause as BUG-03 / CAPACITORHTTP in storage.service.spec.ts.
      // Resolution would require: Jest module mocking, or refactoring toDataUrl to
      // accept an HttpClient/fetch wrapper that can be mocked (architectural change
      // requiring ARCH agent approval).
    });

    xit('TC-RS15 [BLOCKED]: returns undefined and calls logger.warn on CapacitorHttp error — CapacitorHttp Proxy cannot be spied upon', async () => {
      // Same blocker as TC-RS14.
    });

    xit('TC-RS16 [BLOCKED]: returns undefined when CapacitorHttp response.data is empty string — CapacitorHttp Proxy cannot be spied upon', async () => {
      // Same blocker as TC-RS14.
    });
  });

  // =========================================================================
  // contentTypeOf() — private, accessed via (service as any).contentTypeOf
  // =========================================================================

  describe('contentTypeOf() — private', () => {
    it('TC-RS17: returns undefined when headers is undefined', () => {
      const result = (service as any).contentTypeOf(undefined);
      expect(result).toBeUndefined();
    });

    it('TC-RS18: extracts content type stripping charset parameter (Content-Type with charset)', () => {
      const result = (service as any).contentTypeOf({ 'Content-Type': 'image/jpeg; charset=utf-8' });
      expect(result).toBe('image/jpeg');
    });

    it('TC-RS19: returns undefined when headers object is empty (no Content-Type key)', () => {
      const result = (service as any).contentTypeOf({});
      expect(result).toBeUndefined();
    });

    it('TC-RS20: matches lowercase "content-type" key', () => {
      const result = (service as any).contentTypeOf({ 'content-type': 'image/png' });
      expect(result).toBe('image/png');
    });

    it('TC-RS21: matches uppercase "CONTENT-TYPE" key', () => {
      const result = (service as any).contentTypeOf({ 'CONTENT-TYPE': 'image/webp' });
      expect(result).toBe('image/webp');
    });

    it('TC-RS22: returns content type without modification when no params present', () => {
      const result = (service as any).contentTypeOf({ 'Content-Type': 'image/png' });
      expect(result).toBe('image/png');
    });

    it('TC-RS23: strips multiple parameters after content type', () => {
      const result = (service as any).contentTypeOf({
        'Content-Type': 'image/jpeg; charset=utf-8; boundary=something',
      });
      expect(result).toBe('image/jpeg');
    });

    it('TC-RS24: trims whitespace around the content type value', () => {
      const result = (service as any).contentTypeOf({ 'content-type': '  image/png  ' });
      expect(result).toBe('image/png');
    });

    it('TC-RS25: ignores irrelevant headers and returns undefined when Content-Type missing', () => {
      const result = (service as any).contentTypeOf({
        'X-Custom-Header': 'foo',
        'Authorization': 'Bearer token123',
      });
      expect(result).toBeUndefined();
    });

    it('TC-RS26: returns correct type when Content-Type is mixed-case "content-TYPE"', () => {
      const result = (service as any).contentTypeOf({ 'content-TYPE': 'image/gif' });
      expect(result).toBe('image/gif');
    });
  });

  // =========================================================================
  // Parameterized: contentTypeOf() — content type value variants
  // =========================================================================

  describe('contentTypeOf() — parameterized MIME types', () => {
    const mimeTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'application/octet-stream',
    ];

    mimeTypes.forEach((mime) => {
      it(`TC-RS-MIME-${mime}: contentTypeOf() correctly extracts "${mime}"`, () => {
        const result = (service as any).contentTypeOf({ 'Content-Type': mime });
        expect(result).toBe(mime);
      });
    });

    mimeTypes.forEach((mime) => {
      it(`TC-RS-MIME-CHARSET-${mime}: contentTypeOf() strips charset from "${mime}; charset=utf-8"`, () => {
        const result = (service as any).contentTypeOf({
          'Content-Type': `${mime}; charset=utf-8`,
        });
        expect(result).toBe(mime);
      });
    });
  });

  // =========================================================================
  // Parameterized: generate() — various tenant IDs (template resolution)
  // =========================================================================

  describe('generate() — parameterized tenant IDs', () => {
    const tenantIds: Array<string | null> = ['SR', 'HR', 'mock-tenant', null, '', 'arst-srb'];

    tenantIds.forEach((tenantId) => {
      it(`TC-RS-TID-${String(tenantId)}: generate() resolves with tenantId="${String(tenantId)}"`, async () => {
        mockTenant.getCurrentTenantId.and.returnValue(tenantId as string);
        spyOn(service as any, 'toDataUrl').and.resolveTo(undefined);
        mockPdfOutput.openPdf.and.resolveTo();

        await expectAsync(
          service.generate('intervention-receipt', createMockContext()),
        ).toBeResolved();

        expect(mockPdfOutput.openPdf).toHaveBeenCalledTimes(1);
      });
    });
  });
});
