import { TestBed } from '@angular/core/testing';
import { InterventionService } from './intervention.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
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
    'debug',
    'info',
    'warn',
    'error',
  ]);
}

function createMockServerTimeService(): jasmine.SpyObj<ServerTimeService> {
  return jasmine.createSpyObj<ServerTimeService>('ServerTimeService', ['getServerTime']);
}

// AuthStore is a SignalStore — mock it as a plain object with signal-like functions
function createMockAuthStore(): { userEmail: () => string } {
  return {
    userEmail: jasmine.createSpy('userEmail').and.returnValue('test@example.com'),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InterventionService', () => {
  let service: InterventionService;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockAuthStore: { userEmail: () => string };
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;
  let mockLoggerService: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockFirestoreService = createMockFirestoreService();
    mockAuthStore = createMockAuthStore();
    mockServerTimeService = createMockServerTimeService();
    mockLoggerService = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        InterventionService,
        { provide: FirestoreService, useValue: mockFirestoreService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ServerTimeService, useValue: mockServerTimeService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    service = TestBed.inject(InterventionService);
  });

  // ─── saveIntervention() ──────────────────────────────────────────────────────

  describe('saveIntervention()', () => {
    it('TC-IS-01: should save intervention and return document id on success', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-123');

      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      const result = await service.saveIntervention('SN001', device, { field: 'value' });

      expect(result).toBe('doc-123');
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Intervention saved',
        jasmine.objectContaining({ sn: 'SN001', docId: 'doc-123' }),
      );
    });

    it('TC-IS-02: should return null when server time is unavailable', async () => {
      mockServerTimeService.getServerTime.and.resolveTo(null);

      const device = createMockDevice();
      const result = await service.saveIntervention('SN001', device, {});

      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Intervention save failed: server time unavailable',
        jasmine.objectContaining({ sn: 'SN001' }),
      );
      expect(mockFirestoreService.addInterventionDocument).not.toHaveBeenCalled();
    });

    it('TC-IS-03: should return null when Firestore throws an error', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.rejectWith(new Error('Firestore error'));

      const device = createMockDevice();
      const result = await service.saveIntervention('SN001', device, {});

      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Intervention save failed',
        jasmine.objectContaining({ sn: 'SN001' }),
      );
    });

    it('TC-IS-04: should include addedBy from AuthStore userEmail', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-xyz');
      (mockAuthStore.userEmail as jasmine.Spy).and.returnValue('servicer@company.com');

      const device = createMockDevice();
      await service.saveIntervention('SN001', device, {});

      const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
      const data = callArgs[1] as Record<string, unknown>;
      expect(data['addedBy']).toBe('servicer@company.com');
    });

    it('TC-IS-05: should include addedDate as server timestamp', async () => {
      const serverTime = new Date('2024-06-01T08:30:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-abc');

      const device = createMockDevice();
      await service.saveIntervention('SN001', device, {});

      const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
      const data = callArgs[1] as Record<string, unknown>;
      expect(data['addedDate']).toBe(serverTime);
    });

    it('TC-IS-06: should include extra fields from formData', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-extra');

      const device = createMockDevice();
      const formData = { interventionType: 'commissioning', note: 'test note', distance: 30 };
      await service.saveIntervention('SN-EXTRA', device, formData);

      const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
      const data = callArgs[1] as Record<string, unknown>;
      expect(data['interventionType']).toBe('commissioning');
      expect(data['note']).toBe('test note');
      expect(data['distance']).toBe(30);
      expect(data['sn']).toBe('SN-EXTRA');
      expect(data['exported']).toBe(false);
    });

    it('TC-IS-07: should reset isSaving to false after successful save', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-done');

      const device = createMockDevice();
      await service.saveIntervention('SN001', device, {});

      expect(service.isSaving).toBe(false);
    });

    it('TC-IS-08: should reset isSaving to false even when save fails', async () => {
      mockServerTimeService.getServerTime.and.resolveTo(null);

      const device = createMockDevice();
      await service.saveIntervention('SN001', device, {});

      expect(service.isSaving).toBe(false);
    });
  });

  // ─── getInterventionsBySn() ──────────────────────────────────────────────────

  describe('getInterventionsBySn()', () => {
    it('TC-IS-09: should return interventions sorted oldest first by addedDate', async () => {
      const older = { id: 'int-old', path: '/col/int-old', data: { addedDate: buildFirestoreTimestamp(new Date('2024-01-01')), sn: 'SN001' } };
      const newer = { id: 'int-new', path: '/col/int-new', data: { addedDate: buildFirestoreTimestamp(new Date('2024-06-01')), sn: 'SN001' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [newer, older],
        lastDocumentPath: '/col/int-new',
      });

      const result = await service.getInterventionsBySn('SN001', DeviceType.GAS_BOILER);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('int-old');
      expect(result[1].id).toBe('int-new');
    });

    it('TC-IS-10: should return empty array when no interventions found', async () => {
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN-NONE', DeviceType.BOILER);

      expect(result).toEqual([]);
    });

    it('TC-IS-11: should return empty array when Firestore throws error', async () => {
      mockFirestoreService.queryInterventionCollection.and.rejectWith(new Error('Network error'));

      const result = await service.getInterventionsBySn('SN001', DeviceType.GAS_BOILER);

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load interventions',
        jasmine.objectContaining({ sn: 'SN001' }),
      );
    });

    it('TC-IS-12: should query Firestore with correct sn filter', async () => {
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [],
        lastDocumentPath: null,
      });

      await service.getInterventionsBySn('SN-FILTER', DeviceType.HEAT_PUMP);

      expect(mockFirestoreService.queryInterventionCollection).toHaveBeenCalledWith(
        DeviceType.HEAT_PUMP,
        jasmine.objectContaining({
          compositeFilter: jasmine.objectContaining({
            type: 'and',
            queryConstraints: jasmine.arrayContaining([
              jasmine.objectContaining({ fieldPath: 'sn', opStr: '==', value: 'SN-FILTER' }),
            ]),
          }),
        }),
      );
    });
  });

  // ─── getInterventionById() ───────────────────────────────────────────────────

  describe('getInterventionById()', () => {
    it('TC-IS-13: should return intervention data when found', async () => {
      const interventionData = { sn: 'SN001', interventionType: 'commissioning', addedDate: new Date() };
      mockFirestoreService.getInterventionDocument.and.resolveTo(interventionData);

      const result = await service.getInterventionById('doc-001', DeviceType.GAS_BOILER);

      expect(result).toEqual(interventionData);
    });

    it('TC-IS-14: should return null when document does not exist', async () => {
      mockFirestoreService.getInterventionDocument.and.resolveTo(null);

      const result = await service.getInterventionById('nonexistent', DeviceType.BOILER);

      expect(result).toBeNull();
    });

    it('TC-IS-15: should return null when Firestore throws error', async () => {
      mockFirestoreService.getInterventionDocument.and.rejectWith(new Error('Permission denied'));

      const result = await service.getInterventionById('doc-err', DeviceType.GAS_BOILER);

      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load intervention',
        jasmine.objectContaining({ id: 'doc-err' }),
      );
    });
  });

  // ─── getRegistration() ──────────────────────────────────────────────────────

  describe('getRegistration()', () => {
    it('TC-IS-16: should fetch registration from users collection by sn', async () => {
      const registrationData = { sn: 'SN-REG', registeredAt: '2024-01-01' };
      mockFirestoreService.getTenantDocument.and.resolveTo(registrationData);

      const result = await service.getRegistration('SN-REG');

      expect(result).toEqual(registrationData);
      expect(mockFirestoreService.getTenantDocument).toHaveBeenCalledWith('users', 'SN-REG');
    });

    it('TC-IS-17: should return null when registration not found', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo(null);

      const result = await service.getRegistration('SN-MISSING');

      expect(result).toBeNull();
    });

    it('TC-IS-18: should return null and log error when Firestore throws', async () => {
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('Timeout'));

      const result = await service.getRegistration('SN-ERR');

      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load registration',
        jasmine.objectContaining({ sn: 'SN-ERR' }),
      );
    });
  });

  // ─── getInterventionLabel() ──────────────────────────────────────────────────

  describe('getInterventionLabel()', () => {
    it('TC-IS-19: should return commissioning label for COMMISSIONING type', () => {
      const commissioningKey = COMMISSIONING_TYPES[DeviceType.GAS_BOILER]!.key;
      const expectedLabel = COMMISSIONING_TYPES[DeviceType.GAS_BOILER]!.label;

      const result = service.getInterventionLabel(DeviceType.GAS_BOILER, commissioningKey);

      expect(result).toBe(expectedLabel);
    });

    it('TC-IS-20: should return annual service label for ANNUAL_SERVICE type', () => {
      const annualKey = ANNUAL_SERVICE_TYPES[DeviceType.GAS_BOILER]!.key;
      const expectedLabel = ANNUAL_SERVICE_TYPES[DeviceType.GAS_BOILER]!.label;

      const result = service.getInterventionLabel(DeviceType.GAS_BOILER, annualKey);

      expect(result).toBe(expectedLabel);
    });

    it('TC-IS-21: should return intervention option label for INTERVENTION_OPTIONS type', () => {
      const repairOption = INTERVENTION_OPTIONS[DeviceType.GAS_BOILER]![0];
      const repairKey = repairOption.key;
      const expectedLabel = repairOption.label;

      const result = service.getInterventionLabel(DeviceType.GAS_BOILER, repairKey);

      expect(result).toBe(expectedLabel);
    });

    it('TC-IS-22: should return null for unrecognized intervention type', () => {
      const result = service.getInterventionLabel(DeviceType.GAS_BOILER, 'unknown_type_xyz');

      expect(result).toBeNull();
    });

    it('TC-IS-23: should return null for device type with no defined options', () => {
      // DeviceType.AIR_CONDITION has no COMMISSIONING or ANNUAL_SERVICE types
      const result = service.getInterventionLabel(DeviceType.AIR_CONDITION, InterventionType.COMMISSIONING);

      expect(result).toBeNull();
    });

    it('TC-IS-24: should return heat pump commissioning label correctly', () => {
      const hpCommissioningKey = COMMISSIONING_TYPES[DeviceType.HEAT_PUMP]!.key;
      const expectedLabel = COMMISSIONING_TYPES[DeviceType.HEAT_PUMP]!.label;

      const result = service.getInterventionLabel(DeviceType.HEAT_PUMP, hpCommissioningKey);

      expect(result).toBe(expectedLabel);
    });
  });

  // ─── saveInterventionBatch() ─────────────────────────────────────────────────

  describe('saveInterventionBatch()', () => {
    it('TC-IS-25: should write batch atomically and return true on success', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValues('id-a', 'id-b');
      mockFirestoreService.buildInterventionReference.and.callFake(
        (deviceType: string, docId: string) => `tenants/tenant1/${deviceType}/${docId}`,
      );
      mockFirestoreService.writeBatch.and.resolveTo(undefined);

      const entries = [
        { sn: 'SN-A', device: createMockDevice({ type: DeviceType.GAS_BOILER }), formData: { note: 'a' } },
        { sn: 'SN-B', device: createMockDevice({ type: DeviceType.HEAT_PUMP }), formData: { note: 'b' } },
      ];

      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(true);
      expect(mockFirestoreService.writeBatch).toHaveBeenCalledTimes(1);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Intervention batch saved',
        jasmine.objectContaining({ count: 2 }),
      );
    });

    it('TC-IS-26: should return false when server time is unavailable', async () => {
      mockServerTimeService.getServerTime.and.resolveTo(null);

      const entries = [
        { sn: 'SN-X', device: createMockDevice(), formData: {} },
      ];

      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Intervention batch save failed: server time unavailable',
      );
      expect(mockFirestoreService.writeBatch).not.toHaveBeenCalled();
    });

    it('TC-IS-27: should return false when Firestore writeBatch throws error', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValue('id-fail');
      mockFirestoreService.buildInterventionReference.and.returnValue('tenants/t1/interventions/id-fail');
      mockFirestoreService.writeBatch.and.rejectWith(new Error('Batch failed'));

      const entries = [
        { sn: 'SN-FAIL', device: createMockDevice(), formData: {} },
      ];

      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Intervention batch save failed',
        jasmine.objectContaining({}),
      );
    });

    it('TC-IS-28: should reset isSaving to false after batch completes', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValue('id-reset');
      mockFirestoreService.buildInterventionReference.and.returnValue('tenants/t1/interventions/id-reset');
      mockFirestoreService.writeBatch.and.resolveTo(undefined);

      const entries = [{ sn: 'SN-R', device: createMockDevice(), formData: {} }];
      await service.saveInterventionBatch(entries);

      expect(service.isSaving).toBe(false);
    });

    it('TC-IS-29: should include addedBy and addedDate in each batch operation', async () => {
      const serverTime = new Date('2024-03-01T12:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValue('id-check');
      mockFirestoreService.buildInterventionReference.and.returnValue('tenants/t1/interventions/id-check');
      mockFirestoreService.writeBatch.and.resolveTo(undefined);
      (mockAuthStore.userEmail as jasmine.Spy).and.returnValue('batch@test.com');

      const entries = [{ sn: 'SN-BATCH', device: createMockDevice(), formData: { field: 'val' } }];
      await service.saveInterventionBatch(entries);

      const batchOps = mockFirestoreService.writeBatch.calls.mostRecent().args[0] as Array<{
        type: string;
        reference: string;
        data: Record<string, unknown>;
      }>;
      expect(batchOps.length).toBe(1);
      expect(batchOps[0].data['addedBy']).toBe('batch@test.com');
      expect(batchOps[0].data['addedDate']).toBe(serverTime);
      expect(batchOps[0].data['exported']).toBe(false);
    });

    it('TC-IS-30: should handle multiple devices in batch correctly', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValues('id-1', 'id-2', 'id-3');
      mockFirestoreService.buildInterventionReference.and.callFake(
        (deviceType: string, docId: string) => `tenants/t1/${deviceType}/${docId}`,
      );
      mockFirestoreService.writeBatch.and.resolveTo(undefined);

      const entries = [
        { sn: 'SN-1', device: createMockDevice({ type: DeviceType.GAS_BOILER }), formData: {} },
        { sn: 'SN-2', device: createMockDevice({ type: DeviceType.HEAT_PUMP }), formData: {} },
        { sn: 'SN-3', device: createMockDevice({ type: DeviceType.BOILER }), formData: {} },
      ];

      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(true);
      const batchOps = mockFirestoreService.writeBatch.calls.mostRecent().args[0] as unknown[];
      expect(batchOps.length).toBe(3);
      expect(mockFirestoreService.generateId).toHaveBeenCalledTimes(3);
    });
  });

  // ─── sort by addedDate — tested indirectly via getInterventionsBySn() ─────

  describe('sort by addedDate — indirectly via getInterventionsBySn()', () => {
    // SKIPPED: tested legacy raw {seconds} POJO. Strict Timestamp-only contract.
    xit('TC-IS-31: should sort correctly when addedDate is a Firestore timestamp object (seconds)', async () => {
      const old = { id: 'old', path: '/col/old', data: { addedDate: { seconds: 1700000000 }, sn: 'SN' } };
      const recent = { id: 'recent', path: '/col/recent', data: { addedDate: { seconds: 1700999999 }, sn: 'SN' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [recent, old],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);

      expect(result[0].id).toBe('old');
      expect(result[1].id).toBe('recent');
    });

    // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract.
    xit('TC-IS-32: should sort correctly when addedDate is a Date object', async () => {
      const early = { id: 'early', path: '/col/early', data: { addedDate: new Date('2024-01-01'), sn: 'SN' } };
      const late = { id: 'late', path: '/col/late', data: { addedDate: new Date('2024-12-31'), sn: 'SN' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [late, early],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);

      expect(result[0].id).toBe('early');
      expect(result[1].id).toBe('late');
    });

    // SKIPPED: tested legacy ISO string parsing. Strict Timestamp-only contract.
    xit('TC-IS-33: should sort correctly when addedDate is an ISO string', async () => {
      const before = { id: 'before', path: '/col/before', data: { addedDate: '2024-01-15T00:00:00Z', sn: 'SN' } };
      const after = { id: 'after', path: '/col/after', data: { addedDate: '2024-06-20T00:00:00Z', sn: 'SN' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [after, before],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);

      expect(result[0].id).toBe('before');
      expect(result[1].id).toBe('after');
    });

    it('TC-IS-34: should handle null addedDate without throwing (treated as 0)', async () => {
      const noDate = { id: 'no-date', path: '/col/no-date', data: { addedDate: null, sn: 'SN' } };
      const withDate = { id: 'with-date', path: '/col/with-date', data: { addedDate: buildFirestoreTimestamp(new Date('2024-01-01')), sn: 'SN' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [withDate, noDate],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);

      // null → 0, so noDate should come first
      expect(result[0].id).toBe('no-date');
      expect(result[1].id).toBe('with-date');
    });

    it('TC-IS-35: should handle undefined addedDate without throwing (treated as 0)', async () => {
      const noDate = { id: 'undefined-date', path: '/col/undefined-date', data: { sn: 'SN' } };
      const withDate = { id: 'has-date', path: '/col/has-date', data: { addedDate: buildFirestoreTimestamp(new Date('2024-01-01')), sn: 'SN' } };
      mockFirestoreService.queryInterventionCollection.and.resolveTo({
        documents: [withDate, noDate],
        lastDocumentPath: null,
      });

      const result = await service.getInterventionsBySn('SN', DeviceType.GAS_BOILER);

      expect(result[0].id).toBe('undefined-date');
      expect(result[1].id).toBe('has-date');
    });
  });

  // ─── clear() ────────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('TC-IS-36: should reset isSaving to false', () => {
      (service as unknown as { isSaving: boolean }).isSaving = true;

      service.clear();

      expect(service.isSaving).toBe(false);
    });

    it('TC-IS-37: should be idempotent — calling clear() twice leaves isSaving false', () => {
      service.clear();
      service.clear();

      expect(service.isSaving).toBe(false);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('TC-IS-38: should allow empty parts array in formData', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.resolveTo('doc-empty-parts');

      const device = createMockDevice();
      const result = await service.saveIntervention('SN-EP', device, { parts: [] });

      expect(result).toBe('doc-empty-parts');
      const callArgs = mockFirestoreService.addInterventionDocument.calls.mostRecent().args;
      const data = callArgs[1] as Record<string, unknown>;
      expect(data['parts']).toEqual([]);
    });

    it('TC-IS-39: should handle concurrent saves independently', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.addInterventionDocument.and.returnValues(
        Promise.resolve('doc-concurrent-1'),
        Promise.resolve('doc-concurrent-2'),
      );

      const device = createMockDevice();
      const [result1, result2] = await Promise.all([
        service.saveIntervention('SN-C1', device, { field: 1 }),
        service.saveIntervention('SN-C2', device, { field: 2 }),
      ]);

      expect(result1).toBe('doc-concurrent-1');
      expect(result2).toBe('doc-concurrent-2');
    });

    it('TC-IS-40: should save interventionBatch with empty parts array entries', async () => {
      const serverTime = new Date('2024-01-15T10:00:00Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverTime);
      mockFirestoreService.generateId.and.returnValue('id-ep');
      mockFirestoreService.buildInterventionReference.and.returnValue('tenants/t1/interventions/id-ep');
      mockFirestoreService.writeBatch.and.resolveTo(undefined);

      const entries = [{ sn: 'SN-EP', device: createMockDevice(), formData: { parts: [] } }];
      const result = await service.saveInterventionBatch(entries);

      expect(result).toBe(true);
      const batchOps = mockFirestoreService.writeBatch.calls.mostRecent().args[0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(batchOps[0].data['parts']).toEqual([]);
    });
  });
});
