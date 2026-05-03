import { TestBed } from '@angular/core/testing';
import { DeviceSearchService } from './device-search.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { Device, DeviceType } from '../../../shared/models/device.model';

describe('DeviceSearchService', () => {
  let service: DeviceSearchService;
  let mockFirestoreService: {
    queryTenantCollection: jasmine.Spy;
  };
  let mockLoggerService: {
    debug: jasmine.Spy;
    warn: jasmine.Spy;
    error: jasmine.Spy;
  };
  let mockTenantService: {
    getAllowedDeviceTypes: jasmine.Spy;
  };

  const ALLOWED_TYPES = [DeviceType.HEAT_PUMP, DeviceType.BOILER, DeviceType.GAS_BOILER];

  const createQueryResult = (devices: { id: string; name: string; code: string }[], lastPath: string | null = null) => ({
    documents: devices.map((d) => ({
      id: d.id,
      path: `devices/${d.id}`,
      data: {
        'Device Name': d.name,
        'Device code': d.code,
        'Device type': DeviceType.HEAT_PUMP,
      },
    })),
    lastDocumentPath: lastPath,
  });

  const emptyResult = () => ({ documents: [], lastDocumentPath: null });

  beforeEach(() => {
    mockFirestoreService = {
      queryTenantCollection: jasmine.createSpy('queryTenantCollection').and.resolveTo(emptyResult()),
    };
    mockLoggerService = {
      debug: jasmine.createSpy('debug'),
      warn: jasmine.createSpy('warn'),
      error: jasmine.createSpy('error'),
    };
    mockTenantService = {
      getAllowedDeviceTypes: jasmine.createSpy('getAllowedDeviceTypes').and.returnValue(ALLOWED_TYPES),
    };

    TestBed.configureTestingModule({
      providers: [
        DeviceSearchService,
        { provide: TenantService, useValue: mockTenantService },
      ],
    });

    // Create service and inject mocks via private field override
    service = TestBed.inject(DeviceSearchService);
    (service as any).firestoreService = mockFirestoreService;
    (service as any).logger = mockLoggerService;
    (service as any).tenantService = mockTenantService;
  });

  // ── Initial state ──
  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty devices array', () => {
      expect(service.devices).toEqual([]);
    });

    it('should not be loading', () => {
      expect(service.isLoading).toBeFalse();
    });

    it('should not have more results', () => {
      expect(service.hasMore).toBeFalse();
    });

    it('should not keep state', () => {
      expect(service.keepState).toBeFalse();
    });
  });

  // ── search() ──
  describe('search()', () => {
    it('should reset and return for empty string', async () => {
      service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];
      await service.search('');
      expect(service.devices).toEqual([]);
      expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
    });

    it('should reset and return for whitespace-only string', async () => {
      await service.search('   ');
      expect(service.devices).toEqual([]);
      expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
    });

    it('should reset and return for single character', async () => {
      await service.search('A');
      expect(service.devices).toEqual([]);
      expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
    });

    it('should search for 2+ characters', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'DEVICE AB', code: 'AB' }]),
      );
      await service.search('AB');
      expect(mockFirestoreService.queryTenantCollection).toHaveBeenCalled();
      expect(service.devices.length).toBe(1);
    });

    it('should normalize search term to uppercase', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('abc');
      const callArgs = mockFirestoreService.queryTenantCollection.calls.mostRecent().args;
      const filter = callArgs[1].compositeFilter;
      expect(filter.queryConstraints[0].queryConstraints[0].value).toBe('ABC');
    });

    it('should trim search term', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('  ab  ');
      const callArgs = mockFirestoreService.queryTenantCollection.calls.mostRecent().args;
      const filter = callArgs[1].compositeFilter;
      expect(filter.queryConstraints[0].queryConstraints[0].value).toBe('AB');
    });

    it('should clear previous devices on new search', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'FIRST', code: 'F1' }]),
      );
      await service.search('FIRST');
      expect(service.devices.length).toBe(1);

      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '2', name: 'SECOND', code: 'S1' }]),
      );
      await service.search('SECOND');
      expect(service.devices.length).toBe(1);
      expect(service.devices[0].name).toBe('SECOND');
    });

    it('should set isLoading to true during execution', async () => {
      let loadingDuringExecution = false;
      mockFirestoreService.queryTenantCollection.and.callFake(() => {
        loadingDuringExecution = service.isLoading;
        return Promise.resolve(emptyResult());
      });
      await service.search('AB');
      expect(loadingDuringExecution).toBeTrue();
    });

    it('should set isLoading to false after completion', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      expect(service.isLoading).toBeFalse();
    });

    it('should use composite OR filter for name and code', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('TEST');
      const callArgs = mockFirestoreService.queryTenantCollection.calls.mostRecent().args;
      const filter = callArgs[1].compositeFilter;
      expect(filter.type).toBe('or');
      expect(filter.queryConstraints.length).toBe(2);
      expect(filter.queryConstraints[0].type).toBe('and');
      expect(filter.queryConstraints[1].type).toBe('and');
    });

    it('should query Device Name with >= and <= range', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('TEST');
      const filter = mockFirestoreService.queryTenantCollection.calls.mostRecent().args[1].compositeFilter;
      const nameFilter = filter.queryConstraints[0].queryConstraints;
      expect(nameFilter[0].fieldPath).toBe('Device Name');
      expect(nameFilter[0].opStr).toBe('>=');
      expect(nameFilter[0].value).toBe('TEST');
      expect(nameFilter[1].fieldPath).toBe('Device Name');
      expect(nameFilter[1].opStr).toBe('<=');
      expect(nameFilter[1].value).toBe('TEST\uf8ff');
    });

    it('should query Device code with >= and <= range', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('TEST');
      const filter = mockFirestoreService.queryTenantCollection.calls.mostRecent().args[1].compositeFilter;
      const codeFilter = filter.queryConstraints[1].queryConstraints;
      expect(codeFilter[0].fieldPath).toBe('Device code');
      expect(codeFilter[0].opStr).toBe('>=');
      expect(codeFilter[0].value).toBe('TEST');
      expect(codeFilter[1].fieldPath).toBe('Device code');
      expect(codeFilter[1].opStr).toBe('<=');
      expect(codeFilter[1].value).toBe('TEST\uf8ff');
    });

    it('should pass limit of 20 in query constraints', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      const constraints = mockFirestoreService.queryTenantCollection.calls.mostRecent().args[1].queryConstraints;
      expect(constraints).toContain(jasmine.objectContaining({ type: 'limit', limit: 20 }));
    });

    it('should query devices collection', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      expect(mockFirestoreService.queryTenantCollection.calls.mostRecent().args[0]).toBe('devices');
    });
  });

  // ── Device mapping ──
  describe('device mapping', () => {
    it('should map Device Name to name', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'My Device', code: 'D1' }]),
      );
      await service.search('MY');
      expect(service.devices[0].name).toBe('My Device');
    });

    it('should map Device code to code', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'Dev', code: 'ABC123' }]),
      );
      await service.search('AB');
      expect(service.devices[0].code).toBe('ABC123');
    });

    it('should use doc id as fallback when Device code is missing', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [{ id: 'doc-id-123', path: 'devices/doc-id-123', data: { 'Device Name': 'Test', 'Device type': DeviceType.HEAT_PUMP } }],
        lastDocumentPath: null,
      });
      await service.search('TE');
      expect(service.devices[0].code).toBe('doc-id-123');
    });

    it('should use empty string as fallback when Device Name is missing', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [{ id: '1', path: 'devices/1', data: { 'Device code': 'X1', 'Device type': DeviceType.HEAT_PUMP } }],
        lastDocumentPath: null,
      });
      await service.search('X1');
      expect(service.devices[0].name).toBe('');
    });

    it('should map Device type', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'Dev', code: 'D1' }]),
      );
      await service.search('DE');
      expect(service.devices[0].type).toBe(DeviceType.HEAT_PUMP);
    });

    it('should set subType to empty string', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'Dev', code: 'D1' }]),
      );
      await service.search('DE');
      expect(service.devices[0].subType).toBe('');
    });

    it('should set unitCount to 0', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'Dev', code: 'D1' }]),
      );
      await service.search('DE');
      expect(service.devices[0].unitCount).toBe(0);
    });

    it('should set exists to true', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'Dev', code: 'D1' }]),
      );
      await service.search('DE');
      expect(service.devices[0].exists).toBeTrue();
    });

    it('should map multiple devices', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([
          { id: '1', name: 'Device A', code: 'DA' },
          { id: '2', name: 'Device B', code: 'DB' },
          { id: '3', name: 'Device C', code: 'DC' },
        ]),
      );
      await service.search('DE');
      expect(service.devices.length).toBe(3);
      expect(service.devices.map((d) => d.code)).toEqual(['DA', 'DB', 'DC']);
    });
  });

  // ── Pagination (hasMore) ──
  describe('pagination', () => {
    it('should set hasMore to true when result count equals PAGE_SIZE', async () => {
      const devices = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult(devices, 'devices/19'),
      );
      await service.search('AB');
      expect(service.hasMore).toBeTrue();
    });

    it('should set hasMore to false when result count is less than PAGE_SIZE', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'D1', code: 'C1' }]),
      );
      await service.search('AB');
      expect(service.hasMore).toBeFalse();
    });

    it('should set hasMore to false when no results', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      expect(service.hasMore).toBeFalse();
    });

    it('should store lastDocumentPath from result', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'D1', code: 'C1' }], 'devices/1'),
      );
      await service.search('AB');
      expect((service as any).lastDocumentPath).toBe('devices/1');
    });

    it('should reset lastDocumentPath on new search', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'D1', code: 'C1' }], 'devices/1'),
      );
      await service.search('AB');
      expect((service as any).lastDocumentPath).toBe('devices/1');

      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('CD');
      expect((service as any).lastDocumentPath).toBeNull();
    });
  });

  // ── loadMore() ──
  describe('loadMore()', () => {
    it('should not call API when isLoading is true', async () => {
      service.isLoading = true;
      service.hasMore = true;
      await service.loadMore();
      expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
    });

    it('should not call API when hasMore is false', async () => {
      service.hasMore = false;
      await service.loadMore();
      expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
    });

    it('should append results to existing devices', async () => {
      // First search returns page 1
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');
      expect(service.devices.length).toBe(20);

      // Load more returns page 2
      const page2 = [{ id: '20', name: 'D20', code: 'C20' }, { id: '21', name: 'D21', code: 'C21' }];
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page2));
      await service.loadMore();
      expect(service.devices.length).toBe(22);
    });

    it('should include startAfter constraint when loading more', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');

      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.loadMore();

      const lastCallArgs = mockFirestoreService.queryTenantCollection.calls.mostRecent().args;
      const constraints = lastCallArgs[1].queryConstraints;
      expect(constraints).toContain(jasmine.objectContaining({ type: 'startAfter', reference: 'devices/19' }));
    });

    it('should not include startAfter on first page', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      const constraints = mockFirestoreService.queryTenantCollection.calls.mostRecent().args[1].queryConstraints;
      const startAfter = constraints.find((c: any) => c.type === 'startAfter');
      expect(startAfter).toBeUndefined();
    });

    it('should update hasMore after loadMore', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');
      expect(service.hasMore).toBeTrue();

      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '20', name: 'D20', code: 'C20' }]),
      );
      await service.loadMore();
      expect(service.hasMore).toBeFalse();
    });
  });

  // ── Stale search protection ──
  describe('stale search protection', () => {
    it('should ignore results from outdated search', async () => {
      let resolveFirst!: (value: any) => void;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });

      mockFirestoreService.queryTenantCollection.and.callFake(() => firstPromise);
      const firstSearch = service.search('FIRST');

      // Start second search before first resolves
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '2', name: 'SECOND', code: 'S2' }]),
      );
      await service.search('SECOND');

      // Now resolve the first search
      resolveFirst(createQueryResult([{ id: '1', name: 'FIRST', code: 'F1' }]));
      await firstSearch;

      // Should only have second search results
      expect(service.devices.length).toBe(1);
      expect(service.devices[0].name).toBe('SECOND');
    });

    it('should not update isLoading for stale search', async () => {
      let resolveFirst!: (value: any) => void;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });

      mockFirestoreService.queryTenantCollection.and.callFake(() => firstPromise);
      const firstSearch = service.search('FIRST');

      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('SECOND');
      expect(service.isLoading).toBeFalse();

      resolveFirst(emptyResult());
      await firstSearch;
      expect(service.isLoading).toBeFalse();
    });

    it('should ignore error from stale search', async () => {
      let rejectFirst!: (error: any) => void;
      const firstPromise = new Promise((_, reject) => { rejectFirst = reject; });

      mockFirestoreService.queryTenantCollection.and.callFake(() => firstPromise);
      const firstSearch = service.search('FIRST');

      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '2', name: 'SECOND', code: 'S2' }]),
      );
      await service.search('SECOND');

      rejectFirst(new Error('stale'));
      await firstSearch;

      // Error should not be logged for stale search
      expect(mockLoggerService.error).not.toHaveBeenCalled();
      expect(service.devices.length).toBe(1);
    });
  });

  // ── Error handling ──
  describe('error handling', () => {
    it('should log error on API failure', async () => {
      mockFirestoreService.queryTenantCollection.and.rejectWith(new Error('Network error'));
      await service.search('AB');
      expect(mockLoggerService.error).toHaveBeenCalledWith('Device search failed', jasmine.objectContaining({ error: 'Error: Network error' }));
    });

    it('should set isLoading to false on error', async () => {
      mockFirestoreService.queryTenantCollection.and.rejectWith(new Error('fail'));
      await service.search('AB');
      expect(service.isLoading).toBeFalse();
    });

    it('should preserve existing devices on loadMore error', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');
      expect(service.devices.length).toBe(20);

      mockFirestoreService.queryTenantCollection.and.rejectWith(new Error('fail'));
      await service.loadMore();
      expect(service.devices.length).toBe(20);
    });

    it('should not set hasMore on error', async () => {
      mockFirestoreService.queryTenantCollection.and.rejectWith(new Error('fail'));
      await service.search('AB');
      expect(service.hasMore).toBeFalse();
    });
  });

  // ── Logging ──
  describe('logging', () => {
    it('should log debug on successful search', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'D1', code: 'C1' }]),
      );
      await service.search('AB');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device search results', jasmine.objectContaining({
        term: 'AB',
        fetched: 1,
        total: 1,
      }));
    });

    it('should log cumulative total on loadMore', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');

      const page2 = [{ id: '20', name: 'D20', code: 'C20' }];
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page2));
      await service.loadMore();

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Device search results', jasmine.objectContaining({
        fetched: 1,
        total: 21,
      }));
    });

    it('should not log on empty search (below min length)', async () => {
      await service.search('A');
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });
  });

  // ── reset() ──
  describe('reset()', () => {
    it('should clear devices', () => {
      service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];
      service.reset();
      expect(service.devices).toEqual([]);
    });

    it('should set isLoading to false', () => {
      service.isLoading = true;
      service.reset();
      expect(service.isLoading).toBeFalse();
    });

    it('should set hasMore to false', () => {
      service.hasMore = true;
      service.reset();
      expect(service.hasMore).toBeFalse();
    });

    it('should clear searchTerm', () => {
      (service as any).searchTerm = 'TEST';
      service.reset();
      expect((service as any).searchTerm).toBe('');
    });

    it('should clear lastDocumentPath', () => {
      (service as any).lastDocumentPath = 'some/path';
      service.reset();
      expect((service as any).lastDocumentPath).toBeNull();
    });

    it('should increment currentSearchId to invalidate in-flight requests', () => {
      const before = (service as any).currentSearchId;
      service.reset();
      expect((service as any).currentSearchId).toBe(before + 1);
    });

    it('should fully reset after a search', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');
      expect(service.devices.length).toBe(20);

      service.reset();
      expect(service.devices).toEqual([]);
      expect(service.isLoading).toBeFalse();
      expect(service.hasMore).toBeFalse();
    });
  });

  // ── keepState flag ──
  describe('keepState', () => {
    it('should default to false', () => {
      expect(service.keepState).toBeFalse();
    });

    it('should be settable to true', () => {
      service.keepState = true;
      expect(service.keepState).toBeTrue();
    });

    it('should not be affected by reset', () => {
      service.keepState = true;
      service.reset();
      expect(service.keepState).toBeTrue();
    });
  });

  // ── Intermediate state during async execution ──
  describe('intermediate state', () => {
    it('should clear devices immediately when search starts', async () => {
      service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];
      let devicesWhenCalled: Device[] = [];
      mockFirestoreService.queryTenantCollection.and.callFake(() => {
        devicesWhenCalled = [...service.devices];
        return Promise.resolve(emptyResult());
      });
      await service.search('AB');
      expect(devicesWhenCalled).toEqual([]);
    });

    it('should set isLoading before API call', async () => {
      let wasLoading = false;
      mockFirestoreService.queryTenantCollection.and.callFake(() => {
        wasLoading = service.isLoading;
        return Promise.resolve(emptyResult());
      });
      await service.search('AB');
      expect(wasLoading).toBeTrue();
    });

    it('should have correct lastDocumentPath as null during first search', async () => {
      let pathDuringCall: string | null = 'not-null';
      mockFirestoreService.queryTenantCollection.and.callFake(() => {
        pathDuringCall = (service as any).lastDocumentPath;
        return Promise.resolve(emptyResult());
      });
      await service.search('AB');
      expect(pathDuringCall).toBeNull();
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('should handle search term with exactly 2 characters', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      expect(mockFirestoreService.queryTenantCollection).toHaveBeenCalled();
    });

    it('should handle special characters in search term', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('A-B/C');
      expect(mockFirestoreService.queryTenantCollection).toHaveBeenCalled();
    });

    it('should handle unicode characters in search term', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('ŠĐ');
      const filter = mockFirestoreService.queryTenantCollection.calls.mostRecent().args[1].compositeFilter;
      expect(filter.queryConstraints[0].queryConstraints[0].value).toBe('ŠĐ');
    });

    // BUG-02 FIXED: mapToDevice returns null when Device type is missing,
    // device is filtered out before the allowedTypes check, warning is logged.
    it('should skip device with all fields missing and log warning', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [{ id: 'orphan', path: 'devices/orphan', data: {} }],
        lastDocumentPath: null,
      });
      await service.search('OR');
      expect(service.devices.length).toBe(0);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'DeviceSearchService: skipping device with missing type',
        { id: 'orphan' },
      );
    });

    it('should handle rapid sequential searches', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AA');
      await service.search('BB');
      await service.search('CC');
      // Last search should be the active one
      expect((service as any).searchTerm).toBe('CC');
    });

    it('should handle search after reset', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([{ id: '1', name: 'After Reset', code: 'AR' }]),
      );
      service.reset();
      await service.search('AF');
      expect(service.devices.length).toBe(1);
      expect(service.devices[0].name).toBe('After Reset');
    });
  });

  // ── allowedTypes filter ──
  describe('allowedTypes filter', () => {
    it('should filter devices whose type is not in allowedTypes', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [
          { id: '1', path: 'devices/1', data: { 'Device Name': 'A', 'Device code': 'A1', 'Device type': DeviceType.HEAT_PUMP } },
          { id: '2', path: 'devices/2', data: { 'Device Name': 'B', 'Device code': 'B1', 'Device type': 'unknown_type' } },
          { id: '3', path: 'devices/3', data: { 'Device Name': 'C', 'Device code': 'C1', 'Device type': DeviceType.BOILER } },
        ],
        lastDocumentPath: null,
      });
      await service.search('AB');
      // Only heat_pump and boiler are in ALLOWED_TYPES — unknown_type is excluded
      expect(service.devices.length).toBe(2);
      expect(service.devices.map(d => d.type)).toEqual([DeviceType.HEAT_PUMP, DeviceType.BOILER]);
    });

    it('should return empty array when no devices match allowedTypes', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [
          { id: '1', path: 'devices/1', data: { 'Device Name': 'A', 'Device code': 'A1', 'Device type': 'forbidden_type' } },
        ],
        lastDocumentPath: null,
      });
      await service.search('AB');
      expect(service.devices.length).toBe(0);
    });

    it('should call getAllowedDeviceTypes on each search', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AB');
      await service.search('CD');
      expect(mockTenantService.getAllowedDeviceTypes).toHaveBeenCalledTimes(2);
    });

    it('should pass all devices when all types are allowed', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(
        createQueryResult([
          { id: '1', name: 'D1', code: 'C1' },
          { id: '2', name: 'D2', code: 'C2' },
        ]),
      );
      // DeviceType.HEAT_PUMP is in ALLOWED_TYPES
      await service.search('AB');
      expect(service.devices.length).toBe(2);
    });

    it('should filter devices before appending on loadMore', async () => {
      const page1 = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, 'devices/19'));
      await service.search('DE');

      // Page 2 has mixed types — only allowed ones should be appended
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [
          { id: '20', path: 'devices/20', data: { 'Device Name': 'Allowed', 'Device code': 'A20', 'Device type': DeviceType.HEAT_PUMP } },
          { id: '21', path: 'devices/21', data: { 'Device Name': 'Blocked', 'Device code': 'B21', 'Device type': 'forbidden' } },
        ],
        lastDocumentPath: null,
      });
      await service.loadMore();

      expect(service.devices.length).toBe(21); // 20 + 1 allowed
      expect(service.devices[20].name).toBe('Allowed');
    });

    // BUG-02 FIXED: mapToDevice returns null when 'Device type' field is absent,
    // device is excluded from results, warning is logged with device id.
    it('[BUG-02 fixed] should skip device with missing Device type field and log warning', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo({
        documents: [
          { id: 'no-type', path: 'devices/no-type', data: { 'Device Name': 'NoType', 'Device code': 'NT1' } },
        ],
        lastDocumentPath: null,
      });
      await service.search('NT');
      expect(service.devices.length).toBe(0);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'DeviceSearchService: skipping device with missing type',
        { id: 'no-type' },
      );
    });
  });

  // ── clear() ── (Clearable interface)
  describe('clear()', () => {
    it('should clear devices', () => {
      service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];
      service.clear();
      expect(service.devices).toEqual([]);
    });

    it('should set isLoading to false', () => {
      service.isLoading = true;
      service.clear();
      expect(service.isLoading).toBeFalse();
    });

    it('should set hasMore to false', () => {
      service.hasMore = true;
      service.clear();
      expect(service.hasMore).toBeFalse();
    });

    it('should behave identically to reset()', () => {
      (service as any).searchTerm = 'TEST';
      (service as any).lastDocumentPath = 'path/to/doc';
      service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];

      service.clear();

      expect(service.devices).toEqual([]);
      expect((service as any).searchTerm).toBe('');
      expect((service as any).lastDocumentPath).toBeNull();
    });

    it('should not affect keepState flag', () => {
      service.keepState = true;
      service.clear();
      expect(service.keepState).toBeTrue();
    });
  });

  // ── EXPANSION — search() term length variations ──────────────────────────────

  describe('search() — search term length variations (parameterized)', () => {
    const belowMinLength: Array<{ term: string; desc: string }> = [
      { term: '', desc: 'empty' },
      { term: ' ', desc: 'single space' },
      { term: 'A', desc: 'single char' },
      { term: '  A  ', desc: 'whitespace around single char' },
    ];

    belowMinLength.forEach(({ term, desc }) => {
      it(`should NOT query Firestore for "${desc}"`, async () => {
        await service.search(term);
        expect(mockFirestoreService.queryTenantCollection).not.toHaveBeenCalled();
      });

      it(`should reset devices for "${desc}"`, async () => {
        service.devices = [{ code: 'X', name: 'X', type: undefined!, subType: '', unitCount: 0, exists: true }];
        await service.search(term);
        expect(service.devices).toEqual([]);
      });
    });

    const aboveMinLength: Array<{ term: string; desc: string }> = [
      { term: 'AB', desc: '2 chars' },
      { term: 'ABC', desc: '3 chars' },
      { term: 'ABCDE', desc: '5 chars' },
      { term: 'A'.repeat(50), desc: '50 chars' },
      { term: 'A'.repeat(100), desc: '100 chars' },
      { term: 'A'.repeat(500), desc: '500 chars' },
    ];

    aboveMinLength.forEach(({ term, desc }) => {
      it(`should query Firestore for "${desc}"`, async () => {
        mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
        await service.search(term);
        expect(mockFirestoreService.queryTenantCollection).toHaveBeenCalled();
      });
    });
  });

  // ── EXPANSION — search() uppercase normalization ─────────────────────────────

  describe('search() — uppercase normalization (parameterized)', () => {
    const normalizationCases: Array<{ input: string; expected: string }> = [
      { input: 'ab', expected: 'AB' },
      { input: 'abc', expected: 'ABC' },
      { input: 'Heat', expected: 'HEAT' },
      { input: 'heat pump', expected: 'HEAT PUMP' },
      { input: 'ALREADY-UPPER', expected: 'ALREADY-UPPER' },
      { input: 'mixed123', expected: 'MIXED123' },
    ];

    normalizationCases.forEach(({ input, expected }) => {
      it(`should normalize "${input}" to "${expected}"`, async () => {
        mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());

        await service.search(input);

        const callArgs = mockFirestoreService.queryTenantCollection.calls.mostRecent().args;
        const filter = callArgs[1].compositeFilter;
        const nameValue = filter.queryConstraints[0].queryConstraints[0].value;
        expect(nameValue).toBe(expected);
      });
    });
  });

  // ── EXPANSION — search() special characters ──────────────────────────────────

  describe('search() — special characters in term (parameterized)', () => {
    const specialTerms = [
      'A-B',
      'A/B',
      'A_B',
      'A B',
      'A.B',
      'šđ',
      'ŠĐ',
      'Αλφα',
      '中文',
    ];

    specialTerms.forEach((term) => {
      it(`should query Firestore for special term "${term}"`, async () => {
        mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
        await service.search(term);
        expect(mockFirestoreService.queryTenantCollection).toHaveBeenCalled();
      });
    });
  });

  // ── EXPANSION — pagination result counts ─────────────────────────────────────

  describe('search() — pagination with various result counts (parameterized)', () => {
    const resultCountCases: Array<{ count: number; hasLastPath: boolean; expectedHasMore: boolean }> = [
      { count: 0, hasLastPath: false, expectedHasMore: false },
      { count: 1, hasLastPath: false, expectedHasMore: false },
      { count: 5, hasLastPath: false, expectedHasMore: false },
      { count: 10, hasLastPath: false, expectedHasMore: false },
      { count: 19, hasLastPath: false, expectedHasMore: false },
      { count: 20, hasLastPath: true, expectedHasMore: true },
    ];

    resultCountCases.forEach(({ count, hasLastPath, expectedHasMore }) => {
      it(`${count} results should set hasMore=${expectedHasMore}`, async () => {
        const devices = Array.from({ length: count }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
        const lastPath = hasLastPath ? `devices/${count - 1}` : null;
        mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(devices, lastPath));

        await service.search('AB');

        expect(service.hasMore).toBe(expectedHasMore);
        expect(service.devices.length).toBe(count);
      });
    });
  });

  // ── EXPANSION — loadMore appending various pages ─────────────────────────────

  describe('loadMore() — appending scenarios (parameterized)', () => {
    const appendScenarios: Array<{ page1Count: number; page2Count: number }> = [
      { page1Count: 20, page2Count: 1 },
      { page1Count: 20, page2Count: 5 },
      { page1Count: 20, page2Count: 10 },
      { page1Count: 20, page2Count: 20 },
    ];

    appendScenarios.forEach(({ page1Count, page2Count }) => {
      it(`should have ${page1Count + page2Count} devices after loading ${page1Count} + ${page2Count}`, async () => {
        const page1 = Array.from({ length: page1Count }, (_, i) => ({ id: `p1-${i}`, name: `D${i}`, code: `C${i}` }));
        mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page1, `devices/${page1Count - 1}`));
        await service.search('DE');

        const page2 = Array.from({ length: page2Count }, (_, i) => ({ id: `p2-${i}`, name: `E${i}`, code: `F${i}` }));
        const lastPath = page2Count === 20 ? `devices/p2-${page2Count - 1}` : null;
        mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page2, lastPath));
        await service.loadMore();

        expect(service.devices.length).toBe(page1Count + page2Count);
      });
    });
  });

  // ── EXPANSION — rapid sequential searches ─────────────────────────────────────

  describe('search() — rapid sequential searches', () => {
    it('should end up with last search term after 5 sequential searches', async () => {
      const terms = ['AA', 'BB', 'CC', 'DD', 'EE'];
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());

      for (const term of terms) {
        await service.search(term);
      }

      expect((service as any).searchTerm).toBe('EE');
    });

    it('should have isLoading=false after 3 rapid sequential searches', async () => {
      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('AA');
      await service.search('BB');
      await service.search('CC');
      expect(service.isLoading).toBeFalse();
    });

    it('should reset lastDocumentPath on each new search', async () => {
      const page = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `D${i}`, code: `C${i}` }));
      mockFirestoreService.queryTenantCollection.and.resolveTo(createQueryResult(page, 'devices/19'));
      await service.search('AA');
      expect((service as any).lastDocumentPath).toBe('devices/19');

      mockFirestoreService.queryTenantCollection.and.resolveTo(emptyResult());
      await service.search('BB');
      expect((service as any).lastDocumentPath).toBeNull();
    });
  });

  // ── EXPANSION — device mapping for various data shapes ────────────────────────

  describe('device mapping — various data shapes (parameterized)', () => {
    const mappingCases: Array<{
      data: Record<string, any>;
      expectedName: string;
      expectedCode: string;
    }> = [
      {
        data: { 'Device Name': 'Full Device', 'Device code': 'FD-001', 'Device type': DeviceType.HEAT_PUMP },
        expectedName: 'Full Device',
        expectedCode: 'FD-001',
      },
      {
        data: { 'Device Name': 'No Code', 'Device type': DeviceType.HEAT_PUMP },
        expectedName: 'No Code',
        expectedCode: 'doc-id',  // fallback to doc id
      },
      {
        data: { 'Device code': 'CODE-ONLY', 'Device type': DeviceType.HEAT_PUMP },
        expectedName: '',  // empty fallback
        expectedCode: 'CODE-ONLY',
      },
    ];

    mappingCases.forEach(({ data, expectedName, expectedCode }) => {
      it(`should map name="${expectedName}" and code="${expectedCode}"`, async () => {
        mockFirestoreService.queryTenantCollection.and.resolveTo({
          documents: [{ id: 'doc-id', path: 'devices/doc-id', data }],
          lastDocumentPath: null,
        });

        await service.search('AB');

        expect(service.devices[0].name).toBe(expectedName);
        expect(service.devices[0].code).toBe(expectedCode);
      });
    });
  });

  // ── EXPANSION — allowedTypes filtering matrix ──────────────────────────────────

  describe('allowedTypes — filtering matrix (parameterized)', () => {
    const typeCases: Array<{ type: string; expectedCount: number; desc: string }> = [
      { type: DeviceType.HEAT_PUMP, expectedCount: 1, desc: 'HEAT_PUMP is allowed' },
      { type: DeviceType.BOILER, expectedCount: 1, desc: 'BOILER is allowed' },
      { type: DeviceType.GAS_BOILER, expectedCount: 1, desc: 'GAS_BOILER is in ALLOWED_TYPES' },
      { type: 'unknown_type', expectedCount: 0, desc: 'unknown type is filtered' },
      { type: 'forbidden_device', expectedCount: 0, desc: 'forbidden type is filtered' },
    ];

    typeCases.forEach(({ type, expectedCount, desc }) => {
      it(`${desc}: type="${type}" should yield ${expectedCount} results`, async () => {
        mockFirestoreService.queryTenantCollection.and.resolveTo({
          documents: [{ id: '1', path: 'devices/1', data: { 'Device Name': 'Test', 'Device code': 'T1', 'Device type': type } }],
          lastDocumentPath: null,
        });

        await service.search('TE');

        expect(service.devices.length).toBe(expectedCount);
      });
    });
  });
});
