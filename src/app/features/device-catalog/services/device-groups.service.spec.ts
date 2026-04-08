import { TestBed } from '@angular/core/testing';
import { DeviceGroupsService } from './device-groups.service';
import { Group } from '../../../shared/models/group.model';

describe('DeviceGroupsService', () => {
  let service: DeviceGroupsService;
  let mockFirestoreService: {
    queryTenantSubcollection: jasmine.Spy;
  };
  let mockLoggerService: {
    debug: jasmine.Spy;
    error: jasmine.Spy;
  };

  const createGroupResult = (groups: { id: string; name: string; photo: string }[]) => ({
    documents: groups.map((g) => ({
      id: g.id,
      path: `devices/DEV1/Sklopovi/${g.id}`,
      data: { 'Name': g.name, 'Group photo': g.photo },
    })),
    lastDocumentPath: null,
  });

  const emptyResult = () => ({ documents: [], lastDocumentPath: null });

  beforeEach(() => {
    mockFirestoreService = {
      queryTenantSubcollection: jasmine.createSpy('queryTenantSubcollection').and.resolveTo(emptyResult()),
    };
    mockLoggerService = {
      debug: jasmine.createSpy('debug'),
      error: jasmine.createSpy('error'),
    };

    TestBed.configureTestingModule({ providers: [DeviceGroupsService] });
    service = TestBed.inject(DeviceGroupsService);
    (service as any).firestoreService = mockFirestoreService;
    (service as any).logger = mockLoggerService;
  });

  // ── Initial state ──
  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty groups array', () => {
      expect(service.groups).toEqual([]);
    });

    it('should not be loading', () => {
      expect(service.isLoading).toBeFalse();
    });

    it('should have empty loadedDeviceCode', () => {
      expect((service as any).loadedDeviceCode).toBe('');
    });
  });

  // ── load() ──
  describe('load()', () => {
    it('should query Sklopovi subcollection for the device', async () => {
      await service.load('DEV1');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledWith('devices/DEV1', 'Sklopovi');
    });

    it('should set isLoading true during execution', async () => {
      let loadingDuringCall = false;
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        loadingDuringCall = service.isLoading;
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1');
      expect(loadingDuringCall).toBeTrue();
    });

    it('should set isLoading false after completion', async () => {
      await service.load('DEV1');
      expect(service.isLoading).toBeFalse();
    });

    it('should clear groups before loading', async () => {
      service.groups = [{ id: 'old', name: 'Old', groupPhoto: '' }];
      let groupsDuringCall: Group[] = [];
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        groupsDuringCall = [...service.groups];
        return Promise.resolve(createGroupResult([{ id: 'new', name: 'New', photo: '' }]));
      });
      await service.load('DEV1');
      expect(groupsDuringCall).toEqual([]);
    });

    it('should store loaded device code', async () => {
      await service.load('DEV1');
      expect((service as any).loadedDeviceCode).toBe('DEV1');
    });

    it('should populate groups from result', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([
          { id: 'G1', name: 'Group 1', photo: 'photo1.jpg' },
          { id: 'G2', name: 'Group 2', photo: 'photo2.jpg' },
        ]),
      );
      await service.load('DEV1');
      expect(service.groups.length).toBe(2);
    });
  });

  // ── Group mapping ──
  describe('group mapping', () => {
    it('should map doc id to group id', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'SKL-001', name: 'Test', photo: '' }]),
      );
      await service.load('DEV1');
      expect(service.groups[0].id).toBe('SKL-001');
    });

    it('should map Name field to name', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Kompresor', photo: '' }]),
      );
      await service.load('DEV1');
      expect(service.groups[0].name).toBe('Kompresor');
    });

    it('should map Group photo field to groupPhoto', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Test', photo: 'photo123.png' }]),
      );
      await service.load('DEV1');
      expect(service.groups[0].groupPhoto).toBe('photo123.png');
    });

    it('should use empty string when Name is missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'G1', path: 'devices/DEV1/Sklopovi/G1', data: { 'Group photo': 'p.jpg' } }],
        lastDocumentPath: null,
      });
      await service.load('DEV1');
      expect(service.groups[0].name).toBe('');
    });

    it('should use empty string when Group photo is missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'G1', path: 'devices/DEV1/Sklopovi/G1', data: { 'Name': 'Test' } }],
        lastDocumentPath: null,
      });
      await service.load('DEV1');
      expect(service.groups[0].groupPhoto).toBe('');
    });

    it('should map multiple groups preserving order', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([
          { id: 'A', name: 'Alpha', photo: '' },
          { id: 'B', name: 'Beta', photo: '' },
          { id: 'C', name: 'Charlie', photo: '' },
        ]),
      );
      await service.load('DEV1');
      expect(service.groups.map((g) => g.id)).toEqual(['A', 'B', 'C']);
      expect(service.groups.map((g) => g.name)).toEqual(['Alpha', 'Beta', 'Charlie']);
    });

    it('should handle group with all fields missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'G1', path: 'devices/DEV1/Sklopovi/G1', data: {} }],
        lastDocumentPath: null,
      });
      await service.load('DEV1');
      expect(service.groups[0].id).toBe('G1');
      expect(service.groups[0].name).toBe('');
      expect(service.groups[0].groupPhoto).toBe('');
    });
  });

  // ── Caching (same device code) ──
  describe('caching', () => {
    it('should skip loading when same device code and groups exist', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Group', photo: '' }]),
      );
      await service.load('DEV1');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledTimes(1);

      await service.load('DEV1');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledTimes(1);
    });

    it('should reload when different device code', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Group', photo: '' }]),
      );
      await service.load('DEV1');
      await service.load('DEV2');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledTimes(2);
    });

    it('should reload same device code if groups are empty', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      await service.load('DEV1');
      expect(service.groups.length).toBe(0);

      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Now Loaded', photo: '' }]),
      );
      await service.load('DEV1');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledTimes(2);
    });

    it('should reload after reset even for same device code', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Group', photo: '' }]),
      );
      await service.load('DEV1');
      service.reset();
      await service.load('DEV1');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledTimes(2);
    });

    it('should not update isLoading when cache hit', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Group', photo: '' }]),
      );
      await service.load('DEV1');

      service.isLoading = false;
      await service.load('DEV1');
      expect(service.isLoading).toBeFalse();
    });
  });

  // ── Error handling ──
  describe('error handling', () => {
    it('should log error on API failure', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('Firestore error'));
      await service.load('DEV1');
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load device groups',
        jasmine.objectContaining({ error: 'Error: Firestore error' }),
      );
    });

    it('should set isLoading to false on error', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('fail'));
      await service.load('DEV1');
      expect(service.isLoading).toBeFalse();
    });

    it('should leave groups empty on error', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('fail'));
      await service.load('DEV1');
      expect(service.groups).toEqual([]);
    });

    it('should still store device code on error', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('fail'));
      await service.load('DEV1');
      expect((service as any).loadedDeviceCode).toBe('DEV1');
    });
  });

  // ── Logging ──
  describe('logging', () => {
    it('should log debug on success', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'G', photo: '' }]),
      );
      await service.load('DEV1');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device groups loaded', {
        deviceCode: 'DEV1',
        count: 1,
      });
    });

    it('should log correct count for multiple groups', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([
          { id: 'G1', name: 'G1', photo: '' },
          { id: 'G2', name: 'G2', photo: '' },
          { id: 'G3', name: 'G3', photo: '' },
        ]),
      );
      await service.load('DEV1');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device groups loaded', {
        deviceCode: 'DEV1',
        count: 3,
      });
    });

    it('should not log on cache hit', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'G', photo: '' }]),
      );
      await service.load('DEV1');
      mockLoggerService.debug.calls.reset();

      await service.load('DEV1');
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });
  });

  // ── reset() ──
  describe('reset()', () => {
    it('should clear groups', () => {
      service.groups = [{ id: 'G1', name: 'G', groupPhoto: '' }];
      service.reset();
      expect(service.groups).toEqual([]);
    });

    it('should set isLoading to false', () => {
      service.isLoading = true;
      service.reset();
      expect(service.isLoading).toBeFalse();
    });

    it('should clear loadedDeviceCode', () => {
      (service as any).loadedDeviceCode = 'DEV1';
      service.reset();
      expect((service as any).loadedDeviceCode).toBe('');
    });

    it('should allow reloading after reset', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'G', photo: '' }]),
      );
      await service.load('DEV1');
      service.reset();
      expect(service.groups).toEqual([]);

      await service.load('DEV1');
      expect(service.groups.length).toBe(1);
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('should handle empty device code', async () => {
      await service.load('');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledWith('devices/', 'Sklopovi');
    });

    it('should handle device code with special characters', async () => {
      await service.load('DEV-001/A');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledWith('devices/DEV-001/A', 'Sklopovi');
    });

    it('should handle large number of groups', async () => {
      const groups = Array.from({ length: 50 }, (_, i) => ({ id: `G${i}`, name: `Group ${i}`, photo: '' }));
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(createGroupResult(groups));
      await service.load('DEV1');
      expect(service.groups.length).toBe(50);
    });

    it('should handle group with unicode name', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'Компресор', photo: '' }]),
      );
      await service.load('DEV1');
      expect(service.groups[0].name).toBe('Компресор');
    });

    it('should handle consecutive loads for different devices', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G1', name: 'First', photo: '' }]),
      );
      await service.load('DEV1');

      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createGroupResult([{ id: 'G2', name: 'Second', photo: '' }]),
      );
      await service.load('DEV2');

      expect(service.groups.length).toBe(1);
      expect(service.groups[0].name).toBe('Second');
      expect((service as any).loadedDeviceCode).toBe('DEV2');
    });
  });
});
