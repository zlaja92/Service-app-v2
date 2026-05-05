/**
 * DeviceRegistrationService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - getPurchaseDateFormatted() with various date types
 *   - getPurchaseDateFormatted() with boundary dates
 *   - getWarrantyEndDateFormatted() with various warrantyMonths
 *   - getWarrantyEndDateFormatted() with extendedWarrantyMonths
 *   - register() formData field variations
 *   - registerBatch() size matrix
 *   - toDate() input type matrix via getPurchaseDateFormatted
 */

import { TestBed } from '@angular/core/testing';
import { DeviceRegistrationService } from './device-registration.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { DeviceType } from '../../../shared/models/device.model';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockServerTimeService(): jasmine.SpyObj<ServerTimeService> {
  const mock = jasmine.createSpyObj<ServerTimeService>('ServerTimeService', ['getServerTime']);
  mock.getServerTime.and.resolveTo(new Date('2024-06-15T12:00:00.000Z'));
  return mock;
}

// ─── Setup factory ────────────────────────────────────────────────────────────

function createTestBedSetup() {
  const mockFirestore = createMockFirestoreService();
  const mockAuthStore = createMockAuthStore();
  const mockServerTime = createMockServerTimeService();
  const mockLogger = createMockLoggerService();

  mockAuthStore.setUser(buildAuthUser({ uid: 'user-test-uid-001', email: 'servicer@example.com' }));

  TestBed.configureTestingModule({
    providers: [
      DeviceRegistrationService,
      { provide: FirestoreService, useValue: mockFirestore },
      { provide: AuthStore, useValue: mockAuthStore },
      { provide: ServerTimeService, useValue: mockServerTime },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  return {
    service: TestBed.inject(DeviceRegistrationService),
    mockFirestore,
    mockAuthStore,
    mockServerTime,
    mockLogger,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: getPurchaseDateFormatted() — date type matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getPurchaseDateFormatted date types', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  interface DateTypeCase {
    label: string;
    dateOfPurchase: unknown;
    expectedResult?: string | null;
    matchPattern?: RegExp;
    skip?: boolean;
  }

  const validDateCases: DateTypeCase[] = [
    // Legacy types — kept for documentation, skipped after strict Timestamp-only migration
    { label: 'Date object 2023-06-15', dateOfPurchase: new Date('2023-06-15'), expectedResult: '15.06.2023', skip: true },
    { label: 'Date object 2024-12-31', dateOfPurchase: new Date('2024-12-31'), expectedResult: '31.12.2024', skip: true },
    { label: 'Date object 2020-01-01', dateOfPurchase: new Date('2020-01-01'), expectedResult: '01.01.2020', skip: true },
    { label: 'Date object 2000-02-29 (leap year)', dateOfPurchase: new Date('2000-02-29'), expectedResult: '29.02.2000', skip: true },
    { label: 'Firestore raw {seconds} POJO 2024-03-10', dateOfPurchase: { seconds: 1710028800, nanoseconds: 0 }, expectedResult: '10.03.2024', skip: true },
    { label: 'ISO string 2023-06-15T00:00:00.000Z', dateOfPurchase: '2023-06-15T00:00:00.000Z', expectedResult: null, matchPattern: /^\d{2}\.\d{2}\.\d{4}$/, skip: true },
    // Current contract — Timestamp instance
    { label: 'Firestore Timestamp from builder 2023-06-15', dateOfPurchase: buildFirestoreTimestamp(new Date('2023-06-15')), expectedResult: '15.06.2023' },
  ];

  validDateCases.forEach(({ label, dateOfPurchase, expectedResult, matchPattern, skip }) => {
    const itFn = skip ? xit : it;
    itFn(`DATE-TYPE: ${label} → ${expectedResult ?? 'matches dd.MM.yyyy'}`, () => {
      service.userData = { dateOfPurchase };
      const result = service.getPurchaseDateFormatted();
      if (matchPattern) {
        expect(result).toMatch(matchPattern);
      } else if (expectedResult !== undefined) {
        expect(result).toBe(expectedResult);
      }
    });
  });

  // Invalid runtime types — SKIPPED after strict Timestamp-only migration. Util
  // throws TypeError for unexpected types rather than silently returning null;
  // these scenarios cannot occur with Firestore-sourced data (kept for record).
  const invalidDateCases: Array<{ label: string; dateOfPurchase: unknown }> = [
    { label: 'null', dateOfPurchase: null },
    { label: 'undefined', dateOfPurchase: undefined },
    { label: 'empty string', dateOfPurchase: '' },
    { label: 'invalid string "not-a-date"', dateOfPurchase: 'not-a-date' },
    { label: 'invalid string "2023-13-01"', dateOfPurchase: '2023-13-01' },
    { label: 'number 0', dateOfPurchase: 0 },
    { label: 'boolean false', dateOfPurchase: false },
    { label: 'object without seconds', dateOfPurchase: { year: 2023, month: 6 } },
  ];

  invalidDateCases.forEach(({ label, dateOfPurchase }) => {
    // null/undefined still return null and remain valid contract; everything else is legacy
    const itFn = (dateOfPurchase === null || dateOfPurchase === undefined) ? it : xit;
    itFn(`DATE-TYPE-INVALID: ${label} → null`, () => {
      service.userData = { dateOfPurchase };
      const result = service.getPurchaseDateFormatted();
      expect(result).toBeNull();
    });
  });

  it('DATE-TYPE: userData is null → null', () => {
    service.userData = null;
    const result = service.getPurchaseDateFormatted();
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: getPurchaseDateFormatted() — boundary dates
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getPurchaseDateFormatted boundary dates', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const boundaryDateCases = [
    { label: 'first day of year', date: new Date('2023-01-01'), expected: '01.01.2023' },
    { label: 'last day of year', date: new Date('2023-12-31'), expected: '31.12.2023' },
    { label: 'Feb 28 non-leap', date: new Date('2023-02-28'), expected: '28.02.2023' },
    { label: 'Feb 29 leap year 2024', date: new Date('2024-02-29'), expected: '29.02.2024' },
    { label: 'Feb 29 leap year 2000', date: new Date('2000-02-29'), expected: '29.02.2000' },
    { label: 'Mar 1 after leap day', date: new Date('2024-03-01'), expected: '01.03.2024' },
    { label: 'Year 2000', date: new Date('2000-01-01'), expected: '01.01.2000' },
    { label: 'Year 2099', date: new Date('2099-12-31'), expected: '31.12.2099' },
    { label: 'End of month 30-day month', date: new Date('2023-04-30'), expected: '30.04.2023' },
    { label: 'End of month 31-day month', date: new Date('2023-07-31'), expected: '31.07.2023' },
    { label: 'Single-digit day/month', date: new Date('2023-01-05'), expected: '05.01.2023' },
    { label: 'Double-digit day/month', date: new Date('2023-11-15'), expected: '15.11.2023' },
  ];

  boundaryDateCases.forEach(({ label, date, expected }) => {
    it(`BOUNDARY-DATE: ${label} → "${expected}"`, () => {
      service.userData = { dateOfPurchase: buildFirestoreTimestamp(date) };
      const result = service.getPurchaseDateFormatted();
      expect(result).toBe(expected);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: getWarrantyEndDateFormatted() — warrantyMonths variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getWarrantyEndDateFormatted warrantyMonths', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const purchaseDate = buildFirestoreTimestamp(new Date('2023-01-01'));

  const warrantyMonthsCases = [
    { wm: 1, expected: '01.02.2023' },
    { wm: 6, expected: '01.07.2023' },
    { wm: 12, expected: '01.01.2024' },
    { wm: 18, expected: '01.07.2024' },
    { wm: 24, expected: '01.01.2025' },
    { wm: 36, expected: '01.01.2026' },
    { wm: 48, expected: '01.01.2027' },
    { wm: 60, expected: '01.01.2028' },
    { wm: 120, expected: '01.01.2033' },
  ];

  warrantyMonthsCases.forEach(({ wm, expected }) => {
    it(`WARRANTY-END: purchaseDate=2023-01-01 + ${wm}months = "${expected}"`, () => {
      service.userData = { dateOfPurchase: purchaseDate };
      const device = buildDevice({ warrantyMonths: wm });
      const result = service.getWarrantyEndDateFormatted(device);
      expect(result).toBe(expected);
    });
  });

  // warrantyMonths=0 is falsy; the guard `!device.warrantyMonths` returns null early
  it('WARRANTY-END: warrantyMonths=0 → null (falsy guard in service)', () => {
    service.userData = { dateOfPurchase: purchaseDate };
    const device = buildDevice({ warrantyMonths: 0 });
    const result = service.getWarrantyEndDateFormatted(device);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: getWarrantyEndDateFormatted() — extendedWarrantyMonths variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getWarrantyEndDateFormatted extendedWarranty', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const purchaseDate = buildFirestoreTimestamp(new Date('2023-01-01'));

  // Base warranty 24 months (end: 2025-01-01) + various extensions
  const extendedCases = [
    { ext: 0, expected: '01.01.2025' },   // 24+0=24 months
    { ext: 6, expected: '01.07.2025' },   // 24+6=30 months
    { ext: 12, expected: '01.01.2026' },  // 24+12=36 months
    { ext: 24, expected: '01.01.2027' },  // 24+24=48 months
    { ext: 36, expected: '01.01.2028' },  // 24+36=60 months
  ];

  extendedCases.forEach(({ ext, expected }) => {
    it(`EXT-WARRANTY-END: base=24 + ext=${ext} → "${expected}"`, () => {
      service.userData = {
        dateOfPurchase: purchaseDate,
        extendedWarrantyMonths: ext,
      };
      const device = buildDevice({ warrantyMonths: 24 });
      const result = service.getWarrantyEndDateFormatted(device);
      expect(result).toBe(expected);
    });
  });

  // No extended warranty field in userData
  it('EXT-WARRANTY-END: no extendedWarrantyMonths field → uses only base warranty', () => {
    service.userData = { dateOfPurchase: purchaseDate };
    const device = buildDevice({ warrantyMonths: 24 });
    const result = service.getWarrantyEndDateFormatted(device);
    expect(result).toBe('01.01.2025');
  });

  // extendedWarrantyMonths=null
  it('EXT-WARRANTY-END: extendedWarrantyMonths=null → uses only base warranty', () => {
    service.userData = {
      dateOfPurchase: purchaseDate,
      extendedWarrantyMonths: null,
    };
    const device = buildDevice({ warrantyMonths: 24 });
    const result = service.getWarrantyEndDateFormatted(device);
    expect(result).toBe('01.01.2025');
  });

  // extendedWarrantyMonths as string (coercion test)
  it('EXT-WARRANTY-END: extendedWarrantyMonths="12" string → coerced and added to base', () => {
    service.userData = {
      dateOfPurchase: purchaseDate,
      extendedWarrantyMonths: '12',
    };
    const device = buildDevice({ warrantyMonths: 24 });
    const result = service.getWarrantyEndDateFormatted(device);
    // 24+12=36 months → 2026-01-01
    expect(result).toBe('01.01.2026');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: getWarrantyEndDateFormatted() — null/missing conditions
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getWarrantyEndDateFormatted null cases', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const purchaseDate = buildFirestoreTimestamp(new Date('2023-01-01'));

  it('NULL-CASE: warrantyMonths undefined on device → null', () => {
    service.userData = { dateOfPurchase: purchaseDate };
    const device = buildDevice({ warrantyMonths: undefined });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });

  it('NULL-CASE: warrantyMonths null on device → null', () => {
    service.userData = { dateOfPurchase: purchaseDate };
    const device = buildDevice({ warrantyMonths: null as unknown as undefined });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });

  it('NULL-CASE: userData is null → null', () => {
    service.userData = null;
    const device = buildDevice({ warrantyMonths: 24 });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });

  it('NULL-CASE: userData has no dateOfPurchase key → null', () => {
    service.userData = {};
    const device = buildDevice({ warrantyMonths: 24 });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });

  it('NULL-CASE: dateOfPurchase is null → null', () => {
    service.userData = { dateOfPurchase: null };
    const device = buildDevice({ warrantyMonths: 24 });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });

  // SKIPPED: tested legacy invalid-string path. Strict Timestamp-only contract.
  xit('NULL-CASE: invalid date string for dateOfPurchase → null', () => {
    service.userData = { dateOfPurchase: 'not-a-valid-date' };
    const device = buildDevice({ warrantyMonths: 24 });
    expect(service.getWarrantyEndDateFormatted(device)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: register() — formData field matrix (dynamic field variations)
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: register() dynamic field matrix', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestore } = createTestBedSetup());
  });

  const dynamicFieldCases = [
    { label: 'empty fields', fields: {} },
    { label: 'basic name fields', fields: { firstName: 'Marko', lastName: 'Markovic' } },
    { label: 'address fields', fields: { streetName: 'Ulica BB', homeNumber: '5', city: 'Beograd', postalCode: '11000' } },
    { label: 'phone field', fields: { phone: '+381601234567' } },
    { label: 'Cyrillic name fields', fields: { firstName: 'Никола', lastName: 'Николић', city: 'Београд' } },
    { label: 'with special chars', fields: { firstName: "O'Brien", lastName: 'Smith-Jones' } },
    { label: 'all common fields', fields: { firstName: 'Ana', lastName: 'Anic', city: 'Novi Sad', phone: '+381', installerName: 'Petar Peric' } },
    { label: 'empty string values', fields: { firstName: '', lastName: '', note: '' } },
    { label: 'boolean values', fields: { callAccepted: true, voidWarranty: false } },
    { label: 'numeric values', fields: { warrantyExtension: 12 } },
  ];

  dynamicFieldCases.forEach(({ label, fields }) => {
    it(`DYNAMIC-FIELDS: ${label} → register succeeds and returns true`, async () => {
      const device = buildDevice();
      const result = await service.register('SN-FIELDS-TEST', device, fields);
      expect(result).toBeTrue();
      expect(mockFirestore.setTenantDocument).toHaveBeenCalled();
    });
  });

  // Verify that dynamic fields are merged into the written document
  it('DYNAMIC-FIELDS: dynamic fields are included in written document', async () => {
    const device = buildDevice();
    const fields = { firstName: 'TestName', city: 'TestCity', customField: 'customValue' };
    await service.register('SN-VERIFY', device, fields);

    const callArgs = mockFirestore.setTenantDocument.calls.mostRecent().args;
    const writtenData = callArgs[2] as Record<string, unknown>;
    expect(writtenData['firstName']).toBe('TestName');
    expect(writtenData['city']).toBe('TestCity');
    expect(writtenData['customField']).toBe('customValue');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: register() — DeviceType variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: register() device type variations', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestore } = createTestBedSetup());
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
    DeviceType.BOILER,
  ];

  allDeviceTypes.forEach(deviceType => {
    it(`DEVICE-TYPE-REG: ${deviceType} → register succeeds`, async () => {
      const device = buildDevice({ type: deviceType });
      const result = await service.register(`SN-${deviceType}-001`, device, {});
      expect(result).toBeTrue();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: registerBatch() — size matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: registerBatch() size matrix', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockLogger } = createTestBedSetup());
  });

  [1, 2, 3, 5, 10, 20].forEach(size => {
    it(`BATCH-SIZE: ${size} entries → writeBatch called with ${size} ops`, async () => {
      const entries = Array.from({ length: size }, (_, i) => ({
        sn: `SN-BATCH-${i}`,
        device: buildDevice(),
        dynamicFields: { firstName: `User${i}` },
      }));

      const result = await service.registerBatch(entries);

      expect(result).toBeTrue();
      const batchOps = mockFirestore.writeBatch.calls.mostRecent().args[0];
      expect(batchOps.length).toBe(size);
    });
  });

  it('BATCH-SIZE: logs correct count on success', async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      sn: `SN-LOG-${i}`,
      device: buildDevice(),
      dynamicFields: {},
    }));

    await service.registerBatch(entries);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Batch registration saved',
      jasmine.objectContaining({ count: 5 }),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: checkRegistration() — SN variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: checkRegistration SN variations', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestore } = createTestBedSetup());
  });

  const snCases = [
    'SN-SIMPLE-001',
    'VERY-LONG-SERIAL-NUMBER-1234567890-ABCDEFGHIJ',
    '12345678901234567890',
    'SN WITH SPACES',
    'SN_UNDERSCORES',
    'sn-lowercase-001',
    'SN.WITH.DOTS',
    'Никола12345', // Cyrillic
    'SN001',
    'A', // single char
  ];

  snCases.forEach(sn => {
    it(`CHECK-REG-SN: SN="${sn}" → getTenantDocument called with 'users' and correct SN`, async () => {
      mockFirestore.getTenantDocument.and.resolveTo(null);

      await service.checkRegistration(sn);

      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('users', sn);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: checkRegistration() — response variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: checkRegistration response matrix', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestore } = createTestBedSetup());
  });

  it('RESPONSE: full registration data → isRegistered=true with userData set', async () => {
    const regData = buildRegistrationData({ sn: 'SN-FULL-REG' });
    mockFirestore.getTenantDocument.and.resolveTo(regData);

    await service.checkRegistration('SN-FULL-REG');

    expect(service.isRegistered).toBeTrue();
    expect(service.userData).toEqual(regData);
  });

  it('RESPONSE: minimal registration (only sn) → isRegistered=true', async () => {
    mockFirestore.getTenantDocument.and.resolveTo({ sn: 'SN-MIN' });

    await service.checkRegistration('SN-MIN');

    expect(service.isRegistered).toBeTrue();
    expect(service.userData).toEqual({ sn: 'SN-MIN' });
  });

  it('RESPONSE: empty object as registration → isRegistered=true (any truthy doc counts)', async () => {
    mockFirestore.getTenantDocument.and.resolveTo({});

    await service.checkRegistration('SN-EMPTY');

    expect(service.isRegistered).toBeTrue();
  });

  it('RESPONSE: null → isRegistered=false', async () => {
    mockFirestore.getTenantDocument.and.resolveTo(null);

    await service.checkRegistration('SN-MISSING');

    expect(service.isRegistered).toBeFalse();
    expect(service.userData).toBeNull();
  });

  it('RESPONSE: isChecking=false after completion regardless of result', async () => {
    mockFirestore.getTenantDocument.and.resolveTo(null);
    await service.checkRegistration('SN-CHECK');
    expect(service.isChecking).toBeFalse();

    mockFirestore.getTenantDocument.and.resolveTo(buildRegistrationData());
    await service.checkRegistration('SN-CHECK-2');
    expect(service.isChecking).toBeFalse();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11: getPurchaseDateFormatted() — Firestore timestamp boundary values
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getPurchaseDateFormatted Firestore timestamp boundaries', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Test specific Firestore timestamps that are important boundary values
  const timestampCases = [
    { seconds: 0, desc: 'Unix epoch (1970-01-01)', expectedDate: new Date(0) },
    { seconds: 1672531200, desc: '2023-01-01 UTC', expectedDate: new Date('2023-01-01T00:00:00Z') },
    { seconds: 1703980800, desc: '2023-12-31 UTC', expectedDate: new Date('2023-12-31T00:00:00Z') },
    { seconds: 1710028800, desc: '2024-03-10 UTC', expectedDate: new Date('2024-03-10T00:00:00Z') },
    { seconds: 2147483647, desc: 'Max 32-bit int (2038-01-19)', expectedDate: new Date(2147483647 * 1000) },
  ];

  timestampCases.forEach(({ seconds, desc, expectedDate }) => {
    it(`FS-TIMESTAMP: ${desc} (seconds=${seconds}) → formatted correctly`, () => {
      service.userData = { dateOfPurchase: buildFirestoreTimestamp(expectedDate) };
      const result = service.getPurchaseDateFormatted();
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(result).not.toBeNull();
    });
  });

  // SKIPPED: tested raw {seconds} POJO. Strict Timestamp-only contract.
  xit('FS-TIMESTAMP: seconds only (no nanoseconds field) → formats correctly', () => {
    service.userData = { dateOfPurchase: { seconds: 1710028800 } };
    const result = service.getPurchaseDateFormatted();
    expect(result).toBe('10.03.2024');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12: addedBy variations in register()
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: register() addedBy from AuthStore', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockAuthStore: ReturnType<typeof createMockAuthStore>;

  beforeEach(() => {
    ({ service, mockFirestore, mockAuthStore } = createTestBedSetup());
  });

  const emailCases = [
    'servicer@example.com',
    'admin@company.org',
    'user+tag@subdomain.example.co.uk',
    '', // empty email (edge case)
  ];

  emailCases.forEach(email => {
    it(`ADDED-BY: email="${email}" → written to document as addedBy`, async () => {
      mockAuthStore.setUser(buildAuthUser({ email }));
      const device = buildDevice();

      await service.register('SN-EMAIL-TEST', device, {});

      const callArgs = mockFirestore.setTenantDocument.calls.mostRecent().args;
      const writtenData = callArgs[2] as Record<string, unknown>;
      expect(writtenData['addedBy']).toBe(email);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 13: getWarrantyEndDateFormatted() — purchase date type variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: getWarrantyEndDateFormatted purchase date types', () => {
  let service: DeviceRegistrationService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // SKIPPED: tested legacy Date-pass-through path (no longer accepted).
  xit('PURCHASE-DATE-TYPE: Date object → warranty end computed correctly', () => {
    service.userData = { dateOfPurchase: new Date('2023-01-01') };
    const device = buildDevice({ warrantyMonths: 12 });
    expect(service.getWarrantyEndDateFormatted(device)).toBe('01.01.2024');
  });

  it('PURCHASE-DATE-TYPE: Firestore timestamp → warranty end computed correctly', () => {
    service.userData = { dateOfPurchase: buildFirestoreTimestamp(new Date('2023-01-01')) };
    const device = buildDevice({ warrantyMonths: 24 });
    expect(service.getWarrantyEndDateFormatted(device)).toBe('01.01.2025');
  });

  // SKIPPED: tested legacy ISO-string path (no longer accepted).
  xit('PURCHASE-DATE-TYPE: ISO string → warranty end computed correctly', () => {
    service.userData = { dateOfPurchase: '2023-01-01T00:00:00.000Z' };
    const device = buildDevice({ warrantyMonths: 12 });
    const result = service.getWarrantyEndDateFormatted(device);
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 14: clear() — resets all state combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceRegistrationService — EXPANSION: clear() state combinations', () => {
  let service: DeviceRegistrationService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestore } = createTestBedSetup());
  });

  it('CLEAR: clear() on fresh service → idempotent, state is initial', () => {
    service.clear();
    expect(service.isRegistered).toBeNull();
    expect(service.isChecking).toBeFalse();
    expect(service.userData).toBeNull();
  });

  it('CLEAR: clear() after successful checkRegistration → resets isRegistered to null', async () => {
    mockFirestore.getTenantDocument.and.resolveTo(buildRegistrationData());
    await service.checkRegistration('SN-CLEAR-01');
    expect(service.isRegistered).toBeTrue();

    service.clear();
    expect(service.isRegistered).toBeNull();
    expect(service.userData).toBeNull();
  });

  it('CLEAR: clear() after failed checkRegistration (not found) → resets', async () => {
    mockFirestore.getTenantDocument.and.resolveTo(null);
    await service.checkRegistration('SN-NOTFOUND');
    expect(service.isRegistered).toBeFalse();

    service.clear();
    expect(service.isRegistered).toBeNull();
  });

  it('CLEAR: multiple clear() calls → idempotent', () => {
    service.clear();
    service.clear();
    service.clear();
    expect(service.isRegistered).toBeNull();
    expect(service.isChecking).toBeFalse();
    expect(service.userData).toBeNull();
  });

  it('CLEAR: checkRegistration works after clear()', async () => {
    mockFirestore.getTenantDocument.and.resolveTo(null);
    await service.checkRegistration('SN-FIRST');

    service.clear();
    mockFirestore.getTenantDocument.and.resolveTo(buildRegistrationData({ sn: 'SN-AFTER-CLEAR' }));
    await service.checkRegistration('SN-AFTER-CLEAR');

    expect(service.isRegistered).toBeTrue();
    expect(service.userData).not.toBeNull();
  });
});
