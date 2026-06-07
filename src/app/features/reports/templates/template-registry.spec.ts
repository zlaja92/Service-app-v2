/**
 * template-registry Unit Tests
 *
 * Covers resolveTemplate(type, tenantId) pure function.
 * No Angular TestBed needed — module has no DI dependencies.
 *
 * TENANT_TEMPLATES is empty today (all entries commented out in source),
 * so every tenantId — including 'SR' — falls through to DEFAULT_TEMPLATES.
 * Tests document this contract; if a tenant override is ever registered,
 * the 'SR' test below must be updated to import the tenant-specific template.
 */

import { resolveTemplate } from './template-registry';
import { interventionReceiptDefault } from './intervention-receipt.default';
import { ReportType } from '../models/report.model';

describe('resolveTemplate', () => {
  describe("type 'intervention-receipt'", () => {
    it("should return interventionReceiptDefault for tenantId 'SR'", () => {
      const result = resolveTemplate('intervention-receipt', 'SR');
      expect(result).toBe(interventionReceiptDefault);
    });

    it('should return interventionReceiptDefault when tenantId is null', () => {
      const result = resolveTemplate('intervention-receipt', null);
      expect(result).toBe(interventionReceiptDefault);
    });

    it("should return interventionReceiptDefault when tenantId is ''", () => {
      const result = resolveTemplate('intervention-receipt', '');
      expect(result).toBe(interventionReceiptDefault);
    });

    it('should return interventionReceiptDefault for an unregistered tenantId', () => {
      const result = resolveTemplate('intervention-receipt', 'nepostojeci-tenant');
      expect(result).toBe(interventionReceiptDefault);
    });
  });

  describe('unknown ReportType', () => {
    it('should return undefined for an unrecognised type — TC-TR-04', () => {
      // ESKALACIJA APP-BUG-01: resolveTemplate deklariše return tip AnyTemplate ali runtime vraća undefined za nepoznat type; caller (report.service) nema guard. Test dokumentuje ponašanje, ne menja app kod.
      const result = resolveTemplate('nepostojeci-type' as ReportType, 'SR');
      expect(result).toBeUndefined();
    });
  });
});
