/**
 * InterventionService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - toTimestamp() variations (via sort in getInterventionsBySn)
 *   - saveIntervention() data field matrix
 *   - getInterventionLabel() all DeviceType × all intervention types
 *   - getInterventionsBySn() sorting with various date formats
 *   - saveInterventionBatch() size matrix
 */

import { TestBed } from '@angular/core/testing';
import { InterventionService } from './intervention.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { FieldValue } from '@capacitor-firebase/firestore';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  InterventionType,
  COMMISSIONING_TYPES,
  ANNUAL_SERVICE_TYPES,
  INTERVENTION_OPTIONS,
} from '../models/intervention.model';
import { buildFirestoreTimestamp } from '../../../testing/test-data-builders';

// ─── Factories ────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'DEVICE-001',
    name: 'Test Device',
    type: DeviceType.GAS_BOILER,
    subType: 'standard',
    unitCount: 1,
    exists: true,
    ...overrides,
  };
}

function createMockFirestoreService(): jasmine.SpyObj<FirestoreService> {
  return jasmine.createSpyObj<FirestoreService>('FirestoreService', [
    'addInterventionDocument',
    'queryInterventionCollection',
    'getInterventionDocument',
    'getTenantDocument',
    'writeBatch',
    'generateId',
    'buildInterventionReference',
  ]);
}

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug', 'info', 'warn', 'error',
  ]);
}

function createMockServerTimeService(): jasmine.SpyObj<ServerTimeService> {
  return jasmine.createSpyObj<ServerTimeService>('ServerTimeService', ['getServerTime']);
}

function createMockAuthStore(): { userEmail: () => string } {
  return {
    userEmail: jasmine.createSpy('userEmail').and.returnValue('test@example.com'),
  };
}

function makeIntervention(
  id: string,
  addedDate: unknown,
  sn = 'SN-TEST',
): { id: string; path: string; data: Record<string, unknown> } {
  return {
    id,
    path: `/col/${id}`,
    data: { addedDate, sn },
  };
}

// ─── Setup factory ────────────────────────────────────────────────────────────

function createTestBedSetup() {
  const mockFirestoreService = createMockFirestoreService();
  const mockAuthStore = createMockAuthStore();
  const mockServerTimeService = createMockServerTimeService();
  const mockLoggerService = createMockLoggerService();

  TestBed.configureTestingModule({
    providers: [
      InterventionService,
      { provide: FirestoreService, useValue: mockFirestoreService },
      { provide: AuthStore, useValue: mockAuthStore },
      { provide: ServerTimeService, useValue: mockServerTimeService },
      { provide: LoggerService, useValue: mockLoggerService },
    ],
  });

  return {
    service: TestBed.inject(InterventionService),
    mockFirestoreService,
    mockAuthStore,
    mockServerTimeService,
    mockLoggerService,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: toTimestamp() — all input type variations (via sort)
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: toTimestamp input type matrix', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestoreService } = createTestBedSetup());
  });

  // Helper: get sorted result from two interventions
  async function getSorted(
    earlier: { id: string; addedDate: unknown },
    later: { id: string; addedDate: unknown },
  ) {
    // Pass reversed order to test sorting
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [
        makeIntervention(later.id, later.addedDate),
        makeIntervention(earlier.id, earlier.addedDate),
      ],
      lastDocumentPath: null,
    });
    return service.getInterventionsBySn('SN-TEST', DeviceType.GAS_BOILER);
  }

  // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract.
  xit('TIMESTAMP: Date earlier vs Date later → correct sort order', async () => {
    const result = await getSorted(
      { id: 'earlier', addedDate: new Date('2023-01-01') },
      { id: 'later', addedDate: new Date('2023-12-31') },
    );
    expect(result[0].id).toBe('earlier');
    expect(result[1].id).toBe('later');
  });

  // SKIPPED: tested raw {seconds, nanoseconds} POJO. Strict Timestamp-only contract.
  xit('TIMESTAMP: Firestore { seconds, nanoseconds } format → sorted correctly', async () => {
    const result = await getSorted(
      { id: 'old', addedDate: { seconds: 1672531200, nanoseconds: 0 } },
      { id: 'new', addedDate: { seconds: 1703980800, nanoseconds: 0 } },
    );
    expect(result[0].id).toBe('old');
    expect(result[1].id).toBe('new');
  });

  // SKIPPED: tested raw {seconds, nanoseconds} POJO. Strict Timestamp-only contract.
  xit('TIMESTAMP: Firestore { seconds, nanoseconds } — nanoseconds do NOT affect seconds-based sort', async () => {
    const result = await getSorted(
      { id: 'old', addedDate: { seconds: 1000, nanoseconds: 999999999 } },
      { id: 'new', addedDate: { seconds: 2000, nanoseconds: 0 } },
    );
    expect(result[0].id).toBe('old');
    expect(result[1].id).toBe('new');
  });

  // SKIPPED: tested ISO string parsing. Strict Timestamp-only contract.
  xit('TIMESTAMP: ISO string with UTC timezone → sorted correctly', async () => {
    const result = await getSorted(
      { id: 'before', addedDate: '2023-01-15T00:00:00Z' },
      { id: 'after', addedDate: '2023-06-20T00:00:00Z' },
    );
    expect(result[0].id).toBe('before');
    expect(result[1].id).toBe('after');
  });

  // SKIPPED: tested ISO string parsing. Strict Timestamp-only contract.
  xit('TIMESTAMP: ISO string with +02:00 timezone → sorted correctly', async () => {
    const result = await getSorted(
      { id: 'before', addedDate: '2023-01-15T12:00:00+02:00' },
      { id: 'after', addedDate: '2023-06-20T12:00:00+02:00' },
    );
    expect(result[0].id).toBe('before');
    expect(result[1].id).toBe('after');
  });

  // SKIPPED: tested ISO string parsing. Strict Timestamp-only contract.
  xit('TIMESTAMP: ISO string without timezone (local) → sorted correctly', async () => {
    const result = await getSorted(
      { id: 'before', addedDate: '2023-01-15T12:00:00' },
      { id: 'after', addedDate: '2023-06-20T12:00:00' },
    );
    expect(result[0].id).toBe('before');
    expect(result[1].id).toBe('after');
  });

  // null and undefined → treated as 0 (sort to beginning)
  it('TIMESTAMP: null → treated as 0, sorts before any real date', async () => {
    const result = await getSorted(
      { id: 'null-date', addedDate: null },
      { id: 'real-date', addedDate: buildFirestoreTimestamp(new Date('2023-06-01')) },
    );
    expect(result[0].id).toBe('null-date');
    expect(result[1].id).toBe('real-date');
  });

  it('TIMESTAMP: undefined → treated as 0, sorts before any real date', async () => {
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [
        { id: 'real-date', path: '/col/real', data: { addedDate: buildFirestoreTimestamp(new Date('2023-06-01')), sn: 'SN' } },
        { id: 'undef-date', path: '/col/undef', data: { sn: 'SN' } },
      ],
      lastDocumentPath: null,
    });
    const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);
    expect(result[0].id).toBe('undef-date');
    expect(result[1].id).toBe('real-date');
  });

  // SKIPPED: mixed legacy formats. Strict Timestamp-only contract.
  xit('TIMESTAMP: Firestore timestamp vs Date object → correct relative order', async () => {
    const result = await getSorted(
      { id: 'ts-old', addedDate: { seconds: 1672531200 } },
      { id: 'date-new', addedDate: new Date('2023-12-31') },
    );
    expect(result[0].id).toBe('ts-old');
    expect(result[1].id).toBe('date-new');
  });

  // SKIPPED: mixed legacy formats. Strict Timestamp-only contract.
  xit('TIMESTAMP: ISO string vs Firestore timestamp → correct relative order', async () => {
    const result = await getSorted(
      { id: 'iso-old', addedDate: '2023-01-01T00:00:00Z' },
      { id: 'ts-new', addedDate: { seconds: 1703980800 } },
    );
    expect(result[0].id).toBe('iso-old');
    expect(result[1].id).toBe('ts-new');
  });

  it('TIMESTAMP: three items in random order → sorted oldest first', async () => {
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [
        makeIntervention('middle', buildFirestoreTimestamp(new Date('2023-06-15'))),
        makeIntervention('newest', buildFirestoreTimestamp(new Date('2023-12-31'))),
        makeIntervention('oldest', buildFirestoreTimestamp(new Date('2023-01-01'))),
      ],
      lastDocumentPath: null,
    });
    const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);
    expect(result[0].id).toBe('oldest');
    expect(result[1].id).toBe('middle');
    expect(result[2].id).toBe('newest');
  });

  it('TIMESTAMP: five items with Date objects → sorted oldest first', async () => {
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [
        makeIntervention('d3', buildFirestoreTimestamp(new Date('2021-01-01'))),
        makeIntervention('d5', buildFirestoreTimestamp(new Date('2023-01-01'))),
        makeIntervention('d1', buildFirestoreTimestamp(new Date('2019-01-01'))),
        makeIntervention('d4', buildFirestoreTimestamp(new Date('2022-01-01'))),
        makeIntervention('d2', buildFirestoreTimestamp(new Date('2020-01-01'))),
      ],
      lastDocumentPath: null,
    });
    const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);
    expect(result.map(r => r.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
  });

  // SKIPPED: tested raw {seconds} POJO. Strict Timestamp-only contract.
  xit('TIMESTAMP: epoch timestamp (seconds=0) → treated as very early date', async () => {
    const result = await getSorted(
      { id: 'epoch', addedDate: { seconds: 0 } },
      { id: 'recent', addedDate: new Date('2023-01-01') },
    );
    expect(result[0].id).toBe('epoch');
    expect(result[1].id).toBe('recent');
  });

  it('TIMESTAMP: very large timestamp (year 2100) → sorts after normal dates', async () => {
    const result = await getSorted(
      { id: 'normal', addedDate: buildFirestoreTimestamp(new Date('2023-01-01')) },
      { id: 'future', addedDate: buildFirestoreTimestamp(new Date('2100-01-01')) },
    );
    expect(result[0].id).toBe('normal');
    expect(result[1].id).toBe('future');
  });

  // Same timestamp → stable sort (either order acceptable, just no crash)
  it('TIMESTAMP: two identical timestamps → no crash, both items present', async () => {
    const sameDate = buildFirestoreTimestamp(new Date('2023-06-15'));
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [
        makeIntervention('a', sameDate),
        makeIntervention('b', sameDate),
      ],
      lastDocumentPath: null,
    });
    const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);
    expect(result.length).toBe(2);
    expect(result.map(r => r.id).sort()).toEqual(['a', 'b']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: getInterventionLabel() — all DeviceType × intervention types
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: getInterventionLabel matrix', () => {
  let service: InterventionService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Get all device types that have defined options
  const deviceTypesWithOptions = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER];

  deviceTypesWithOptions.forEach(dt => {
    // Test commissioning label if defined
    if (COMMISSIONING_TYPES[dt]) {
      const commKey = COMMISSIONING_TYPES[dt]!.key;
      const commLabel = COMMISSIONING_TYPES[dt]!.label;
      it(`LABEL: ${dt} commissioning key "${commKey}" → "${commLabel}"`, () => {
        const result = service.getInterventionLabel(dt, commKey);
        expect(result).toBe(commLabel);
      });
    }

    // Test annual service label if defined
    if (ANNUAL_SERVICE_TYPES[dt]) {
      const annualKey = ANNUAL_SERVICE_TYPES[dt]!.key;
      const annualLabel = ANNUAL_SERVICE_TYPES[dt]!.label;
      it(`LABEL: ${dt} annual service key "${annualKey}" → "${annualLabel}"`, () => {
        const result = service.getInterventionLabel(dt, annualKey);
        expect(result).toBe(annualLabel);
      });
    }

    // Test each intervention option if defined
    const options = INTERVENTION_OPTIONS[dt] ?? [];
    options.forEach((opt, idx) => {
      it(`LABEL: ${dt} option[${idx}] key "${opt.key}" → "${opt.label}"`, () => {
        const result = service.getInterventionLabel(dt, opt.key);
        expect(result).toBe(opt.label);
      });
    });
  });

  // Unrecognized keys → null for all device types
  const unrecognizedKeys = [
    'totally_unknown_key',
    '',
    'null',
    'undefined',
    'ANNUAL_SERVICE', // uppercase, wrong case
    'commissioning_typo',
    '12345',
    'null_key_xyz',
  ];

  [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER].forEach(dt => {
    unrecognizedKeys.forEach(key => {
      it(`LABEL: ${dt} unrecognized key "${key}" → null`, () => {
        const result = service.getInterventionLabel(dt, key);
        expect(result).toBeNull();
      });
    });
  });

  // Device types with no defined options
  const deviceTypesNoOptions = [DeviceType.AIR_CONDITION];
  deviceTypesNoOptions.forEach(dt => {
    [InterventionType.COMMISSIONING, InterventionType.ANNUAL_SERVICE, 'some_key'].forEach(key => {
      it(`LABEL: ${dt} (no options) key "${key}" → null`, () => {
        const result = service.getInterventionLabel(dt, key);
        expect(result).toBeNull();
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: saveIntervention() — formData field variations
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: saveIntervention formData variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;

  beforeEach(() => {
    ({ service, mockFirestoreService, mockServerTimeService } = createTestBedSetup());
    mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15T10:00:00Z'));
    mockFirestoreService.addInterventionDocument.and.resolveTo('doc-id');
  });

  const device = createMockDevice();

  // Various formData shapes
  const formDataCases = [
    { label: 'empty object', formData: {} },
    { label: 'interventionType only', formData: { interventionType: 'commissioning' } },
    { label: 'with note', formData: { note: 'Test note' } },
    { label: 'with empty note', formData: { note: '' } },
    { label: 'with null note', formData: { note: null } },
    { label: 'with parts array', formData: { parts: ['PART-001', 'PART-002'] } },
    { label: 'with empty parts', formData: { parts: [] } },
    { label: 'with distance=0', formData: { distance: 0 } },
    { label: 'with distance=999', formData: { distance: 999 } },
    { label: 'with multiple fields', formData: { interventionType: 'repair', note: 'Multi field', distance: 50, fault: 'E05' } },
    { label: 'with Cyrillic text', formData: { note: 'Редовни сервис', city: 'Београд' } },
    { label: 'with boolean resolved=true', formData: { resolved: true } },
    { label: 'with boolean resolved=false', formData: { resolved: false } },
    { label: 'with nested object', formData: { envInfo: { temperature: '65', pressure: '1.5' } } },
    { label: 'with array of objects', formData: { photos: [{ url: 'http://test.com/photo.jpg' }] } },
  ];

  formDataCases.forEach(({ label, formData }) => {
    it(`FORM-DATA: ${label} — saves successfully and returns docId`, async () => {
      const result = await service.saveIntervention('SN-FD-TEST', device, formData);
      expect(result).toBe('doc-id');
    });
  });

  // Verify that fixed fields are always present regardless of formData
  it('FORM-DATA: always includes sn, addedBy, addedDate, exported regardless of formData', async () => {
    const result = await service.saveIntervention('SN-ALWAYS', device, { note: 'test' });
    expect(result).toBe('doc-id');

    const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
    const data = callArgs[1] as Record<string, unknown>;
    expect(data['sn']).toBe('SN-ALWAYS');
    expect(data['addedBy']).toBeDefined();
    expect(data['addedDate']).toBeDefined();
    expect(data['exported']).toBe(false);
  });

  // formData spreads AFTER sn parameter, so formData.sn overwrites the sn parameter
  // data = { sn, ...formData, addedBy, addedDate, exported } → formData.sn wins
  it('FORM-DATA: sn in formData overrides sn parameter (spread order: sn first, formData second)', async () => {
    await service.saveIntervention('BASE-SN', device, { sn: 'FORMDATA-SN' });
    const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
    const data = callArgs[1] as Record<string, unknown>;
    // formData is spread after sn parameter, so formData.sn takes precedence
    expect(data['sn']).toBe('FORMDATA-SN');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: saveInterventionBatch() — batch size variations
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: saveInterventionBatch size variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;

  beforeEach(() => {
    ({ service, mockFirestoreService, mockServerTimeService } = createTestBedSetup());
    mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15T10:00:00Z'));
    mockFirestoreService.writeBatch.and.resolveTo(undefined);
    mockFirestoreService.generateId.and.callFake(() => `id-${Math.random()}`);
    mockFirestoreService.buildInterventionReference.and.callFake(
      (deviceType: string, docId: string) => `tenants/t1/${deviceType}/${docId}`,
    );
  });

  // Test batch sizes: 1, 2, 3, 5, 10
  [1, 2, 3, 5, 10].forEach(size => {
    it(`BATCH-SIZE: batch of ${size} entries → writeBatch called once with ${size} ops`, async () => {
      const entries = Array.from({ length: size }, (_, i) => ({
        sn: `SN-BATCH-${i}`,
        device: createMockDevice(),
        formData: { note: `Note ${i}` },
      }));

      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(true);
      expect(mockFirestoreService.writeBatch).toHaveBeenCalledTimes(1);
      const batchOps = mockFirestoreService.writeBatch.calls.mostRecent().args[0] as unknown[];
      expect(batchOps.length).toBe(size);
    });
  });

  // Test with mixed device types
  const deviceTypesCombinations = [
    [DeviceType.GAS_BOILER],
    [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP],
    [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER],
    [DeviceType.BOILER, DeviceType.AIR_CONDITION, DeviceType.HEAT_PUMP],
  ];

  deviceTypesCombinations.forEach(types => {
    it(`BATCH-TYPES: batch with device types [${types.join(', ')}] → all succeed`, async () => {
      const entries = types.map((type, i) => ({
        sn: `SN-${i}`,
        device: createMockDevice({ type }),
        formData: {},
      }));

      const result = await service.saveInterventionBatch(entries);
      expect(result).toBe(true);
      expect(mockFirestoreService.generateId).toHaveBeenCalledTimes(types.length);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: saveIntervention() — addedBy email variations
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: saveIntervention addedBy variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;
  let mockAuthStore: { userEmail: () => string };

  beforeEach(() => {
    ({ service, mockFirestoreService, mockServerTimeService, mockAuthStore } = createTestBedSetup());
    mockServerTimeService.getServerTime.and.resolveTo(new Date('2024-01-15T10:00:00Z'));
    mockFirestoreService.addInterventionDocument.and.resolveTo('doc-xyz');
  });

  const emailCases = [
    'user@example.com',
    'admin@company.org',
    'service.tech+tag@domain.co.uk',
    'noatsign', // invalid email but service should pass it through
    '',
    'Никола@домен.рс', // unicode email
    'user@subdomain.domain.example.com',
  ];

  emailCases.forEach(email => {
    it(`ADDED-BY: email="${email}" is included in written document`, async () => {
      (mockAuthStore.userEmail as jasmine.Spy).and.returnValue(email);
      const device = createMockDevice();

      await service.saveIntervention('SN-EMAIL', device, {});

      const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
      const data = callArgs[1] as Record<string, unknown>;
      expect(data['addedBy']).toBe(email);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: getInterventionsBySn() — DeviceType parametrized
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: getInterventionsBySn DeviceType variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockLoggerService: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockFirestoreService, mockLoggerService } = createTestBedSetup());
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
  ];

  allDeviceTypes.forEach(dt => {
    it(`QUERY-DEVICE-TYPE: ${dt} — calls queryInterventionCollection with correct deviceType`, async () => {
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [],
        lastDocumentPath: null,
      });

      await service.getInterventionsBySn('SN-DT-TEST', dt);

      expect(mockFirestoreService.queryInterventionCollection).toHaveBeenCalledWith(
        dt,
        jasmine.any(Object),
      );
    });

    it(`QUERY-DEVICE-TYPE: ${dt} — error → returns empty array with error log`, async () => {
      mockFirestoreService.queryInterventionCollection.and.rejectWith(new Error(`${dt} error`));

      const result = await service.getInterventionsBySn('SN-ERR', dt);

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: getInterventionsBySn() — SN filter variations
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: getInterventionsBySn SN filter variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestoreService } = createTestBedSetup());
    mockFirestoreService.queryInterventionCollection.and.resolveTo({
      documents: [],
      lastDocumentPath: null,
    });
  });

  const snCases = [
    'SN001',
    'SN-COMPLEX-123-ABC',
    'VERY-LONG-SERIAL-NUMBER-1234567890-ABCDEFGHIJ',
    '12345678901234567890',
    'a', // single char
    'SN WITH SPACES',
    'SN_WITH_UNDERSCORES',
    'SN.WITH.DOTS',
  ];

  snCases.forEach(sn => {
    it(`SN-FILTER: SN="${sn}" is forwarded as filter to Firestore`, async () => {
      await service.getInterventionsBySn(sn, DeviceType.GAS_BOILER);

      expect(mockFirestoreService.queryInterventionCollection).toHaveBeenCalledWith(
        DeviceType.GAS_BOILER,
        jasmine.objectContaining({
          compositeFilter: jasmine.objectContaining({
            queryConstraints: jasmine.arrayContaining([
              jasmine.objectContaining({ fieldPath: 'sn', opStr: '==', value: sn }),
            ]),
          }),
        }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: getInterventionsBySn() — result count variations
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: getInterventionsBySn result count', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;

  beforeEach(() => {
    ({ service, mockFirestoreService } = createTestBedSetup());
  });

  [0, 1, 2, 5, 10, 20, 50].forEach(count => {
    it(`RESULT-COUNT: ${count} interventions returned → sorted array of ${count} items`, async () => {
      const docs = Array.from({ length: count }, (_, i) => ({
        id: `int-${i}`,
        path: `/col/int-${i}`,
        data: { addedDate: buildFirestoreTimestamp(new Date(2023, 0, i + 1)), sn: 'SN-COUNT-TEST' },
      }));
      // Shuffle to test sorting
      const shuffled = [...docs].reverse();
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: shuffled,
        lastDocumentPath: count > 0 ? shuffled[shuffled.length - 1].path : null,
      });

      const result = await service.getInterventionsBySn('SN-COUNT-TEST', DeviceType.GAS_BOILER);

      expect(result.length).toBe(count);
      // Verify sorted oldest first
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1].data['addedDate'] as { toDate(): Date };
        const curr = result[i].data['addedDate'] as { toDate(): Date };
        expect(prev.toDate().getTime()).toBeLessThanOrEqual(curr.toDate().getTime());
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: saveIntervention() — server time as addedDate in document
// ══════════════════════════════════════════════════════════════════════════════

describe('InterventionService — EXPANSION: saveIntervention addedDate timestamp variations', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;

  beforeEach(() => {
    ({ service, mockFirestoreService, mockServerTimeService } = createTestBedSetup());
    mockFirestoreService.addInterventionDocument.and.resolveTo('doc-ts');
  });

  // The service no longer fetches a server time (ServerTimeService is gone); it
  // writes a FieldValue.serverTimestamp() sentinel that Firestore expands on the
  // server. So addedDate is always the same sentinel regardless of clock value —
  // the old per-timestamp parameterization no longer applies.
  it('writes a serverTimestamp() sentinel as addedDate in the written doc', async () => {
    const device = createMockDevice();

    await service.saveIntervention('SN-TS', device, {});

    const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
    const data = callArgs[1] as Record<string, unknown>;
    expect(data['addedDate']).toBeInstanceOf(FieldValue);
    expect((data['addedDate'] as FieldValue).toJSON()).toEqual(
      jasmine.objectContaining({ __type__: 'serverTimestamp' }),
    );
  });
});
