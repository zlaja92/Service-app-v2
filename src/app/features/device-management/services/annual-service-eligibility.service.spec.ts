import { TestBed } from '@angular/core/testing';
import {
  AnnualServiceEligibilityService,
  ServiceWindowParams,
} from './annual-service-eligibility.service';
import { InterventionService } from './intervention.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { DeviceType } from '../../../shared/models/device.model';
import { InterventionType } from '../models/intervention.model';
import { buildDevice, buildRegistrationData, buildInterventionData, buildFirestoreTimestamp } from '../../../testing/test-data-builders';

// ─── Mock helper ──────────────────────────────────────────────────────────────

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', ['debug', 'info', 'warn', 'error']);
}

function makeIntervention(
  type: InterventionType,
  addedDate: Date,
  sn = 'SN-TEST-001',
): { id: string; data: Record<string, unknown> } {
  return {
    id: `int-${Date.now()}-${Math.random()}`,
    data: buildInterventionData({
      sn,
      interventionType: type,
      addedDate: buildFirestoreTimestamp(addedDate),
    }),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AnnualServiceEligibilityService', () => {
  let service: AnnualServiceEligibilityService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;
  let mockLoggerService: jasmine.SpyObj<LoggerService>;

  // Default values used across most tests
  const DEFAULT_SN = 'SN-TEST-001';

  beforeEach(() => {
    mockInterventionService = jasmine.createSpyObj<InterventionService>(
      'InterventionService',
      ['getRegistration', 'getInterventionsBySn', 'getInterventionLabel'],
    );
    mockServerTimeService = jasmine.createSpyObj<ServerTimeService>(
      'ServerTimeService',
      ['getServerTime'],
    );
    mockLoggerService = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        AnnualServiceEligibilityService,
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: ServerTimeService, useValue: mockServerTimeService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    service = TestBed.inject(AnnualServiceEligibilityService);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // checkEligibility() — top-level orchestration
  // ══════════════════════════════════════════════════════════════════════════════

  describe('checkEligibility()', () => {

    // TC-ASE-01: Missing service period params
    it('TC-ASE-01: sets disableReason=no_service_period_params when device lacks window params', async () => {
      const device = buildDevice({
        serviceWindowStart: undefined,
        serviceWindowEnd: undefined,
        firstServiceYear: undefined,
        warrantyMonths: undefined,
      });

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-02: No registration document
    it('TC-ASE-02: sets disableReason=no_warranty_document_field when registration is null', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(null);

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('no_warranty_document_field');
    });

    // TC-ASE-03: Registration exists but warrantyStatus field is missing
    it('TC-ASE-03: sets disableReason=no_warranty_document_field when warrantyStatus field is absent', async () => {
      const device = buildDevice();
      const regData = buildRegistrationData();
      delete regData['warrantyStatus'];
      mockInterventionService.getRegistration.and.resolveTo(regData);

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('no_warranty_document_field');
    });

    // TC-ASE-04: warrantyStatus is not 'in-warranty'
    it('TC-ASE-04: sets disableReason=not_in_warranty when warrantyStatus !== in_warranty', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'expired' }),
      );

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('not_in_warranty');
    });

    // TC-ASE-05: No purchase date
    it('TC-ASE-05: sets disableReason=no_purchase_date when dateOfPurchase is null', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'in-warranty', dateOfPurchase: null }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-06-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('no_purchase_date');
    });

    // TC-ASE-06: Server time unavailable
    it('TC-ASE-06: sets disableReason=server_time_unavailable when server time returns null', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'in-warranty' }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(null);

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('server_time_unavailable');
    });

    // TC-ASE-07: Warranty expired
    it('TC-ASE-07: sets disableReason=warranty_expired when current time is past warrantyMonths', async () => {
      // Device: 24 month warranty, no extension, purchased Jan 2020 → expired by Mar 2022
      const purchaseDate = new Date('2020-01-15');
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2022-05-01')); // 28 months after purchase

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('warranty_expired');
    });

    // TC-ASE-08: Missed annual service (past window without service)
    it('TC-ASE-08: sets disableReason=missed_annual_service when past window without service', async () => {
      // Device: 24 month warranty, window months 10-14 of year 1
      // Purchase: Jan 2023 → first window: month 10-14 = Nov2023-Mar2024
      // Now: Apr 2024 → past window end (month 15), no service done
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      // month 15 from Jan 2023 = Apr 2024
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-04-01'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('missed_annual_service');
    });

    // TC-ASE-09: Already serviced this year
    it('TC-ASE-09: sets disableReason=already_serviced when annual service already done in window', async () => {
      // Purchase: Jan 2023, window months 10-14, now within window (month 12 = Jan 2024)
      const purchaseDate = new Date('2023-01-01');
      const serviceDate = new Date('2023-12-15'); // month 11 from purchase → within window 10-14
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        makeIntervention(InterventionType.ANNUAL_SERVICE, serviceDate),
      ]);
      // Now month 12 from purchase = Jan 2024 (still within 10-14 window)
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('already_serviced');
    });

    // TC-ASE-10: Outside window (too early)
    it('TC-ASE-10: sets disableReason=outside_window when not yet reached first window', async () => {
      // Purchase: Jan 2023, window months 10-14, now month 5 = Jun 2023 (before window)
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-06-01')); // month 5

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('outside_window');
    });

    // TC-ASE-11: Eligible — in window, not yet serviced
    it('TC-ASE-11: isEligible=true and disableReason=null when in window with no prior service', async () => {
      // Purchase: Jan 2023, window months 10-14, now month 12 = Jan 2024 (in window)
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15')); // month 12

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeTrue();
      expect(service.disableReason).toBeNull();
    });

    // TC-ASE-12: isChecking transitions correctly
    it('TC-ASE-12: sets isChecking=true during check and false after completion', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      let isCheckingDuringExecution = false;

      // Intercept getRegistration to capture isChecking mid-flight
      mockInterventionService.getRegistration.and.callFake(async () => {
        isCheckingDuringExecution = service.isChecking;
        return buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        });
      });
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(isCheckingDuringExecution).toBeTrue();
      expect(service.isChecking).toBeFalse();
    });

    // TC-ASE-13: Commissioning required but not done
    it('TC-ASE-13: sets disableReason=no_commissioning when commissioning required but not done', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
        commissioning: true,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'in-warranty' }),
      );
      // No commissioning intervention
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('no_commissioning');
    });

    // TC-ASE-14: Commissioning done — proceeds to eligibility check
    it('TC-ASE-14: does NOT set no_commissioning when commissioning intervention exists', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
        commissioning: true,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      // Commissioning done, no annual service yet
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        makeIntervention(InterventionType.COMMISSIONING, new Date('2023-02-01')),
      ]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15')); // month 12

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).not.toBe('no_commissioning');
    });

    // TC-ASE-15: clear() resets all state
    it('TC-ASE-15: clear() resets isEligible, isChecking, disableReason', async () => {
      service.isEligible = true;
      service.isChecking = true;
      service.disableReason = 'warranty_expired';

      service.clear();

      expect(service.isEligible).toBeFalse();
      expect(service.isChecking).toBeFalse();
      expect(service.disableReason).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // determineEligibility() — algorithm details
  // ══════════════════════════════════════════════════════════════════════════════

  describe('determineEligibility()', () => {

    function makeParams(overrides: Partial<ServiceWindowParams> = {}): ServiceWindowParams {
      return {
        firstServiceYear: 1,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 24,
        ...overrides,
      };
    }

    // TC-ASE-16: Warranty period calculation with extendedWarranty
    it('TC-ASE-16: uses effectiveWarranty = warrantyMonths + extendedWarrantyMonths', () => {
      const params = makeParams({ warrantyMonths: 24 });
      const purchaseDate = new Date('2023-01-01');
      // Month 26 from purchase — past 24-month base warranty but within 24+6=30 extended
      const now = new Date('2025-03-01'); // 26 months
      const result = service.determineEligibility(params, purchaseDate, now, [], 6);

      // Should NOT be warranty_expired because effectiveWarranty = 30
      expect(result.reason).not.toBe('warranty_expired');
    });

    // TC-ASE-17: Base warranty (no extension) — expired
    it('TC-ASE-17: returns warranty_expired when elapsed > warrantyMonths with no extension', () => {
      const params = makeParams({ warrantyMonths: 24 });
      const purchaseDate = new Date('2023-01-01');
      const now = new Date('2025-03-01'); // 26 months elapsed
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('warranty_expired');
    });

    // TC-ASE-18: Service window start month calculation (year 1)
    it('TC-ASE-18: correctly identifies window for firstServiceYear=1, start=10, end=14', () => {
      const params = makeParams({ firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14 });
      const purchaseDate = new Date('2023-01-01');
      // Month 12 = Jan 2024 → inside window 10-14
      const now = new Date('2024-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // TC-ASE-19: Service window for second year (firstServiceYear=1)
    it('TC-ASE-19: evaluates second service window correctly (year 2: months 22-26)', () => {
      // Year 1 window: 10-14 (had service done), Year 2 window: 22-26
      const params = makeParams({
        firstServiceYear: 1,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 36,
      });
      const purchaseDate = new Date('2023-01-01');
      // Service done in year-1 window (month 11)
      const serviceDoneDate = new Date('2023-12-01'); // month 11
      // Now in year-2 window (month 24 = Jan 2025)
      const now = new Date('2025-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [serviceDoneDate], 0);

      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // TC-ASE-20: firstServiceYear=2 — window starts at month 22
    it('TC-ASE-20: firstServiceYear=2 means first window starts at month (1*12+start)', () => {
      // firstServiceYear=2 → windowStart = (2-1)*12 + 10 = 22, windowEnd = (2-1)*12 + 14 = 26
      const params = makeParams({
        firstServiceYear: 2,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 36,
      });
      const purchaseDate = new Date('2023-01-01');
      // Month 24 from purchase = Jan 2025 → inside window 22-26
      const now = new Date('2025-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // TC-ASE-21: missed_annual_service for year 1 when year 2 is current
    it('TC-ASE-21: missed_annual_service when year-1 window passed without service and now in year-2 window', () => {
      const params = makeParams({
        firstServiceYear: 1,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 36,
      });
      const purchaseDate = new Date('2023-01-01');
      // No services done; now in month 24 (year-2 window) but year-1 missed
      const now = new Date('2025-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('missed_annual_service');
    });

    // TC-ASE-22: Extended warranty allows service in month 25+ normally expired
    it('TC-ASE-22: extended warranty extends eligible period beyond base warranty', () => {
      const params = makeParams({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14 });
      const purchaseDate = new Date('2023-01-01');
      // Month 24 = Jan 2025: at boundary of base 24-month warranty
      // But window 22-26 (year 2) is within extended warranty of 30
      const now = new Date('2025-01-01'); // month 24
      const result = service.determineEligibility(params, purchaseDate, now, [], 6);

      // effectiveWarranty = 30, elapsed = 24, not expired
      // year-1 window was 10-14 → month 24 > 14 (past) → check if year-1 had service → no → missed!
      expect(result.reason).toBe('missed_annual_service');
    });

    // TC-ASE-23: already_serviced returns correct reason
    it('TC-ASE-23: returns already_serviced when service date falls within current window', () => {
      const params = makeParams({ firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14 });
      const purchaseDate = new Date('2023-01-01');
      const serviceDate = new Date('2023-12-01'); // month 11
      const now = new Date('2024-02-01'); // month 13 (still in window 10-14)
      const result = service.determineEligibility(params, purchaseDate, now, [serviceDate], 0);

      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('already_serviced');
    });

    // TC-ASE-24: outside_window when before first window
    it('TC-ASE-24: returns outside_window when elapsed < windowStart', () => {
      const params = makeParams({ firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14 });
      const purchaseDate = new Date('2023-01-01');
      const now = new Date('2023-07-01'); // month 6 — before window start (10)
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('outside_window');
    });

    // TC-ASE-25: windowStart > effectiveWarranty breaks the loop → outside_window
    it('TC-ASE-25: returns outside_window when all service windows fall outside warranty period', () => {
      // warrantyMonths=12, window at months 15-20 → windowStart(15) > warrantyMonths(12) → break
      const params = makeParams({
        firstServiceYear: 1,
        serviceWindowStart: 15,
        serviceWindowEnd: 20,
        warrantyMonths: 12,
      });
      const purchaseDate = new Date('2023-01-01');
      const now = new Date('2023-10-01'); // month 9 — within warranty but before window
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('outside_window');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // extractParams() (tested indirectly via checkEligibility)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('extractParams() — via checkEligibility', () => {

    // TC-ASE-26: Returns null when serviceWindowStart is undefined
    it('TC-ASE-26: null when device.serviceWindowStart is undefined', async () => {
      const device = buildDevice({ serviceWindowStart: undefined });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-27: Returns null when serviceWindowEnd is undefined
    it('TC-ASE-27: null when device.serviceWindowEnd is undefined', async () => {
      const device = buildDevice({ serviceWindowEnd: undefined });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-28: Returns null when firstServiceYear is undefined
    it('TC-ASE-28: null when device.firstServiceYear is undefined', async () => {
      const device = buildDevice({ firstServiceYear: undefined });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-29: Returns null when warrantyMonths is undefined
    it('TC-ASE-29: null when device.warrantyMonths is undefined', async () => {
      const device = buildDevice({ warrantyMonths: undefined });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-30: Returns null when serviceWindowStart is NaN (e.g. non-numeric string coerced)
    it('TC-ASE-30: null when serviceWindowStart coerces to NaN', async () => {
      const device = buildDevice({ serviceWindowStart: NaN });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-31: Returns null when serviceWindowEnd is NaN
    it('TC-ASE-31: null when serviceWindowEnd coerces to NaN', async () => {
      const device = buildDevice({ serviceWindowEnd: NaN });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-32: Returns null when firstServiceYear < 1
    it('TC-ASE-32: null when firstServiceYear < 1', async () => {
      const device = buildDevice({ firstServiceYear: 0 });
      await service.checkEligibility(DEFAULT_SN, device);
      expect(service.disableReason).toBe('no_service_period_params');
    });

    // TC-ASE-33: Returns valid params when all fields present and valid
    it('TC-ASE-33: proceeds past extractParams when all fields are valid', async () => {
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      // Will fail at getRegistration, but that means extractParams returned non-null
      mockInterventionService.getRegistration.and.resolveTo(null);

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).toBe('no_warranty_document_field');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // toDate() — tested indirectly through purchase date handling
  // ══════════════════════════════════════════════════════════════════════════════

  describe('toDate() — private utility (tested via checkEligibility dateOfPurchase)', () => {

    // TC-ASE-34: Firestore timestamp object → Date
    it('TC-ASE-34: accepts Firestore timestamp { seconds, nanoseconds } as dateOfPurchase', async () => {
      const purchaseDate = new Date('2023-06-15');
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate), // { seconds, nanoseconds }
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      // Now is month 1 after purchase (July 2023 → before window 10-14) → outside_window, not no_purchase_date
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-07-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).not.toBe('no_purchase_date');
    });

    // TC-ASE-35: Date passthrough
    it('TC-ASE-35: accepts native Date object as dateOfPurchase', async () => {
      const purchaseDate = new Date('2023-06-15');
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: purchaseDate,
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-07-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).not.toBe('no_purchase_date');
    });

    // TC-ASE-36: ISO string → Date
    it('TC-ASE-36: accepts ISO string as dateOfPurchase', async () => {
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: '2023-06-15T00:00:00.000Z',
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-07-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).not.toBe('no_purchase_date');
    });

    // TC-ASE-37: null dateOfPurchase → no_purchase_date
    it('TC-ASE-37: null value leads to disableReason=no_purchase_date', async () => {
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: null,
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-07-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).toBe('no_purchase_date');
    });

    // SKIPPED: tested legacy invalid-string path. After strict Timestamp-only
    // migration, strings are not accepted; this scenario cannot occur.
    xit('TC-ASE-38: invalid date string leads to disableReason=no_purchase_date', async () => {
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: 'not-a-date',
          extendedWarrantyMonths: 0,
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2023-07-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).toBe('no_purchase_date');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // monthsDiff() — tested indirectly via determineEligibility
  // ══════════════════════════════════════════════════════════════════════════════

  describe('monthsDiff() — private utility (tested via determineEligibility)', () => {

    // TC-ASE-39: Same date → 0 months
    it('TC-ASE-39: 0 months diff for same date', () => {
      const date = new Date('2024-06-15');
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 0,
        serviceWindowEnd: 1,
        warrantyMonths: 24,
      };
      // elapsed = 0; window [0,1] → 0 >= 0 and 0 <= 1 → eligible
      const result = service.determineEligibility(params, date, date, [], 0);
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-40: One month later → 1 month diff
    it('TC-ASE-40: 1 month diff when to is one month after from', () => {
      const from = new Date('2024-01-15');
      const to = new Date('2024-02-15');
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 1,
        serviceWindowEnd: 2,
        warrantyMonths: 24,
      };
      // elapsed = 1; window [1,2] → 1 >= 1 → eligible (no service done)
      const result = service.determineEligibility(params, from, to, [], 0);
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-41: 12 months diff for exactly one year
    it('TC-ASE-41: 12 months diff for exactly one year apart', () => {
      const from = new Date('2023-03-01');
      const to = new Date('2024-03-01');
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 12,
        serviceWindowEnd: 13,
        warrantyMonths: 24,
      };
      // elapsed = 12; window [12,13] → 12 >= 12 → eligible
      const result = service.determineEligibility(params, from, to, [], 0);
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-42: Cross-year calculation (Nov to Feb = 3 months)
    it('TC-ASE-42: correctly calculates cross-year month diff (Nov → Feb = 3 months)', () => {
      const from = new Date('2023-11-01');
      const to = new Date('2024-02-01');
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 3,
        serviceWindowEnd: 4,
        warrantyMonths: 24,
      };
      // elapsed = 3; window [3,4] → 3 >= 3 → eligible
      const result = service.determineEligibility(params, from, to, [], 0);
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-43: Negative diff — to is before from → warranty_expired not triggered
    it('TC-ASE-43: negative monthsDiff when now is before purchase (returns outside_window or similar)', () => {
      const from = new Date('2024-06-01');
      const to = new Date('2023-01-01'); // before purchase
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 24,
      };
      // elapsed = -17; not > 24 (warranty), not > 14 (window end), not >= 10 (window start)
      // → outside_window
      const result = service.determineEligibility(params, from, to, [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('outside_window');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // hasServiceInWindow() — tested indirectly via determineEligibility
  // ══════════════════════════════════════════════════════════════════════════════

  describe('hasServiceInWindow() — private (tested via determineEligibility)', () => {

    // TC-ASE-44: Service date within window → already_serviced
    it('TC-ASE-44: returns already_serviced when service date is within window', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      const serviceDate = new Date('2023-11-01'); // month 10 — exactly at window start
      const now = new Date('2024-01-01'); // month 12 — in window
      const result = service.determineEligibility(params, purchaseDate, now, [serviceDate], 0);

      expect(result.reason).toBe('already_serviced');
    });

    // TC-ASE-45: Service date outside window → not counted as service
    it('TC-ASE-45: service date outside window is not counted (still eligible)', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      // Service done at month 5 (outside window 10-14)
      const serviceDate = new Date('2023-06-01'); // month 5
      const now = new Date('2024-01-01'); // month 12 — in window
      const result = service.determineEligibility(params, purchaseDate, now, [serviceDate], 0);

      // Month 5 service is outside window [10,14] → doesn't count → eligible
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-46: No interventions → false
    it('TC-ASE-46: empty serviceDates array means no service → eligible in window', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      const now = new Date('2024-01-01'); // month 12 in window
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-47: Only non-ANNUAL_SERVICE interventions filtered by checkEligibility
    it('TC-ASE-47: only ANNUAL_SERVICE interventions count for service dates', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );
      // Has COMMISSIONING and REPAIR but no ANNUAL_SERVICE
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        makeIntervention(InterventionType.COMMISSIONING, new Date('2023-03-01')),
        makeIntervention(InterventionType.INTERVENTION_REPAIR, new Date('2023-12-01')),
      ]);
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15')); // month 12

      await service.checkEligibility(DEFAULT_SN, device);

      // Non-annual interventions should not count → should be eligible
      expect(service.isEligible).toBeTrue();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Boundary tests — CRITICAL for production
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Boundary tests', () => {

    // TC-ASE-48: Date exactly at window start
    it('TC-ASE-48: eligible when current date is exactly at window start (boundary inclusive)', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      // Exactly month 10 from purchase = Nov 2023
      const now = new Date('2023-11-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // TC-ASE-49: Date exactly at window end
    it('TC-ASE-49: eligible when current date is exactly at window end (boundary inclusive)', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      // Month 14 = Mar 2024
      const now = new Date('2024-03-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // TC-ASE-50: Warranty expires exactly today (same month)
    it('TC-ASE-50: not warranty_expired when elapsed == warrantyMonths (boundary: <= not <)', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 22, serviceWindowEnd: 26, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      // Exactly month 24 elapsed = Jan 2025
      const now = new Date('2025-01-01');
      // elapsed(24) > effectiveWarranty(24) is false (> not >=)
      // monthsDiff is exactly 24; 24 > 24 is false → not expired
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      // Should not be warranty_expired; should be eligible (in window 22-26)
      expect(result.reason).not.toBe('warranty_expired');
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-51: Service done on last day (month) of window — already_serviced
    it('TC-ASE-51: already_serviced when service was performed at window end month', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      const purchaseDate = new Date('2023-01-01');
      const serviceDate = new Date('2024-03-15'); // month 14 — at window end
      const now = new Date('2024-03-20'); // still in month 14
      const result = service.determineEligibility(params, purchaseDate, now, [serviceDate], 0);

      expect(result.reason).toBe('already_serviced');
    });

    // TC-ASE-52: Leap year handling — Feb 29
    it('TC-ASE-52: correctly handles leap year purchase date (Feb 29)', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24,
      };
      // Leap year purchase: Feb 29, 2024
      const purchaseDate = new Date('2024-02-29');
      // Month 12 from Feb 29, 2024 = Feb 2025
      const now = new Date('2025-02-28');
      const result = service.determineEligibility(params, purchaseDate, now, [], 0);

      // monthsDiff: (2025-2024)*12 + (1-1) = 12 → inside window 10-14
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-53: Extended warranty pushing past base — eligible in extended period
    it('TC-ASE-53: eligible in extended warranty period that would otherwise be expired', () => {
      // Base 12-month warranty, +12 extension = 24 total
      // Window at months 22-26 (year 2 of extended)
      const params: ServiceWindowParams = {
        firstServiceYear: 2,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        warrantyMonths: 12,
      };
      const purchaseDate = new Date('2023-01-01');
      // Month 24 — past base 12 warranty but within 12+12=24 extended
      const now = new Date('2025-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [], 12);

      // effectiveWarranty = 24, elapsed = 24, 24 > 24 is false
      // first window (year 2): windowStart = (2-1)*12+10=22, windowEnd=26
      // elapsed(24) not > 26, elapsed(24) >= 22 → eligible
      expect(result.eligible).toBeTrue();
    });

    // TC-ASE-54: warrantyStatus = 'out-of-warranty' → not_in_warranty
    it('TC-ASE-54: not_in_warranty for out_of_warranty status string', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'out-of-warranty' }),
      );

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).toBe('not_in_warranty');
    });

    // TC-ASE-55: extendedWarrantyMonths as string that coerces to number
    it('TC-ASE-55: handles extendedWarrantyMonths as numeric string (coerced via Number())', async () => {
      // Setup: firstServiceYear=2 so first window starts at month 22; no prior missed windows
      // extendedWarrantyMonths='6' as string → Number('6')=6 → effectiveWarranty=24+6=30
      // Elapsed = 24 months → in first window (22-26) → eligible
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 2, // first window: (2-1)*12+10=22 to (2-1)*12+14=26
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in-warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: '6', // string, should coerce to 6
        }),
      );
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      // Month 24 from Jan 2023 = Jan 2025 → inside window 22-26
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2025-01-01'));

      await service.checkEligibility(DEFAULT_SN, device);

      // With extended 6 months: effectiveWarranty = 30; elapsed = 24; not expired
      // firstServiceYear=2 → first window starts at month 22 → in window [22-26] → eligible
      expect(service.isEligible).toBeTrue();
    });

    // TC-ASE-56: extendedWarrantyMonths = 0 (falsy NaN fallback)
    it('TC-ASE-56: defaults extendedWarrantyMonths to 0 when field is undefined/null', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      const reg = buildRegistrationData({
        warrantyStatus: 'in-warranty',
        dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
      });
      delete reg['extendedWarrantyMonths'];
      mockInterventionService.getRegistration.and.resolveTo(reg);
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      // Month 12 → in window 10-14 → eligible
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15'));

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.isEligible).toBeTrue();
    });

    // TC-ASE-57: Exception thrown by getRegistration is caught gracefully
    it('TC-ASE-57: handles exception in getRegistration without crashing (isChecking=false after)', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.rejectWith(new Error('Firestore error'));

      await expectAsync(service.checkEligibility(DEFAULT_SN, device)).toBeResolved();
      expect(service.isChecking).toBeFalse();
      expect(service.isEligible).toBeFalse();
    });

    // TC-ASE-58: Exception thrown by getInterventionsBySn is caught gracefully
    it('TC-ASE-58: handles exception in getInterventionsBySn without crashing', async () => {
      const purchaseDate = new Date('2023-01-01');
      const device = buildDevice({
        warrantyMonths: 24,
        serviceWindowStart: 10,
        serviceWindowEnd: 14,
        firstServiceYear: 1,
      });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: 'in-warranty' }),
      );
      mockInterventionService.getInterventionsBySn.and.rejectWith(new Error('Network error'));
      mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15'));

      await expectAsync(service.checkEligibility(DEFAULT_SN, device)).toBeResolved();
      expect(service.isChecking).toBeFalse();
    });

    // TC-ASE-59: Multiple annual services — first in window triggers already_serviced
    it('TC-ASE-59: already_serviced when multiple annual services exist and one is in current window', () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 36,
      };
      const purchaseDate = new Date('2023-01-01');
      // Year 1 service at month 11
      const service1 = new Date('2023-12-01');
      // Year 2 service at month 23 → in year-2 window [22, 26]
      const service2 = new Date('2024-12-01');
      // Now at month 24 — in year-2 window and service done
      const now = new Date('2025-01-01');
      const result = service.determineEligibility(params, purchaseDate, now, [service1, service2], 0);

      expect(result.reason).toBe('already_serviced');
    });

    // TC-ASE-60: warrantyStatus null → no_warranty_document_field
    it('TC-ASE-60: no_warranty_document_field when warrantyStatus is explicitly null', async () => {
      const device = buildDevice();
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: null }),
      );

      await service.checkEligibility(DEFAULT_SN, device);

      expect(service.disableReason).toBe('no_warranty_document_field');
    });
  });
});
