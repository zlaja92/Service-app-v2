/**
 * DeviceLookupService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - extractModelCode: snModelStart × snModelLength matrix
 *   - SN variations (special chars, empty, single char, max length)
 *   - lookup() with various model code extractions
 *   - mapToDevice field variations
 */

import { TestBed } from '@angular/core/testing';
import { DeviceLookupService } from './device-lookup.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { DeviceType } from '../../../shared/models/device.model';
import { AppConfig, getDefaultConfig } from '../../../core/config/config.model';
import {
  createMockFirestoreService,
  createMockLoggerService,
  createMockTenantService,
  createMockConfigStore,
  MockConfigStore,
} from '../../../testing/mock-factories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDeviceDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'Device code': 'GENUS24',
    'Device Name': 'Genus One 24',
    'Device type': DeviceType.GAS_BOILER,
    commissioning: false,
    annualService: true,
    connectedDevice: false,
    firstServiceYear: 1,
    serviceWindowStart: 10,
    serviceWindowEnd: 14,
    warrantyMonths: 24,
    ...overrides,
  };
}

function buildAppConfig(snModelStart: number, snModelLength: number): AppConfig {
  const cfg = getDefaultConfig();
  cfg.business.snModelStart = snModelStart;
  cfg.business.snModelLength = snModelLength;
  return cfg;
}

// ─── Setup factory ────────────────────────────────────────────────────────────

function createTestBedSetup() {
  const mockFirestore = createMockFirestoreService();
  const mockConfigStore = createMockConfigStore();
  const mockTenantService = createMockTenantService();
  const mockLogger = createMockLoggerService();

  mockConfigStore.setConfig(buildAppConfig(0, 7));

  TestBed.configureTestingModule({
    providers: [
      DeviceLookupService,
      { provide: FirestoreService, useValue: mockFirestore },
      { provide: ConfigStore, useValue: mockConfigStore },
      { provide: TenantService, useValue: mockTenantService },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  return {
    service: TestBed.inject(DeviceLookupService),
    mockFirestore,
    mockConfigStore,
    mockTenantService,
    mockLogger,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: extractModelCode() — snModelStart × snModelLength matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: extractModelCode snModelStart×snModelLength matrix', () => {
  let service: DeviceLookupService;
  let mockConfigStore: MockConfigStore;

  beforeEach(() => {
    ({ service, mockConfigStore } = createTestBedSetup());
  });

  // Matrix: start ∈ [0,1,2,3,5,7,10], length ∈ [1,2,3,5,7,10,15]
  const starts = [0, 1, 2, 3, 5, 7, 10];
  const lengths = [1, 2, 3, 5, 7, 10, 15];
  const testSN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 26 chars

  starts.forEach(start => {
    lengths.forEach(length => {
      it(`EXTRACT-MATRIX: start=${start} length=${length} on 26-char SN`, () => {
        mockConfigStore.setConfig(buildAppConfig(start, length));
        const result = service.extractModelCode(testSN);
        const expected = testSN.substring(start, start + length);
        expect(result).toBe(expected);
      });
    });
  });

  // When start >= SN length, result should be empty string
  const shortSN = 'ABC'; // 3 chars
  [3, 4, 5, 10, 20].forEach(start => {
    it(`EXTRACT-MATRIX: start=${start} >= SN length (3) → empty string`, () => {
      mockConfigStore.setConfig(buildAppConfig(start, 5));
      const result = service.extractModelCode(shortSN);
      expect(result).toBe('');
    });
  });

  // When length extends past SN end, result is truncated
  [0, 1, 2].forEach(start => {
    it(`EXTRACT-MATRIX: start=${start}, length=100 on 26-char SN → truncated at end`, () => {
      mockConfigStore.setConfig(buildAppConfig(start, 100));
      const result = service.extractModelCode(testSN);
      expect(result).toBe(testSN.substring(start));
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: extractModelCode() — SN character variation boundary cases
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: extractModelCode SN character variations', () => {
  let service: DeviceLookupService;
  let mockConfigStore: MockConfigStore;

  beforeEach(() => {
    ({ service, mockConfigStore } = createTestBedSetup());
  });

  // Standard config: start=0, length=7
  beforeEach(() => {
    mockConfigStore.setConfig(buildAppConfig(0, 7));
  });

  it('SN-CHARS: empty SN → empty string', () => {
    expect(service.extractModelCode('')).toBe('');
  });

  it('SN-CHARS: single character SN, length=1', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 1));
    expect(service.extractModelCode('A')).toBe('A');
  });

  it('SN-CHARS: single character SN, length=7 → truncated to single char', () => {
    expect(service.extractModelCode('A')).toBe('A');
  });

  it('SN-CHARS: SN with numbers → extracts correctly', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 6));
    expect(service.extractModelCode('123456789')).toBe('123456');
  });

  it('SN-CHARS: SN with special chars (hyphens)', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('ABC-D-EFG')).toBe('ABC-D');
  });

  it('SN-CHARS: SN with underscores', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AB_CD_EFG')).toBe('AB_CD');
  });

  it('SN-CHARS: SN with dots', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AB.CD.EFG')).toBe('AB.CD');
  });

  it('SN-CHARS: SN with forward slashes', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AB/CD/EFG')).toBe('AB/CD');
  });

  it('SN-CHARS: SN with spaces', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AB CD EFG')).toBe('AB CD');
  });

  it('SN-CHARS: SN with mixed case', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AbCdEfGhI')).toBe('AbCdE');
  });

  it('SN-CHARS: SN with unicode characters', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 4));
    expect(service.extractModelCode('ÄÖÜabc')).toBe('ÄÖÜa');
  });

  it('SN-CHARS: SN with Cyrillic characters', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 4));
    expect(service.extractModelCode('АБВГabcd')).toBe('АБВГ');
  });

  it('SN-CHARS: maximum realistic SN length (30 chars)', () => {
    const longSN = 'GENUS2400000000000000000000000'; // 30 chars
    mockConfigStore.setConfig(buildAppConfig(0, 7));
    expect(service.extractModelCode(longSN)).toBe('GENUS24');
  });

  it('SN-CHARS: SN with leading zeros', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('0001234567')).toBe('00012');
  });

  it('SN-CHARS: start in middle of SN with special chars', () => {
    mockConfigStore.setConfig(buildAppConfig(3, 4));
    expect(service.extractModelCode('ABC-DEFG-HIJK')).toBe('-DEF');
  });

  it('SN-CHARS: SN with newline character', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('ABC\nDEFG')).toBe('ABC\nD');
  });

  it('SN-CHARS: SN all numeric digits', () => {
    mockConfigStore.setConfig(buildAppConfig(2, 5));
    expect(service.extractModelCode('0123456789')).toBe('23456');
  });

  it('SN-CHARS: SN all same character repeated', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    expect(service.extractModelCode('AAAAAAAAAA')).toBe('AAAAA');
  });

  it('SN-CHARS: length=0 always returns empty string regardless of SN', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 0));
    expect(service.extractModelCode('GENUS24ABCDE')).toBe('');
  });

  it('SN-CHARS: start=0 length=1 extracts first char only', () => {
    mockConfigStore.setConfig(buildAppConfig(0, 1));
    expect(service.extractModelCode('GENUS24')).toBe('G');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: lookup() — with various model code extractions (integration)
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: lookup() model code extraction integration', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockConfigStore: MockConfigStore;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockConfigStore, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  // Different start/length configs and expected model codes
  const lookupIntegrationCases = [
    { start: 0, length: 4, sn: 'AQUATHERM24001', expectedModelCode: 'AQUA' },
    { start: 0, length: 6, sn: 'GENUS24SERIAL', expectedModelCode: 'GENUS2' },
    { start: 2, length: 4, sn: 'XXGENUS24EXTRA', expectedModelCode: 'GENU' },
    { start: 3, length: 7, sn: '000GENIUS24SERN', expectedModelCode: 'GENIUS2' },
    { start: 0, length: 10, sn: 'SHORTCODE', expectedModelCode: 'SHORTCODE' }, // SN shorter than length
    { start: 1, length: 5, sn: 'BGENUS24EXTRA', expectedModelCode: 'GENUS' },
  ];

  lookupIntegrationCases.forEach(({ start, length, sn, expectedModelCode }) => {
    it(`LOOKUP-EXTRACT: start=${start} length=${length} SN="${sn}" → Firestore called with "${expectedModelCode}"`, async () => {
      mockConfigStore.setConfig(buildAppConfig(start, length));
      mockFirestore.getTenantDocument.and.resolveTo(buildDeviceDoc({ 'Device code': expectedModelCode }));

      await service.lookup(sn);

      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', expectedModelCode);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: mapToDevice() — all DeviceType values parametrized
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: mapToDevice all DeviceType values', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
  ];

  allDeviceTypes.forEach(dt => {
    it(`MAP-DEVICE-TYPE: maps "${dt}" correctly`, async () => {
      const doc = buildDeviceDoc({ 'Device type': dt });
      mockFirestore.getTenantDocument.and.resolveTo(doc);

      const device = await service.lookup('GENUS24EXTRA');

      expect(device).not.toBeNull();
      expect(device!.type).toBe(dt);
    });
  });

  // Test fallback when device type is missing
  it('MAP-DEVICE-TYPE: missing type → fallback to DeviceType.BOILER', async () => {
    const doc = buildDeviceDoc();
    delete doc['Device type'];
    mockFirestore.getTenantDocument.and.resolveTo(doc);

    const device = await service.lookup('GENUS24EXTRA');

    expect(device!.type).toBe(DeviceType.BOILER);
  });

  // Unknown/invalid device type
  it('MAP-DEVICE-TYPE: unrecognized type string is passed through as-is', async () => {
    const doc = buildDeviceDoc({ 'Device type': 'UNKNOWN_DEVICE_TYPE' });
    mockFirestore.getTenantDocument.and.resolveTo(doc);

    const device = await service.lookup('GENUS24EXTRA');

    expect(device!.type).toBe('UNKNOWN_DEVICE_TYPE' as DeviceType);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: mapToDevice() — optional boolean fields matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: mapToDevice boolean field combinations', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  interface BooleanCombo {
    commissioning: boolean;
    annualService: boolean;
    connectedDevice: boolean;
  }

  const boolCombinations: BooleanCombo[] = [
    { commissioning: false, annualService: false, connectedDevice: false },
    { commissioning: false, annualService: false, connectedDevice: true },
    { commissioning: false, annualService: true, connectedDevice: false },
    { commissioning: false, annualService: true, connectedDevice: true },
    { commissioning: true, annualService: false, connectedDevice: false },
    { commissioning: true, annualService: false, connectedDevice: true },
    { commissioning: true, annualService: true, connectedDevice: false },
    { commissioning: true, annualService: true, connectedDevice: true },
  ];

  boolCombinations.forEach(({ commissioning, annualService, connectedDevice }) => {
    it(`BOOL-COMBO: commissioning=${commissioning} annualService=${annualService} connectedDevice=${connectedDevice}`, async () => {
      const doc = buildDeviceDoc({ commissioning, annualService, connectedDevice });
      mockFirestore.getTenantDocument.and.resolveTo(doc);

      const device = await service.lookup('GENUS24EXTRA');

      expect(device!.commissioning).toBe(commissioning);
      expect(device!.annualService).toBe(annualService);
      expect(device!.connectedDevice).toBe(connectedDevice);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: mapToDevice() — warrantyMonths variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: mapToDevice warrantyMonths variations', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  const warrantyMonthsCases = [0, 1, 6, 12, 18, 24, 36, 48, 60, 72, 96, 120];

  warrantyMonthsCases.forEach(wm => {
    it(`WARRANTY-MONTHS-MAP: warrantyMonths=${wm} mapped correctly`, async () => {
      const doc = buildDeviceDoc({ warrantyMonths: wm });
      mockFirestore.getTenantDocument.and.resolveTo(doc);

      const device = await service.lookup('GENUS24EXTRA');

      expect(device!.warrantyMonths).toBe(wm);
    });
  });

  it('WARRANTY-MONTHS-MAP: missing warrantyMonths → undefined', async () => {
    const doc = buildDeviceDoc();
    delete doc['warrantyMonths'];
    mockFirestore.getTenantDocument.and.resolveTo(doc);

    const device = await service.lookup('GENUS24EXTRA');

    expect(device!.warrantyMonths).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: lookup() — isDeviceTypeAllowed matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: isDeviceTypeAllowed matrix', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenantService } = createTestBedSetup());
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
  ];

  allDeviceTypes.forEach(dt => {
    it(`ALLOWED: ${dt} allowed → lookup returns device`, async () => {
      const doc = buildDeviceDoc({ 'Device type': dt });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      const result = await service.lookup('GENUS24EXTRA');

      expect(result).not.toBeNull();
      expect(result!.type).toBe(dt);
    });

    it(`ALLOWED: ${dt} disallowed → lookup returns null`, async () => {
      const doc = buildDeviceDoc({ 'Device type': dt });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(false);

      const result = await service.lookup('GENUS24EXTRA');

      expect(result).toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: lookup() — SN boundary cases for model code extraction
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: lookup() SN boundary cases', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockConfigStore: MockConfigStore;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockConfigStore, mockLogger, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  it('SN-BOUNDARY: empty SN → no Firestore call, warn logged, returns null', async () => {
    mockConfigStore.setConfig(buildAppConfig(0, 0));
    const result = await service.lookup('');
    expect(result).toBeNull();
    expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
  });

  it('SN-BOUNDARY: single char SN with start=0, length=1 → calls Firestore with "A"', async () => {
    mockConfigStore.setConfig(buildAppConfig(0, 1));
    mockFirestore.getTenantDocument.and.resolveTo(buildDeviceDoc());

    await service.lookup('A');

    expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', 'A');
  });

  it('SN-BOUNDARY: SN shorter than start+length → Firestore called with truncated model', async () => {
    mockConfigStore.setConfig(buildAppConfig(0, 20));
    mockFirestore.getTenantDocument.and.resolveTo(buildDeviceDoc({ 'Device code': 'SHORT' }));

    await service.lookup('SHORT');

    expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', 'SHORT');
  });

  it('SN-BOUNDARY: very long SN (100 chars) → correct extraction', async () => {
    mockConfigStore.setConfig(buildAppConfig(0, 7));
    const longSN = 'GENUS24' + 'X'.repeat(93); // 100 chars
    mockFirestore.getTenantDocument.and.resolveTo(buildDeviceDoc());

    await service.lookup(longSN);

    expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', 'GENUS24');
  });

  it('SN-BOUNDARY: SN with special chars in model code position', async () => {
    mockConfigStore.setConfig(buildAppConfig(0, 5));
    const snWithSpecial = 'AB-CD-EFGH'; // model code: "AB-CD"
    mockFirestore.getTenantDocument.and.resolveTo(buildDeviceDoc({ 'Device code': 'AB-CD' }));

    await service.lookup(snWithSpecial);

    expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', 'AB-CD');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: lookupSilent() — state isolation across multiple calls
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: lookupSilent() state isolation', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenantService } = createTestBedSetup());
    mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
  });

  it('SILENT: lookupSilent does not overwrite device set by lookup()', async () => {
    const doc1 = buildDeviceDoc({ 'Device Name': 'Main Device' });
    const doc2 = buildDeviceDoc({ 'Device Name': 'Silent Device' });

    mockFirestore.getTenantDocument.and.resolveTo(doc1);
    await service.lookup('GENUS24FIRST');
    expect(service.device!.name).toBe('Main Device');

    mockFirestore.getTenantDocument.and.resolveTo(doc2);
    await service.lookupSilent('GENUS24SECOND');

    // device must remain as set by lookup()
    expect(service.device!.name).toBe('Main Device');
  });

  it('SILENT: multiple lookupSilent calls do not accumulate state', async () => {
    const doc = buildDeviceDoc({ 'Device Name': 'Test Device' });
    mockFirestore.getTenantDocument.and.resolveTo(doc);
    service.device = null;

    await service.lookupSilent('SN1');
    await service.lookupSilent('SN2');
    await service.lookupSilent('SN3');

    // service.device must still be null
    expect(service.device).toBeNull();
  });

  it('SILENT: returns device for each call independently', async () => {
    const doc1 = buildDeviceDoc({ 'Device code': 'CODE1', 'Device Name': 'Device One' });
    const doc2 = buildDeviceDoc({ 'Device code': 'CODE2', 'Device Name': 'Device Two' });

    mockFirestore.getTenantDocument.and.resolveTo(doc1);
    const result1 = await service.lookupSilent('SN1111111');

    mockFirestore.getTenantDocument.and.resolveTo(doc2);
    const result2 = await service.lookupSilent('SN2222222');

    expect(result1!.name).toBe('Device One');
    expect(result2!.name).toBe('Device Two');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: extractModelCode() — config null/undefined edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceLookupService — EXPANSION: extractModelCode config edge cases', () => {
  let service: DeviceLookupService;
  let mockConfigStore: MockConfigStore;

  beforeEach(() => {
    ({ service, mockConfigStore } = createTestBedSetup());
  });

  it('CONFIG-NULL: config is null → defaults to start=0, length=7', () => {
    mockConfigStore.config.set(null);
    const result = service.extractModelCode('GENUS24EXTRA');
    expect(result).toBe('GENUS24');
  });

  it('CONFIG-NULL: null config with short SN → returns full SN (truncated at length)', () => {
    mockConfigStore.config.set(null);
    const result = service.extractModelCode('SHORT');
    expect(result).toBe('SHORT');
  });

  it('CONFIG-NULL: null config with empty SN → empty string', () => {
    mockConfigStore.config.set(null);
    const result = service.extractModelCode('');
    expect(result).toBe('');
  });

  it('CONFIG-NULL: null config with exact 7-char SN → returns full SN', () => {
    mockConfigStore.config.set(null);
    const result = service.extractModelCode('GENUS24');
    expect(result).toBe('GENUS24');
  });

  it('CONFIG-NULL: null config with 8-char SN → returns first 7 chars', () => {
    mockConfigStore.config.set(null);
    const result = service.extractModelCode('GENUS24X');
    expect(result).toBe('GENUS24');
  });
});
