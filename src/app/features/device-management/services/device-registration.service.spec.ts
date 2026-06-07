/**
 * DeviceRegistrationService Unit Tests — WU-34, Batch B5
 *
 * MOCK STRATEGY
 * =============
 * - FirestoreService: createMockFirestoreService() — jasmine.SpyObj with all methods stubbed
 * - AuthStore: createMockAuthStore() — plain object with Angular signals (NGRx SignalStore)
 * - LoggerService: createMockLoggerService() — jasmine.SpyObj with all log-level methods stubbed
 *
 * NOTE: ServerTimeService was removed in the Timestamp migration. The service now
 * uses FieldValue.serverTimestamp() sentinel directly — no server time round-trip.
 *
 * The service uses inject() so dependencies are provided via TestBed.
 * AuthStore is a SignalStore (not a class with constructor injection), so we
 * provide it with useValue: createMockAuthStore().
 */

import { TestBed } from '@angular/core/testing';
import { DeviceRegistrationService } from './device-registration.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  createMockFirestoreService,
  createMockLoggerService,
  createMockAuthStore,
} from '../../../testing/mock-factories';
import {
  buildDevice,
  buildRegistrationData,
  buildFirestoreTimestamp,
  buildAuthUser,
} from '../../../testing/test-data-builders';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('DeviceRegistrationService', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockAuthStore: ReturnType<typeof createMockAuthStore>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockFirestore = createMockFirestoreService();
    mockAuthStore = createMockAuthStore();
    mockLogger = createMockLoggerService();

    // Set a default authenticated user in the auth store
    mockAuthStore.setUser(buildAuthUser({ uid: 'user-test-uid-001', email: 'servicer@example.com' }));

    TestBed.configureTestingModule({
      providers: [
        DeviceRegistrationService,
        { provide: FirestoreService, useValue: mockFirestore },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DeviceRegistrationService);
  });

  // =========================================================================
  // checkRegistration()
  // =========================================================================

  describe('checkRegistration()', () => {
    it('TC-REG-01: found existing registration → sets isRegistered true and stores userData', async () => {
      const regData = buildRegistrationData({ sn: 'SN-EXIST-001' });
      mockFirestore.getTenantDocument.and.resolveTo(regData);

      await service.checkRegistration('SN-EXIST-001');

      expect(service.isRegistered).toBeTrue();
      expect(service.userData).toEqual(regData);
      expect(service.isChecking).toBeFalse();
    });

    it('TC-REG-02: no registration found → sets isRegistered false and userData null', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(null);

      await service.checkRegistration('SN-MISSING-001');

      expect(service.isRegistered).toBeFalse();
      expect(service.userData).toBeNull();
      expect(service.isChecking).toBeFalse();
    });

    it('TC-REG-03: Firestore error → logs error and leaves isRegistered null', async () => {
      mockFirestore.getTenantDocument.and.rejectWith(new Error('firestore/unavailable'));

      await service.checkRegistration('SN-ERROR-001');

      expect(service.isRegistered).toBeNull();
      expect(service.userData).toBeNull();
      expect(service.isChecking).toBeFalse();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Registration check failed',
        jasmine.objectContaining({ sn: 'SN-ERROR-001' }),
      );
    });
  });

  // =========================================================================
  // register()
  // =========================================================================

  describe('register()', () => {
    it('TC-REG-04: successful registration → calls setTenantDocument and returns true', async () => {
      const device = buildDevice();
      const dynamicFields = { firstName: 'Marko', city: 'Beograd' };

      const result = await service.register('SN-OK-001', device, dynamicFields);

      expect(result).toBeTrue();
      expect(mockFirestore.setTenantDocument).toHaveBeenCalledOnceWith(
        'users',
        'SN-OK-001',
        jasmine.any(Object),
      );
      expect(service.isRegistered).toBeTrue();
    });

    it('TC-REG-05: Firestore setTenantDocument error → logs error and returns false', async () => {
      // After Timestamp migration, server time is no longer fetched separately.
      // FieldValue.serverTimestamp() is passed directly, so the only failure path
      // during write is a Firestore error.
      mockFirestore.setTenantDocument.and.rejectWith(new Error('firestore/unavailable'));
      const device = buildDevice();

      const result = await service.register('SN-NOTIME-001', device, {});

      expect(result).toBeFalse();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Device registration failed',
        jasmine.objectContaining({ sn: 'SN-NOTIME-001' }),
      );
    });

    it('TC-REG-06: Firestore error during set → logs error and returns false', async () => {
      mockFirestore.setTenantDocument.and.rejectWith(new Error('firestore/permission-denied'));
      const device = buildDevice();

      const result = await service.register('SN-FSERR-001', device, {});

      expect(result).toBeFalse();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Device registration failed',
        jasmine.objectContaining({ sn: 'SN-FSERR-001' }),
      );
    });

    it('TC-REG-07: includes addedBy from AuthStore.userEmail in written document', async () => {
      const device = buildDevice();

      await service.register('SN-ADDEDBY-001', device, {});

      const callArgs = mockFirestore.setTenantDocument.calls.mostRecent().args;
      const writtenData = callArgs[2] as Record<string, unknown>;
      expect(writtenData['addedBy']).toBe('servicer@example.com');
    });

    it('TC-REG-08: includes FieldValue.serverTimestamp() sentinel as addedDate in written document', async () => {
      // After Timestamp migration, register() uses FieldValue.serverTimestamp()
      // instead of fetching a Date from ServerTimeService.
      const device = buildDevice();

      await service.register('SN-TS-001', device, {});

      const callArgs = mockFirestore.setTenantDocument.calls.mostRecent().args;
      const writtenData = callArgs[2] as Record<string, unknown>;
      // FieldValue.serverTimestamp() returns a FieldValue sentinel object, not a Date.
      expect(writtenData['addedDate']).toBeDefined();
      expect(writtenData['addedDate']).not.toBeNull();
    });
  });

  // =========================================================================
  // registerBatch()
  // =========================================================================

  describe('registerBatch()', () => {
    it('TC-REG-09: atomic batch write of multiple registrations → calls writeBatch and returns true', async () => {
      const entries = [
        { sn: 'SN-BATCH-001', device: buildDevice(), dynamicFields: { firstName: 'Ana' } },
        { sn: 'SN-BATCH-002', device: buildDevice({ type: DeviceType.HEAT_PUMP }), dynamicFields: { firstName: 'Ivan' } },
      ];

      const result = await service.registerBatch(entries);

      expect(result).toBeTrue();
      expect(mockFirestore.writeBatch).toHaveBeenCalledTimes(1);
      const batchOps = mockFirestore.writeBatch.calls.mostRecent().args[0];
      expect(batchOps.length).toBe(2);
    });

    it('TC-REG-10: Firestore writeBatch error → rejects entire batch and returns false', async () => {
      // After Timestamp migration, server time is no longer fetched separately.
      // FieldValue.serverTimestamp() is used directly; the only failure path is
      // a Firestore error during the batch write itself.
      mockFirestore.writeBatch.and.rejectWith(new Error('firestore/unavailable'));
      const entries = [
        { sn: 'SN-NOTIME-B001', device: buildDevice(), dynamicFields: {} },
      ];

      const result = await service.registerBatch(entries);

      expect(result).toBeFalse();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Batch registration failed',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('TC-REG-11: Firestore error → returns false with error log', async () => {
      mockFirestore.writeBatch.and.rejectWith(new Error('firestore/aborted'));
      const entries = [
        { sn: 'SN-BATCHERR-001', device: buildDevice(), dynamicFields: {} },
      ];

      const result = await service.registerBatch(entries);

      expect(result).toBeFalse();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Batch registration failed',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('TC-REG-12: logs batch operation with entry count after success', async () => {
      const entries = [
        { sn: 'SN-LOG-B001', device: buildDevice(), dynamicFields: {} },
        { sn: 'SN-LOG-B002', device: buildDevice(), dynamicFields: {} },
      ];

      await service.registerBatch(entries);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Batch registration saved',
        jasmine.objectContaining({ count: 2 }),
      );
    });
  });

  // =========================================================================
  // getPurchaseDateFormatted()
  // =========================================================================

  describe('getPurchaseDateFormatted()', () => {
    // SKIPPED: tested legacy Date-pass-through path. After migration to strict
    // Timestamp-only contract, raw Date is no longer accepted from Firestore.
    xit('TC-REG-13: Date object in userData → returns formatted dd.MM.yyyy string', () => {
      service.userData = { dateOfPurchase: new Date('2023-06-15') };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBe('15.06.2023');
    });

    it('TC-REG-14: Firestore timestamp in userData → converts to date and formats', () => {
      const ts = buildFirestoreTimestamp(new Date('2023-06-15'));
      service.userData = { dateOfPurchase: ts };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBe('15.06.2023');
    });

    // SKIPPED: tested legacy ISO-string path. After strict Timestamp-only
    // migration, strings from Firestore are no longer expected.
    xit('TC-REG-15: ISO string in userData → parses and formats', () => {
      service.userData = { dateOfPurchase: '2023-06-15T00:00:00.000Z' };

      const result = service.getPurchaseDateFormatted();

      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('TC-REG-16: null dateOfPurchase → returns null', () => {
      service.userData = { dateOfPurchase: null };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBeNull();
    });

    it('TC-REG-17: userData is null (undefined dateOfPurchase) → returns null', () => {
      service.userData = null;

      const result = service.getPurchaseDateFormatted();

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getWarrantyEndDateFormatted()
  // =========================================================================

  describe('getWarrantyEndDateFormatted()', () => {
    it('TC-REG-18: with warrantyMonths and dateOfPurchase → adds months and returns formatted date', () => {
      service.userData = { dateOfPurchase: buildFirestoreTimestamp(new Date('2023-01-01')) };
      const device = buildDevice({ warrantyMonths: 24 });

      const result = service.getWarrantyEndDateFormatted(device);

      expect(result).toBe('01.01.2025');
    });

    it('TC-REG-19: with extendedWarrantyMonths → adds base + extended months to purchase date', () => {
      service.userData = {
        dateOfPurchase: buildFirestoreTimestamp(new Date('2023-01-01')),
        extendedWarrantyMonths: 12,
      };
      const device = buildDevice({ warrantyMonths: 24 });

      const result = service.getWarrantyEndDateFormatted(device);

      // 24 base + 12 extended = 36 months → 2026-01-01
      expect(result).toBe('01.01.2026');
    });

    it('TC-REG-20: no warrantyMonths on device → returns null', () => {
      service.userData = { dateOfPurchase: buildFirestoreTimestamp(new Date('2023-01-01')) };
      const device = buildDevice({ warrantyMonths: undefined });

      const result = service.getWarrantyEndDateFormatted(device);

      expect(result).toBeNull();
    });

    it('TC-REG-21: no dateOfPurchase in userData → returns null', () => {
      service.userData = {};
      const device = buildDevice({ warrantyMonths: 24 });

      const result = service.getWarrantyEndDateFormatted(device);

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // toDate() — tested indirectly through getPurchaseDateFormatted()
  // =========================================================================

  describe('toDate() via getPurchaseDateFormatted()', () => {
    // SKIPPED: tested legacy raw {seconds, nanoseconds} POJO coercion. After
    // strict Timestamp-only migration, raw POJOs are no longer accepted.
    xit('TC-REG-22: Firestore timestamp object (seconds field) converts to correct Date', () => {
      const ts = { seconds: 1710028800, nanoseconds: 0 };
      service.userData = { dateOfPurchase: ts };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBe('10.03.2024');
    });

    // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract
    // no longer accepts raw Date instances from Firestore reads.
    xit('TC-REG-23: Date object passes through without conversion', () => {
      const d = new Date('2024-05-20');
      service.userData = { dateOfPurchase: d };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBe('20.05.2024');
    });

    // SKIPPED: tested legacy string parsing. Strings are no longer expected.
    xit('TC-REG-24: invalid string → toDate returns null → getPurchaseDateFormatted returns null', () => {
      service.userData = { dateOfPurchase: 'not-a-date' };

      const result = service.getPurchaseDateFormatted();

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // clear()
  // =========================================================================

  describe('clear()', () => {
    it('TC-REG-25: resets isRegistered, isChecking, and userData to initial state', async () => {
      // First put service in a non-initial state
      mockFirestore.getTenantDocument.and.resolveTo(buildRegistrationData());
      await service.checkRegistration('SN-CLEAR-001');

      expect(service.isRegistered).toBeTrue();
      expect(service.userData).not.toBeNull();

      service.clear();

      expect(service.isRegistered).toBeNull();
      expect(service.isChecking).toBeFalse();
      expect(service.userData).toBeNull();
    });
  });

  // =========================================================================
  // Edge cases / Bonus
  // =========================================================================

  describe('Edge cases', () => {
    it('TC-REG-26: concurrent register calls → each writes independently with serverTimestamp sentinel', async () => {
      // After Timestamp migration, FieldValue.serverTimestamp() is used directly —
      // no server time round-trip. Concurrent calls are safe since each builds its
      // own data object and calls setTenantDocument independently.
      const device = buildDevice();
      const [result1, result2] = await Promise.all([
        service.register('SN-CONC-001', device, {}),
        service.register('SN-CONC-002', device, {}),
      ]);

      expect(result1).toBeTrue();
      expect(result2).toBeTrue();
      expect(mockFirestore.setTenantDocument).toHaveBeenCalledTimes(2);
    });

    it('TC-REG-27: Cyrillic characters in dynamicFields pass through unchanged', async () => {
      const device = buildDevice();
      const dynamicFields = {
        firstName: 'Никола',
        lastName: 'Николић',
        city: 'Београд',
      };

      await service.register('SN-CYR-001', device, dynamicFields);

      const callArgs = mockFirestore.setTenantDocument.calls.mostRecent().args;
      const writtenData = callArgs[2] as Record<string, unknown>;
      expect(writtenData['firstName']).toBe('Никола');
      expect(writtenData['lastName']).toBe('Николић');
      expect(writtenData['city']).toBe('Београд');
    });
  });
});
