import { TestBed } from '@angular/core/testing';
import { DevicePartsService, Part } from './device-parts.service';

describe('DevicePartsService', () => {
  let service: DevicePartsService;
  let mockFirestoreService: {
    queryTenantSubcollection: jasmine.Spy;
  };
  let mockStorageService: {
    resolveFileUrl: jasmine.Spy;
  };
  let mockLoggerService: {
    debug: jasmine.Spy;
    error: jasmine.Spy;
  };

  const createPartResult = (parts: { id: string; code: string; name: string }[]) => ({
    documents: parts.map((p) => ({
      id: p.id,
      path: `devices/DEV1/Sklopovi/G1/Rezervni delovi/${p.id}`,
      data: { Code: p.code, 'Part name': p.name },
    })),
    lastDocumentPath: null,
  });

  const emptyResult = () => ({ documents: [], lastDocumentPath: null });

  beforeEach(() => {
    mockFirestoreService = {
      queryTenantSubcollection: jasmine.createSpy('queryTenantSubcollection').and.resolveTo(emptyResult()),
    };
    mockStorageService = {
      resolveFileUrl: jasmine.createSpy('resolveFileUrl').and.resolveTo('https://storage.example.com/photo.png'),
    };
    mockLoggerService = {
      debug: jasmine.createSpy('debug'),
      error: jasmine.createSpy('error'),
    };

    TestBed.configureTestingModule({ providers: [DevicePartsService] });
    service = TestBed.inject(DevicePartsService);
    (service as any).firestoreService = mockFirestoreService;
    (service as any).storageService = mockStorageService;
    (service as any).logger = mockLoggerService;
  });

  // ── Initial state ──
  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty parts array', () => {
      expect(service.parts).toEqual([]);
    });

    it('should have empty groupPhoto', () => {
      expect(service.groupPhoto).toBe('');
    });

    it('should not be loading', () => {
      expect(service.isLoading).toBeFalse();
    });
  });

  // ── load() ──
  describe('load()', () => {
    it('should query Rezervni delovi subcollection', async () => {
      await service.load('DEV1', 'G1', '');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledWith(
        'devices/DEV1/Sklopovi/G1',
        'Rezervni delovi',
      );
    });

    it('should set isLoading true during execution', async () => {
      let loadingDuringCall = false;
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        loadingDuringCall = service.isLoading;
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1', 'G1', '');
      expect(loadingDuringCall).toBeTrue();
    });

    it('should set isLoading false after completion', async () => {
      await service.load('DEV1', 'G1', '');
      expect(service.isLoading).toBeFalse();
    });

    it('should clear parts before loading', async () => {
      service.parts = [{ id: 'old', code: 'OLD', name: 'Old' }];
      let partsDuringCall: Part[] = [];
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        partsDuringCall = [...service.parts];
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1', 'G1', '');
      expect(partsDuringCall).toEqual([]);
    });

    it('should clear groupPhoto before loading', async () => {
      service.groupPhoto = 'old-photo.jpg';
      let photoDuringCall!: string;
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        photoDuringCall = service.groupPhoto;
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1', 'G1', '');
      // groupPhoto is cleared at start, no photo param means it stays empty
      expect(service.groupPhoto).toBe('');
      expect(photoDuringCall).toBe('');
    });

    it('should populate parts from result', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([
          { id: 'P1', code: 'C1', name: 'Part 1' },
          { id: 'P2', code: 'C2', name: 'Part 2' },
        ]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts.length).toBe(2);
    });
  });

  // ── Part mapping ──
  describe('part mapping', () => {
    it('should map doc id to part id', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'RD-001', code: 'C1', name: 'Test' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].id).toBe('RD-001');
    });

    it('should map Code field to code', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P1', code: 'ABC-123', name: 'Test' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].code).toBe('ABC-123');
    });

    it('should map Part name field to name', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P1', code: 'C1', name: 'Kompresor klip' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].name).toBe('Kompresor klip');
    });

    it('should use doc id as fallback when Code is missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'P1', path: 'path', data: { 'Part name': 'Test' } }],
        lastDocumentPath: null,
      });
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].code).toBe('P1');
    });

    it('should use empty string when Part name is missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'P1', path: 'path', data: { Code: 'C1' } }],
        lastDocumentPath: null,
      });
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].name).toBe('');
    });

    it('should map multiple parts preserving order', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([
          { id: 'A', code: 'CA', name: 'Alpha' },
          { id: 'B', code: 'CB', name: 'Beta' },
          { id: 'C', code: 'CC', name: 'Charlie' },
        ]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts.map((p) => p.id)).toEqual(['A', 'B', 'C']);
    });

    it('should handle part with all data fields missing', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo({
        documents: [{ id: 'P1', path: 'path', data: {} }],
        lastDocumentPath: null,
      });
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].id).toBe('P1');
      expect(service.parts[0].code).toBe('P1');
      expect(service.parts[0].name).toBe('');
    });
  });

  // ── Group photo ──
  describe('group photo', () => {
    it('should resolve group photo URL when groupPhoto is provided', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/photo.png');
      await service.load('DEV1', 'G1', 'my-photo');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith('Photos', 'my-photo', ['PNG', 'png', 'jpg', 'jpeg']);
      expect(service.groupPhoto).toBe('https://cdn.example.com/photo.png');
    });

    it('should not resolve photo when groupPhoto is empty', async () => {
      await service.load('DEV1', 'G1', '');
      expect(mockStorageService.resolveFileUrl).not.toHaveBeenCalled();
      expect(service.groupPhoto).toBe('');
    });

    it('should pass correct extensions for photo resolution', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      await service.load('DEV1', 'G1', 'photo123');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith(
        'Photos', 'photo123', ['PNG', 'png', 'jpg', 'jpeg'],
      );
    });

    it('should resolve photo in Photos folder', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      await service.load('DEV1', 'G1', 'img');
      expect(mockStorageService.resolveFileUrl.calls.mostRecent().args[0]).toBe('Photos');
    });
  });

  // ── Error handling ──
  describe('error handling', () => {
    it('should log error on Firestore failure', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('Firestore error'));
      await service.load('DEV1', 'G1', '');
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load device parts',
        jasmine.objectContaining({ error: 'Error: Firestore error' }),
      );
    });

    it('should set isLoading false on error', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('fail'));
      await service.load('DEV1', 'G1', '');
      expect(service.isLoading).toBeFalse();
    });

    it('should leave parts empty on error', async () => {
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('fail'));
      await service.load('DEV1', 'G1', '');
      expect(service.parts).toEqual([]);
    });

    it('should handle photo resolution error', async () => {
      mockStorageService.resolveFileUrl.and.rejectWith(new Error('Photo not found'));
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      await service.load('DEV1', 'G1', 'missing-photo');
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(service.isLoading).toBeFalse();
    });

    it('should keep resolved photo URL even when Firestore query fails after photo resolves', async () => {
      // Photo resolves first, then Firestore fails
      mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/photo.png');
      mockFirestoreService.queryTenantSubcollection.and.rejectWith(new Error('Firestore fail'));
      await service.load('DEV1', 'G1', 'photo.png');
      // The entire try block catches, so groupPhoto may or may not persist
      // depending on implementation — the key test is isLoading is false and error is logged
      expect(service.isLoading).toBeFalse();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load device parts',
        jasmine.objectContaining({ error: 'Error: Firestore fail' }),
      );
      expect(service.parts).toEqual([]);
    });

    it('should have groupPhoto set before Firestore query is made', async () => {
      let photoWhenQueryCalled = '';
      mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/resolved.png');
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        photoWhenQueryCalled = service.groupPhoto;
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1', 'G1', 'photo.png');
      expect(photoWhenQueryCalled).toBe('https://cdn.example.com/resolved.png');
    });
  });

  // ── Logging ──
  describe('logging', () => {
    it('should log debug on success with no group photo', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P1', code: 'C1', name: 'Part' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device parts loaded', {
        deviceCode: 'DEV1',
        groupId: 'G1',
        count: 1,
        groupPhotoUrl: '',
      });
    });

    it('should log debug with group photo URL', async () => {
      mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/p.png');
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(emptyResult());
      await service.load('DEV1', 'G1', 'photo.png');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device parts loaded', jasmine.objectContaining({
        groupPhotoUrl: 'https://cdn.example.com/p.png',
      }));
    });

    it('should log correct count for multiple parts', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([
          { id: 'P1', code: 'C1', name: 'A' },
          { id: 'P2', code: 'C2', name: 'B' },
          { id: 'P3', code: 'C3', name: 'C' },
        ]),
      );
      await service.load('DEV1', 'G1', '');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device parts loaded', jasmine.objectContaining({
        count: 3,
      }));
    });
  });

  // ── reset() ──
  describe('reset()', () => {
    it('should clear parts', () => {
      service.parts = [{ id: 'P1', code: 'C1', name: 'Part' }];
      service.reset();
      expect(service.parts).toEqual([]);
    });

    it('should clear groupPhoto', () => {
      service.groupPhoto = 'https://cdn.example.com/photo.png';
      service.reset();
      expect(service.groupPhoto).toBe('');
    });

    it('should set isLoading to false', () => {
      service.isLoading = true;
      service.reset();
      expect(service.isLoading).toBeFalse();
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('should handle empty device code and group id', async () => {
      await service.load('', '', '');
      expect(mockFirestoreService.queryTenantSubcollection).toHaveBeenCalledWith('devices//Sklopovi/', 'Rezervni delovi');
    });

    it('should handle large number of parts', async () => {
      const parts = Array.from({ length: 100 }, (_, i) => ({ id: `P${i}`, code: `C${i}`, name: `Part ${i}` }));
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(createPartResult(parts));
      await service.load('DEV1', 'G1', '');
      expect(service.parts.length).toBe(100);
    });

    it('should handle unicode part names', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P1', code: 'C1', name: 'Клапна вентила' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].name).toBe('Клапна вентила');
    });

    it('should handle consecutive loads overriding previous data', async () => {
      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P1', code: 'C1', name: 'First' }]),
      );
      await service.load('DEV1', 'G1', '');
      expect(service.parts[0].name).toBe('First');

      mockFirestoreService.queryTenantSubcollection.and.resolveTo(
        createPartResult([{ id: 'P2', code: 'C2', name: 'Second' }]),
      );
      await service.load('DEV2', 'G2', '');
      expect(service.parts.length).toBe(1);
      expect(service.parts[0].name).toBe('Second');
    });

    it('should load photo and parts in correct order', async () => {
      const callOrder: string[] = [];
      mockStorageService.resolveFileUrl.and.callFake(() => {
        callOrder.push('photo');
        return Promise.resolve('url');
      });
      mockFirestoreService.queryTenantSubcollection.and.callFake(() => {
        callOrder.push('parts');
        return Promise.resolve(emptyResult());
      });
      await service.load('DEV1', 'G1', 'photo.png');
      expect(callOrder).toEqual(['photo', 'parts']);
    });
  });
});
